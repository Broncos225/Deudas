
"use client";

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Trash2, PlusCircle, Users, DivideCircle, Info, Copy, Calculator } from 'lucide-react';
import { useCurrencyInput } from '@/hooks/use-currency-input';
import { useAppData } from '@/contexts/app-data-context';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import DashboardHeader from '@/components/dashboard-header';
import { AddDebtDialog } from '@/components/add-debt-dialog';
import { ParticipantInputRow } from '@/components/split-expenses/participant-input-row';

interface Participant {
  id: string;
  name: string;
  amountPaid: number;
  percentageToPay?: number; // Percentage of the total bill
  fixedAmountToPay?: number; // Fixed amount to pay
}

interface DebtSettlement {
  from: string;
  to: string;
  amount: number;
}

interface IndividualContribution {
    name: string;
    paid: number;
    shouldPay: number;
    balance: number;
    calculationMethod: 'fixed' | 'percentage' | 'equal' | 'none';
}

export default function SplitBillPage() {
  const { formatUserCurrency } = useAppData();
  const { toast } = useToast();
  const [totalBillAmount, setTotalBillAmount] = useState<number | undefined>(undefined);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [settlements, setSettlements] = useState<DebtSettlement[]>([]);
  const [costPerPersonSummary, setCostPerPersonSummary] = useState<IndividualContribution[]>([]);
  const [calculationError, setCalculationError] = useState<string | null>(null);

  // --- Calculator State ---
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [calculatorState, setCalculatorState] = useState({
    displayValue: '0',
    previousValue: null as number | null,
    operator: null as string | null,
    waitingForOperand: false,
  });

  const { inputProps: totalBillInputProps } = useCurrencyInput({
    initialValue: totalBillAmount,
    onChangeRHF: (value) => setTotalBillAmount(value),
  });

  // --- Calculator Logic ---
  const handleCalculatorInput = (input: string) => {
    setCalculatorState(prevState => {
      // Handle error state
      if (prevState.displayValue === 'Error') {
        return { ...prevState, displayValue: input, waitingForOperand: false };
      }

      if (input === '.') {
        if (prevState.waitingForOperand) return { ...prevState, displayValue: '0.', waitingForOperand: false };
        if (prevState.displayValue.includes('.')) return prevState;
        return { ...prevState, displayValue: prevState.displayValue + '.' };
      }

      if (prevState.waitingForOperand) {
        return { ...prevState, displayValue: input, waitingForOperand: false };
      } else {
        const newDisplayValue = prevState.displayValue === '0' ? input : prevState.displayValue + input;
        return { ...prevState, displayValue: newDisplayValue };
      }
    });
  };

  const performCalculation = (prev: number, current: number, op: string): number => {
    switch (op) {
      case '+': return prev + current;
      case '-': return prev - current;
      case '*': return prev * current;
      case '/': return current === 0 ? Infinity : prev / current; // Return Infinity for division by zero
      default: return current;
    }
  };

  const handleCalculatorOperation = (nextOperator: string) => {
    setCalculatorState(prevState => {
      const inputValue = parseFloat(prevState.displayValue);

      // If there's an error, do nothing until cleared
      if (isNaN(inputValue) || prevState.displayValue === 'Error') return prevState;

      let newPreviousValue = prevState.previousValue;

      if (newPreviousValue === null) {
        newPreviousValue = inputValue;
      } else if (prevState.operator && !prevState.waitingForOperand) {
        const result = performCalculation(newPreviousValue, inputValue, prevState.operator);
        if (!isFinite(result)) {
           return { displayValue: 'Error', previousValue: null, operator: null, waitingForOperand: true };
        }
        newPreviousValue = result;
      }

      return {
        displayValue: String(newPreviousValue),
        previousValue: newPreviousValue,
        operator: nextOperator,
        waitingForOperand: true,
      };
    });
  };

  const handleCalculatorEquals = () => {
    setCalculatorState(prevState => {
      const { operator, previousValue, displayValue } = prevState;
      const inputValue = parseFloat(displayValue);

      if (operator && previousValue !== null) {
        const result = performCalculation(previousValue, inputValue, operator);
        if (!isFinite(result)) {
          return { displayValue: 'Error', previousValue: null, operator: null, waitingForOperand: true };
        }
        return { displayValue: String(result), previousValue: null, operator: null, waitingForOperand: true };
      }
      return prevState;
    });
  };
  
  const handleCalculatorClear = () => {
    setCalculatorState({
      displayValue: '0',
      previousValue: null,
      operator: null,
      waitingForOperand: false,
    });
  };

  const handleCalculatorApply = () => {
    const finalValue = parseFloat(calculatorState.displayValue);
    if (!isNaN(finalValue) && isFinite(finalValue)) {
      setTotalBillAmount(finalValue);
    }
    setIsCalculatorOpen(false);
  };
  // --- End Calculator Logic ---


  const addParticipant = () => {
    if (newParticipantName.trim() === '') return;
    setParticipants(prev => [
      ...prev,
      { id: crypto.randomUUID(), name: newParticipantName.trim(), amountPaid: 0, percentageToPay: undefined, fixedAmountToPay: undefined },
    ]);
    setNewParticipantName('');
  };

  const removeParticipant = (id: string) => {
    setParticipants(prev => prev.filter((p) => p.id !== id));
  };

  const updateParticipant = (id: string, newValues: Partial<Omit<Participant, 'id'>>) => {
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, ...newValues } : p));
  };

  const calculateDebts = () => {
    setCalculationError(null);
    setSettlements([]);
    setCostPerPersonSummary([]);

    if (totalBillAmount === undefined || totalBillAmount <= 0) {
      setCalculationError("Por favor, ingresa un monto total de gasto válido y positivo.");
      return;
    }
    if (participants.length === 0) {
      setCalculationError("Por favor, añade al menos un participante.");
      return;
    }
    if (participants.some(p => p.name.trim() === '')) {
      setCalculationError("Todos los participantes deben tener un nombre.");
      return;
    }

    let amountCoveredByFixed = 0;
    let totalPercentageAssigned = 0;
    const participantsForEqualSplit = [];

    for (const p of participants) {
        if (p.fixedAmountToPay !== undefined && p.fixedAmountToPay > 0) {
            amountCoveredByFixed += p.fixedAmountToPay;
        } else if (p.percentageToPay !== undefined && p.percentageToPay > 0) {
            totalPercentageAssigned += p.percentageToPay;
        } else {
            participantsForEqualSplit.push(p);
        }
    }
    
    if (totalPercentageAssigned > 100.01) {
        setCalculationError(`La suma de porcentajes asignados (${totalPercentageAssigned.toFixed(2)}%) excede el 100%. Por favor, ajusta los porcentajes.`);
        return;
    }

    const amountAvailableForPercentageSplit = totalBillAmount - amountCoveredByFixed;
    if (amountAvailableForPercentageSplit < -0.01) {
        setCalculationError(`La suma de montos fijos (${formatUserCurrency(amountCoveredByFixed)}) excede el total del gasto. Por favor, ajusta los valores.`);
        return;
    }

    const amountCoveredByPercentage = (totalPercentageAssigned / 100) * amountAvailableForPercentageSplit;
    const remainingAmountToSplitEqually = amountAvailableForPercentageSplit - amountCoveredByPercentage;

    if (remainingAmountToSplitEqually < -0.01) {
        setCalculationError(`La combinación de montos fijos y porcentajes excede el total del gasto. Por favor, ajusta los valores.`);
        return;
    }

    let equalShare = 0;
    if (participantsForEqualSplit.length > 0 && remainingAmountToSplitEqually > 0) {
        equalShare = remainingAmountToSplitEqually / participantsForEqualSplit.length;
    } else if (participantsForEqualSplit.length === 0 && remainingAmountToSplitEqually > 0.01) {
        setCalculationError(`Queda un monto de ${formatUserCurrency(remainingAmountToSplitEqually)} por cubrir, pero no hay participantes para dividirlo equitativamente.`);
        return;
    }


    const individualContributions: IndividualContribution[] = participants.map(p => {
        let shouldPayAmount = 0;
        let method: IndividualContribution['calculationMethod'] = 'none';

        if (p.fixedAmountToPay !== undefined && p.fixedAmountToPay > 0) {
            shouldPayAmount = p.fixedAmountToPay;
            method = 'fixed';
        } else if (p.percentageToPay !== undefined && p.percentageToPay > 0) {
            shouldPayAmount = (p.percentageToPay / 100) * amountAvailableForPercentageSplit;
            method = 'percentage';
        } else {
            shouldPayAmount = equalShare;
            method = 'equal';
        }

        return {
            name: p.name,
            paid: p.amountPaid,
            shouldPay: shouldPayAmount,
            balance: p.amountPaid - shouldPayAmount,
            calculationMethod: method,
        };
    });

    setCostPerPersonSummary(individualContributions);

    const debtors = individualContributions.filter((p) => p.balance < -0.001).sort((a, b) => a.balance - b.balance);
    const creditors = individualContributions.filter((p) => p.balance > 0.001).sort((a, b) => b.balance - a.balance);

    const newSettlements: DebtSettlement[] = [];
    let debtorIndex = 0;
    let creditorIndex = 0;

    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];
      const amountToSettle = Math.min(Math.abs(debtor.balance), creditor.balance);

      if (amountToSettle > 0.001) {
        newSettlements.push({
          from: debtor.name,
          to: creditor.name,
          amount: amountToSettle,
        });
        debtor.balance += amountToSettle;
        creditor.balance -= amountToSettle;
      }

      if (Math.abs(debtor.balance) < 0.01) debtorIndex++;
      if (creditor.balance < 0.01) creditorIndex++;
    }
    setSettlements(newSettlements);
  };
  
  const totalPaidByParticipants = participants.reduce((sum, p) => sum + p.amountPaid, 0);
  const differenceFromTotalBill = totalBillAmount !== undefined ? totalPaidByParticipants - totalBillAmount : 0;

  const generateSummaryText = (): string => {
    if (!totalBillAmount || costPerPersonSummary.length === 0) return "No hay datos para generar el resumen.";

    let summary = "Resumen de División de Gastos\n";
    summary += "=============================\n";
    summary += `Monto Total del Gasto: ${formatUserCurrency(totalBillAmount)}\n\n`;

    summary += "Participantes:\n";
    summary += "-----------------------------\n";
    costPerPersonSummary.forEach(item => {
      const originalParticipant = participants.find(p => p.name === item.name);
      summary += `- ${item.name}:\n`;
      summary += `  Pagó: ${formatUserCurrency(item.paid)}\n`;
      
      let contributionType = "";
      if (item.calculationMethod === 'fixed') contributionType = `Monto Fijo: ${formatUserCurrency(item.shouldPay)}`;
      else if (item.calculationMethod === 'percentage') contributionType = `% A Cubrir: ${originalParticipant?.percentageToPay?.toFixed(2)}%`;
      else contributionType = `División Equitativa del Resto`;
      
      summary += `  Contribución: ${contributionType}\n`;
      summary += `  Debería Pagar: ${formatUserCurrency(item.shouldPay)}\n`;

      let balanceText = `${formatUserCurrency(item.balance)}`;
      if (item.balance < -0.001) balanceText += ` (Debe ${formatUserCurrency(Math.abs(item.balance))})`;
      else if (item.balance > 0.001) balanceText += ` (A favor ${formatUserCurrency(item.balance)})`;
      else balanceText += ` (Saldado)`;
      summary += `  Balance: ${balanceText}\n`;
      summary += "-----------------------------\n";
    });

    summary += "\nAjustes para Saldar Cuentas:\n";
    summary += "-----------------------------\n";
    if (settlements.length > 0) {
      settlements.forEach(settlement => {
        summary += `- ${settlement.from} le debe a ${settlement.to}: ${formatUserCurrency(settlement.amount)}\n`;
      });
    } else {
      summary += "¡Todas las cuentas están saldadas o no se requieren pagos adicionales!\n";
    }
    summary += "=============================";
    return summary;
  };

  const handleCopySummary = async () => {
    const summaryText = generateSummaryText();
    try {
      await navigator.clipboard.writeText(summaryText);
      toast({
        title: "¡Resumen Copiado!",
        description: "El resumen de la división de gastos ha sido copiado al portapapeles.",
      });
    } catch (err) {
      console.error('Error al copiar el texto: ', err);
      toast({
        variant: "destructive",
        title: "Error al Copiar",
        description: "No se pudo copiar el resumen al portapapeles.",
      });
    }
  };


  return (
    <>
    <DashboardHeader addDebtDialog={<AddDebtDialog onAddDebt={()=>{}} debtors={[]}/>} />
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader
        title="Dividir Gastos"
        description="Calcula fácilmente cómo dividir una cuenta entre varias personas, con opción de porcentajes y montos fijos."
      />

      <div className="grid grid-cols-1 gap-6 items-start">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>1. Configuración del Gasto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div>
              <Label htmlFor="totalBillAmount">Monto Total del Gasto</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="totalBillAmount"
                  {...totalBillInputProps}
                />
                <Popover open={isCalculatorOpen} onOpenChange={setIsCalculatorOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Abrir calculadora">
                      <Calculator className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2">
                    <div className="space-y-2">
                      <div className="rounded-md border bg-muted p-2 text-right text-2xl font-mono h-12 flex items-center justify-end break-all">
                        {calculatorState.displayValue}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <Button variant="outline" className="col-span-3" onClick={handleCalculatorClear}>C</Button>
                        <Button variant="outline" onClick={() => handleCalculatorOperation('/')}>÷</Button>

                        <Button variant="secondary" onClick={() => handleCalculatorInput('7')}>7</Button>
                        <Button variant="secondary" onClick={() => handleCalculatorInput('8')}>8</Button>
                        <Button variant="secondary" onClick={() => handleCalculatorInput('9')}>9</Button>
                        <Button variant="outline" onClick={() => handleCalculatorOperation('*')}>×</Button>

                        <Button variant="secondary" onClick={() => handleCalculatorInput('4')}>4</Button>
                        <Button variant="secondary" onClick={() => handleCalculatorInput('5')}>5</Button>
                        <Button variant="secondary" onClick={() => handleCalculatorInput('6')}>6</Button>
                        <Button variant="outline" onClick={() => handleCalculatorOperation('-')}>-</Button>
                        
                        <Button variant="secondary" onClick={() => handleCalculatorInput('1')}>1</Button>
                        <Button variant="secondary" onClick={() => handleCalculatorInput('2')}>2</Button>
                        <Button variant="secondary" onClick={() => handleCalculatorInput('3')}>3</Button>
                        <Button variant="outline" onClick={() => handleCalculatorOperation('+')}>+</Button>

                        <Button variant="secondary" className="col-span-2" onClick={() => handleCalculatorInput('0')}>0</Button>
                        <Button variant="secondary" onClick={() => handleCalculatorInput('.')}>.</Button>
                        <Button variant="default" onClick={handleCalculatorEquals}>=</Button>

                      </div>
                      <Button className="w-full" onClick={handleCalculatorApply}>Aplicar al Gasto</Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary" /> 2. Participantes</CardTitle>
             <CardDescription>Añade quiénes participaron, cuánto pagó cada uno y, opcionalmente, el % del total o un monto fijo que deben cubrir.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col space-y-4">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Nombre del nuevo participante"
                value={newParticipantName}
                onChange={(e) => setNewParticipantName(e.target.value)}
                onKeyPress={(e) => { if (e.key === 'Enter') addParticipant(); }}
              />
              <Button onClick={addParticipant} variant="outline" size="icon">
                <PlusCircle className="h-5 w-5" />
                <span className="sr-only">Añadir participante</span>
              </Button>
            </div>
            <div className="overflow-y-auto max-h-[50vh] pr-1">
              {participants.length > 0 && (
                  <div className={cn("space-y-3", participants.length > 3 && "border-t pt-3 mt-3")}>
                    {participants.map((participant, index) => (
                        <ParticipantInputRow
                          key={participant.id}
                          participant={participant}
                          onUpdate={(newValues) => updateParticipant(participant.id, newValues)}
                          onRemove={() => removeParticipant(participant.id)}
                          index={index}
                        />
                    ))}
                  </div>
              )}
            </div>
            {participants.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Aún no hay participantes. Añade algunos para empezar.</p>
            )}
          </CardContent>
           <CardFooter className="border-t pt-4">
                <div className="w-full text-sm text-muted-foreground">
                    <p>Total pagado por participantes: <span className="font-semibold text-foreground">{formatUserCurrency(totalPaidByParticipants)}</span></p>
                    {totalBillAmount !== undefined && (
                        <p className={cn("mt-1", differenceFromTotalBill !== 0 && Math.abs(differenceFromTotalBill) > 0.01 ? "text-orange-600 font-medium" : "text-green-600")}>
                            Diferencia con el total del gasto: {formatUserCurrency(differenceFromTotalBill)}
                            {differenceFromTotalBill !== 0 && Math.abs(differenceFromTotalBill) > 0.01 && <span className="text-xs italic"> (Esto afectará los cálculos de deuda)</span>}
                        </p>
                    )}
                </div>
           </CardFooter>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button onClick={calculateDebts} size="lg" className="text-base px-8 py-6">
          <DivideCircle className="mr-2 h-5 w-5" />
          Dividir la Cuenta y Calcular Deudas
        </Button>
      </div>

      {(calculationError || settlements.length > 0 || costPerPersonSummary.length > 0) && (
        <Card className="shadow-xl mt-6">
          <CardHeader>
            <CardTitle>3. Resultados de la División</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {calculationError && (
              <Alert variant="destructive">
                <Info className="h-4 w-4" />
                <AlertTitle>Error en el Cálculo</AlertTitle>
                <AlertDescription>{calculationError}</AlertDescription>
              </Alert>
            )}
            
            {!calculationError && costPerPersonSummary.length > 0 && (
              <div className="space-y-3">
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Resumen de Aportes y Deudas Individuales</AlertTitle>
                    <AlertDescription>
                        Esta tabla muestra cuánto pagó cada persona, cuánto debería haber pagado y su balance.
                    </AlertDescription>
                </Alert>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead>Participante</TableHead>
                            <TableHead>Cálculo</TableHead>
                            <TableHead className="text-right">Pagó</TableHead>
                            <TableHead className="text-right">Debería Pagar</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {costPerPersonSummary.map((summary, index) => (
                            <TableRow key={index}>
                                <TableCell className="font-medium">{summary.name}</TableCell>
                                <TableCell className="text-xs text-muted-foreground capitalize">{summary.calculationMethod === 'equal' ? 'Equitativo' : summary.calculationMethod}</TableCell>
                                <TableCell className="text-right">{formatUserCurrency(summary.paid)}</TableCell>
                                <TableCell className="text-right">{formatUserCurrency(summary.shouldPay)}</TableCell>
                                <TableCell className={cn("text-right font-semibold", summary.balance < 0 ? "text-red-600" : (summary.balance > 0 ? "text-green-600" : ""))}>
                                    {formatUserCurrency(summary.balance)}
                                    {summary.balance < -0.001 && " (Debe)"}
                                    {summary.balance > 0.001 && " (A Favor)"}
                                </TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
              </div>
            )}

            {!calculationError && settlements.length > 0 && (
              <div>
                <h3 className="text-md font-semibold mb-2 text-primary mt-4">Transacciones para Saldar Cuentas:</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {settlements.map((debt, index) => (
                    <li key={index} className="text-sm">
                      <strong>{debt.from}</strong> le debe a <strong>{debt.to}</strong> la cantidad de <strong className="text-primary">{formatUserCurrency(debt.amount)}</strong>.
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!calculationError && settlements.length === 0 && costPerPersonSummary.length > 0 && (
              <p className="text-sm text-green-600 font-medium text-center py-3">¡Todas las cuentas están saldadas o no se requieren pagos adicionales entre participantes!</p>
            )}
          </CardContent>
          {!calculationError && costPerPersonSummary.length > 0 && (
            <CardFooter className="border-t pt-4 flex justify-end">
                <Button onClick={handleCopySummary} variant="outline">
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar Resumen
                </Button>
            </CardFooter>
          )}
        </Card>
      )}
    </div>
    </>
  );
}

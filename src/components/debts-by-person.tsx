
"use client";

import { useMemo } from 'react';
import type { Debt, Debtor, Payment, Settlement, Category } from "@/lib/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DebtsGrid } from './debts-grid';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Scale, Trash2, Loader, Clipboard } from 'lucide-react';
import { SettleDebtsDialog } from './settle-debts-dialog';
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { User } from 'firebase/auth';


interface DebtsByPersonProps {
  user: User | null;
  debts: Debt[];
  debtors: Debtor[];
  categories: Category[];
  settlements: Settlement[];
  onAddPayment: (debtId: string, newPayment: Omit<Payment, 'id'>) => void;
  onEditDebt: (debtId: string, updatedDebt: Partial<Omit<Debt, 'id'>>, debtorName: string) => void;
  onDeleteDebt: (debtId: string) => void;
  onEditPayment: (debtId: string, paymentId: string, updatedPayment: Partial<Omit<Payment, 'id'>>) => void;
  onDeletePayment: (debtId: string, paymentId: string) => void;
  onSettleDebts: (debtorId: string, iouTotal: number, uomeTotal: number, currency: string) => void;
  onReverseSettlement: (settlement: Settlement) => void;
  onApproveDebt: (debtId: string) => void;
  onRejectDebt: (debtId: string, reason: string) => void;
  onConfirmDeletion: (debtId: string) => void;
  onCancelDeletionRequest: (debtId: string) => void;
  onSetDebtCategory: (debtId: string, categoryId: string | null) => void;
  onViewDebt: (debt: Debt) => void;
  isLoading: boolean;
  onToggleRecurrence: (debt: Debt, status: 'active' | 'paused') => void;
}

export function DebtsByPerson({ 
    user,
    debts, 
    debtors, 
    categories,
    settlements, 
    onAddPayment, 
    onEditDebt, 
    onDeleteDebt, 
    onEditPayment, 
    onDeletePayment, 
    onSettleDebts,
    onReverseSettlement,
    onApproveDebt,
    onRejectDebt,
    onConfirmDeletion,
    onCancelDeletionRequest,
    onSetDebtCategory,
    onViewDebt,
    isLoading,
    onToggleRecurrence
}: DebtsByPersonProps) {

  const { toast } = useToast();
  const formatCurrency = (amount: number, currency: string) => new Intl.NumberFormat("es-CO", { style: "currency", currency: currency, minimumFractionDigits: 0 }).format(amount);
  const formatDate = (date: any) => {
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return isValid(d) ? format(d, "MMM d, yyyy", { locale: es }) : 'Fecha inválida';
  }

  const getUsername = (email: string | null | undefined) => {
    if (!email) return 'Usuario';
    const username = email.split('@')[0];
    return username.charAt(0).toUpperCase() + username.slice(1);
  }

  const debtsGroupedByPerson = useMemo(() => {
    if (!debtors || !debts) return [];

    const nonRejectedDebts = debts.filter(d => d.status !== 'rejected');
    const activeDebts = nonRejectedDebts.filter(d => (d.amount - d.payments.reduce((s, p) => s + p.amount, 0)) > 0.01);

    return debtors.map(debtor => {
      const personDebts = activeDebts.filter(d => d.debtorId === debtor.id);
      const allPersonDebts = debts.filter(d => d.debtorId === debtor.id && d.status !== 'rejected');
      const personSettlements = settlements.filter(s => s.debtorId === debtor.id);
      
      const totals = personDebts.reduce((acc, debt) => {
        const remaining = debt.amount - debt.payments.reduce((sum, p) => sum + p.amount, 0);
        
        if (remaining > 0) { 
            if (debt.type === 'iou') {
              acc.iou[debt.currency] = (acc.iou[debt.currency] || 0) + remaining;
            } else {
              acc.uome[debt.currency] = (acc.uome[debt.currency] || 0) + remaining;
            }
        }
        return acc;
      }, { iou: {} as Record<string, number>, uome: {} as Record<string, number> });

      return {
        ...debtor,
        debts: personDebts,
        allDebts: allPersonDebts,
        settlements: personSettlements,
        totals,
      };
    }).filter(d => d.debts.length > 0 || d.settlements.length > 0).sort((a, b) => a.name.localeCompare(b.name));

  }, [debts, debtors, settlements]);

  const renderTotals = (totals: Record<string, number>) => {
    const entries = Object.entries(totals);
    if (entries.length === 0) return <span className="text-muted-foreground">--</span>;
    return entries.map(([currency, amount]) => (
      <div key={currency}>{formatCurrency(amount, currency)}</div>
    ));
  };
  
  const handleReverse = (settlement: Settlement) => {
    onReverseSettlement(settlement);
  }

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
        toast({
            title: "Copiado al portapapeles",
            description: "El resumen de deudas se ha copiado correctamente.",
        });
    }).catch(err => {
        console.error("Failed to copy text: ", err);
        toast({
            variant: "destructive",
            title: "Error al copiar",
            description: "No se pudo copiar el texto al portapapeles.",
        });
    });
  };

  const generateSimpleExport = (debtorName: string, totals: { iou: Record<string, number>, uome: Record<string, number> }) => {
    const userName = getUsername(user?.email);
    let exportText = `Resumen de Deudas entre ${userName} y ${debtorName}:\n\n`;

    const formatSection = (title: string, currencyTotals: Record<string, number>) => {
        let sectionText = `${title}:\n`;
        const entries = Object.entries(currencyTotals);
        if (entries.length === 0) {
            sectionText += "- No hay deudas pendientes\n";
        } else {
            entries.forEach(([currency, amount]) => {
                sectionText += `- ${formatCurrency(amount, currency)}\n`;
            });
        }
        return sectionText;
    };
    
    exportText += formatSection(`Deudas de ${userName} con ${debtorName}`, totals.iou);
    exportText += `\n`;
    exportText += formatSection(`Deudas de ${debtorName} con ${userName}`, totals.uome);

    handleCopyToClipboard(exportText);
  };

  const generateDetailedExport = (debtorName: string, allPersonDebts: Debt[]) => {
      const userName = getUsername(user?.email);
      let exportText = `Informe Detallado de Deudas entre ${userName} y ${debtorName}\n\n`;

      const iouDebts = allPersonDebts.filter(d => d.type === 'iou');
      const uomeDebts = allPersonDebts.filter(d => d.type === 'uome');
      
      const formatDebtDetails = (debts: Debt[]) => {
          if (debts.length === 0) return "No hay deudas en esta categoría.\n";
          
          let text = "";
          debts.forEach(debt => {
              const totalPaid = debt.payments.reduce((acc, p) => acc + p.amount, 0);
              const remaining = debt.amount - totalPaid;
              text += `Concepto: ${debt.concept}\n`;
              text += `  - Monto Original: ${formatCurrency(debt.amount, debt.currency)}\n`;
              text += `  - Fecha: ${formatDate(debt.createdAt)}\n`;
              text += `  - Estado: ${remaining > 0.01 ? `Pendiente (${formatCurrency(remaining, debt.currency)})` : 'Saldada'}\n`;
              
              if (debt.items && debt.items.length > 0) {
                  text += "  - Ítems:\n";
                  debt.items.forEach(item => {
                      text += `    • ${item.name}: ${formatCurrency(item.value, debt.currency)}\n`;
                  });
              }

              if (debt.payments.length > 0) {
                  text += "  - Abonos:\n";
                  debt.payments.forEach(p => {
                      text += `    • ${formatCurrency(p.amount, debt.currency)} (${formatDate(p.date)})\n`;
                  });
              }
              text += `\n`;
          });
          return text;
      };

      exportText += `DEUDAS DE ${userName.toUpperCase()} CON ${debtorName.toUpperCase()}:\n`;
      exportText += formatDebtDetails(iouDebts);
      
      exportText += `\nDEUDAS DE ${debtorName.toUpperCase()} CON ${userName.toUpperCase()}:\n`;
      exportText += formatDebtDetails(uomeDebts);

      handleCopyToClipboard(exportText);
  };


  if (isLoading) {
      return (
          <div className="flex items-center justify-center p-8">
              <Loader className="h-6 w-6 animate-spin text-primary" />
          </div>
      );
  }
  
  return (
    <Card className="mt-4">
        <CardHeader>
            <CardTitle>Resumen por Persona</CardTitle>
            <CardDescription>Un resumen de las deudas agrupadas por cada persona o entidad.</CardDescription>
        </CardHeader>
        <CardContent>
            {debtsGroupedByPerson.length > 0 ? (
                <Accordion type="multiple" className="w-full">
                {debtsGroupedByPerson.map(({ id, name, debts: personDebts, allDebts, settlements, totals }) => {
                    const iouCurrencies = Object.keys(totals.iou);
                    const uomeCurrencies = Object.keys(totals.uome);
                    const canSettle = iouCurrencies.length === 1 && uomeCurrencies.length === 1 && iouCurrencies[0] === uomeCurrencies[0] && totals.iou[iouCurrencies[0]] > 0 && totals.uome[uomeCurrencies[0]] > 0;
                    const currency = canSettle ? iouCurrencies[0] : '';
                    const iouTotal = canSettle ? totals.iou[currency] : 0;
                    const uomeTotal = canSettle ? totals.uome[currency] : 0;
                    const userName = getUsername(user?.email);

                    return (
                        <AccordionItem value={id} key={id}>
                            <div className="flex flex-col md:flex-row w-full items-start md:items-center justify-between hover:bg-muted/50 rounded-t-md px-4 py-2">
                                <AccordionTrigger className="flex-grow py-1 hover:no-underline [&>svg]:ml-2 md:[&>svg]:ml-4 w-full">
                                    <div className="flex items-center justify-between w-full">
                                        <span className="font-semibold text-base text-left flex-shrink-0 truncate pr-4">{name}</span>
                                        <div className="flex gap-4 text-sm text-right items-center flex-shrink-0">
                                            <div className="min-w-[80px]">
                                                <p className="text-red-500 font-medium">Pagar</p>
                                                {renderTotals(totals.iou)}
                                            </div>
                                            <div className="min-w-[80px]">
                                                <p className="text-green-500 font-medium">Cobrar</p>
                                                {renderTotals(totals.uome)}
                                            </div>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <div className="flex-shrink-0 flex items-center gap-2 self-end md:self-center pt-2 md:pt-0">
                                     {canSettle && (
                                        <SettleDebtsDialog 
                                            debtorName={name}
                                            iouTotal={iouTotal}
                                            uomeTotal={uomeTotal}
                                            currency={currency}
                                            onConfirm={() => onSettleDebts(id, iouTotal, uomeTotal, currency)}
                                        >
                                            <Button variant="outline" size="sm" className="gap-1 h-7">
                                                <Scale className="h-3 w-3" />
                                                Cruzar
                                            </Button>
                                        </SettleDebtsDialog>
                                    )}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="gap-1 h-7">
                                                <Clipboard className="h-3 w-3" />
                                                Exportar
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenuItem onClick={() => generateSimpleExport(name, totals)}>
                                                Exportar Resumen
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => generateDetailedExport(name, allDebts)}>
                                                Exportar Detalle
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        <AccordionContent>
                            {settlements.length > 0 && (
                                <div className="mx-4 mb-4 p-3 border rounded-lg bg-muted/30">
                                    <h4 className="font-semibold text-sm mb-2">Historial de Cruces</h4>
                                    <ul className="space-y-2">
                                        {settlements.map(s => {
                                            const date = s.date instanceof Timestamp ? s.date.toDate() : new Date();
                                            return (
                                                <li key={s.id} className="flex items-center justify-between text-xs p-2 bg-background rounded-md">
                                                    <div>
                                                        <p>Cruce de <span className="font-semibold">{formatCurrency(s.amountSettled, s.currency)}</span></p>
                                                        <p className="text-muted-foreground">
                                                            {isValid(date) ? format(date, "MMM d, yyyy 'a las' HH:mm", { locale: es }) : 'Fecha inválida'}
                                                        </p>
                                                    </div>
                                                     <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-500">
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>¿Revertir cruce de cuentas?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Esta acción no se puede deshacer. Se eliminarán los abonos de cruce y las deudas volverán a su estado anterior.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleReverse(s)} className="bg-destructive hover:bg-destructive/90">
                                                                    Sí, revertir
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                </div>
                            )}
                            <div className="px-4 pb-4">
                                <DebtsGrid
                                    debts={personDebts}
                                    debtors={debtors}
                                    categories={categories}
                                    user={user}
                                    onAddPayment={onAddPayment}
                                    onEditDebt={onEditDebt}
                                    onDeleteDebt={onDeleteDebt}
                                    onEditPayment={onEditPayment}
                                    onDeletePayment={onDeletePayment}
                                    onApproveDebt={onApproveDebt}
                                    onRejectDebt={onRejectDebt}
                                    onConfirmDeletion={onConfirmDeletion}
                                    onCancelDeletionRequest={onCancelDeletionRequest}
                                    onSetDebtCategory={onSetDebtCategory}
                                    onViewDebt={onViewDebt}
                                    isLoading={isLoading}
                                    showSettled={false}
                                    onToggleRecurrence={onToggleRecurrence}
                                />
                            </div>
                        </AccordionContent>
                        </AccordionItem>
                    )
                })}
                </Accordion>
            ) : (
                <div className="text-center py-10">
                    <p className="text-muted-foreground">No hay deudas registradas.</p>
                </div>
            )}
        </CardContent>
    </Card>
  );
}

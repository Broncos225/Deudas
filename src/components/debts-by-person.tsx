
"use client";

import { useMemo } from 'react';
import type { Debt, Debtor, Payment, Settlement } from "@/lib/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DebtsGrid } from './debts-grid';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Scale, Trash2, Loader } from 'lucide-react';
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


interface DebtsByPersonProps {
  debts: Debt[];
  debtors: Debtor[];
  settlements: Settlement[];
  onAddPayment: (debtId: string, newPayment: Omit<Payment, 'id' | 'date'>) => void;
  onEditDebt: (debtId: string, updatedDebt: Partial<Omit<Debt, 'id'>>, debtorName: string) => void;
  onDeleteDebt: (debtId: string) => void;
  onEditPayment: (debtId: string, paymentId: string, updatedPayment: Partial<Omit<Payment, 'id' | 'date'>>) => void;
  onDeletePayment: (debtId: string, paymentId: string) => void;
  onSettleDebts: (debtorId: string, iouTotal: number, uomeTotal: number, currency: string) => void;
  onReverseSettlement: (settlement: Settlement) => void;
  isLoading: boolean;
}

export function DebtsByPerson({ 
    debts, 
    debtors, 
    settlements, 
    onAddPayment, 
    onEditDebt, 
    onDeleteDebt, 
    onEditPayment, 
    onDeletePayment, 
    onSettleDebts,
    onReverseSettlement,
    isLoading
}: DebtsByPersonProps) {

  const formatCurrency = (amount: number, currency: string) => new Intl.NumberFormat("es-CO", { style: "currency", currency: currency, minimumFractionDigits: 0 }).format(amount);

  const debtsGroupedByPerson = useMemo(() => {
    if (!debtors || !debts) return [];

    const activeDebts = debts.filter(d => (d.amount - d.payments.reduce((s, p) => s + p.amount, 0)) > 0.01);

    return debtors.map(debtor => {
      const personDebts = activeDebts.filter(d => d.debtorId === debtor.id);
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
                {debtsGroupedByPerson.map(({ id, name, debts, settlements, totals }) => {
                    const iouCurrencies = Object.keys(totals.iou);
                    const uomeCurrencies = Object.keys(totals.uome);
                    const canSettle = iouCurrencies.length === 1 && uomeCurrencies.length === 1 && iouCurrencies[0] === uomeCurrencies[0] && totals.iou[iouCurrencies[0]] > 0 && totals.uome[uomeCurrencies[0]] > 0;
                    const currency = canSettle ? iouCurrencies[0] : '';
                    const iouTotal = canSettle ? totals.iou[currency] : 0;
                    const uomeTotal = canSettle ? totals.uome[currency] : 0;

                    return (
                        <AccordionItem value={id} key={id}>
                            <div className="flex w-full items-center justify-between hover:bg-muted/50 rounded-t-md">
                                <AccordionTrigger className="flex-grow py-3 hover:no-underline px-4">
                                    <div className="flex flex-col md:flex-row md:justify-between md:items-center w-full gap-2 md:gap-4">
                                        <span className="font-semibold text-base text-left flex-shrink-0 truncate">{name}</span>
                                        <div className="flex gap-4 text-sm text-left md:text-right items-start md:items-center flex-shrink-0">
                                            <div className="min-w-[80px]">
                                                <p className="text-red-500 font-medium">Tú debes</p>
                                                {renderTotals(totals.iou)}
                                            </div>
                                            <div className="min-w-[80px]">
                                                <p className="text-green-500 font-medium">Te deben</p>
                                                {renderTotals(totals.uome)}
                                            </div>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                {canSettle && (
                                    <div className="px-4 flex-shrink-0">
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
                                    </div>
                                )}
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
                                    debts={debts.filter(d => d.debtorId === id && (d.amount - d.payments.reduce((s, p) => s + p.amount, 0)) > 0.01)}
                                    debtors={debtors}
                                    onAddPayment={onAddPayment}
                                    onEditDebt={onEditDebt}
                                    onDeleteDebt={onDeleteDebt}
                                    onEditPayment={onEditPayment}
                                    onDeletePayment={onDeletePayment}
                                    isLoading={isLoading}
                                    showSettled={false}
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

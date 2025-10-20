
"use client";

import { useState, useEffect } from 'react';
import type { Debt, Debtor, Payment } from "@/lib/types";
import { format, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { MoreHorizontal, Edit, Trash2, ArrowDownLeft, ArrowUpRight, Wallet, Loader, CheckCircle, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddPaymentDialog } from "./add-payment-dialog";
import { ViewDebtDialog } from "./view-debt-dialog";
import { Timestamp } from 'firebase/firestore';
import { AddDebtDialog } from './add-debt-dialog';
import { DeleteDebtAlertDialog } from './delete-debt-alert-dialog';
import { Card, CardContent } from './ui/card';

interface DebtsListProps {
  debts: Debt[];
  debtors: Debtor[];
  onAddPayment: (debtId: string, newPayment: Omit<Payment, 'id'>) => void;
  onEditDebt: (debtId: string, updatedDebt: Partial<Omit<Debt, 'id'>>, debtorName: string) => void;
  onDeleteDebt: (debtId: string) => void;
  onEditPayment: (debtId: string, paymentId: string, updatedPayment: Partial<Omit<Payment, 'id'>>) => void;
  onDeletePayment: (debtId: string, paymentId: string) => void;
  isLoading: boolean;
}

const ClientFormattedDate = ({ date, prefix }: { date: string | Date | Timestamp, prefix?: string }) => {
    const [formattedDate, setFormattedDate] = useState('');
  
    useEffect(() => {
        if (!date) return;
        
        let dateObj: Date;
        if (date instanceof Timestamp) dateObj = date.toDate();
        else if (typeof date === 'string') dateObj = parseISO(date);
        else dateObj = date;

        if (isValid(dateObj)) {
            setFormattedDate(format(dateObj, "MMM d, yyyy", { locale: es }));
        } else {
            setFormattedDate('');
        }
    }, [date]);
  
    if (!formattedDate) return <span className="h-4 w-20 animate-pulse bg-muted rounded-md" />;
  
    return <>{prefix}{formattedDate}</>;
};

export function DebtsList({ 
    debts, 
    debtors, 
    onAddPayment, 
    onEditDebt, 
    onDeleteDebt, 
    onEditPayment, 
    onDeletePayment, 
    isLoading
}: DebtsListProps) {
  const calculateRemaining = (debt: Debt) => debt.amount - debt.payments.reduce((sum, p) => sum + p.amount, 0);

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);

  if (isLoading) {
    return (
        <Card className="mt-4">
            <CardContent className="p-0">
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="grid grid-cols-[2fr,1fr,1fr,1fr,auto] gap-4 items-center p-4">
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-4 bg-muted rounded-md animate-pulse"></div>
                                <div className="space-y-1">
                                    <div className="h-4 w-24 bg-muted rounded-md animate-pulse"></div>
                                    <div className="h-3 w-16 bg-muted rounded-md animate-pulse"></div>
                                </div>
                            </div>
                            <div className="h-4 w-20 bg-muted rounded-md animate-pulse ml-auto"></div>
                            <div className="h-4 w-20 bg-muted rounded-md animate-pulse ml-auto"></div>
                            <div className="h-4 w-24 bg-muted rounded-md animate-pulse mx-auto"></div>
                            <div className="h-8 w-8 bg-muted rounded-md animate-pulse"></div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
  }

  if (debts.length === 0) {
    return (
        <div className="text-center py-10 col-span-full">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <p className="text-muted-foreground mt-4">No se encontraron deudas.</p>
        </div>
    )
  }

  return (
    <Card className="mt-4">
        <CardContent className="p-0">
            <div className="space-y-2">
                {/* Header */}
                <div className="hidden md:grid grid-cols-[2fr,1fr,1fr,1fr,auto] gap-4 items-center p-4 font-medium text-muted-foreground text-sm">
                    <div>Concepto / Persona</div>
                    <div className="text-right">Monto Original</div>
                    <div className="text-right">Saldo Restante</div>
                    <div className="text-center">Vencimiento</div>
                    <div className="w-12"></div>
                </div>

                {debts.map((debt) => {
                    const remaining = calculateRemaining(debt);
                    const isPaid = remaining <= 0.01;
                    const isIOU = debt.type === 'iou';

                    return (
                        <div key={debt.id} className="grid grid-cols-[1fr,auto] md:grid-cols-[2fr,1fr,1fr,1fr,auto] gap-2 md:gap-4 items-center p-4 border-b last:border-0 hover:bg-muted/50 transition-colors">
                            {/* Mobile Header */}
                            <div className="md:hidden col-span-2 text-xs font-medium text-muted-foreground flex justify-between">
                                <span>Concepto</span>
                                <span>Restante</span>
                            </div>

                            {/* Debt Info */}
                            <div className="flex items-center gap-2">
                                {isIOU ? <ArrowDownLeft className="h-4 w-4 text-red-500 flex-shrink-0" /> : <ArrowUpRight className="h-4 w-4 text-green-500 flex-shrink-0" />}
                                <div>
                                    <p className="font-semibold truncate">{debt.concept}</p>
                                    <p className="text-sm text-muted-foreground">{debt.debtorName}</p>
                                </div>
                            </div>
                            
                            <div className="hidden md:block text-right">{formatCurrency(debt.amount, debt.currency)}</div>
                            <div className="text-right font-semibold">{formatCurrency(remaining, debt.currency)}</div>

                            {/* Due Date - Mobile & Desktop */}
                            <div className="text-xs text-muted-foreground flex items-center gap-1 col-span-2 md:col-span-1 md:text-center md:justify-center">
                                {debt.dueDate && !isPaid ? (
                                    <>
                                        <Bell className="h-3 w-3" />
                                        <ClientFormattedDate date={debt.dueDate} />
                                    </>
                                ) : (
                                    <span className="hidden md:inline-block">-</span>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end col-start-2 row-start-2 md:col-start-auto md:row-start-auto">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button aria-haspopup="true" size="icon" variant="ghost" className="h-8 w-8">
                                            <MoreHorizontal className="h-4 w-4" />
                                            <span className="sr-only">Toggle menu</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                        <ViewDebtDialog debt={debt} onEditPayment={onEditPayment} onDeletePayment={onDeletePayment}>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Ver Detalles</DropdownMenuItem>
                                        </ViewDebtDialog>
                                        {!isPaid && (
                                            <>
                                                <AddPaymentDialog debt={debt} onAddPayment={onAddPayment}>
                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2">
                                                        <Wallet className="h-4 w-4" /> Añadir Pago
                                                    </DropdownMenuItem>
                                                </AddPaymentDialog>
                                                <AddDebtDialog debtToEdit={debt} debtors={debtors} onEditDebt={onEditDebt}>
                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2">
                                                        <Edit className="h-4 w-4" /> Editar Deuda
                                                    </DropdownMenuItem>
                                                </AddDebtDialog>
                                            </>
                                        )}
                                        <DropdownMenuSeparator />
                                        <DeleteDebtAlertDialog onDelete={() => onDeleteDebt(debt.id)}>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-500 focus:text-red-500 focus:bg-red-50 gap-2">
                                                <Trash2 className="h-4 w-4" /> Eliminar
                                            </DropdownMenuItem>
                                        </DeleteDebtAlertDialog>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    );
                })}
            </div>
        </CardContent>
    </Card>
  );
}

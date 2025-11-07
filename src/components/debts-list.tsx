
"use client";

import { useState, useEffect } from 'react';
import type { Debt, Debtor, Payment } from "@/lib/types";
import { format, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { MoreHorizontal, Edit, Trash2, ArrowDownLeft, ArrowUpRight, Wallet, Loader, CheckCircle, Bell, Info } from "lucide-react";
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
import { User } from 'firebase/auth';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { cn } from '@/lib/utils';

interface DebtsListProps {
  debts: Debt[];
  debtors: Debtor[];
  user: User | null;
  onAddPayment: (debtId: string, newPayment: Omit<Payment, 'id'>) => void;
  onEditDebt: (debtId: string, updatedDebt: Partial<Omit<Debt, 'id'>>, debtorName: string) => void;
  onDeleteDebt: (debtId: string) => void;
  onEditPayment: (debtId: string, paymentId: string, updatedPayment: Partial<Omit<Payment, 'id'>>) => void;
  onDeletePayment: (debtId: string, paymentId: string) => void;
  isLoading: boolean;
  onViewDebt: (debt: Debt) => void;
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
    user,
    onAddPayment, 
    onEditDebt, 
    onDeleteDebt, 
    onEditPayment, 
    onDeletePayment, 
    isLoading,
    onViewDebt
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
                <div className="space-y-2 p-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex gap-4 items-center p-2">
                            <div className="h-4 w-4 bg-muted rounded-md animate-pulse"></div>
                            <div className="flex-1 space-y-1">
                                <div className="h-4 w-3/4 bg-muted rounded-md animate-pulse"></div>
                            </div>
                            <div className="h-4 w-20 bg-muted rounded-md animate-pulse"></div>
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
            <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground mt-4">No se encontraron deudas.</p>
        </div>
    )
  }

  return (
    <>
        <Card className="mt-4">
            <CardContent className="p-0">
                <div className="divide-y divide-border">
                    {/* Header */}
                    <div className="hidden md:flex items-center p-4 font-medium text-muted-foreground text-sm bg-muted/50">
                        <div className="flex-1 min-w-0 pr-4">Concepto / Persona</div>
                        <div className="w-32 text-right pr-4">Monto Original</div>
                        <div className="w-32 text-right pr-4">Saldo Restante</div>
                        <div className="w-32 text-center">Vencimiento</div>
                        <div className="w-10"></div>
                    </div>

                    {debts.map((debt) => {
                        const remaining = calculateRemaining(debt);
                        const isPaid = remaining <= 0.01;
                        const isIOU = debt.type === 'iou';
                        const isCreator = user ? user.uid === (debt.creatorId || debt.userId) : false;

                        return (
                            <div 
                                key={debt.id} 
                                className="flex items-center p-2 md:p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                                onClick={() => onViewDebt(debt)}
                            >
                                <div className="flex-1 flex items-center gap-2 min-w-0">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                {isIOU ? <ArrowDownLeft className="h-4 w-4 text-red-500 flex-shrink-0" /> : <ArrowUpRight className="h-4 w-4 text-green-500 flex-shrink-0" />}
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                {isIOU ? 'Tú debes' : 'Te deben'}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold truncate">{debt.concept}</p>
                                        <p className="text-sm text-muted-foreground truncate">{debt.debtorName}</p>
                                    </div>
                                </div>
                                
                                <div className="hidden md:block w-32 text-right pr-4 text-sm">{formatCurrency(debt.amount, debt.currency)}</div>
                                <div className="w-24 md:w-32 text-right pr-4 font-semibold text-sm">{formatCurrency(remaining, debt.currency)}</div>

                                <div className="hidden md:flex w-32 text-center items-center justify-center text-xs text-muted-foreground gap-1">
                                    {debt.dueDate && !isPaid && (
                                        <>
                                            <Bell className="h-3 w-3" />
                                            <ClientFormattedDate date={debt.dueDate} />
                                        </>
                                    )}
                                </div>

                                <div className="w-10 flex justify-end" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button aria-haspopup="true" size="icon" variant="ghost" className="h-8 w-8">
                                                <MoreHorizontal className="h-4 w-4" />
                                                <span className="sr-only">Toggle menu</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                            <DropdownMenuItem onSelect={() => onViewDebt(debt)}>Ver Detalles</DropdownMenuItem>
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
                                            <DeleteDebtAlertDialog onDelete={() => onDeleteDebt(debt.id)} isShared={debt.isShared ?? false}>
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
    </>
  );
}

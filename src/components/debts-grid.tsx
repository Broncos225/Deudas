
"use client";

import { useState, useEffect } from 'react';
import type { Debt, Debtor, Payment } from "@/lib/types";
import { format, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { MoreHorizontal, Edit, Trash2, ArrowDownLeft, ArrowUpRight, Wallet, Loader, CheckCircle, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Progress } from "./ui/progress";
import { Timestamp } from 'firebase/firestore';
import { AddDebtDialog } from './add-debt-dialog';
import { DeleteDebtAlertDialog } from './delete-debt-alert-dialog';


interface DebtsGridProps {
  debts: Debt[];
  debtors: Debtor[];
  onAddPayment: (debtId: string, newPayment: Omit<Payment, 'id'>) => void;
  onEditDebt: (debtId: string, updatedDebt: Partial<Omit<Debt, 'id'>>, debtorName: string) => void;
  onDeleteDebt: (debtId: string) => void;
  onEditPayment: (debtId: string, paymentId: string, updatedPayment: Partial<Omit<Payment, 'id'>>) => void;
  onDeletePayment: (debtId: string, paymentId: string) => void;
  isLoading: boolean;
  showSettled: boolean;
}

const ClientFormattedDate = ({ date, prefix }: { date: string | Date | Timestamp, prefix?: string }) => {
    const [formattedDate, setFormattedDate] = useState('');
  
    useEffect(() => {
        if (!date) {
            return;
        }
        
        let dateObj: Date;
        if (date instanceof Timestamp) {
            dateObj = date.toDate();
        } else if (typeof date === 'string') {
            dateObj = parseISO(date);
        } else {
            dateObj = date;
        }

        if (isValid(dateObj)) {
            setFormattedDate(format(dateObj, "MMM d, yyyy", { locale: es }));
        } else {
            setFormattedDate('');
        }
    }, [date]);
  
    if (!formattedDate) {
      return <span className="h-4 w-20 animate-pulse bg-muted rounded-md" />;
    }
  
    return <>{prefix}{formattedDate}</>;
  };

export function DebtsGrid({ 
    debts, 
    debtors, 
    onAddPayment, 
    onEditDebt, 
    onDeleteDebt, 
    onEditPayment, 
    onDeletePayment, 
    isLoading,
    showSettled 
}: DebtsGridProps) {
  const calculatePaid = (debt: Debt) => debt.payments.reduce((sum, p) => sum + p.amount, 0);
  const calculateRemaining = (debt: Debt) => debt.amount - calculatePaid(debt);
  const calculateProgress = (debt: Debt) => (calculatePaid(debt) / debt.amount) * 100;

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);

  if (isLoading) {
    return (
        <div className="flex items-center justify-center p-8">
            <Loader className="h-6 w-6 animate-spin text-primary" />
        </div>
    );
  }

  if (debts.length === 0) {
    return (
        <div className="text-center py-10 col-span-full">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <p className="text-muted-foreground mt-4">{showSettled ? "No hay deudas saldadas en el historial." : "¡Felicidades! No tienes deudas activas."}</p>
        </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
      {debts.map((debt) => {
        const remaining = calculateRemaining(debt);
        const paid = calculatePaid(debt);
        const isPaid = remaining <= 0.01; // Use a small threshold for float comparison
        const progress = calculateProgress(debt);
        const isIOU = debt.type === 'iou';

        return (
          <Card key={debt.id} className="flex flex-col group hover:shadow-md transition-shadow duration-200">
            <CardHeader className="flex flex-row items-start p-4">
                <div className="grid gap-1 flex-1">
                    <CardTitle className="text-base md:text-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isIOU ? <ArrowDownLeft className="h-4 w-4 text-red-500" /> : <ArrowUpRight className="h-4 w-4 text-green-500" />}
                        {debt.debtorName}
                      </div>
                      <div className={`text-xs font-semibold py-1 px-2.5 rounded-full ${isPaid ? 'bg-green-100 text-green-700' : isIOU ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {isPaid ? "Pagado" : "Pendiente"}
                      </div>
                    </CardTitle>
                    <CardDescription className="text-sm pl-6">
                      <span className="font-semibold text-foreground">{debt.concept}</span>
                    </CardDescription>
                     <CardDescription className="text-sm pl-6">
                      <span className="font-semibold text-foreground">{formatCurrency(debt.amount, debt.currency)}</span>
                    </CardDescription>
                </div>
                <div className="ml-auto -mt-1 -mr-1">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                             <ViewDebtDialog 
                                debt={debt} 
                                onEditPayment={onEditPayment}
                                onDeletePayment={onDeletePayment}
                             >
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                Ver Detalles
                              </DropdownMenuItem>
                            </ViewDebtDialog>
                            {!isPaid && (
                                <AddDebtDialog debtToEdit={debt} debtors={debtors} onEditDebt={onEditDebt}>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2">
                                        <Edit className="h-4 w-4" /> Editar
                                    </DropdownMenuItem>
                                </AddDebtDialog>
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
            </CardHeader>
            <CardContent className="flex-grow p-4 pt-0">
               <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Pagado</span>
                    <span>{formatCurrency(paid, debt.currency)}</span>
                </div>
                <Progress value={progress} className={`h-2 ${isPaid ? '[&>*]:bg-green-500' : isIOU ? '[&>*]:bg-red-500' : '[&>*]:bg-amber-500' }`} />
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                    <span>Restante</span>
                    <span>{formatCurrency(remaining, debt.currency)}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-4 pt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                {!isPaid && (
                  <AddPaymentDialog debt={debt} onAddPayment={onAddPayment}>
                    <Button variant="outline" size="sm" className="w-full gap-2">
                      <Wallet className="h-4 w-4" /> Añadir Pago
                    </Button>
                  </AddPaymentDialog>
                )}
                 <div className="text-xs text-muted-foreground text-left flex-shrink-0 whitespace-nowrap">
                    Creada el <ClientFormattedDate date={debt.createdAt} />
                </div>
                {debt.dueDate && !isPaid && (
                    <div className="text-xs text-muted-foreground text-right flex-shrink-0 whitespace-nowrap flex items-center gap-1">
                        <Bell className="h-3 w-3" />
                        <ClientFormattedDate date={debt.dueDate} prefix="Vence el "/>
                    </div>
                )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

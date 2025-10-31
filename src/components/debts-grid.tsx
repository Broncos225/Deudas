
"use client";

import { useState, useEffect } from 'react';
import type { Debt, Debtor, Payment } from "@/lib/types";
import { format, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { MoreHorizontal, Edit, Trash2, ArrowDownLeft, ArrowUpRight, Wallet, Loader, CheckCircle, Bell, Info, ThumbsUp, ThumbsDown, AlertTriangle, XCircle, ShieldQuestion } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddPaymentDialog } from "./add-payment-dialog";
import { ViewDebtDialog } from "./view-debt-dialog";
import { Progress } from "./ui/progress";
import { Timestamp } from 'firebase/firestore';
import { AddDebtDialog } from './add-debt-dialog';
import { DeleteDebtAlertDialog } from './delete-debt-alert-dialog';
import { User } from 'firebase/auth';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { cn } from '@/lib/utils';


interface DebtsGridProps {
  debts: Debt[];
  debtors: Debtor[];
  user: User | null;
  onAddPayment: (debtId: string, newPayment: Omit<Payment, 'id'>) => void;
  onEditDebt: (debtId: string, updatedDebt: Partial<Omit<Debt, 'id'>>, debtorName: string) => void;
  onDeleteDebt: (debtId: string) => void;
  onEditPayment: (debtId: string, paymentId: string, updatedPayment: Partial<Omit<Payment, 'id'>>) => void;
  onDeletePayment: (debtId: string, paymentId: string) => void;
  onApproveDebt: (debtId: string) => void;
  onRejectDebt: (debtId: string, reason: string) => void;
  onConfirmDeletion: (debtId: string) => void;
  onCancelDeletionRequest: (debtId: string) => void;
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

const RejectDebtDialog = ({ onConfirm }: { onConfirm: (reason: string) => void }) => {
    const [reason, setReason] = useState('');
    return (
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Rechazar esta deuda?</AlertDialogTitle>
                <AlertDialogDescription>
                    La deuda no se activará y la otra persona será notificada. Por favor, explica brevemente el motivo del rechazo.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
                <Label htmlFor="rejection-reason" className="text-sm font-medium">Motivo (opcional)</Label>
                <Input 
                    id="rejection-reason" 
                    value={reason} 
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ej: El monto es incorrecto"
                />
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={() => onConfirm(reason)} 
                    className="bg-destructive hover:bg-destructive/90"
                >
                    Sí, Rechazar
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    );
}

export function DebtsGrid({ 
    debts, 
    debtors,
    user,
    onAddPayment, 
    onEditDebt, 
    onDeleteDebt, 
    onEditPayment, 
    onDeletePayment,
    onApproveDebt,
    onRejectDebt,
    onConfirmDeletion,
    onCancelDeletionRequest,
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
            {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i}><CardHeader><div className="h-6 w-1/2 bg-muted rounded-md animate-pulse"></div></CardHeader><CardContent><div className="h-10 w-full bg-muted rounded-md animate-pulse"></div></CardContent><CardFooter><div className="h-8 w-full bg-muted rounded-md animate-pulse"></div></CardFooter></Card>
            ))}
        </div>
    );
  }

  if (debts.length === 0) {
    return (
        <div className="text-center py-10 col-span-full">
            <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground mt-4">{showSettled ? "No hay deudas saldadas que coincidan." : "No se encontraron deudas activas."}</p>
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
        const creatorId = debt.creatorId || debt.userId;
        const isCreator = user ? user.uid === creatorId : false;

        const isPending = debt.isShared && debt.status === 'pending';
        const isRejected = debt.isShared && debt.status === 'rejected';
        
        // A debt is approved if it's not shared, or its status is 'approved', or it's an older debt without a status field.
        const isApproved = !debt.isShared || debt.status === 'approved' || (debt.isShared && !debt.status);

        const userHasApproved = debt.approvedBy?.includes(user?.uid || '');
        const canApprove = isPending && !userHasApproved;

        const isDeletionRequested = debt.isShared && debt.deletionStatus === 'requested';
        const canConfirmDeletion = isDeletionRequested && debt.deletionRequestedBy !== user?.uid;

        const getStatusBadge = () => {
            if (isDeletionRequested) return { text: "Eliminación Solicitada", className: "bg-orange-100 text-orange-700", Icon: ShieldQuestion };
            if (isPaid) return { text: "Pagado", className: "bg-green-100 text-green-700", Icon: CheckCircle };
            if (isPending) return { text: "Pendiente", className: "bg-yellow-100 text-yellow-700", Icon: Bell };
            if (isRejected) return { text: "Rechazado", className: "bg-red-100 text-red-700", Icon: XCircle };
            return { text: "Activa", className: "bg-blue-100 text-blue-700", Icon: CheckCircle };
        }

        const statusBadge = getStatusBadge();


        return (
          <Card key={debt.id} className={cn(
            "flex flex-col group hover:shadow-md transition-shadow duration-200",
            isPending && "bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-500/50",
            isDeletionRequested && "bg-orange-50/50 dark:bg-orange-900/10 border-orange-500/50"
            )}>
            <CardHeader className="flex flex-row items-start p-4">
                <div className="grid gap-1 flex-1">
                    <CardTitle className="text-base md:text-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isIOU ? <ArrowDownLeft className="h-4 w-4 text-red-500" /> : <ArrowUpRight className="h-4 w-4 text-green-500" />}
                        {debt.debtorName}
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className={cn('text-xs font-semibold py-1 px-2.5 rounded-full flex items-center gap-1', statusBadge.className)}>
                                    <statusBadge.Icon className="h-3 w-3"/>
                                    {statusBadge.text}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                {isDeletionRequested && <p>Esperando confirmación de la otra parte.</p>}
                                {isPending && <p>Esperando aprobación para activar la deuda.</p>}
                            </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
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
                            {(isCreator && !isPaid && !isDeletionRequested) && (
                                <AddDebtDialog debtToEdit={debt} debtors={debtors} onEditDebt={onEditDebt}>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2">
                                        <Edit className="h-4 w-4" /> Editar
                                    </DropdownMenuItem>
                                </AddDebtDialog>
                            )}
                           <DropdownMenuSeparator />
                           <DeleteDebtAlertDialog 
                                onDelete={() => onDeleteDebt(debt.id)}
                                isShared={debt.isShared || false}
                           >
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-500 focus:text-red-500 focus:bg-red-50 gap-2">
                                  <Trash2 className="h-4 w-4" /> {debt.isShared ? 'Solicitar Eliminación' : 'Eliminar'}
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
                <Progress value={progress} className={cn('h-2', isApproved && !isPaid ? (isIOU ? '[&>*]:bg-red-500' : '[&>*]:bg-amber-500') : '[&>*]:bg-green-500')} />
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                    <span>Restante</span>
                    <span>{formatCurrency(remaining, debt.currency)}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-4 pt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                {isApproved && !isPaid && !isDeletionRequested && (
                  <AddPaymentDialog debt={debt} onAddPayment={onAddPayment}>
                    <Button variant="outline" size="sm" className="w-full gap-2">
                      <Wallet className="h-4 w-4" /> Añadir Pago
                    </Button>
                  </AddPaymentDialog>
                )}
                {canApprove && (
                    <div className="w-full flex gap-2">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                               <Button variant="outline" className="w-full bg-green-500/10 border-green-500/50 text-green-700 hover:bg-green-500/20 hover:text-green-800 dark:text-green-300">
                                  <ThumbsUp className="h-4 w-4 mr-2"/> Aprobar
                               </Button>
                            </AlertDialogTrigger>
                             <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Aprobar esta deuda?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Al aprobar, confirmas que estás de acuerdo con los detalles de esta deuda y se activará para registrar pagos.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onApproveDebt(debt.id)}>Sí, Aprobar</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog>
                             <AlertDialogTrigger asChild>
                                <Button variant="outline" className="w-full bg-red-500/10 border-red-500/50 text-red-700 hover:bg-red-500/20 hover:text-red-800 dark:text-red-400">
                                   <ThumbsDown className="h-4 w-4 mr-2"/> Rechazar
                                </Button>
                             </AlertDialogTrigger>
                             <RejectDebtDialog onConfirm={(reason) => onRejectDebt(debt.id, reason)} />
                        </AlertDialog>
                    </div>
                )}
                {isDeletionRequested && (
                  <div className="w-full flex gap-2">
                    {canConfirmDeletion ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="w-full">
                            <CheckCircle className="h-4 w-4 mr-2" /> Confirmar Eliminación
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción eliminará permanentemente la deuda para ambos. No se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>No</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onConfirmDeletion(debt.id)} className="bg-destructive hover:bg-destructive/90">Sí, Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <p className="text-xs text-center w-full text-muted-foreground">Esperando confirmación del otro usuario...</p>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => onCancelDeletionRequest(debt.id)}>
                        <XCircle className="h-4 w-4 mr-2" /> Cancelar
                    </Button>
                  </div>
                )}
                <div className="text-xs text-muted-foreground text-left flex-shrink-0 whitespace-nowrap">
                    Creada el <ClientFormattedDate date={debt.createdAt} />
                </div>
                {isRejected && debt.rejectionReason && (
                     <TooltipProvider delayDuration={100}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="text-xs text-red-500 flex items-center gap-1 cursor-help">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>Motivo del rechazo</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{debt.rejectionReason}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                {debt.dueDate && !isPaid && !isRejected && (
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

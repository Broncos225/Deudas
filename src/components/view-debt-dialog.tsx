
"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { Debt, Payment } from '@/lib/types';
import { format, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ScrollArea } from './ui/scroll-area';
import { Timestamp } from 'firebase/firestore';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { MoreHorizontal, Edit, Trash2, ShieldCheck, Scale, Bell } from 'lucide-react';
import { DeletePaymentAlertDialog } from './delete-payment-alert-dialog';
import { EditPaymentDialog } from './edit-payment-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';


interface ViewDebtDialogProps {
  debt: Debt;
  children: React.ReactNode;
  onEditPayment: (debtId: string, paymentId: string, updatedPayment: Partial<Omit<Payment, 'id'>>) => void;
  onDeletePayment: (debtId: string, paymentId: string) => void;
}

const ClientFormattedDate = ({ date, formatString }: { date: string | Date | Timestamp, formatString: string }) => {
    const [formattedDate, setFormattedDate] = useState('');

    useEffect(() => {
        if (!date) {
            setFormattedDate('');
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
            setFormattedDate(format(dateObj, formatString, { locale: es }));
        } else {
            setFormattedDate('');
        }
    }, [date, formatString]);
  
    if (!formattedDate) {
      return null;
    }
  
    return <>{formattedDate}</>;
};

const ImagePreviewDialog = ({ imageUrl, onOpenChange }: { imageUrl: string | null; onOpenChange: (open: boolean) => void }) => {
    return (
      <Dialog open={!!imageUrl} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl p-2">
            <DialogHeader>
              <DialogTitle>Vista Previa de Imagen</DialogTitle>
              <DialogDescription className="sr-only">Imagen ampliada del recibo.</DialogDescription>
            </DialogHeader>
          {imageUrl && (
            <Image
              src={imageUrl}
              alt="Vista previa del recibo"
              width={1200}
              height={1600}
              className="w-full h-auto object-contain max-h-[90vh]"
            />
          )}
        </DialogContent>
      </Dialog>
    );
  };


export function ViewDebtDialog({ debt, children, onEditPayment, onDeletePayment }: ViewDebtDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<{url: string, title: string} | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (debt.receiptUrl) {
        setActiveReceipt({ url: debt.receiptUrl, title: 'Recibo Principal' });
      } else {
        setActiveReceipt(null);
      }
    }
  }, [open, debt.receiptUrl]);

  const calculatePaid = (d: Debt) => d.payments.reduce((sum, p) => sum + p.amount, 0);
  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: currency, minimumFractionDigits: 0 }).format(amount);

  const paid = calculatePaid(debt);
  const remaining = debt.amount - paid;
  const hasItems = debt.items && debt.items.length > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl grid-rows-[auto,1fr] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Detalles de la Deuda: {debt.debtorName}</DialogTitle>
            <DialogDescription className="flex items-center gap-4">
              <span>{debt.concept} - Creada el <ClientFormattedDate date={debt.createdAt} formatString="PPP" /></span>
              {debt.dueDate && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Bell className="h-3 w-3" />
                  Vence el <ClientFormattedDate date={debt.dueDate} formatString="PPP" />
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-full">
            <div className="grid md:grid-cols-2 gap-6 pr-6">
              <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="font-medium text-muted-foreground">Deuda Total:</span> {formatCurrency(debt.amount, debt.currency)}</div>
                    <div><span className="font-medium text-muted-foreground">Total Pagado:</span> {formatCurrency(paid, debt.currency)}</div>
                    <div className="col-span-2 font-semibold"><span className="font-medium text-muted-foreground">Restante:</span> {formatCurrency(remaining, debt.currency)}</div>
                  </div>
                  
                  <Separator />

                  {hasItems && (
                      <div>
                          <h4 className="font-medium mb-2">Ítems de la Deuda</h4>
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                      <TableHead>Ítem</TableHead>
                                      <TableHead className="text-right">Valor</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {debt.items?.map((item, index) => (
                                      <TableRow key={index}>
                                          <TableCell className="font-medium">{item.name}</TableCell>
                                          <TableCell className="text-right">{formatCurrency(item.value, debt.currency)}</TableCell>
                                      </TableRow>
                                  ))}
                              </TableBody>
                          </Table>
                          <Separator className="my-4" />
                      </div>
                  )}
                  
                  <div>
                    <h4 className="font-medium mb-2">Historial de Pagos</h4>
                    {debt.payments.length > 0 ? (
                      
                        <ul className="space-y-2 text-sm">
                          {debt.payments.map((payment) => (
                            <li key={payment.id} className="flex justify-between items-center p-2 rounded-md bg-secondary/80">
                              <div className="flex-1 flex items-center gap-2">
                                {payment.isSettlement && <Scale className="h-4 w-4 text-muted-foreground" title="Pago de cruce" />}
                                <div>
                                    <span className="font-semibold">{formatCurrency(payment.amount, debt.currency)}</span>
                                    <span className="text-muted-foreground block text-xs">
                                        <ClientFormattedDate date={payment.date} formatString="MMM d, yyyy" />
                                    </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {payment.receiptUrl && (
                                  <Button variant="outline" size="sm" onClick={() => payment.receiptUrl && setActiveReceipt({ url: payment.receiptUrl, title: `Recibo del Pago - ${format(payment.date instanceof Timestamp ? payment.date.toDate() : new Date(), "MMM d", { locale: es })}` })}>Ver Recibo</Button>
                                )}
                                {!payment.isSettlement && (
                                    <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6">
                                        <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Acciones del Pago</DropdownMenuLabel>
                                        <EditPaymentDialog debt={debt} payment={payment} onEditPayment={onEditPayment}>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2">
                                                <Edit className="h-4 w-4" /> Editar
                                            </DropdownMenuItem>
                                        </EditPaymentDialog>
                                        <DeletePaymentAlertDialog onDelete={() => onDeletePayment(debt.id, payment.id)}>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-500 focus:text-red-500 focus:bg-red-50 gap-2">
                                            <Trash2 className="h-4 w-4" /> Eliminar
                                        </DropdownMenuItem>
                                        </DeletePaymentAlertDialog>
                                    </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      
                    ) : (
                      <p className="text-sm text-muted-foreground">Aún no se han registrado pagos.</p>
                    )}
                  </div>
              </div>
              <div className="flex flex-col mt-6 md:mt-0">
                {(activeReceipt || debt.receiptUrl) && (
                  <>
                    <div>
                      <h4 className="font-medium mb-2">{activeReceipt?.title || 'Recibo Principal'}</h4>
                      <div className="relative w-full rounded-md border cursor-pointer" onClick={() => setImagePreviewUrl(activeReceipt?.url || debt.receiptUrl || null)}>
                          <Image 
                            src={activeReceipt?.url || debt.receiptUrl!} 
                            alt={`Recibo de ${debt.debtorName}`} 
                            width={400} 
                            height={600} 
                            className="w-full h-auto object-contain"
                            data-ai-hint="receipt document" 
                          />
                      </div>
                      {activeReceipt && activeReceipt.title !== 'Recibo Principal' && debt.receiptUrl && (
                          <Button variant="link" size="sm" onClick={() => setActiveReceipt({url: debt.receiptUrl!, title: 'Recibo Principal'})} className="mt-2 pl-0">Volver al recibo principal</Button>
                      )}
                    </div>
                  </>
                )}
                {!activeReceipt && !debt.receiptUrl && (
                    <div className="h-full flex flex-col items-center justify-center bg-muted/50 rounded-md border border-dashed min-h-48">
                        <p className="text-muted-foreground">No hay recibos adjuntos.</p>
                    </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      <ImagePreviewDialog imageUrl={imagePreviewUrl} onOpenChange={() => setImagePreviewUrl(null)} />
    </>
  );
}

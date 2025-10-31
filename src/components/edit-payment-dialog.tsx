
"use client";

import { useState, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { Debt, Payment } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { FileImage, Calendar as CalendarIcon } from 'lucide-react';
import { fileToDataUrl } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';
import { useStorage, useUser } from '@/firebase';
import { v4 as uuidv4 } from 'uuid';

const paymentFormSchema = z.object({
  amount: z.coerce.number().positive({ message: "El monto debe ser positivo." }),
  date: z.date({ required_error: "La fecha del pago es requerida." }),
  receipt: z.any().optional(),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface EditPaymentDialogProps {
  debt: Debt;
  payment: Payment;
  onEditPayment: (debtId: string, paymentId: string, updatedPayment: Partial<Omit<Payment, 'id'>>) => void;
  children: React.ReactNode;
}

export function EditPaymentDialog({ debt, payment, onEditPayment, children }: EditPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { user } = useUser();


  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amount: 0,
      date: new Date(),
    }
  });

  useEffect(() => {
    if (open) {
      setSelectedFile(null);
      form.reset({
        amount: payment.amount,
        date: payment.date instanceof Timestamp ? payment.date.toDate() : new Date(),
      });
    }
  }, [open, payment, form]);


  async function onSubmit(data: PaymentFormValues) {
    if (!user) return;

    let receiptDataUrl: string | undefined = undefined;
    
    if (selectedFile) {
        const { id: toastId } = toast({ title: 'Procesando recibo...' });
        try {
            receiptDataUrl = await fileToDataUrl(selectedFile, 400, 600, 0.7);
            toast({ id: toastId, title: 'Recibo procesado' });
        } catch (error) {
            console.error("Receipt processing error:", error);
            toast({ id: toastId, variant: 'destructive', title: 'Error al procesar recibo', description: 'No se pudo procesar la imagen del recibo.' });
            return;
        }
    }

    const updatedPayment: Partial<Omit<Payment, 'id'>> = {
      amount: data.amount,
      date: Timestamp.fromDate(data.date),
      receiptUrl: receiptDataUrl || payment.receiptUrl,
    };
    
    onEditPayment(debt.id, payment.id, updatedPayment);
    toast({
      title: "Pago Actualizado",
      description: `El pago ha sido actualizado correctamente.`,
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Pago para {debt.debtorName}</DialogTitle>
          <DialogDescription>
            Modifica los detalles de este pago.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto del Pago ({debt.currency})</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value ?? 0}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha del Pago</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: es })
                          ) : (
                            <span>Elige una fecha</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormItem>
              <FormLabel>Reemplazar Comprobante (Opcional)</FormLabel>
              <FormControl>
                <div className="relative">
                  <FileImage className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="file"
                    className="pl-10"
                    accept="image/*"
                    onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
            <DialogFooter>
              <Button type="submit">Guardar Cambios</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

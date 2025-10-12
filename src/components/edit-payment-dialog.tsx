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
import { FileImage } from 'lucide-react';
import { fileToDataUrl } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';

const paymentFormSchema = z.object({
  amount: z.coerce.number().positive({ message: "El monto debe ser positivo." }),
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

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
  });

  useEffect(() => {
    if (open) {
      form.reset({
        amount: payment.amount,
        receipt: undefined,
      });
    }
  }, [open, payment, form]);


  async function onSubmit(data: PaymentFormValues) {
    let receiptDataUrl: string | undefined = undefined;
    if (data.receipt?.[0]) {
      try {
        receiptDataUrl = await fileToDataUrl(data.receipt[0]);
      } catch (error) {
        toast({
            variant: "destructive",
            title: "Error de Imagen",
            description: "No se pudo procesar la imagen del recibo.",
        });
        return;
      }
    }

    const updatedPayment: Partial<Omit<Payment, 'id'>> = {
      amount: data.amount,
      date: payment.date, // Preserve original date
    };
    
    if (receiptDataUrl) {
      updatedPayment.receiptUrl = receiptDataUrl;
    }

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
              name="receipt"
              render={({ field: { onChange, value, ...fieldProps } }) => (
                <FormItem>
                  <FormLabel>Reemplazar Comprobante (Opcional)</FormLabel>
                  <FormControl>
                     <div className="relative">
                      <FileImage className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input 
                        type="file" 
                        className="pl-10" 
                        accept="image/*"
                        onChange={(e) => onChange(e.target.files)}
                        {...fieldProps}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Guardar Cambios</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

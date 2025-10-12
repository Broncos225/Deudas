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

const paymentFormSchema = z.object({
  amount: z.coerce.number().positive({ message: "El monto debe ser positivo." }),
  receipt: z.any().optional(),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface AddPaymentDialogProps {
  debt: Debt;
  onAddPayment: (debtId: string, newPayment: Omit<Payment, 'id' | 'date'>) => void;
  children: React.ReactNode;
}

export function AddPaymentDialog({ debt, onAddPayment, children }: AddPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const formatCurrency = (amount: number, currency: string) => new Intl.NumberFormat("es-CO", { style: "currency", currency, minimumFractionDigits: 0 }).format(amount);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amount: 0,
      receipt: undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        amount: 0,
        receipt: undefined,
      });
    }
  }, [open, form]);

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

    const newPayment: Omit<Payment, 'id' | 'date'> = {
      amount: data.amount,
      ...(receiptDataUrl && { receiptUrl: receiptDataUrl }),
    };

    onAddPayment(debt.id, newPayment);
    toast({
      title: "Pago Registrado",
      description: `Se ha añadido un pago de ${formatCurrency(data.amount, debt.currency)} para ${debt.debtorName}.`,
    });
    setOpen(false);
    form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Añadir Pago para {debt.debtorName}</DialogTitle>
          <DialogDescription>
            Registrar un nuevo pago para esta deuda. La deuda total es {formatCurrency(debt.amount, debt.currency)}.
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
                    <Input type="number" placeholder="50.00" {...field} />
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
                  <FormLabel>Comprobante (Opcional)</FormLabel>
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
              <Button type="submit">Registrar Pago</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


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
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';

const paymentFormSchema = z.object({
  paymentType: z.enum(["parcial", "total"], { required_error: "Debes seleccionar un tipo de pago." }),
  amount: z.coerce.number().positive({ message: "El monto debe ser positivo." }),
  date: z.date({ required_error: "La fecha del pago es requerida." }),
  receipt: z.any().optional(),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface AddPaymentDialogProps {
  debt: Debt;
  onAddPayment: (debtId: string, newPayment: Omit<Payment, 'id'>) => void;
  children: React.ReactNode;
}

export function AddPaymentDialog({ debt, onAddPayment, children }: AddPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const formatCurrency = (amount: number, currency: string) => new Intl.NumberFormat("es-CO", { style: "currency", currency, minimumFractionDigits: 0 }).format(amount);
  const [selectedFile, setSelectedFile] = useState<FileList | null>(null);

  const calculateRemaining = (d: Debt) => d.amount - d.payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingAmount = calculateRemaining(debt);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amount: 0,
      paymentType: "parcial",
      date: new Date(),
    },
  });

  const paymentType = form.watch("paymentType");

  useEffect(() => {
    if (open) {
      setSelectedFile(null);
      form.reset({
        amount: 0,
        paymentType: "parcial",
        date: new Date(),
      });
    }
  }, [open, form]);

  useEffect(() => {
    if (paymentType === 'total') {
        form.setValue('amount', remainingAmount);
    }
  }, [paymentType, remainingAmount, form]);


  async function onSubmit(data: PaymentFormValues) {
    let receiptDataUrl: string | undefined = undefined;
    
    if (selectedFile && selectedFile.length > 0) {
      try {
        receiptDataUrl = await fileToDataUrl(selectedFile[0]);
      } catch (error) {
        toast({
            variant: "destructive",
            title: "Error de Imagen",
            description: "No se pudo procesar la imagen del recibo.",
        });
        return;
      }
    }

    const newPayment: Omit<Payment, 'id'> = {
      amount: data.amount,
      date: Timestamp.fromDate(data.date),
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
            Deuda total: {formatCurrency(debt.amount, debt.currency)}. Saldo restante: {formatCurrency(remainingAmount, debt.currency)}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
             <FormField
              control={form.control}
              name="paymentType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Tipo de Pago</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex space-x-4"
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="parcial" />
                        </FormControl>
                        <FormLabel className="font-normal">Pago Parcial</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="total" />
                        </FormControl>
                        <FormLabel className="font-normal">Pago Total</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto del Pago ({debt.currency})</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="50.00" {...field} disabled={paymentType === 'total'} />
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
              <FormLabel>Comprobante (Opcional)</FormLabel>
              <FormControl>
                <div className="relative">
                  <FileImage className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="file"
                    className="pl-10"
                    accept="image/*"
                    onChange={(e) => setSelectedFile(e.target.files)}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
            <DialogFooter>
              <Button type="submit">Registrar Pago</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

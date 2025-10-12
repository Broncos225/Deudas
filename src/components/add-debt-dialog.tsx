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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileImage, PlusCircle } from "lucide-react";
import type { Debt, Debtor } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { fileToDataUrl } from '@/lib/utils';

const debtFormSchema = z.object({
  debtorId: z.string({ required_error: "Debes seleccionar un deudor." }),
  concept: z.string().min(3, { message: "El concepto debe tener al menos 3 caracteres." }),
  amount: z.coerce.number().positive({ message: "El monto debe ser positivo." }),
  currency: z.string({ required_error: "Se requiere una divisa." }),
  type: z.enum(["iou", "uome"], { required_error: "Debes seleccionar un tipo de deuda." }),
  receipt: z.any().optional(),
});

type DebtFormValues = z.infer<typeof debtFormSchema>;

interface AddDebtDialogProps {
  debtors: Debtor[];
  debtToEdit?: Debt;
  onAddDebt?: (newDebt: Omit<Debt, 'id' | 'payments' | 'createdAt' | 'userId' | 'debtorName'>) => void;
  onEditDebt?: (debtId: string, updatedDebt: Partial<Omit<Debt, 'id'>>, debtorName: string) => void;
  children: React.ReactNode;
}

export function AddDebtDialog({ onAddDebt, onEditDebt, debtors, debtToEdit, children }: AddDebtDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const isEditMode = !!debtToEdit;

  const form = useForm<DebtFormValues>({
    resolver: zodResolver(debtFormSchema),
  });

  useEffect(() => {
    if (isEditMode && debtToEdit) {
      form.reset({
        debtorId: debtToEdit.debtorId,
        concept: debtToEdit.concept,
        amount: debtToEdit.amount,
        currency: debtToEdit.currency,
        type: debtToEdit.type,
      });
    } else {
      form.reset({
        amount: 0,
        currency: "COP",
        type: "iou",
        concept: "",
      });
    }
  }, [isEditMode, debtToEdit, open, form]);


  async function onSubmit(data: DebtFormValues) {
    const selectedDebtor = debtors.find(d => d.id === data.debtorId);
    if (!selectedDebtor) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Deudor no encontrado.",
        });
        return;
    }

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

    if (isEditMode && debtToEdit && onEditDebt) {
        const updatedDebt: Partial<Omit<Debt, 'id'>> = {
            debtorId: data.debtorId,
            concept: data.concept,
            amount: data.amount,
            currency: data.currency,
            type: data.type,
            debtorName: selectedDebtor.name,
        };
        if (receiptDataUrl) {
          updatedDebt.receiptUrl = receiptDataUrl;
        }
        onEditDebt(debtToEdit.id, updatedDebt, selectedDebtor.name);
        toast({
            title: "Deuda Actualizada",
            description: `La deuda de ${selectedDebtor.name} ha sido actualizada.`,
        });
    } else if (onAddDebt) {
        const newDebt: Omit<Debt, 'id' | 'payments' | 'createdAt' | 'userId' | 'debtorName'> = {
          debtorId: data.debtorId,
          concept: data.concept,
          amount: data.amount,
          currency: data.currency,
          type: data.type,
          ...(receiptDataUrl && { receiptUrl: receiptDataUrl }),
        };
        onAddDebt(newDebt);
        toast({
          title: "Deuda Agregada",
          description: `Una nueva deuda para ${selectedDebtor.name} ha sido creada.`,
        });
    }
    
    setOpen(false);
    form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Editar Deuda" : "Agregar Nueva Deuda"}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Modifica los detalles de esta deuda."
              : "Completa los detalles para crear un nuevo registro de deuda."
            }
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
             <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Tipo de deuda</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex space-x-4"
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="iou" />
                        </FormControl>
                        <FormLabel className="font-normal">Tú debes</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="uome" />
                        </FormControl>
                        <FormLabel className="font-normal">Te deben a ti</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="debtorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Persona</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una persona" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {debtors.map(debtor => (
                        <SelectItem key={debtor.id} value={debtor.id}>{debtor.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="concept"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Concepto</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Almuerzo, Préstamo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-3 gap-2">
                <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                    <FormItem className="col-span-2">
                    <FormLabel>Monto</FormLabel>
                    <FormControl>
                        <Input type="number" placeholder="100.00" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Divisa</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Divisa" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        <SelectItem value="COP">COP</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            
            <FormField
              control={form.control}
              name="receipt"
              render={({ field: { onChange, ...fieldProps } }) => (
                <FormItem>
                  <FormLabel>Factura / Recibo (Opcional)</FormLabel>
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
              <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                {isEditMode ? "Guardar Cambios" : "Crear Deuda"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

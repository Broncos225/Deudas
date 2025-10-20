
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
import { PlusCircle } from "lucide-react";
import type { Debtor } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

const debtorFormSchema = z.object({
  name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
  contact: z.string().optional(),
  type: z.enum(["person", "entity"], { required_error: "Debes seleccionar un tipo." }),
  paymentMethod: z.enum(["efectivo", "virtual"], { required_error: "Debes seleccionar un método de pago."}),
  paymentInfo: z.string().optional(),
}).refine(data => {
    if (data.paymentMethod === 'virtual') {
        return !!data.paymentInfo && data.paymentInfo.length > 0;
    }
    return true;
}, {
    message: "La información de pago es requerida para el método virtual.",
    path: ["paymentInfo"],
});

type DebtorFormValues = z.infer<typeof debtorFormSchema>;

interface AddDebtorDialogProps {
  onAddDebtor?: (newDebtor: Omit<Debtor, 'id' | 'userId'>) => void;
  onEditDebtor?: (debtorId: string, updatedDebtor: Omit<Debtor, 'id' | 'userId'>) => void;
  debtorToEdit?: Debtor;
  children?: React.ReactNode;
}

export function AddDebtorDialog({ onAddDebtor, onEditDebtor, debtorToEdit, children }: AddDebtorDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const isEditMode = !!debtorToEdit;

  const form = useForm<DebtorFormValues>({
    resolver: zodResolver(debtorFormSchema),
    defaultValues: {
      type: 'person',
      paymentMethod: 'efectivo',
    }
  });

  const paymentMethod = form.watch("paymentMethod");

  useEffect(() => {
    if (isEditMode && debtorToEdit) {
        form.reset({
            name: debtorToEdit.name,
            contact: debtorToEdit.contact || "",
            type: debtorToEdit.type || 'person',
            paymentMethod: debtorToEdit.paymentMethod || 'efectivo',
            paymentInfo: debtorToEdit.paymentInfo || ""
        });
    } else {
        form.reset({
            name: "",
            contact: "",
            type: 'person',
            paymentMethod: 'efectivo',
            paymentInfo: ""
        });
    }
  }, [isEditMode, debtorToEdit, open, form]);

  function onSubmit(data: DebtorFormValues) {
    if (isEditMode && debtorToEdit && onEditDebtor) {
        onEditDebtor(debtorToEdit.id, data);
        toast({
            title: "Contacto Actualizado",
            description: `La información de ${data.name} ha sido actualizada.`,
        });
    } else if (onAddDebtor) {
        onAddDebtor(data);
        toast({
          title: "Contacto Agregado",
          description: `${data.name} ha sido añadido a tu lista.`,
        });
    }
    setOpen(false);
    form.reset();
  }

  const trigger = children ? (
    <DialogTrigger asChild>{children}</DialogTrigger>
  ) : (
    <DialogTrigger asChild>
      <Button size="sm" className="gap-1 bg-accent hover:bg-accent/90 text-accent-foreground text-xs md:text-sm">
        <PlusCircle className="h-4 w-4" />
        Agregar Contacto
      </Button>
    </DialogTrigger>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Editar Contacto" : "Agregar Nuevo Contacto"}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Modifica los detalles de este contacto."
              : "Añade una nueva persona o entidad a tu lista."
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
                  <FormLabel>Tipo de Contacto</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex space-x-4"
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="person" />
                        </FormControl>
                        <FormLabel className="font-normal">Persona</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="entity" />
                        </FormControl>
                        <FormLabel className="font-normal">Entidad</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contacto (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Email, teléfono, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Método de Pago Preferido</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex space-x-4"
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="efectivo" />
                        </FormControl>
                        <FormLabel className="font-normal">Efectivo</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="virtual" />
                        </FormControl>
                        <FormLabel className="font-normal">Virtual</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {paymentMethod === 'virtual' && (
                <FormField
                control={form.control}
                name="paymentInfo"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Información de Pago Virtual</FormLabel>
                    <FormControl>
                        <Input placeholder="N° de cuenta, Nequi, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            )}
            <DialogFooter>
              <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                {isEditMode ? "Guardar Cambios" : "Crear Contacto"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

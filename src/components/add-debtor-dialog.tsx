
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';

const debtorFormSchema = z.object({
  name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
  contact: z.string().optional(),
  type: z.enum(["person", "entity"], { required_error: "Debes seleccionar un tipo." }),
  paymentMethod: z.enum(["Efectivo", "Transferencia", "Tarjeta", "Otro"], { required_error: "Debes seleccionar un método de pago." }).optional(),
  paymentInfo: z.string().optional(),
  isAppUser: z.boolean().default(false),
  appUserId: z.string().optional(),
}).refine(data => {
    if (data.isAppUser) {
        return !!data.appUserId && data.appUserId.length > 20; // Basic check for UID length
    }
    return true;
}, {
    message: "El código de usuario de la app es requerido y debe ser válido.",
    path: ["appUserId"],
});


type DebtorFormValues = z.infer<typeof debtorFormSchema>;

interface AddDebtorDialogProps {
  onAddDebtor?: (newDebtor: Omit<Debtor, 'id' | 'userId'>) => void;
  onEditDebtor?: (debtorId: string, updatedDebtor: Omit<Debtor, 'id' | 'userId'>, originalDebtor: Debtor) => void;
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
      isAppUser: false,
      name: "",
      contact: "",
      paymentMethod: undefined,
      paymentInfo: "",
      appUserId: "",
    }
  });
  
  const isAppUser = form.watch("isAppUser");

  useEffect(() => {
    if (open) {
      if (isEditMode && debtorToEdit) {
          form.reset({
              name: debtorToEdit.name,
              contact: debtorToEdit.contact || "",
              type: debtorToEdit.type || 'person',
              paymentMethod: debtorToEdit.paymentMethod || undefined,
              paymentInfo: debtorToEdit.paymentInfo || "",
              isAppUser: debtorToEdit.isAppUser || false,
              appUserId: debtorToEdit.appUserId || "",
          });
      } else {
          form.reset({
              name: "",
              contact: "",
              type: 'person',
              paymentMethod: undefined,
              paymentInfo: "",
              isAppUser: false,
              appUserId: "",
          });
      }
    }
  }, [isEditMode, debtorToEdit, open, form]);


  function onSubmit(data: DebtorFormValues) {
    console.log('🎯 AddDebtorDialog onSubmit called');
    console.log('isEditMode:', isEditMode);
    console.log('debtorToEdit:', debtorToEdit);
    console.log('data:', data);
    
    if (isEditMode && debtorToEdit && onEditDebtor) {
        console.log('✅ Calling onEditDebtor with:');
        console.log('  - debtorId:', debtorToEdit.id);
        console.log('  - updatedData:', data);
        console.log('  - originalDebtor:', debtorToEdit);
        
        onEditDebtor(debtorToEdit.id, data, debtorToEdit);
        
        toast({
            title: "Contacto Actualizado",
            description: `La información de ${data.name} ha sido actualizada.`,
        });
    } else if (onAddDebtor) {
        console.log('➕ Calling onAddDebtor');
        onAddDebtor(data);
        toast({
          title: "Contacto Agregado",
          description: `${data.name} ha sido añadido a tu lista.`,
        });
    }
    setOpen(false);
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
            
            <Separator />

            <div>
              <h3 className="text-sm font-medium mb-2">Información de Pago</h3>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Método de Pago Preferido</FormLabel>
                       <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un método" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Efectivo">Efectivo</SelectItem>
                          <SelectItem value="Transferencia">Transferencia</SelectItem>
                          <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                          <SelectItem value="Otro">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentInfo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Detalles de Pago (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="N° de cuenta, Nequi, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            <Separator />

            <div>
               <h3 className="text-sm font-medium mb-3">Vinculación con la App</h3>
                <FormField
                control={form.control}
                name="isAppUser"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                            <FormLabel>¿Es un usuario de la app?</FormLabel>
                            <DialogDescription className="text-xs">
                                Activa esto para compartir deudas.
                            </DialogDescription>
                        </div>
                        <FormControl>
                            <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            />
                        </FormControl>
                    </FormItem>
                )}
                />
                {isAppUser && (
                    <FormField
                    control={form.control}
                    name="appUserId"
                    render={({ field }) => (
                        <FormItem className="mt-4">
                        <FormLabel>Código de Usuario</FormLabel>
                        <FormControl>
                            <Input placeholder="Pega el código de usuario aquí" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                )}
            </div>

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

    

"use client";

import { useState, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
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
import { FileImage, PlusCircle, Calendar as CalendarIcon, Trash2 } from "lucide-react";
import type { Debt, Debtor } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { fileToDataUrl } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';
import { ScrollArea } from './ui/scroll-area';
import { useUser } from '@/firebase';

const debtFormSchema = z.object({
  debtorId: z.string({ required_error: "Debes seleccionar un deudor." }),
  concept: z.string().min(3, { message: "El concepto debe tener al menos 3 caracteres." }),
  amount: z.coerce.number().positive({ message: "El monto debe ser positivo." }),
  currency: z.string({ required_error: "Se requiere una divisa." }),
  type: z.enum(["iou", "uome"], { required_error: "Debes seleccionar un tipo de deuda." }),
  createdAt: z.date({ required_error: "La fecha de creación es requerida."}),
  dueDate: z.date().optional(),
  items: z.array(z.object({
    name: z.string().min(1, { message: "El nombre es requerido." }),
    value: z.coerce.number().positive({ message: "El valor debe ser positivo." }),
  })).optional(),
});

type DebtFormValues = z.infer<typeof debtFormSchema>;

interface AddDebtDialogProps {
  debtors: Debtor[];
  debtToEdit?: Debt;
  onAddDebt?: (newDebt: Omit<Debt, 'id' | 'payments' | 'debtorName'> & { receiptUrl?: string }) => void;
  onEditDebt?: (debtId: string, updatedDebt: Partial<Omit<Debt, 'id'>>, debtorName: string) => void;
  children?: React.ReactNode;
}

export function AddDebtDialog({ onAddDebt, onEditDebt, debtors, debtToEdit, children }: AddDebtDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();
  const isEditMode = !!debtToEdit;
  const [selectedFile, setSelectedFile] = useState<FileList | null>(null);

  const form = useForm<DebtFormValues>({
    resolver: zodResolver(debtFormSchema),
    defaultValues: {
      amount: 0,
      concept: "",
      currency: "COP",
      type: "iou",
      createdAt: new Date(),
      items: [],
      dueDate: undefined,
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedItems = form.watch("items");
  const hasItems = watchedItems && watchedItems.length > 0;

  useEffect(() => {
    if (hasItems) {
      const total = watchedItems.reduce((sum, item) => sum + (item.value || 0), 0);
      form.setValue('amount', total, { shouldValidate: true });
    }
  }, [watchedItems, form, hasItems]);

  useEffect(() => {
    if (open) {
      setSelectedFile(null);
      if (isEditMode && debtToEdit) {
        form.reset({
          debtorId: debtToEdit.debtorId,
          concept: debtToEdit.concept,
          amount: debtToEdit.amount,
          currency: debtToEdit.currency,
          type: debtToEdit.type,
          createdAt: debtToEdit.createdAt.toDate(),
          dueDate: debtToEdit.dueDate ? debtToEdit.dueDate.toDate() : undefined,
          items: debtToEdit.items || [],
        });
      } else {
        form.reset({
          amount: 0,
          currency: "COP",
          type: "iou",
          concept: "",
          debtorId: undefined,
          createdAt: new Date(),
          dueDate: undefined,
          items: [],
        });
      }
    }
  }, [isEditMode, debtToEdit, open, form]);


  async function onSubmit(data: DebtFormValues) {
    if (!user) {
        toast({ variant: "destructive", title: "Error", description: "Debes iniciar sesión para crear una deuda."});
        return;
    }
    const selectedDebtor = debtors.find(d => d.id === data.debtorId);
    if (!selectedDebtor) {
        toast({ variant: "destructive", title: "Error", description: "Deudor no encontrado." });
        return;
    }

    let receiptDataUrl: string | undefined = undefined;
    
    if (selectedFile && selectedFile.length > 0) {
      try {
        receiptDataUrl = await fileToDataUrl(selectedFile[0]);
      } catch (error) {
        toast({ variant: "destructive", title: "Error de Imagen", description: "No se pudo procesar la imagen del recibo."});
        return;
      }
    }
    
    const finalAmount = hasItems ? (data.items || []).reduce((sum, item) => sum + (item.value || 0), 0) : data.amount;

    const baseDebtData: Partial<Debt> = {
        ...data,
        amount: finalAmount,
        items: hasItems ? data.items : [],
        createdAt: Timestamp.fromDate(data.createdAt),
        ...(data.dueDate && { dueDate: Timestamp.fromDate(data.dueDate) }),
        ...(receiptDataUrl && { receiptUrl: receiptDataUrl }),
    };
    
    if (baseDebtData.dueDate === undefined) {
      delete baseDebtData.dueDate;
    }

    // Shared Debt Logic
    if (selectedDebtor.isAppUser && selectedDebtor.appUserId) {
        const participants = [user.uid, selectedDebtor.appUserId].sort();
        baseDebtData.isShared = true;
        baseDebtData.userOneId = participants[0];
        baseDebtData.userTwoId = participants[1];
        baseDebtData.participants = participants;
        delete baseDebtData.userId; // Not needed for shared debts
    } else {
        baseDebtData.userId = user.uid;
        baseDebtData.isShared = false;
    }

    if (isEditMode && debtToEdit && onEditDebt) {
      const updatedDebt: Partial<Omit<Debt, 'id'>> = {
            ...baseDebtData,
            debtorName: selectedDebtor.name,
        };
        // If the contact type changes, we may need to adjust the participants list
        if (updatedDebt.isShared && updatedDebt.userOneId && updatedDebt.userTwoId) {
            updatedDebt.participants = [updatedDebt.userOneId, updatedDebt.userTwoId].sort();
        } else {
            delete updatedDebt.participants;
            delete updatedDebt.userOneId;
            delete updatedDebt.userTwoId;
        }
        onEditDebt(debtToEdit.id, updatedDebt, selectedDebtor.name);
        toast({ title: "Deuda Actualizada", description: `La deuda de ${selectedDebtor.name} ha sido actualizada.` });
    } else if (onAddDebt) {
        onAddDebt(baseDebtData as Omit<Debt, 'id' | 'payments' | 'debtorName'>);
        toast({ title: "Deuda Agregada", description: `Una nueva deuda para ${selectedDebtor.name} ha sido creada.` });
    }
    
    setOpen(false);
    form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
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
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[60vh] pr-6">
            <div className="space-y-4 py-4">
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
            
            <div>
              <FormLabel>Ítems de la Deuda (Opcional)</FormLabel>
              <div className="space-y-2 mt-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <FormField
                      control={form.control}
                      name={`items.${index}.name`}
                      render={({ field }) => (
                        <FormItem className="flex-grow">
                          <FormControl>
                            <Input {...field} placeholder="Nombre del ítem" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.value`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} type="number" placeholder="Valor" className="w-28" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => append({ name: '', value: 0 })}
              >
                Agregar Ítem
              </Button>
            </div>


            <div className="grid grid-cols-3 gap-2">
                <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                    <FormItem className="col-span-2">
                    <FormLabel>Monto</FormLabel>
                    <FormControl>
                        <Input type="number" placeholder="100.00" {...field} disabled={hasItems} />
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="createdAt"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha de Creación</FormLabel>
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
               <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha de Vencimiento (Opcional)</FormLabel>
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
                            date < new Date()
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>


            <FormItem>
              <FormLabel>Factura / Recibo (Opcional)</FormLabel>
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


            </div>
            </ScrollArea>
            <DialogFooter className="pt-4 pr-6">
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

    

"use client";

import type { Debtor } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { User, Mail, Phone, MoreHorizontal, Edit, Trash2, Building, Loader, CreditCard, Banknote } from "lucide-react";
import { AddDebtorDialog } from "./add-debtor-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "./ui/button";
import { DeleteDebtorAlertDialog } from "./delete-debtor-alert-dialog";


interface DebtorDetailsProps {
  debtors: Debtor[];
  onAddDebtor: (newDebtor: Omit<Debtor, 'id' | 'userId'>) => void;
  onEditDebtor: (debtorId: string, updatedDebtor: Omit<Debtor, 'id' | 'userId'>) => void;
  onDeleteDebtor: (debtorId: string) => void;
  isLoading: boolean;
}

export function DebtorDetails({ debtors, onAddDebtor, onEditDebtor, onDeleteDebtor, isLoading }: DebtorDetailsProps) {
  
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
            <Loader className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }
    
    if (debtors.length > 0) {
      return debtors.map((debtor) => (
        <div key={debtor.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-4">
              <div className="p-2 bg-secondary rounded-full">
                 {debtor.type === 'person' ? <User className="h-5 w-5 text-secondary-foreground" /> : <Building className="h-5 w-5 text-secondary-foreground" />}
              </div>
              <div className="flex-1">
                  <p className="font-semibold">{debtor.name}</p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {debtor.contact && (
                        <p className="flex items-center gap-1">
                            {debtor.contact.includes('@') ? <Mail className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
                            {debtor.contact}
                        </p>
                    )}
                    {debtor.paymentMethod === 'virtual' && debtor.paymentInfo && (
                         <p className="flex items-center gap-1">
                            <CreditCard className="h-3 w-3" />
                            {debtor.paymentInfo}
                        </p>
                    )}
                     {debtor.paymentMethod === 'efectivo' && (
                         <p className="flex items-center gap-1">
                            <Banknote className="h-3 w-3" />
                            Efectivo
                        </p>
                    )}
                  </div>
              </div>
          </div>
          <div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button aria-haspopup="true" size="icon" variant="ghost" className="h-6 w-6 md:h-8 md:w-8">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Toggle menu</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                    <AddDebtorDialog debtorToEdit={debtor} onEditDebtor={onEditDebtor}>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2">
                            <Edit className="h-4 w-4" /> Editar
                        </DropdownMenuItem>
                    </AddDebtorDialog>
                    <DropdownMenuSeparator />
                    <DeleteDebtorAlertDialog onDelete={() => onDeleteDebtor(debtor.id)}>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-500 focus:text-red-500 focus:bg-red-50 gap-2">
                          <Trash2 className="h-4 w-4" /> Eliminar
                      </DropdownMenuItem>
                    </DeleteDebtorAlertDialog>
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ));
    }
    
    return (
        <div className="text-center py-10">
          <p className="text-muted-foreground">No has agregado a ningún contacto todavía.</p>
          <p className="text-muted-foreground text-sm">Empieza por añadir a alguien o algo.</p>
        </div>
    );
  }


  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>Contactos</CardTitle>
            <CardDescription>
                Tu lista de personas y entidades.
            </CardDescription>
        </div>
        <AddDebtorDialog onAddDebtor={onAddDebtor} />
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {renderContent()}
        </div>
      </CardContent>
    </Card>
  );
}

    

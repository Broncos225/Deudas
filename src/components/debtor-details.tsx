"use client";

import type { Debtor } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { User, Mail, Phone, MoreHorizontal, Edit, Trash2, Building, Loader, CreditCard, Link as LinkIcon, Banknote, History } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";


interface DebtorDetailsProps {
  debtors: Debtor[];
  onAddDebtor: (newDebtor: Omit<Debtor, 'id' | 'userId'>) => void;
  onEditDebtor: (debtorId: string, updatedDebtor: Omit<Debtor, 'id' | 'userId'>, originalDebtor: Debtor) => void;
  onDeleteDebtor: (debtorId: string) => void;
  onSyncDebts: (debtorId: string) => void;
  isLoading: boolean;
}

const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length > 1 && parts[0] && parts[1]) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}


export function DebtorDetails({ debtors, onAddDebtor, onEditDebtor, onDeleteDebtor, onSyncDebts, isLoading }: DebtorDetailsProps) {
  
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
            <Loader className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }
    
    if (debtors.length > 0) {
      return debtors.map((debtor) => {
        return (
            <div key={debtor.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-4">
                <Avatar className="h-10 w-10">
                    {debtor.isAppUser && debtor.appUserPhotoUrl ? (
                         <AvatarImage src={debtor.appUserPhotoUrl} alt={debtor.name} />
                    ) : (
                        debtor.isAppUser && <AvatarImage src={`https://avatar.vercel.sh/${debtor.appUserId}.png`} alt={debtor.name} />
                    )}
                    <AvatarFallback className="bg-secondary text-secondary-foreground">
                        {getInitials(debtor.name)}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <p className="font-semibold">{debtor.name}</p>
                    <div className="text-sm text-muted-foreground space-y-1 mt-1">
                        {debtor.isAppUser && debtor.appUserId && (
                          <div className="flex items-center gap-2">
                            <p className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                                <LinkIcon className="h-3 w-3" />
                                Usuario de la app vinculado
                            </p>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-6 px-2 gap-1 text-xs">
                                  <History className="h-3 w-3" />
                                  Sincronizar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Sincronizar deudas antiguas?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción buscará todas las deudas privadas que tengas con <strong>{debtor.name}</strong> y las convertirá en deudas compartidas.
                                    Ambos podrán verlas. Esta acción no se puede deshacer fácilmente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => onSyncDebts(debtor.id)}>
                                    Sí, sincronizar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                        {debtor.contact && (
                            <p className="flex items-center gap-1.5">
                                {debtor.contact.includes('@') ? <Mail className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
                                {debtor.contact}
                            </p>
                        )}
                        {debtor.paymentMethod && (
                            <p className="flex items-center gap-1.5">
                                {debtor.paymentMethod === 'Efectivo' && <Banknote className="h-3 w-3" />}
                                {debtor.paymentMethod !== 'Efectivo' && <CreditCard className="h-3 w-3" />}
                                {debtor.paymentMethod}
                                {debtor.paymentInfo && <span className="text-xs text-muted-foreground/80">({debtor.paymentInfo})</span>}
                            </p>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
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
        )
      });
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


"use client";

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
import { useToast } from "@/hooks/use-toast";

interface DeleteDebtAlertDialogProps {
  onDelete: () => void;
  children: React.ReactNode;
  isShared: boolean;
}

export function DeleteDebtAlertDialog({ onDelete, children, isShared }: DeleteDebtAlertDialogProps) {
  const { toast } = useToast();

  const handleDelete = () => {
    onDelete();
  };

  const title = isShared ? "¿Solicitar Eliminación?" : "¿Estás absolutamente seguro?";
  const description = isShared 
    ? "Se enviará una solicitud a la otra persona para confirmar la eliminación de esta deuda. La deuda se borrará para ambos una vez que sea aceptada."
    : "Esta acción no se puede deshacer. Esto eliminará permanentemente la deuda de nuestros servidores.";
  const cta = isShared ? "Sí, solicitar eliminación" : "Sí, eliminar deuda";


  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
            {cta}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

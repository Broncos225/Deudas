"use client";

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
import { useToast } from "@/hooks/use-toast";

interface SettleDebtsDialogProps {
  debtorName: string;
  iouTotal: number;
  uomeTotal: number;
  currency: string;
  onConfirm: () => void;
  children: React.ReactNode;
}

export function SettleDebtsDialog({ debtorName, iouTotal, uomeTotal, currency, onConfirm, children }: SettleDebtsDialogProps) {
  const { toast } = useToast();
  const formatCurrency = (amount: number, currency: string) => new Intl.NumberFormat("es-CO", { style: "currency", currency, minimumFractionDigits: 0 }).format(amount);

  const settlementAmount = Math.min(iouTotal, uomeTotal);
  const finalBalance = uomeTotal - iouTotal;

  const handleConfirm = () => {
    onConfirm();
    toast({
      title: "Cruce de Cuentas Realizado",
      description: `Se han cruzado ${formatCurrency(settlementAmount, currency)} con ${debtorName}.`,
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        {children}
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Cruzar Cuentas con {debtorName}</DialogTitle>
          <DialogDescription>
            Revisa los detalles del cruce antes de confirmar. Esta acción modificará tus deudas activas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 text-sm">
            <div className="flex justify-between p-3 rounded-md bg-muted">
                <span>Total que debes:</span>
                <span className="font-semibold">{formatCurrency(iouTotal, currency)}</span>
            </div>
            <div className="flex justify-between p-3 rounded-md bg-muted">
                <span>Total que te deben:</span>
                <span className="font-semibold">{formatCurrency(uomeTotal, currency)}</span>
            </div>
            <div className="flex justify-between p-3 rounded-md bg-primary/10 text-primary-foreground">
                <span className="font-bold text-primary">Monto a cruzar:</span>
                <span className="font-bold text-primary">{formatCurrency(settlementAmount, currency)}</span>
            </div>
             <div className="flex justify-between p-3 rounded-md bg-secondary text-secondary-foreground">
                <span className="font-bold">Nuevo Saldo:</span>
                <span className="font-bold">
                    {finalBalance < 0 
                        ? `Quedas debiendo ${formatCurrency(Math.abs(finalBalance), currency)}`
                        : finalBalance > 0
                        ? `Te quedan debiendo ${formatCurrency(finalBalance, currency)}`
                        : "Cuentas saldadas"
                    }
                </span>
            </div>
            <p className="text-xs text-muted-foreground pt-2">
                Al confirmar, se marcarán las deudas correspondientes como pagadas por el monto del cruce y se creará una nueva deuda por el saldo restante, si lo hay.
            </p>
        </div>
        <DialogFooter>
          <DialogTrigger asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogTrigger>
          <DialogTrigger asChild>
            <Button onClick={handleConfirm}>Confirmar Cruce</Button>
          </DialogTrigger>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    
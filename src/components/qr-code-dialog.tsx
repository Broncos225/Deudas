
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QRCodeSVG } from 'qrcode.react';

interface QrCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

export function QrCodeDialog({ open, onOpenChange, userId, userName }: QrCodeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Comparte tu Código</DialogTitle>
          <DialogDescription>
            Pídele a la otra persona que escanee este código QR para vincular sus cuentas al instante.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center p-4">
            <div className="p-4 bg-white rounded-lg border">
                <QRCodeSVG 
                    value={userId} 
                    size={256}
                    includeMargin={true}
                    aria-label={`Código QR para ${userName}`}
                />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Tu código de usuario:</p>
            <code className="text-xs bg-muted text-muted-foreground rounded-sm px-2 py-1 mt-1 break-all text-center">
                {userId}
            </code>
        </div>
      </DialogContent>
    </Dialog>
  );
}

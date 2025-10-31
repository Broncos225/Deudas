"use client";

import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Html5QrcodeScanner } from 'html5-qrcode';

interface QrScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanSuccess: (result: string) => void;
}

const QR_SCANNER_CONTAINER_ID = "html5-qr-scanner";

export function QrScannerDialog({ open, onOpenChange, onScanSuccess }: QrScannerDialogProps) {

  useEffect(() => {
    if (open) {
      const scanner = new Html5QrcodeScanner(
        QR_SCANNER_CONTAINER_ID,
        { 
          qrbox: {
            width: 250,
            height: 250,
          },
          fps: 10,
        },
        /* verbose= */ false
      );

      const handleSuccess = (decodedText: string) => {
        scanner.clear();
        onScanSuccess(decodedText);
      };

      const handleError = (errorMessage: string) => {
        // console.error(`QR Scanner Error: ${errorMessage}`);
      };

      scanner.render(handleSuccess, handleError);

      return () => {
        // Cleanup function to stop the scanner when the dialog is closed or component unmounts
        if (scanner) {
          scanner.clear().catch(error => {
            console.error("Failed to clear html5-qrcode scanner.", error);
          });
        }
      };
    }
  }, [open, onScanSuccess]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escanear Código QR</DialogTitle>
          <DialogDescription>
            Apunta la cámara al código QR de la otra persona.
          </DialogDescription>
        </DialogHeader>
        <div id={QR_SCANNER_CONTAINER_ID} className="w-full" />
      </DialogContent>
    </Dialog>
  );
}

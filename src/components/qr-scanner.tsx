"use client";

import { useEffect, useRef } from 'react';
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
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (open && !isInitializedRef.current) {
      const container = document.getElementById(QR_SCANNER_CONTAINER_ID);
      if (!container) return;

      // Clear any previous scanner instances
      container.innerHTML = '';
      isInitializedRef.current = true;
      
      const timeoutId = setTimeout(() => {
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
        scannerRef.current = scanner;
  
        const handleSuccess = (decodedText: string) => {
          if (scannerRef.current) {
            scannerRef.current.clear();
            scannerRef.current = null;
          }
          onScanSuccess(decodedText);
        };
  
        const handleError = (errorMessage: string) => {
          // console.error(`QR Scanner Error: ${errorMessage}`);
        };
  
        scanner.render(handleSuccess, handleError);
      }, 100);

      return () => {
        clearTimeout(timeoutId);
      }
    }
  }, [open, onScanSuccess]);

  // Cleanup effect when the dialog is closed
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear html5-qrcode scanner on unmount.", error);
        });
        scannerRef.current = null;
      }
      isInitializedRef.current = false;
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escanear Código QR</DialogTitle>
          <DialogDescription>
            Apunta la cámara al código QR de la otra persona.
          </DialogDescription>
        </DialogHeader>
        <div id={QR_SCANNER_CONTAINER_ID} className="w-full min-h-[300px]" />
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";

export function ScannerModal({
  open,
  onOpenChange,
  onDetected,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDetected: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setStarting(true);

    const reader = new BrowserMultiFormatReader();

    (async () => {
      try {
        // Prefer rear camera on mobile
        let deviceId: string | undefined;
        try {
          const devices = await BrowserMultiFormatReader.listVideoInputDevices();
          const back = devices.find((d) => /back|rear|traseira|environment/i.test(d.label));
          deviceId = (back ?? devices[0])?.deviceId;
        } catch {
          /* ignore — fall back to constraints */
        }

        const constraints: MediaStreamConstraints = deviceId
          ? { video: { deviceId: { exact: deviceId } }, audio: false }
          : { video: { facingMode: { ideal: "environment" } }, audio: false };

        const controls = await reader.decodeFromConstraints(
          constraints,
          videoRef.current!,
          (result) => {
            if (result) {
              const code = result.getText();
              if (code) {
                onDetected(code);
              }
            }
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStarting(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Não foi possível acessar a câmera.");
          setStarting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      try { controlsRef.current?.stop(); } catch { /* noop */ }
      controlsRef.current = null;
    };
  }, [open, onDetected]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Escanear código de barras</DialogTitle>
        </DialogHeader>

        <div className="relative w-full aspect-[4/3] bg-black rounded-md overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
          />
          {/* Guia de enquadramento */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[80%] h-[35%] border-2 border-white/90 rounded-md shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Iniciando câmera...
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-sm p-4 text-center">
              {error}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Posicione o código de barras dentro do retângulo.
        </p>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

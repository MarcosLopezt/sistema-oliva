"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { whatsappDigits } from "@/lib/materia-prima";

export function ProviderOrderDialog({
  open,
  onOpenChange,
  provider,
  phone,
  message,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: string;
  phone: string | null;
  message: string;
}) {
  const [copied, setCopied] = useState(false);
  const digits = whatsappDigits(phone);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success("Pedido copiado al portapapeles.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar. Seleccioná y copiá manualmente.");
    }
  }

  function shareWhatsApp() {
    if (!digits) return;
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pedido para {provider}</DialogTitle>
          <DialogDescription>
            Cantidades definitivas (con merma y redondeo a la unidad de venta).
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={message}
          readOnly
          rows={Math.min(16, message.split("\n").length + 1)}
          className="font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        {!digits && (
          <p className="text-xs text-muted-foreground">
            Agregá el teléfono del proveedor para habilitar WhatsApp.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={copy}>
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
            Copiar texto
          </Button>
          {digits && (
            <Button onClick={shareWhatsApp}>
              <MessageCircle className="size-4" />
              Compartir por WhatsApp
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

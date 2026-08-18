"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/app-sidebar";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Cerrar el menú al navegar. Se ajusta durante el render (no en un effect)
  // comparando contra la ruta anterior: así el menú ya sale cerrado en el
  // primer pintado de la página nueva, sin un render extra.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Abrir menú"
        className="md:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 gap-0 p-0 pt-10">
          <SheetTitle className="sr-only">Navegación</SheetTitle>
          <AppSidebar />
        </SheetContent>
      </Sheet>
    </>
  );
}

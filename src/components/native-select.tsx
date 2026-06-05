import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Select nativo estilizado al tema. Lo usamos en formularios por simplicidad y
 * robustez (evita la complejidad del Select de Base UI para casos simples).
 */
export function NativeSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

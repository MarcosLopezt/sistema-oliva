import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CalendarClock, CheckCircle2 } from "lucide-react";

export default function EventosPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Eventos</h1>
        <p className="text-muted-foreground">
          Próximos eventos primero. Creá un evento para empezar a costear.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4 text-primary" />
              Eventos activos
            </CardTitle>
            <CardDescription>Ordenados por proximidad de fecha.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Todavía no hay eventos activos.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-primary" />
              Finalizados
            </CardTitle>
            <CardDescription>Historial de eventos pasados.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            El historial aparecerá acá.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

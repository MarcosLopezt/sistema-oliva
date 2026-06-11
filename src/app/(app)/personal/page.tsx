"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Wallet, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StaffDialog } from "@/components/personal/staff-dialog";
import { useStaff } from "@/lib/hooks";
import { formatARS } from "@/lib/format";
import { STAFF_CATEGORIES, staffCategoryLabel, type Staff } from "@/lib/types";

export default function PersonalPage() {
  const { data: staff, isLoading, error } = useStaff();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("active");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (staff ?? []).filter((s) => {
      if (category !== "all" && s.category !== category) return false;
      if (status === "active" && !s.active) return false;
      if (status === "inactive" && s.active) return false;
      if (term && !s.full_name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [staff, search, category, status]);

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(s: Staff) {
    setEditing(s);
    setDialogOpen(true);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Personal</h1>
          <p className="text-muted-foreground">
            Empleados reutilizables en todos los eventos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            nativeButton={false}
            render={<Link href="/personal/pagos" />}
            variant="outline"
          >
            <Wallet className="size-4" />
            Pagos
          </Button>
          <Button onClick={openNew}>
            <Plus className="size-4" />
            Nuevo empleado
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre…"
            className="pl-9"
          />
        </div>
        <NativeSelect
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-44"
        >
          <option value="all">Todas las categorías</option>
          {STAFF_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="w-36"
        >
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="all">Todos</option>
        </NativeSelect>
      </div>

      {error && (
        <p className="text-sm text-destructive">Error al cargar: {error.message}</p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {staff && staff.length > 0
            ? "Ningún empleado coincide con el filtro."
            : "Todavía no hay empleados. Creá el primero con “Nuevo empleado”."}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-right">$ / hora</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-px text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {staffCategoryLabel(s.category)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.role || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatARS(s.hourly_rate)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.active ? "default" : "secondary"}>
                      {s.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(s)}
                        aria-label="Editar"
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <StaffDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        staff={editing}
      />
    </div>
  );
}

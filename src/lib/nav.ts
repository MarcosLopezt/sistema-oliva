import {
  CalendarDays,
  BookOpen,
  Truck,
  Carrot,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Secciones principales de la app. Algunas se construyen en fases siguientes. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Eventos", icon: CalendarDays },
  { href: "/recetas", label: "Recetas", icon: BookOpen },
  { href: "/proveedores", label: "Proveedores", icon: Truck },
  { href: "/personal", label: "Personal", icon: Users },
  { href: "/ingredientes", label: "Ingredientes", icon: Carrot },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

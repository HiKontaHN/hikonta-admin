"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { HiKontaIcon } from "@/components/shared/hikonta-icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Home, Users, Crown, Shield, LogOut, Menu, X,
  ChevronsLeft, ChevronsRight,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Resumen", icon: Home },
  { href: "/users", label: "Usuarios", icon: Users },
  { href: "/plans", label: "Planes", icon: Crown },
  { href: "/admins", label: "Administradores", icon: Shield },
];

// Recordar el estado colapsado entre sesiones — no tiene sentido que se
// reabra expandida cada vez que se navega o se refresca la página.
const SIDEBAR_COLLAPSED_KEY = "hikonta-admin:sidebar-collapsed";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { me, loading, denied, bypassing, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }

  useEffect(() => {
    // "denied" es sesión válida sin acceso (no está en `admins`, o está
    // desactivado) — no se manda a /login (evitaría un loop), se muestra
    // la pantalla de acceso denegado más abajo.
    if (!loading && !me && !denied) router.replace("/login");
  }, [loading, me, denied, router]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
      </div>
    );
  }

  if (denied) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <Shield className="size-6 text-destructive" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Acceso denegado</h1>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            Esta cuenta no tiene acceso al panel de administración. Si crees que es un error,
            pedile a otro administrador que revise la tabla <code>admins</code> en Neon.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => signOut()}>
          Cerrar sesión
        </Button>
      </div>
    );
  }

  if (!me) return null;

  const currentLabel =
    NAV.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"))?.label
    ?? "HiKonta Admin";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — desktop, fija (sticky) y colapsable */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-card transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <SidebarContent pathname={pathname} collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      </aside>

      {/* Drawer — mobile */}
      {navOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
          <aside className="relative flex w-64 flex-col border-r bg-card">
            <div className="flex justify-end p-2">
              <Button variant="ghost" size="icon" onClick={() => setNavOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <SidebarContent pathname={pathname} collapsed={false} onToggleCollapse={null} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Navbar — fija arriba, visible en todos los tamaños. El sidebar
            guarda la navegación; acá vive lo que hace falta ver siempre:
            de dónde estás parado, modo oscuro y cerrar sesión. */}
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={() => setNavOpen(true)}>
              <Menu className="size-5" />
            </Button>
            <span className="truncate text-sm font-semibold">{currentLabel}</span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <ThemeToggle />
            <span className="hidden max-w-40 truncate text-xs text-muted-foreground sm:inline">
              {me.displayName ?? me.email}
            </span>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => signOut()}>
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </Button>
          </div>
        </header>

        {bypassing && (
          <div className="bg-warning px-4 py-2 text-center text-xs font-semibold text-warning-foreground">
            ⚠️ NEXT_PUBLIC_BYPASS_AUTH está activo — nadie está autenticando de verdad. Apagarlo
            antes de desplegar.
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  collapsed,
  onToggleCollapse,
}: {
  pathname: string;
  collapsed: boolean;
  onToggleCollapse: (() => void) | null;
}) {
  return (
    <>
      <div className={cn("flex items-center gap-2.5 border-b px-5 py-4", collapsed && "justify-center px-0")}>
        <HiKontaIcon className="h-8 w-8 shrink-0" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">HiKonta</p>
            <p className="truncate text-xs leading-tight text-muted-foreground">Administración</p>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-2",
                active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* El toggle de colapsar solo existe en el sidebar fijo de desktop —
          el drawer mobile es temporal, no tiene sentido colapsarlo. */}
      {onToggleCollapse && (
        <div className="border-t p-3">
          <Button
            variant="ghost"
            size="sm"
            className={cn("w-full gap-2 text-muted-foreground", collapsed ? "justify-center px-0" : "justify-start")}
            onClick={onToggleCollapse}
            title={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            {!collapsed && "Colapsar"}
          </Button>
        </div>
      )}
    </>
  );
}

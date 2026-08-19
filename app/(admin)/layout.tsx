"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Shield, LogOut } from "lucide-react";

// Mismo patrón que app/(dashboard)/layout.tsx en yelifin-sistema:
// SidebarProvider + AppSidebar + SidebarInset, sidebar pegada (variant
// "sidebar", no "floating") para que no quede el hueco entre sidebar y
// header que había con el layout casero anterior.
const NAV_LABELS: Record<string, string> = {
  "/dashboard": "Resumen",
  "/users": "Usuarios",
  "/plans": "Planes",
  "/payments": "Pagos",
  "/partners": "Partners",
  "/admins": "Administradores",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { me, loading, denied, bypassing, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // "denied" es sesión válida sin acceso (no está en `admins`, o está
    // desactivado) — no se manda a /login (evitaría un loop), se muestra
    // la pantalla de acceso denegado más abajo.
    if (!loading && !me && !denied) router.replace("/login");
  }, [loading, me, denied, router]);

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
    Object.entries(NAV_LABELS).find(([href]) => pathname === href || pathname.startsWith(href + "/"))?.[1]
    ?? "HiKonta Admin";

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar />

      <SidebarInset className="flex flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 py-4 lg:px-6">
          <SidebarTrigger className="-ml-1 md:hidden" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <span className="truncate text-sm font-semibold">{currentLabel}</span>

          <div className="ml-auto flex items-center gap-2">
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

        <main className="h-full flex-1 overflow-auto p-4 pb-0 lg:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

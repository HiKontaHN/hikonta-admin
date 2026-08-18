"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { HiKontaIcon } from "@/components/shared/hikonta-icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Home, Users, Crown, LogOut, Menu, X, Shield } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Resumen", icon: Home },
  { href: "/users", label: "Usuarios", icon: Users },
  { href: "/plans", label: "Planes", icon: Crown },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { me, loading, denied, bypassing, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

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

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
        <SidebarContent pathname={pathname} me={me} bypassing={bypassing} signOut={signOut} />
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
            <SidebarContent pathname={pathname} me={me} bypassing={bypassing} signOut={signOut} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Navbar — mobile */}
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setNavOpen(true)}>
            <Menu className="size-5" />
          </Button>
          <HiKontaIcon className="h-7 w-7" />
          <ThemeToggle />
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
  me,
  bypassing,
  signOut,
}: {
  pathname: string;
  me: { email: string; displayName: string | null };
  bypassing: boolean;
  signOut: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2.5 border-b px-5 py-4">
        <HiKontaIcon className="h-8 w-8" />
        <div>
          <p className="text-sm font-semibold leading-tight">HiKonta</p>
          <p className="text-xs text-muted-foreground leading-tight">Administración</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{me.displayName ?? me.email}</p>
            {bypassing && <p className="text-[10px] text-warning">bypass activo</p>}
          </div>
          <ThemeToggle />
        </div>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => signOut()}>
          <LogOut className="size-4" />
          Cerrar sesión
        </Button>
      </div>
    </>
  );
}

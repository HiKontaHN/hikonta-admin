// app/(admin)/users/page.tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAdminUsers, useAdminPlans, useAdminCreateUser } from "@/hooks/swr/use-admin";
import { Input }    from "@/components/ui/input";
import { Button }   from "@/components/ui/button";
import { Badge }    from "@/components/ui/badge";
import { Label }    from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Search, CheckCircle2, XCircle, Clock, UserPlus, Loader2, Eye, EyeOff,
} from "lucide-react";
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis,
} from "@/components/ui/pagination";
import { useDebounce } from "@/hooks/use-debounce";

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(date: string | null): string {
  if (!date) return "—";
  const diff = Date.now() - new Date(date).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)   return "hace un momento";
  if (mins < 60)  return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30)  return `hace ${days}d`;
  return new Date(date).toLocaleDateString("es-HN", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_LABEL: Record<string, string> = {
  TRIAL: "Prueba", ACTIVE: "Activa", CANCELLED: "Cancelada",
  EXPIRED: "Vencida", PAST_DUE: "Pendiente",
};
const STATUS_COLOR: Record<string, string> = {
  TRIAL: "bg-blue-100 text-blue-700 border-blue-200",
  ACTIVE: "bg-green-100 text-green-700 border-green-200",
  CANCELLED: "bg-red-100 text-red-700 border-red-200",
  EXPIRED: "bg-gray-100 text-gray-600 border-gray-200",
  PAST_DUE: "bg-amber-100 text-amber-700 border-amber-200",
};

const TIMEZONES = [
  { value: "America/Tegucigalpa", label: "Honduras" },
  { value: "America/Guatemala",   label: "Guatemala" },
  { value: "America/El_Salvador", label: "El Salvador" },
  { value: "America/Managua",     label: "Nicaragua" },
  { value: "America/Costa_Rica",  label: "Costa Rica" },
  { value: "America/Mexico_City", label: "México" },
  { value: "America/Bogota",      label: "Colombia" },
  { value: "America/New_York",    label: "EE.UU. Este" },
  { value: "UTC",                 label: "UTC" },
];

const CURRENCIES = [
  { value: "HNL", label: "HNL — Lempira" },
  { value: "USD", label: "USD — Dólar" },
  { value: "GTQ", label: "GTQ — Quetzal" },
  { value: "MXN", label: "MXN — Peso MX" },
  { value: "COP", label: "COP — Peso CO" },
  { value: "EUR", label: "EUR — Euro" },
];

// ── Create user dialog ─────────────────────────────────────────────────────

function CreateUserDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { plans } = useAdminPlans();
  const { createUser, isCreating } = useAdminCreateUser();

  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPass,     setShowPass]     = useState(false);
  const [displayName,  setDisplayName]  = useState("");
  const [businessName, setBusinessName] = useState("");
  const [timezone,     setTimezone]     = useState("America/Tegucigalpa");
  const [currency,     setCurrency]     = useState("HNL");
  const [planId,       setPlanId]       = useState<string>("");

  const reset = () => {
    setEmail(""); setPassword(""); setDisplayName(""); setBusinessName("");
    setTimezone("America/Tegucigalpa"); setCurrency("HNL"); setPlanId(""); setShowPass(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!email.trim())    { toast.error("El email es requerido"); return; }
    if (!password.trim()) { toast.error("La contraseña es requerida"); return; }
    if (password.length < 6) { toast.error("La contraseña debe tener al menos 6 caracteres"); return; }

    try {
      await createUser({
        email:          email.trim(),
        password,
        display_name:   displayName.trim() || undefined,
        business_name:  businessName.trim() || undefined,
        timezone,
        currency,
        plan_id:        planId ? Number(planId) : undefined,
        email_verified: true,
      });
      toast.success("Usuario creado exitosamente");
      onCreated();
      handleClose();
    } catch (err: any) {
      toast.error(err.message || "Error al crear usuario");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear nuevo usuario</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="cu-email">Email <span className="text-destructive">*</span></Label>
            <Input
              id="cu-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              disabled={isCreating}
            />
          </div>

          {/* Contraseña */}
          <div className="space-y-1.5">
            <Label htmlFor="cu-password">Contraseña <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Input
                id="cu-password"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                disabled={isCreating}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPass((v) => !v)}
                tabIndex={-1}
              >
                {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Nombre visible */}
          <div className="space-y-1.5">
            <Label htmlFor="cu-name">Nombre visible</Label>
            <Input
              id="cu-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nombre o apodo del usuario"
              disabled={isCreating}
            />
          </div>

          {/* Nombre del negocio */}
          <div className="space-y-1.5">
            <Label htmlFor="cu-biz">Nombre del negocio</Label>
            <Input
              id="cu-biz"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Ej. Tienda Don José"
              disabled={isCreating}
            />
          </div>

          {/* Zona horaria + Moneda */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Zona horaria</Label>
              <Select value={timezone} onValueChange={setTimezone} disabled={isCreating}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Moneda</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={isCreating}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Plan */}
          <div className="space-y-1.5">
            <Label>Plan inicial</Label>
            <Select value={planId} onValueChange={setPlanId} disabled={isCreating}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Prueba gratuita (por defecto)" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} {p.price_usd > 0 ? `· $${p.price_usd}` : "· Gratis"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Si no seleccionás un plan, el usuario quedará en estado de prueba.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isCreating} className="gap-2">
            {isCreating ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
            Crear usuario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { back, push } = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page,   setPage]   = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const debouncedSearch = useDebounce(search, 350);

  const { users, total, pages, isLoading, mutate } = useAdminUsers({
    search: debouncedSearch,
    status,
    page,
  });

  const handleSearch = useCallback((v: string) => { setSearch(v); setPage(1); }, []);
  const handleStatus = useCallback((v: string) => { setStatus(v); setPage(1); }, []);

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Cargando..." : `${total} usuario${total !== 1 ? "s" : ""} registrados`}
          </p>
        </div>
        <Button size="sm" className="gap-2 shrink-0" onClick={() => setShowCreate(true)}>
          <UserPlus className="size-4" />
          <span className="hidden sm:inline">Crear usuario</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por email, nombre o negocio..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={handleStatus}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="TRIAL">Prueba</SelectItem>
            <SelectItem value="ACTIVE">Activa</SelectItem>
            <SelectItem value="PAST_DUE">Pago pendiente</SelectItem>
            <SelectItem value="CANCELLED">Cancelada</SelectItem>
            <SelectItem value="EXPIRED">Vencida</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Usuario / Negocio</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead>Registrado</TableHead>
              <TableHead>Último acceso</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No se encontraron usuarios
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow
                  key={u.id}
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => push(`/users/${u.id}`)}
                >
                  <TableCell>
                    <p className="font-medium text-sm">{u.business_name || u.display_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </TableCell>
                  <TableCell className="text-sm">{u.plan_name ?? "—"}</TableCell>
                  <TableCell>
                    {u.subscription_status ? (
                      <Badge className={`${STATUS_COLOR[u.subscription_status] ?? ""} border text-xs`}>
                        {STATUS_LABEL[u.subscription_status] ?? u.subscription_status}
                      </Badge>
                    ) : <span className="text-muted-foreground text-xs">Sin suscripción</span>}
                  </TableCell>
                  <TableCell>
                    {u.is_active
                      ? <CheckCircle2 className="size-4 text-green-600" />
                      : <XCircle      className="size-4 text-destructive" />}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground" suppressHydrationWarning>
                    {new Date(u.created_at).toLocaleDateString("es-HN", { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="size-3 shrink-0" />
                      <span>{relativeTime(u.last_refresh_time ?? u.last_sign_in_time)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="text-xs">Ver</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          : users.length === 0
            ? <p className="text-sm text-center text-muted-foreground py-12">No se encontraron usuarios</p>
            : users.map((u) => (
                <div
                  key={u.id}
                  className="rounded-xl border p-3.5 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => push(`/users/${u.id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{u.business_name || u.display_name || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    {u.is_active
                      ? <CheckCircle2 className="size-3.5 text-green-600 shrink-0" />
                      : <XCircle      className="size-3.5 text-destructive shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-muted-foreground">{u.plan_name ?? "Sin plan"}</span>
                    {u.subscription_status && (
                      <Badge className={`${STATUS_COLOR[u.subscription_status] ?? ""} border text-xs`}>
                        {STATUS_LABEL[u.subscription_status] ?? u.subscription_status}
                      </Badge>
                    )}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                      <Clock className="size-3" />
                      {relativeTime(u.last_refresh_time ?? u.last_sign_in_time)}
                    </span>
                  </div>
                </div>
              ))
        }
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <p className="text-sm text-muted-foreground order-2 sm:order-1">
            {total} usuario{total !== 1 ? "s" : ""} · página {page} de {pages}
          </p>
          <Pagination className="order-1 sm:order-2 w-auto mx-0 justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-disabled={page === 1}
                  className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {Array.from({ length: pages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === pages || (p >= page - 1 && p <= page + 1))
                .reduce<(number | "…")[]>((acc, p, i, arr) => {
                  if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "…" ? (
                    <PaginationItem key={`e-${i}`}><PaginationEllipsis /></PaginationItem>
                  ) : (
                    <PaginationItem key={p}>
                      <PaginationLink isActive={p === page} onClick={() => setPage(p as number)} className="cursor-pointer">{p}</PaginationLink>
                    </PaginationItem>
                  )
                )}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  aria-disabled={page === pages}
                  className={page === pages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <CreateUserDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => mutate()}
      />
    </div>
  );
}

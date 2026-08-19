// app/(admin)/users/[id]/page.tsx
"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAdminUser, useAdminUpdateUser, useAdminPlans, type AdminUserStorage, type AdminTeamMember } from "@/hooks/swr/use-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge }    from "@/components/ui/badge";
import { Button }   from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Label }    from "@/components/ui/label";
import { Input }    from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Building2, Mail, Calendar, ShoppingCart,
  Package, ReceiptText, Crown, AlertTriangle, CheckCircle2,
  XCircle, Loader2, Save, Clock, RefreshCw, Database, Image,
  KeyRound, Eye, EyeOff, Users2,
} from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  TRIAL:     "Prueba",
  ACTIVE:    "Activa",
  CANCELLED: "Cancelada",
  EXPIRED:   "Vencida",
  PAST_DUE:  "Pago pendiente",
};
const STATUS_COLOR: Record<string, string> = {
  TRIAL:     "bg-blue-100 text-blue-700 border-blue-200",
  ACTIVE:    "bg-green-100 text-green-700 border-green-200",
  CANCELLED: "bg-red-100 text-red-700 border-red-200",
  EXPIRED:   "bg-gray-100 text-gray-600 border-gray-200",
  PAST_DUE:  "bg-amber-100 text-amber-700 border-amber-200",
};

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { back, push } = useRouter();
  const userId  = Number(id);

  const { user, activity, storage, teamMembers, isLoading, mutate } = useAdminUser(userId);
  const { plans }                              = useAdminPlans();
  const { updateUser, isSaving }              = useAdminUpdateUser(userId);

  // Edit state
  const [planId,          setPlanId]          = useState<string>("");
  const [subStatus,       setSubStatus]       = useState<string>("");
  const [trialEndDate,    setTrialEndDate]    = useState<string>("");
  const [periodEndDate,   setPeriodEndDate]   = useState<string>("");
  const [newPassword,     setNewPassword]     = useState<string>("");
  const [showNewPass,     setShowNewPass]     = useState(false);
  const [isSavingPass,    setIsSavingPass]    = useState(false);

  useEffect(() => {
    if (user) {
      setPlanId(String(user.plan_id ?? ""));
      setSubStatus(user.subscription_status ?? "");
      setTrialEndDate(user.trial_end_date   ? user.trial_end_date.slice(0, 10)   : "");
      setPeriodEndDate(user.current_period_end ? user.current_period_end.slice(0, 10) : "");
    }
  }, [user]);

  const handleSaveSub = async () => {
    try {
      const payload: Record<string, unknown> = {};
      if (planId)        payload.plan_id              = Number(planId);
      if (subStatus)     payload.subscription_status  = subStatus;
      if (trialEndDate)  payload.trial_end_date        = trialEndDate;
      if (periodEndDate) payload.current_period_end    = periodEndDate;
      await updateUser(payload);
      await mutate();
      toast.success("Suscripción actualizada");
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar");
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim()) { toast.error("Ingresá la nueva contraseña"); return; }
    if (newPassword.length < 6) { toast.error("La contraseña debe tener al menos 6 caracteres"); return; }
    setIsSavingPass(true);
    try {
      await updateUser({ new_password: newPassword });
      setNewPassword("");
      toast.success("Contraseña actualizada exitosamente");
    } catch (err: any) {
      toast.error(err.message || "Error al cambiar contraseña");
    } finally {
      setIsSavingPass(false);
    }
  };

  const handleToggleActive = async () => {
    if (!user) return;
    try {
      await updateUser({ is_active: !user.is_active });
      await mutate();
      toast.success(user.is_active ? "Usuario desactivado" : "Usuario reactivado");
    } catch (err: any) {
      toast.error(err.message || "Error al cambiar estado");
    }
  };

  if (isLoading) return <LoadingSkeleton onBack={() => back()} />;
  if (!user) return (
    <div className="text-center py-20 text-muted-foreground space-y-2">
      <p>Usuario no encontrado.</p>
      <Button variant="outline" onClick={() => back()}>Volver</Button>
    </div>
  );

  const displayName = user.business_name || user.display_name || user.email;

  return (
    <div className="space-y-5 pb-10 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{displayName}</h1>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {user.is_active
            ? <Badge className="bg-green-100 text-green-700 border-green-200 border gap-1"><CheckCircle2 className="size-3"/>Activo</Badge>
            : <Badge className="bg-red-100 text-red-700 border-red-200 border gap-1"><XCircle className="size-3"/>Inactivo</Badge>
          }
        </div>
      </div>

      {/* Info + actividad */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Datos del usuario */}
        <Card className="pt-1 pb-1">
          <CardHeader className="px-3.5 pt-3 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Building2 className="size-3.5" /> Información
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3.5 pb-3 space-y-2.5 text-sm">
            <InfoRow icon={<Mail className="size-3.5"/>} label="Email" value={user.email} />
            {user.business_name && <InfoRow icon={<Building2 className="size-3.5"/>} label="Negocio" value={user.business_name} />}
            {user.display_name  && <InfoRow icon={<Building2 className="size-3.5"/>} label="Nombre" value={user.display_name} />}
            {user.org_name ? (
              <InfoRow
                icon={<Users2 className="size-3.5"/>}
                label="Rol"
                value={user.is_owner ? `Dueño de ${user.org_name}` : `Miembro de ${user.org_name} · ${user.role_name}`}
              />
            ) : (
              <InfoRow icon={<Users2 className="size-3.5"/>} label="Rol" value="No pertenece a ninguna organización" />
            )}
            <InfoRow icon={<Calendar className="size-3.5"/>} label="Registrado"
              value={new Date(user.created_at).toLocaleDateString("es-HN", { day: "numeric", month: "long", year: "numeric" })}
            />
            <InfoRow icon={<Clock className="size-3.5"/>} label="Último acceso"
              value={user.last_sign_in_time
                ? new Date(user.last_sign_in_time).toLocaleString("es-HN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                : "—"}
            />
            <InfoRow icon={<RefreshCw className="size-3.5"/>} label="Token renovado"
              value={user.last_refresh_time
                ? new Date(user.last_refresh_time).toLocaleString("es-HN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                : "—"}
            />
            <InfoRow icon={<Building2 className="size-3.5"/>} label="Moneda" value={user.currency ?? "—"} />
            <InfoRow icon={<Building2 className="size-3.5"/>} label="Zona horaria" value={user.timezone} />
          </CardContent>
        </Card>

        <div className="space-y-3">
          {/* Actividad */}
          {activity && (
            <Card className="pt-1 pb-1">
              <CardHeader className="px-3.5 pt-3 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <ReceiptText className="size-3.5" /> Actividad
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3.5 pb-3 space-y-2">
                <ActivityStat icon={<ShoppingCart className="size-3.5 text-primary"/>} label="Ventas"        value={activity.total_sales} />
                <ActivityStat icon={<Package      className="size-3.5 text-primary"/>} label="Productos"     value={activity.total_products} />
                <ActivityStat icon={<ReceiptText  className="size-3.5 text-primary"/>} label="Transacciones" value={activity.total_transactions} />
              </CardContent>
            </Card>
          )}

          {/* Suscripción — vista */}
          <Card className="pt-1 pb-1">
            <CardHeader className="px-3.5 pt-3 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Crown className="size-3.5" /> Suscripción
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3.5 pb-3 text-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Plan</span>
                <span className="font-semibold text-xs">{user.plan_name ?? "Sin plan"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Estado</span>
                {user.subscription_status ? (
                  <Badge className={`${STATUS_COLOR[user.subscription_status] ?? ""} border text-[10px] py-0`}>
                    {STATUS_LABEL[user.subscription_status] ?? user.subscription_status}
                  </Badge>
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </div>
              {user.current_period_end && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Vence</span>
                  <span className="text-xs" suppressHydrationWarning>
                    {new Date(user.current_period_end).toLocaleDateString("es-HN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              )}
              {user.trial_end_date && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Fin de prueba</span>
                  <span className="text-xs" suppressHydrationWarning>
                    {new Date(user.trial_end_date).toLocaleDateString("es-HN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Equipo — el resto de organization_members de esta misma org */}
      {user.org_name && teamMembers.length > 1 && (
        <TeamCard orgName={user.org_name} members={teamMembers} currentUserId={user.id} onSelect={(id) => push(`/users/${id}`)} />
      )}

      {/* Almacenamiento */}
      {storage && <StorageCard storage={storage} />}

      {/* Editar suscripción */}
      <Card className="pt-1 pb-1">
        <CardHeader className="px-3.5 pt-3 pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground">Editar suscripción</CardTitle>
        </CardHeader>
        <CardContent className="px-3.5 pb-3 space-y-3">
          {user.org_name && user.is_owner === false && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-2.5 py-2">
              {displayName} es miembro de <strong>{user.org_name}</strong>, no el dueño — esto edita
              la suscripción de toda la organización, no solo la de esta persona.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Plan</Label>
              <Select value={planId} onValueChange={setPlanId} disabled={isSaving}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Seleccionar plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} {p.price_usd > 0 ? `· $${p.price_usd} USD` : "· Gratis"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Estado</Label>
              <Select value={subStatus} onValueChange={setSubStatus} disabled={isSaving}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRIAL">Prueba</SelectItem>
                  <SelectItem value="ACTIVE">Activa</SelectItem>
                  <SelectItem value="PAST_DUE">Pago pendiente</SelectItem>
                  <SelectItem value="CANCELLED">Cancelada</SelectItem>
                  <SelectItem value="EXPIRED">Vencida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Fin del período</Label>
              <Input type="date" value={periodEndDate} onChange={(e) => setPeriodEndDate(e.target.value)} disabled={isSaving} className="h-9 text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Fin de prueba</Label>
              <Input type="date" value={trialEndDate} onChange={(e) => setTrialEndDate(e.target.value)} disabled={isSaving} className="h-9 text-sm" />
            </div>
          </div>

          <Button onClick={handleSaveSub} disabled={isSaving} size="sm" className="gap-2">
            {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Guardar cambios
          </Button>
        </CardContent>
      </Card>

      {/* Cambiar contraseña */}
      <Card className="pt-1 pb-1">
        <CardHeader className="px-3.5 pt-3 pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <KeyRound className="size-3.5" /> Cambiar contraseña
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3.5 pb-3 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nueva contraseña</Label>
            <div className="relative">
              <Input
                type={showNewPass ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                disabled={isSavingPass}
                className="pr-10 h-9 text-sm"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowNewPass((v) => !v)}
                tabIndex={-1}
              >
                {showNewPass ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </div>
          <Button onClick={handleResetPassword} disabled={isSavingPass || !newPassword} size="sm" className="gap-2">
            {isSavingPass ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
            Cambiar contraseña
          </Button>
        </CardContent>
      </Card>

      {/* Zona de peligro */}
      <Card className="border-destructive/30 pt-1 pb-1">
        <CardHeader className="px-3.5 pt-3 pb-2">
          <CardTitle className="text-xs font-medium text-destructive flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" /> Zona de peligro
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3.5 pb-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">
                {user.is_active ? "Desactivar usuario" : "Reactivar usuario"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {user.is_active
                  ? "El usuario no podrá iniciar sesión ni usar el sistema."
                  : "Permite al usuario volver a iniciar sesión."}
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant={user.is_active ? "destructive" : "outline"} size="sm" disabled={isSaving}>
                  {user.is_active ? "Desactivar" : "Reactivar"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {user.is_active ? "¿Desactivar este usuario?" : "¿Reactivar este usuario?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {user.is_active
                      ? `"${displayName}" no podrá acceder al sistema hasta que sea reactivado.`
                      : `"${displayName}" volverá a tener acceso al sistema.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleToggleActive}>
                    {user.is_active ? "Sí, desactivar" : "Sí, reactivar"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <span className="text-xs text-muted-foreground">{label}: </span>
        <span className="font-medium break-all" suppressHydrationWarning>{value}</span>
      </div>
    </div>
  );
}

function TeamCard({
  orgName, members, currentUserId, onSelect,
}: {
  orgName: string; members: AdminTeamMember[]; currentUserId: number; onSelect: (id: number) => void;
}) {
  return (
    <Card className="pt-1 pb-1">
      <CardHeader className="px-3.5 pt-3 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Users2 className="size-3.5" /> Equipo de {orgName}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3.5 pb-3 space-y-1">
        {members.map((m) => {
          const isCurrent = m.user_id === currentUserId;
          return (
            <button
              key={m.user_id}
              type="button"
              disabled={isCurrent}
              onClick={() => onSelect(m.user_id)}
              className={`w-full flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
                isCurrent ? "bg-muted/60 cursor-default" : "hover:bg-muted/40"
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {m.display_name || m.email} {isCurrent && <span className="text-xs text-muted-foreground">(estás viendo a esta persona)</span>}
                </p>
                <p className="text-xs text-muted-foreground truncate">{m.email}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!m.user_is_active && (
                  <Badge className="bg-red-100 text-red-700 border-red-200 border text-[10px] py-0">Inactivo</Badge>
                )}
                {!m.membership_is_active && (
                  <Badge className="bg-gray-100 text-gray-600 border-gray-200 border text-[10px] py-0">Removido</Badge>
                )}
                <Badge variant="outline" className={`text-[10px] py-0 ${!m.is_owner ? "bg-secondary" : ""}`}>
                  {m.is_owner ? "Dueño" : m.role_name}
                </Badge>
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ActivityStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-bold text-sm">{value}</span>
    </div>
  );
}

const STORAGE_ROWS: { key: keyof AdminUserStorage; label: string }[] = [
  { key: "products",            label: "Productos"              },
  { key: "sales",               label: "Ventas"                 },
  { key: "transactions",        label: "Transacciones"          },
  { key: "customers",           label: "Clientes"               },
  { key: "accounts",            label: "Cuentas"                },
  { key: "credit_cards",        label: "Tarjetas de crédito"    },
  { key: "cc_transactions",     label: "Movimientos de tarjeta" },
  { key: "inventory_batches",   label: "Lotes de inventario"    },
  { key: "inventory_movements", label: "Movimientos de inventario" },
  { key: "events",              label: "Eventos"                },
];

function StorageCard({ storage }: { storage: AdminUserStorage }) {
  const total = STORAGE_ROWS.reduce((sum, r) => sum + (storage[r.key] as number), 0);
  const maxVal = Math.max(...STORAGE_ROWS.map((r) => storage[r.key] as number), 1);

  return (
    <Card className="pt-1 pb-1">
      <CardHeader className="px-3.5 pt-3 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Database className="size-3.5" /> Almacenamiento en BD
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {total.toLocaleString("es-HN")} filas totales
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3.5 pb-3 space-y-2">
        {STORAGE_ROWS.filter((r) => (storage[r.key] as number) > 0).map((r) => {
          const val = storage[r.key] as number;
          const pct = Math.round((val / maxVal) * 100);
          return (
            <div key={r.key}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-muted-foreground">{r.label}</span>
                <span className="text-xs font-medium">{val.toLocaleString("es-HN")}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        {total === 0 && (
          <p className="text-xs text-muted-foreground">Sin datos registrados</p>
        )}

        {/* Imágenes */}
        {storage.image_count > 0 && (
          <>
            <Separator className="my-1" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Image className="size-3" /> Imágenes subidas
              </span>
              <Badge variant="outline" className="text-[10px]">
                {storage.image_count}
              </Badge>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="size-4" /></Button>
        <Skeleton className="h-7 w-48" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-56 rounded-xl" />
    </div>
  );
}

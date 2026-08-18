// app/(admin)/plans/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useAdminPlans, useAdminUpdatePlan,
  useAdminPlanFeatures, useAdminUpdatePlanFeatures,
  PlanFeatureRow,
} from "@/hooks/swr/use-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Package, ShoppingCart, HardDrive, ArrowLeftRight,
  Loader2, Boxes, Users, Wallet, CalendarDays, BarChart3, Shield, Puzzle,
} from "lucide-react";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
  PRODUCTS:     "Productos",
  INVENTORY:    "Inventario",
  SALES:        "Ventas",
  CUSTOMERS:    "Clientes",
  FINANCES:     "Finanzas",
  EVENTS:       "Eventos",
  REPORTS:      "Reportes",
  INTEGRATIONS: "Integraciones",
  ADMIN:        "Administración",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  PRODUCTS:     <Package className="size-4" />,
  INVENTORY:    <Boxes className="size-4" />,
  SALES:        <ShoppingCart className="size-4" />,
  CUSTOMERS:    <Users className="size-4" />,
  FINANCES:     <Wallet className="size-4" />,
  EVENTS:       <CalendarDays className="size-4" />,
  REPORTS:      <BarChart3 className="size-4" />,
  INTEGRATIONS: <Puzzle className="size-4" />,
  ADMIN:        <Shield className="size-4" />,
};

type LimitsForm = {
  max_products: string;
  max_sales_per_month: string;
  max_transactions_per_month: string;
  max_accounts: string;
  max_supplies: string;
  max_storage_mb: string;
};

export default function AdminPlanDetailPage() {
  const { push } = useRouter();
  const params = useParams<{ id: string }>();
  const planId = Number(params.id) || null;

  const { plans, isLoading: plansLoading, mutate: mutatePlans } = useAdminPlans();
  // Neon devuelve BIGINT como string — normalizar antes de comparar
  const plan = plans.find((p) => Number(p.id) === planId) ?? null;

  const { features, isLoading: featuresLoading, mutate: mutateFeatures } = useAdminPlanFeatures(planId);
  const { updatePlan, isSaving: savingLimits } = useAdminUpdatePlan();
  const { updateFeatures, isSaving: savingFeatures } = useAdminUpdatePlanFeatures(planId);

  // ── Límites ──────────────────────────────────────────────────────────
  const [limits, setLimits] = useState<LimitsForm | null>(null);

  useEffect(() => {
    if (plan && limits === null) {
      setLimits({
        max_products:               plan.max_products != null ? String(plan.max_products) : "",
        max_sales_per_month:        plan.max_sales_per_month != null ? String(plan.max_sales_per_month) : "",
        max_transactions_per_month: plan.max_transactions_per_month != null ? String(plan.max_transactions_per_month) : "",
        max_accounts:               plan.max_accounts != null ? String(plan.max_accounts) : "",
        max_supplies:               plan.max_supplies != null ? String(plan.max_supplies) : "",
        max_storage_mb:             plan.max_storage_mb != null ? String(plan.max_storage_mb) : "",
      });
    }
  }, [plan, limits]);

  const limitsDirty = useMemo(() => {
    if (!plan || !limits) return false;
    const toVal = (s: string) => (s !== "" ? Number(s) : null);
    return (
      toVal(limits.max_products)               !== plan.max_products ||
      toVal(limits.max_sales_per_month)        !== plan.max_sales_per_month ||
      toVal(limits.max_transactions_per_month) !== plan.max_transactions_per_month ||
      toVal(limits.max_accounts)               !== plan.max_accounts ||
      toVal(limits.max_supplies)               !== plan.max_supplies ||
      toVal(limits.max_storage_mb)             !== plan.max_storage_mb
    );
  }, [plan, limits]);

  const handleSaveLimits = async () => {
    if (!plan || !limits) return;
    try {
      await updatePlan(plan.id, {
        max_products:               limits.max_products !== "" ? Number(limits.max_products) : null,
        max_sales_per_month:        limits.max_sales_per_month !== "" ? Number(limits.max_sales_per_month) : null,
        max_transactions_per_month: limits.max_transactions_per_month !== "" ? Number(limits.max_transactions_per_month) : null,
        max_accounts:               limits.max_accounts !== "" ? Number(limits.max_accounts) : null,
        max_supplies:               limits.max_supplies !== "" ? Number(limits.max_supplies) : null,
        max_storage_mb:             limits.max_storage_mb !== "" ? Number(limits.max_storage_mb) : null,
      });
      toast.success("Límites actualizados");
      mutatePlans();
    } catch (e: any) {
      toast.error(e.message || "Error al guardar límites");
    }
  };

  // ── Opciones (features) ──────────────────────────────────────────────
  const [toggles, setToggles] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (features.length > 0) {
      setToggles(Object.fromEntries(features.map((f) => [f.id, f.is_enabled])));
    }
  }, [features]);

  const featuresDirty = useMemo(
    () => features.some((f) => toggles[f.id] !== undefined && toggles[f.id] !== f.is_enabled),
    [features, toggles]
  );

  const enabledCount = Object.values(toggles).filter(Boolean).length;

  const byCategory = useMemo(() => {
    const groups: Record<string, PlanFeatureRow[]> = {};
    for (const f of features) {
      (groups[f.category] ??= []).push(f);
    }
    return groups;
  }, [features]);

  const handleSaveFeatures = async () => {
    try {
      await updateFeatures(toggles);
      toast.success("Opciones del plan actualizadas");
      mutateFeatures();
    } catch (e: any) {
      toast.error(e.message || "Error al guardar opciones");
    }
  };

  const isLoading = plansLoading || featuresLoading;

  if (!planId) {
    return <p className="text-sm text-muted-foreground">Plan inválido.</p>;
  }

  return (
    <div className="space-y-5 pb-10 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => push("/plans")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {plan ? plan.name : "Plan"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {plan ? (
              <span className="font-mono">{plan.slug}</span>
            ) : isLoading ? "Cargando…" : "Plan no encontrado"}
          </p>
        </div>
        {plan && !plan.is_active && <Badge variant="secondary">Inactivo</Badge>}
      </div>

      {isLoading && !plan ? (
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : !plan ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No se encontró el plan solicitado.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Límites ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Límites de uso</CardTitle>
              <p className="text-xs text-muted-foreground">
                Dejar un campo vacío = sin límite. Los límites se validan al crear cada recurso.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {limits && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <Package className="size-3" /> Productos
                    </Label>
                    <Input
                      type="number" min="0" placeholder="∞"
                      value={limits.max_products}
                      onChange={(e) => setLimits({ ...limits, max_products: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <ShoppingCart className="size-3" /> Ventas/mes
                    </Label>
                    <Input
                      type="number" min="0" placeholder="∞"
                      value={limits.max_sales_per_month}
                      onChange={(e) => setLimits({ ...limits, max_sales_per_month: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <ArrowLeftRight className="size-3" /> Transacciones/mes
                    </Label>
                    <Input
                      type="number" min="0" placeholder="∞"
                      value={limits.max_transactions_per_month}
                      onChange={(e) => setLimits({ ...limits, max_transactions_per_month: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <Wallet className="size-3" /> Cuentas
                    </Label>
                    <Input
                      type="number" min="0" placeholder="∞"
                      value={limits.max_accounts}
                      onChange={(e) => setLimits({ ...limits, max_accounts: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <Boxes className="size-3" /> Suministros
                    </Label>
                    <Input
                      type="number" min="0" placeholder="∞"
                      value={limits.max_supplies}
                      onChange={(e) => setLimits({ ...limits, max_supplies: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <HardDrive className="size-3" /> Almac. (MB)
                    </Label>
                    <Input
                      type="number" min="0" placeholder="∞"
                      value={limits.max_storage_mb}
                      onChange={(e) => setLimits({ ...limits, max_storage_mb: e.target.value })}
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <Button size="sm" onClick={handleSaveLimits} disabled={!limitsDirty || savingLimits}>
                  {savingLimits && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                  Guardar límites
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Opciones ── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Opciones del plan</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Funciones a las que tienen acceso las organizaciones con este plan.
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {enabledCount} de {features.length} activas
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {featuresLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
                </div>
              ) : (
                Object.entries(byCategory).map(([category, rows]) => (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                      {CATEGORY_ICONS[category]}
                      {CATEGORY_LABELS[category] ?? category}
                    </div>
                    <div className="rounded-lg border divide-y">
                      {rows.map((f) => (
                        <div key={f.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-tight">{f.feature_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{f.feature_key}</p>
                          </div>
                          <Switch
                            checked={toggles[f.id] ?? false}
                            onCheckedChange={(v) =>
                              setToggles((prev) => ({ ...prev, [f.id]: v }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}

              <div className="flex justify-end pt-1">
                <Button onClick={handleSaveFeatures} disabled={!featuresDirty || savingFeatures}>
                  {savingFeatures && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                  Guardar opciones
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

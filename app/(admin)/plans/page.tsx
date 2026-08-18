// app/(admin)/plans/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminPlans, useAdminCreatePlan, useAdminUpdatePlan, useAdminDeletePlan, AdminPlan, PlanInput } from "@/hooks/swr/use-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Plus, Pencil, Trash2, Crown, Users,
  Package, ShoppingCart, HardDrive, Loader2, Infinity,
  ArrowLeftRight, SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";

const INTERVAL_LABELS: Record<string, string> = {
  MONTHLY:  "Mensual",
  YEARLY:   "Anual",
  LIFETIME: "De por vida",
};

const INTERVAL_COLORS: Record<string, string> = {
  MONTHLY:  "bg-blue-100 text-blue-700 border-blue-200",
  YEARLY:   "bg-purple-100 text-purple-700 border-purple-200",
  LIFETIME: "bg-amber-100 text-amber-700 border-amber-200",
};

function limitLabel(val: number | null) {
  if (val == null) return <span className="flex items-center gap-0.5 text-green-600"><Infinity className="size-3.5" /> Sin límite</span>;
  return val.toLocaleString("es-HN");
}

// ── Plan form ────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  slug: string;
  description: string;
  price_usd: string;
  billing_interval: string;
  max_products: string;
  max_sales_per_month: string;
  max_transactions_per_month: string;
  max_storage_mb: string;
  is_active: boolean;
};

const emptyForm = (): FormState => ({
  name: "", slug: "", description: "",
  price_usd: "0", billing_interval: "MONTHLY",
  max_products: "", max_sales_per_month: "",
  max_transactions_per_month: "",
  max_storage_mb: "", is_active: true,
});

function planToForm(p: AdminPlan): FormState {
  return {
    name:                p.name,
    slug:                p.slug,
    description:         p.description ?? "",
    price_usd:           String(p.price_usd),
    billing_interval:    p.billing_interval ?? "MONTHLY",
    max_products:        p.max_products != null ? String(p.max_products) : "",
    max_sales_per_month: p.max_sales_per_month != null ? String(p.max_sales_per_month) : "",
    max_transactions_per_month: p.max_transactions_per_month != null ? String(p.max_transactions_per_month) : "",
    max_storage_mb:      p.max_storage_mb != null ? String(p.max_storage_mb) : "",
    is_active:           p.is_active,
  };
}

function formToInput(f: FormState): PlanInput {
  return {
    name:                f.name.trim(),
    slug:                f.slug.trim(),
    description:         f.description.trim() || null,
    price_usd:           Number(f.price_usd) || 0,
    billing_interval:    f.billing_interval,
    max_products:        f.max_products !== "" ? Number(f.max_products) : null,
    max_sales_per_month: f.max_sales_per_month !== "" ? Number(f.max_sales_per_month) : null,
    max_transactions_per_month: f.max_transactions_per_month !== "" ? Number(f.max_transactions_per_month) : null,
    max_storage_mb:      f.max_storage_mb !== "" ? Number(f.max_storage_mb) : null,
    is_active:           f.is_active,
  };
}

function PlanFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: FormState;
  onSave: (f: FormState) => Promise<void>;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const set = (k: keyof FormState) => (v: string | boolean) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  // Auto-generate slug from name
  const handleName = (v: string) => {
    setForm((prev) => ({
      ...prev,
      name: v,
      slug: prev.slug === "" || prev.slug === prev.name.toLowerCase().replace(/\s+/g, "-")
        ? v.toLowerCase().replace(/\s+/g, "-")
        : prev.slug,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) return;
    await onSave(form);
  };

  const isEdit = initial.name !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar plan" : "Nuevo plan"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={(e) => handleName(e.target.value)} placeholder="Pro" required />
            </div>
            <div className="space-y-1.5">
              <Label>Slug *</Label>
              <Input value={form.slug} onChange={(e) => set("slug")(e.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="pro" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="Descripción del plan…"
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Precio (USD)</Label>
              <Input
                type="number" min="0" step="0.01"
                value={form.price_usd}
                onChange={(e) => set("price_usd")(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Facturación</Label>
              <Select value={form.billing_interval} onValueChange={set("billing_interval")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Mensual</SelectItem>
                  <SelectItem value="YEARLY">Anual</SelectItem>
                  <SelectItem value="LIFETIME">De por vida</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground -mb-1">Límites — dejar vacío = sin límite</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Package className="size-3" /> Productos</Label>
              <Input type="number" min="0" value={form.max_products} onChange={(e) => set("max_products")(e.target.value)} placeholder="∞" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><ShoppingCart className="size-3" /> Ventas/mes</Label>
              <Input type="number" min="0" value={form.max_sales_per_month} onChange={(e) => set("max_sales_per_month")(e.target.value)} placeholder="∞" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><ArrowLeftRight className="size-3" /> Transacc./mes</Label>
              <Input type="number" min="0" value={form.max_transactions_per_month} onChange={(e) => set("max_transactions_per_month")(e.target.value)} placeholder="∞" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><HardDrive className="size-3" /> Almac. (MB)</Label>
              <Input type="number" min="0" value={form.max_storage_mb} onChange={(e) => set("max_storage_mb")(e.target.value)} placeholder="∞" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Plan activo</p>
              <p className="text-xs text-muted-foreground">Los usuarios pueden suscribirse a este plan</p>
            </div>
            <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active")(v)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSaving || !form.name.trim()}>
              {isSaving && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
              {isEdit ? "Guardar cambios" : "Crear plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function AdminPlansPage() {
  const { push } = useRouter();
  const { plans, isLoading, mutate } = useAdminPlans();
  const { createPlan, isCreating } = useAdminCreatePlan();
  const { updatePlan, isSaving }   = useAdminUpdatePlan();
  const { deletePlan, isDeleting } = useAdminDeletePlan();

  const [createOpen, setCreateOpen] = useState(false);
  const [editPlan, setEditPlan]     = useState<AdminPlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<AdminPlan | null>(null);

  const handleCreate = async (form: FormState) => {
    try {
      await createPlan(formToInput(form));
      toast.success("Plan creado");
      mutate();
      setCreateOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Error al crear plan");
    }
  };

  const handleUpdate = async (form: FormState) => {
    if (!editPlan) return;
    try {
      await updatePlan(editPlan.id, formToInput(form));
      toast.success("Plan actualizado");
      mutate();
      setEditPlan(null);
    } catch (e: any) {
      toast.error(e.message || "Error al actualizar plan");
    }
  };

  const handleToggleActive = async (plan: AdminPlan) => {
    try {
      await updatePlan(plan.id, { is_active: !plan.is_active });
      toast.success(plan.is_active ? "Plan desactivado" : "Plan activado");
      mutate();
    } catch (e: any) {
      toast.error(e.message || "Error al actualizar plan");
    }
  };

  const handleDelete = async () => {
    if (!deletingPlan) return;
    try {
      await deletePlan(deletingPlan.id);
      toast.success("Plan eliminado");
      mutate();
      setDeletingPlan(null);
    } catch (e: any) {
      toast.error(e.message || "Error al eliminar plan");
      setDeletingPlan(null);
    }
  };

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => push("/dashboard")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Planes</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Cargando…" : `${plans.length} plan${plans.length !== 1 ? "es" : ""}`}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Nuevo plan
        </Button>
      </div>

      {/* Plans grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3">
            <Crown className="size-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No hay planes configurados</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" /> Crear primer plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={`relative flex flex-col ${!plan.is_active ? "opacity-60" : ""}`}>
              <CardContent className="p-5 flex flex-col gap-3 flex-1">

                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-bold leading-tight">{plan.name}</p>
                      {!plan.is_active && (
                        <Badge variant="secondary" className="text-[10px]">Inactivo</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{plan.slug}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${INTERVAL_COLORS[plan.billing_interval ?? "MONTHLY"] ?? ""}`}
                  >
                    {INTERVAL_LABELS[plan.billing_interval ?? "MONTHLY"] ?? plan.billing_interval}
                  </Badge>
                </div>

                {/* Price */}
                <div>
                  <span className="text-2xl font-extrabold">
                    {Number(plan.price_usd) === 0 ? "Gratis" : `$${Number(plan.price_usd).toFixed(2)}`}
                  </span>
                  {Number(plan.price_usd) > 0 && (
                    <span className="text-xs text-muted-foreground ml-1">USD</span>
                  )}
                </div>

                {/* Description */}
                {plan.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{plan.description}</p>
                )}

                {/* Limits */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Package className="size-3" /> Productos
                    </span>
                    <span className="font-medium">{limitLabel(plan.max_products)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <ShoppingCart className="size-3" /> Ventas/mes
                    </span>
                    <span className="font-medium">{limitLabel(plan.max_sales_per_month)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <ArrowLeftRight className="size-3" /> Transacciones/mes
                    </span>
                    <span className="font-medium">{limitLabel(plan.max_transactions_per_month)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <HardDrive className="size-3" /> Almacenamiento
                    </span>
                    <span className="font-medium">
                      {plan.max_storage_mb != null ? `${plan.max_storage_mb} MB` : limitLabel(null)}
                    </span>
                  </div>
                </div>

                {/* Users count */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t mt-auto">
                  <Users className="size-3" />
                  <span>{plan.user_count} usuario{plan.user_count !== 1 ? "s" : ""} activo{plan.user_count !== 1 ? "s" : ""}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline" size="sm" className="flex-1 gap-1.5 text-xs"
                    onClick={() => push(`/plans/${plan.id}`)}
                  >
                    <SlidersHorizontal className="size-3" /> Opciones
                  </Button>
                  <Button
                    variant="outline" size="sm" className="gap-1.5 text-xs"
                    onClick={() => setEditPlan(plan)}
                  >
                    <Pencil className="size-3" /> Editar
                  </Button>
                  <Button
                    variant="outline" size="sm" className="text-xs"
                    onClick={() => handleToggleActive(plan)}
                  >
                    {plan.is_active ? "Desactivar" : "Activar"}
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={plan.user_count > 0}
                    onClick={() => setDeletingPlan(plan)}
                    title={plan.user_count > 0 ? "No se puede eliminar: hay usuarios en este plan" : "Eliminar plan"}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <PlanFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initial={emptyForm()}
        onSave={handleCreate}
        isSaving={isCreating}
      />

      {/* Edit dialog */}
      {editPlan && (
        <PlanFormDialog
          open={!!editPlan}
          onOpenChange={(v) => !v && setEditPlan(null)}
          initial={planToForm(editPlan)}
          onSave={handleUpdate}
          isSaving={isSaving}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deletingPlan} onOpenChange={(v) => !v && setDeletingPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plan?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente el plan <strong>{deletingPlan?.name}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

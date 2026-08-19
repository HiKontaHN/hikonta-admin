// app/(admin)/admins/page.tsx
// UI para gestionar la tabla `admins` — quién puede entrar a este panel.
// Antes era un INSERT/UPDATE manual en Neon (ver README.md, sección
// "Pendiente"); este panel no existía en yelifin-sistema porque esa tabla
// es exclusiva de hikonta-admin.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  useAdminAdmins, useAdminAddAdmin, useAdminUpdateAdmin, useAdminRemoveAdmin, AdminAdminRow,
} from "@/hooks/swr/use-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Shield, ShieldOff, Trash2, Loader2, UserCog } from "lucide-react";

// ── Add admin dialog ─────────────────────────────────────────────────────

function AddAdminDialog({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { addAdmin, isAdding } = useAdminAddAdmin();
  const [email, setEmail] = useState("");

  const handleClose = () => { setEmail(""); onClose(); };

  const handleSubmit = async () => {
    if (!email.trim()) { toast.error("El email es requerido"); return; }
    try {
      await addAdmin(email.trim());
      toast.success("Administrador agregado");
      onAdded();
      handleClose();
    } catch (err: any) {
      toast.error(err.message || "Error al agregar administrador");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Agregar administrador</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@hikonta.com"
              disabled={isAdding}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            <p className="text-xs text-muted-foreground">
              Tiene que ser el email de un usuario que ya existe en HiKonta. No crea una cuenta
              nueva, solo le da acceso a este panel.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isAdding}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isAdding} className="gap-2">
            {isAdding ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function AdminAdminsPage() {
  const { back } = useRouter();
  const { me } = useAuth();
  const { admins, isLoading, mutate } = useAdminAdmins();
  const { updateAdmin, isSaving } = useAdminUpdateAdmin();
  const { removeAdmin, isRemoving } = useAdminRemoveAdmin();

  const [showAdd, setShowAdd] = useState(false);
  const [removing, setRemoving] = useState<AdminAdminRow | null>(null);

  const activeCount = admins.filter((a) => a.is_active).length;

  const handleToggle = async (admin: AdminAdminRow) => {
    try {
      await updateAdmin(admin.id, !admin.is_active);
      toast.success(admin.is_active ? "Administrador desactivado" : "Administrador activado");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar administrador");
    }
  };

  const handleRemove = async () => {
    if (!removing) return;
    try {
      await removeAdmin(removing.id);
      toast.success("Administrador eliminado");
      mutate();
      setRemoving(null);
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar administrador");
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Administradores</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Cargando…" : `${admins.length} administrador${admins.length !== 1 ? "es" : ""} · ${activeCount} activo${activeCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setShowAdd(true)}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">Agregar</span>
        </Button>
      </div>

      <Card className="border-dashed">
        <CardContent className="p-3.5 flex items-start gap-2.5 text-xs text-muted-foreground">
          <UserCog className="size-4 shrink-0 mt-0.5" />
          <p>
            Quien está acá tiene acceso completo a este panel: puede crear/desactivar cualquier
            usuario de la plataforma, resetear contraseñas y editar suscripciones. Agregá solo
            cuentas de confianza.
          </p>
        </CardContent>
      </Card>

      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Administrador</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Agregado</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : admins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  No hay administradores registrados
                </TableCell>
              </TableRow>
            ) : (
              admins.map((a) => {
                const isMe = a.id === me?.adminId;
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <p className="font-medium text-sm">
                        {a.display_name || a.email} {isMe && <span className="text-xs text-muted-foreground">(vos)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={a.is_active
                          ? "bg-green-100 text-green-700 border-green-200 text-xs"
                          : "bg-gray-100 text-gray-600 border-gray-200 text-xs"}
                      >
                        {a.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground" suppressHydrationWarning>
                      {new Date(a.created_at).toLocaleDateString("es-HN", { day: "numeric", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline" size="sm" className="text-xs gap-1"
                          disabled={isMe || isSaving}
                          title={isMe ? "No podés desactivarte a vos mismo" : undefined}
                          onClick={() => handleToggle(a)}
                        >
                          {a.is_active ? <ShieldOff className="size-3.5" /> : <Shield className="size-3.5" />}
                          {a.is_active ? "Desactivar" : "Activar"}
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={isMe}
                          title={isMe ? "No podés eliminarte a vos mismo" : "Eliminar"}
                          onClick={() => setRemoving(a)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          : admins.length === 0
            ? <p className="text-sm text-center text-muted-foreground py-12">No hay administradores registrados</p>
            : admins.map((a) => {
                const isMe = a.id === me?.adminId;
                return (
                  <div key={a.id} className="rounded-xl border p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {a.display_name || a.email} {isMe && <span className="text-xs text-muted-foreground">(vos)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={a.is_active
                          ? "bg-green-100 text-green-700 border-green-200 text-xs shrink-0"
                          : "bg-gray-100 text-gray-600 border-gray-200 text-xs shrink-0"}
                      >
                        {a.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    <div className="flex gap-1.5 mt-3">
                      <Button
                        variant="outline" size="sm" className="flex-1 text-xs gap-1"
                        disabled={isMe || isSaving}
                        onClick={() => handleToggle(a)}
                      >
                        {a.is_active ? <ShieldOff className="size-3.5" /> : <Shield className="size-3.5" />}
                        {a.is_active ? "Desactivar" : "Activar"}
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        className="text-xs text-destructive hover:text-destructive"
                        disabled={isMe}
                        onClick={() => setRemoving(a)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
        }
      </div>

      <AddAdminDialog open={showAdd} onClose={() => setShowAdd(false)} onAdded={() => mutate()} />

      <AlertDialog open={!!removing} onOpenChange={(v) => !v && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar administrador?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{removing?.display_name || removing?.email}</strong> perderá acceso a este
              panel de inmediato. Esta acción no se puede deshacer — se puede volver a agregar
              después con su email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleRemove}
              disabled={isRemoving}
            >
              {isRemoving && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

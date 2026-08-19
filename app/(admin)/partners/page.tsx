// app/(admin)/partners/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  useAdminPartners, useAdminCreatePartner, useAdminUpdatePartner, useAdminDeletePartner,
  AdminPartner,
} from "@/hooks/swr/use-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Handshake, Building2, Mail, Phone, Loader2, Trash2, SlidersHorizontal,
} from "lucide-react";

// ── Create dialog ────────────────────────────────────────────────────

function CreatePartnerDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { createPartner, isCreating } = useAdminCreatePartner();
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const reset = () => { setName(""); setContactName(""); setEmail(""); setPhone(""); setUserEmail(""); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!name.trim())  { toast.error("El nombre es requerido"); return; }
    if (!email.trim()) { toast.error("El email de contacto es requerido"); return; }
    try {
      await createPartner({
        name: name.trim(),
        contact_name: contactName.trim() || null,
        email: email.trim(),
        phone: phone.trim() || null,
        user_email: userEmail.trim() || null,
      });
      toast.success("Partner creado");
      onCreated();
      handleClose();
    } catch (err: any) {
      toast.error(err.message || "Error al crear partner");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo partner</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Nombre <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aceleradora Terra" disabled={isCreating} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contacto</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nombre del coordinador" disabled={isCreating} />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isCreating} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email de contacto <span className="text-destructive">*</span></Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contacto@aceleradora.com" disabled={isCreating} />
          </div>
          <div className="space-y-1.5">
            <Label>Email de login (opcional)</Label>
            <Input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="Debe ya existir como usuario de HiKonta" disabled={isCreating} />
            <p className="text-xs text-muted-foreground">
              Con qué cuenta de HiKonta entra el coordinador a su panel (hikonta-partners). Se puede
              vincular después si todavía no tiene cuenta.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isCreating} className="gap-2">
            {isCreating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Crear partner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

export default function AdminPartnersPage() {
  const { push } = useRouter();
  const { partners, isLoading, mutate } = useAdminPartners();
  const { updatePartner, isSaving } = useAdminUpdatePartner();
  const { deletePartner, isDeleting } = useAdminDeletePartner();

  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<AdminPartner | null>(null);

  const handleToggleActive = async (partner: AdminPartner) => {
    try {
      await updatePartner(partner.id, { is_active: !partner.is_active });
      toast.success(partner.is_active ? "Partner desactivado" : "Partner activado");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar partner");
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deletePartner(deleting.id);
      toast.success("Partner eliminado");
      mutate();
      setDeleting(null);
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar partner");
    }
  };

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Partners</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Cargando…" : `${partners.length} partner${partners.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
          <Plus className="size-4" />
          Nuevo partner
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : partners.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <Handshake className="size-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No hay partners registrados</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowCreate(true)}>
              <Plus className="size-3.5" /> Crear el primero
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {partners.map((partner) => (
            <Card key={partner.id} className={`flex flex-col ${!partner.is_active ? "opacity-60" : ""}`}>
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-bold leading-tight">{partner.name}</p>
                      {!partner.is_active && <Badge variant="secondary" className="text-[10px]">Inactivo</Badge>}
                    </div>
                    {partner.contact_name && <p className="mt-0.5 text-xs text-muted-foreground">{partner.contact_name}</p>}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5"><Mail className="size-3" /> {partner.email}</div>
                  {partner.phone && <div className="flex items-center gap-1.5"><Phone className="size-3" /> {partner.phone}</div>}
                  {partner.user_email && (
                    <div className="flex items-center gap-1.5">
                      <Handshake className="size-3" /> login: {partner.user_email}
                    </div>
                  )}
                </div>

                <div className="mt-auto flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
                  <Building2 className="size-3" />
                  <span>{partner.org_count} organización{partner.org_count !== 1 ? "es" : ""} vinculada{partner.org_count !== 1 ? "s" : ""}</span>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={() => push(`/partners/${partner.id}`)}>
                    <SlidersHorizontal className="size-3" /> Gestionar
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs" disabled={isSaving} onClick={() => handleToggleActive(partner)}>
                    {partner.is_active ? "Desactivar" : "Activar"}
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={partner.org_count > 0}
                    title={partner.org_count > 0 ? "No se puede eliminar: tiene organizaciones vinculadas" : "Eliminar"}
                    onClick={() => setDeleting(partner)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreatePartnerDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => mutate()} />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar partner?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente <strong>{deleting?.name}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// app/(admin)/partners/[id]/page.tsx
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  useAdminPartner, useAdminUpdatePartner, useAdminLinkPartnerOrg,
  useAdminUpdatePartnerOrgLink, useAdminUnlinkPartnerOrg, AdminOrgSearchResult,
} from "@/hooks/swr/use-admin";
import { OrgPicker } from "@/components/shared/org-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { ArrowLeft, Plus, Loader2, Building2, Link2Off } from "lucide-react";

// ── Link org dialog ────────────────────────────────────────────────────

function LinkOrgDialog({
  partnerId, open, onClose, onLinked,
}: { partnerId: number; open: boolean; onClose: () => void; onLinked: () => void }) {
  const { linkOrg, isLinking } = useAdminLinkPartnerOrg(partnerId);
  const [org, setOrg] = useState<AdminOrgSearchResult | null>(null);
  const [shareFinancials, setShareFinancials] = useState(false);

  const reset = () => { setOrg(null); setShareFinancials(false); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!org) { toast.error("Seleccioná una organización"); return; }
    try {
      await linkOrg(org.id, shareFinancials);
      toast.success(`${org.name} vinculada`);
      onLinked();
      handleClose();
    } catch (err: any) {
      toast.error(err.message || "Error al vincular organización");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular organización</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Organización</Label>
            <OrgPicker selected={org} onSelect={setOrg} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Compartir finanzas</p>
              <p className="text-xs text-muted-foreground">
                El partner ve montos/ingresos de esta org, no solo actividad. Requiere consentimiento
                del dueño del negocio — no lo actives sin confirmarlo con ellos.
              </p>
            </div>
            <Switch checked={shareFinancials} onCheckedChange={setShareFinancials} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLinking}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isLinking || !org} className="gap-2">
            {isLinking ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

export default function AdminPartnerDetailPage() {
  const { push } = useRouter();
  const params = useParams();
  const partnerId = Number(params.id);

  const { partner, organizations, isLoading, mutate } = useAdminPartner(partnerId || null);
  const { updatePartner, isSaving } = useAdminUpdatePartner();
  const { updateLink } = useAdminUpdatePartnerOrgLink(partnerId || null);
  const { unlinkOrg, isRemoving } = useAdminUnlinkPartnerOrg(partnerId || null);

  const [showLink, setShowLink] = useState(false);
  const [unlinking, setUnlinking] = useState<{ org_id: number; org_name: string } | null>(null);

  const [form, setForm] = useState<{ name: string; contact_name: string; email: string; phone: string } | null>(null);
  const active = form ?? (partner ? { name: partner.name, contact_name: partner.contact_name ?? "", email: partner.email, phone: partner.phone ?? "" } : null);

  const handleSave = async () => {
    if (!active) return;
    try {
      await updatePartner(partnerId, {
        name: active.name.trim(),
        contact_name: active.contact_name.trim() || null,
        email: active.email.trim(),
        phone: active.phone.trim() || null,
      });
      toast.success("Cambios guardados");
      mutate();
      setForm(null);
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    }
  };

  const handleToggleShare = async (orgId: number, current: boolean) => {
    try {
      await updateLink(orgId, !current);
      toast.success(!current ? "Ahora comparte finanzas" : "Ya no comparte finanzas");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar el vínculo");
    }
  };

  const handleUnlink = async () => {
    if (!unlinking) return;
    try {
      await unlinkOrg(unlinking.org_id);
      toast.success(`${unlinking.org_name} desvinculada`);
      mutate();
      setUnlinking(null);
    } catch (err: any) {
      toast.error(err.message || "Error al desvincular");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 pb-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!partner) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Partner no encontrado</p>;
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => push("/partners")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{partner.name}</h1>
            <Badge variant="outline" className={partner.is_active ? "border-green-200 bg-green-100 text-green-700" : "border-gray-200 bg-gray-100 text-gray-600"}>
              {partner.is_active ? "Activo" : "Inactivo"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{organizations.length} organización{organizations.length !== 1 ? "es" : ""} vinculada{organizations.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <p className="text-sm font-semibold">Información de contacto</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input value={active?.name ?? ""} onChange={(e) => setForm({ ...active!, name: e.target.value })} disabled={isSaving} />
            </div>
            <div className="space-y-1.5">
              <Label>Contacto</Label>
              <Input value={active?.contact_name ?? ""} onChange={(e) => setForm({ ...active!, contact_name: e.target.value })} disabled={isSaving} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={active?.email ?? ""} onChange={(e) => setForm({ ...active!, email: e.target.value })} disabled={isSaving} />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input value={active?.phone ?? ""} onChange={(e) => setForm({ ...active!, phone: e.target.value })} disabled={isSaving} />
            </div>
          </div>
          {partner.user_email && (
            <p className="text-xs text-muted-foreground">Login vinculado: <span className="font-medium text-foreground">{partner.user_email}</span></p>
          )}
          {form && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setForm(null)} disabled={isSaving}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5">
                {isSaving && <Loader2 className="size-3.5 animate-spin" />}
                Guardar cambios
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Organizaciones vinculadas</p>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowLink(true)}>
          <Plus className="size-3.5" /> Vincular organización
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Organización</TableHead>
              <TableHead>Comparte finanzas</TableHead>
              <TableHead>Vinculada</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                  <Building2 className="mx-auto mb-2 size-8 text-muted-foreground/30" />
                  Sin organizaciones vinculadas todavía
                </TableCell>
              </TableRow>
            ) : (
              organizations.map((link) => (
                <TableRow key={link.link_id}>
                  <TableCell>
                    <p className="text-sm font-medium">{link.org_name}</p>
                    <p className="text-xs text-muted-foreground">{link.owner_email}</p>
                  </TableCell>
                  <TableCell>
                    <Switch checked={link.share_financials} onCheckedChange={() => handleToggleShare(link.org_id, link.share_financials)} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground" suppressHydrationWarning>
                    {new Date(link.linked_at).toLocaleDateString("es-HN", { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost" size="icon"
                      className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setUnlinking({ org_id: link.org_id, org_name: link.org_name })}
                    >
                      <Link2Off className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <LinkOrgDialog partnerId={partnerId} open={showLink} onClose={() => setShowLink(false)} onLinked={() => mutate()} />

      <AlertDialog open={!!unlinking} onOpenChange={(v) => !v && setUnlinking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desvincular organización?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{unlinking?.org_name}</strong> dejará de ser visible para este partner.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleUnlink} disabled={isRemoving}>
              {isRemoving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

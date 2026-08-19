// app/(admin)/partners/[id]/page.tsx
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  useAdminPartner, useAdminUpdatePartner, useAdminLinkPartnerOrg,
  useAdminUpdatePartnerOrgLink, useAdminUnlinkPartnerOrg, useAdminBulkSponsor,
  AdminOrgSearchResult, SponsorBatchResultRow,
} from "@/hooks/swr/use-admin";
import { OrgPicker, MultiOrgPicker } from "@/components/shared/org-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Plus, Loader2, Building2, Link2Off, Handshake,
  CheckCircle2, XCircle, CircleDashed,
} from "lucide-react";

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

// ── Sponsor batch dialog ───────────────────────────────────────────────
// "El partner compra N suscripciones de M meses para N orgs" — el caso
// que motivó esto. Cada org vincula (si hace falta) y queda con un pago
// independiente, así que no hay ningún "crédito" que arrastrar: si en 3
// meses una de estas orgs paga por su cuenta, no se le sigue contando a
// este partner (ver GET /api/admin/partners/[id], currently_sponsored).

function SponsorBatchDialog({
  partnerId, open, onClose, onDone,
}: { partnerId: number; open: boolean; onClose: () => void; onDone: () => void }) {
  const { bulkSponsor, isSponsoring } = useAdminBulkSponsor(partnerId);
  const [orgs, setOrgs] = useState<AdminOrgSearchResult[]>([]);
  const [amount, setAmount] = useState("0");
  const [months, setMonths] = useState("3");
  const [provider, setProvider] = useState("MANUAL");
  const [results, setResults] = useState<SponsorBatchResultRow[] | null>(null);

  const reset = () => { setOrgs([]); setAmount("0"); setMonths("3"); setProvider("MANUAL"); setResults(null); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (orgs.length === 0) { toast.error("Agregá al menos una organización"); return; }
    const amountNum = Number(amount);
    const monthsNum = Number(months);
    if (!(amountNum >= 0)) { toast.error("El monto por organización debe ser mayor o igual a 0"); return; }
    if (!(monthsNum >= 1)) { toast.error("Los meses deben ser al menos 1"); return; }

    try {
      const res = await bulkSponsor({
        org_ids: orgs.map((o) => o.id),
        amount_usd: amountNum,
        months_purchased: monthsNum,
        provider: provider as "MANUAL" | "STRIPE" | "PAYPAL",
      });
      setResults(res.data);
      if (res.failed === 0) {
        toast.success(`${res.succeeded} organización${res.succeeded !== 1 ? "es" : ""} patrocinada${res.succeeded !== 1 ? "s" : ""}`);
      } else {
        toast.warning(`${res.succeeded} ok, ${res.failed} con error — revisá el detalle`);
      }
      onDone();
    } catch (err: any) {
      toast.error(err.message || "Error al registrar el lote");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Patrocinar organizaciones</DialogTitle>
        </DialogHeader>

        {results ? (
          <div className="space-y-3 py-1">
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {results.map((r) => (
                <div key={r.org_id} className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                  <span className="truncate">{r.org_name ?? `Org #${r.org_id}`}</span>
                  {r.success
                    ? <CheckCircle2 className="size-4 shrink-0 text-success" />
                    : <span className="flex shrink-0 items-center gap-1 text-xs text-destructive"><XCircle className="size-3.5" /> {r.error}</span>}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Cerrar</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-1">
              <div className="space-y-1.5">
                <Label>Organizaciones</Label>
                <MultiOrgPicker selected={orgs} onChange={setOrgs} />
                <p className="text-xs text-muted-foreground">
                  {orgs.length} organización{orgs.length !== 1 ? "es" : ""} seleccionada{orgs.length !== 1 ? "s" : ""}.
                  Las que todavía no estén vinculadas a este partner se vinculan automáticamente.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Monto por org. (USD)</Label>
                  <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={isSponsoring} />
                </div>
                <div className="space-y-1.5">
                  <Label>Meses cubiertos</Label>
                  <Input type="number" min="1" step="1" value={months} onChange={(e) => setMonths(e.target.value)} disabled={isSponsoring} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Método</Label>
                <Select value={provider} onValueChange={setProvider} disabled={isSponsoring}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANUAL">Manual (efectivo/transferencia)</SelectItem>
                    <SelectItem value="STRIPE">Stripe</SelectItem>
                    <SelectItem value="PAYPAL">PayPal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <p className="text-xs text-muted-foreground">
                Cada organización queda con un pago independiente a su nombre — no hay ningún saldo
                ni crédito compartido. Cuando se acabe este período, si la organización paga por su
                cuenta, ese pago nuevo no se le va a contar a este partner.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={isSponsoring}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={isSponsoring || orgs.length === 0} className="gap-2">
                {isSponsoring ? <Loader2 className="size-3.5 animate-spin" /> : <Handshake className="size-3.5" />}
                Patrocinar {orgs.length > 0 && `(${orgs.length})`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

export default function AdminPartnerDetailPage() {
  const { push } = useRouter();
  const params = useParams();
  const partnerId = Number(params.id);

  const { partner, organizations, activeSponsorships, isLoading, mutate } = useAdminPartner(partnerId || null);
  const { updatePartner, isSaving } = useAdminUpdatePartner();
  const { updateLink } = useAdminUpdatePartnerOrgLink(partnerId || null);
  const { unlinkOrg, isRemoving } = useAdminUnlinkPartnerOrg(partnerId || null);

  const [showLink, setShowLink] = useState(false);
  const [showSponsor, setShowSponsor] = useState(false);
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
          <p className="text-sm text-muted-foreground">
            {organizations.length} organización{organizations.length !== 1 ? "es" : ""} vinculada{organizations.length !== 1 ? "s" : ""}
            {" · "}
            <span className={activeSponsorships > 0 ? "font-medium text-success" : ""}>
              {activeSponsorships} con patrocinio activo ahora
            </span>
          </p>
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Organizaciones vinculadas</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowLink(true)}>
            <Plus className="size-3.5" /> Vincular organización
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setShowSponsor(true)}>
            <Handshake className="size-3.5" /> Patrocinar organizaciones
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Organización</TableHead>
              <TableHead>Patrocinio</TableHead>
              <TableHead>Comparte finanzas</TableHead>
              <TableHead>Vinculada</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
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
                  <TableCell className="text-xs">
                    {link.months_sponsored > 0 ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          {link.currently_sponsored ? (
                            <Badge className="border-green-200 bg-green-100 py-0 text-[10px] text-green-700">Activo</Badge>
                          ) : (
                            <Badge variant="outline" className="py-0 text-[10px] text-muted-foreground">
                              Vencido — paga por su cuenta
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          {link.months_sponsored} mes{link.months_sponsored !== 1 ? "es" : ""} pagados por el partner
                          {link.sponsored_until && (
                            <> · {link.currently_sponsored ? "cubierto hasta" : "cubrió hasta"}{" "}
                              <span suppressHydrationWarning>
                                {new Date(link.sponsored_until).toLocaleDateString("es-HN", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            </>
                          )}
                        </p>
                      </>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <CircleDashed className="size-3" /> Sin pagos patrocinados
                      </span>
                    )}
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

      <SponsorBatchDialog partnerId={partnerId} open={showSponsor} onClose={() => setShowSponsor(false)} onDone={() => mutate()} />

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

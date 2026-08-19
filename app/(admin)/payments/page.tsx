// app/(admin)/payments/page.tsx
"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  useAdminPayments, useAdminRegisterPayment, useAdminOrgPartners, AdminPayment,
} from "@/hooks/swr/use-admin";
import { AdminOrgSearchResult } from "@/hooks/swr/use-admin";
import { OrgPicker } from "@/components/shared/org-picker";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  Pagination, PaginationContent, PaginationItem,
  PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { Plus, Search, Loader2, Receipt, Handshake } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  PAID: "Pagado", PENDING: "Pendiente", FAILED: "Fallido", REFUNDED: "Reembolsado",
};
const STATUS_COLOR: Record<string, string> = {
  PAID: "bg-green-100 text-green-700 border-green-200",
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  FAILED: "bg-red-100 text-red-700 border-red-200",
  REFUNDED: "bg-gray-100 text-gray-600 border-gray-200",
};
const PROVIDER_LABEL: Record<string, string> = { MANUAL: "Manual", STRIPE: "Stripe", PAYPAL: "PayPal" };

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-HN", { day: "numeric", month: "short", year: "numeric" });
}

// ── Dialog: registrar pago ────────────────────────────────────────────

function RegisterPaymentDialog({
  open, onClose, onRegistered,
}: { open: boolean; onClose: () => void; onRegistered: () => void }) {
  const { registerPayment, isSaving } = useAdminRegisterPayment();
  const [org, setOrg] = useState<AdminOrgSearchResult | null>(null);
  const [amount, setAmount] = useState("0");
  const [months, setMonths] = useState("1");
  const [provider, setProvider] = useState("MANUAL");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [partnerId, setPartnerId] = useState<string>("");

  const { orgPartners } = useAdminOrgPartners(org?.id ?? null);

  const reset = () => {
    setOrg(null); setAmount("0"); setMonths("1"); setProvider("MANUAL"); setReceiptUrl(""); setPartnerId("");
  };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!org) { toast.error("Seleccioná una organización"); return; }
    const amountNum = Number(amount);
    const monthsNum = Number(months);
    if (!(amountNum >= 0)) { toast.error("El monto debe ser mayor o igual a 0"); return; }
    if (!(monthsNum >= 1)) { toast.error("Los meses deben ser al menos 1"); return; }

    try {
      await registerPayment({
        org_id: org.id,
        amount_usd: amountNum,
        months_purchased: monthsNum,
        provider: provider as "MANUAL" | "STRIPE" | "PAYPAL",
        receipt_url: receiptUrl.trim() || undefined,
        paid_by_partner_id: partnerId ? Number(partnerId) : undefined,
      });
      toast.success(`Pago registrado — suscripción de ${org.name} extendida`);
      onRegistered();
      handleClose();
    } catch (err: any) {
      toast.error(err.message || "Error al registrar el pago");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago manual</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Organización</Label>
            <OrgPicker selected={org} onSelect={(o) => { setOrg(o); setPartnerId(""); }} />
          </div>

          {org && orgPartners.length > 0 && (
            <div className="space-y-1.5">
              <Label>Patrocinado por (opcional)</Label>
              <Select value={partnerId || "none"} onValueChange={(v) => setPartnerId(v === "none" ? "" : v)} disabled={isSaving}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno — paga la propia organización</SelectItem>
                  {orgPartners.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Solo marcá esto si el partner efectivamente pagó este período — no queda ningún
                estado "patrocinado" en la org, es por pago. El próximo pago que registres sin
                elegir partner no se le va a contar a nadie más que a la propia organización.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Monto (USD)</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={isSaving} />
            </div>
            <div className="space-y-1.5">
              <Label>Meses cubiertos</Label>
              <Input type="number" min="1" step="1" value={months} onChange={(e) => setMonths(e.target.value)} disabled={isSaving} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Método</Label>
            <Select value={provider} onValueChange={setProvider} disabled={isSaving}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MANUAL">Manual (efectivo/transferencia)</SelectItem>
                <SelectItem value="STRIPE">Stripe</SelectItem>
                <SelectItem value="PAYPAL">PayPal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Comprobante (URL, opcional)</Label>
            <Input value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} placeholder="https://…" disabled={isSaving} />
          </div>

          <p className="text-xs text-muted-foreground">
            Esto extiende la suscripción de la organización — si el período actual no venció, los
            meses se acumulan al final; si ya venció, arranca desde hoy.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSaving || !org} className="gap-2">
            {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Registrar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

export default function AdminPaymentsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [showRegister, setShowRegister] = useState(false);
  const debouncedSearch = useDebounce(search, 350);

  const { payments, total, pages, isLoading, mutate } = useAdminPayments({
    search: debouncedSearch, status, page,
  });

  const handleSearch = useCallback((v: string) => { setSearch(v); setPage(1); }, []);
  const handleStatus = useCallback((v: string) => { setStatus(v); setPage(1); }, []);

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Pagos</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Cargando…" : `${total} pago${total !== 1 ? "s" : ""} registrados`}
          </p>
        </div>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setShowRegister(true)}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">Registrar pago</span>
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por organización o email del dueño…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={handleStatus}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="PAID">Pagado</SelectItem>
            <SelectItem value="PENDING">Pendiente</SelectItem>
            <SelectItem value="FAILED">Fallido</SelectItem>
            <SelectItem value="REFUNDED">Reembolsado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="hidden overflow-hidden rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Organización</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Meses</TableHead>
              <TableHead>Período cubierto</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
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
            ) : payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  <Receipt className="mx-auto mb-2 size-8 text-muted-foreground/30" />
                  No hay pagos registrados
                </TableCell>
              </TableRow>
            ) : (
              payments.map((p: AdminPayment) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <p className="text-sm font-medium">{p.org_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{p.owner_email ?? "—"}</p>
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    ${Number(p.amount_usd).toFixed(2)} {p.currency !== "USD" && <span className="text-xs text-muted-foreground">{p.currency}</span>}
                  </TableCell>
                  <TableCell className="text-sm">{p.months_purchased ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmtDate(p.covers_period_start)} → {fmtDate(p.covers_period_end)}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1.5">
                      {PROVIDER_LABEL[p.provider ?? ""] ?? p.provider ?? "—"}
                      {p.partner_name && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Patrocinado por partner">
                          <Handshake className="size-3" /> {p.partner_name}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${STATUS_COLOR[p.status] ?? ""} border text-xs`}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground" suppressHydrationWarning>
                    {fmtDate(p.paid_at ?? p.created_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2 md:hidden">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          : payments.length === 0
            ? <p className="py-12 text-center text-sm text-muted-foreground">No hay pagos registrados</p>
            : payments.map((p: AdminPayment) => (
                <div key={p.id} className="rounded-xl border p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.org_name ?? "—"}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.owner_email ?? "—"}</p>
                    </div>
                    <Badge className={`${STATUS_COLOR[p.status] ?? ""} border shrink-0 text-xs`}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>${Number(p.amount_usd).toFixed(2)} · {p.months_purchased} mes{p.months_purchased !== 1 ? "es" : ""}</span>
                    <span>{fmtDate(p.paid_at ?? p.created_at)}</span>
                  </div>
                </div>
              ))
        }
      </div>

      {pages > 1 && (
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <p className="order-2 text-sm text-muted-foreground sm:order-1">
            {total} pago{total !== 1 ? "s" : ""} · página {page} de {pages}
          </p>
          <Pagination className="order-1 mx-0 w-auto justify-end sm:order-2">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-disabled={page === 1}
                  className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <PaginationItem key={p}>
                  <PaginationLink isActive={p === page} onClick={() => setPage(p)} className="cursor-pointer">{p}</PaginationLink>
                </PaginationItem>
              ))}
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

      <RegisterPaymentDialog open={showRegister} onClose={() => setShowRegister(false)} onRegistered={() => mutate()} />
    </div>
  );
}

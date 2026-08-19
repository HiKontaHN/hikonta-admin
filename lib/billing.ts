// lib/billing.ts
// Aplicar un pago a una suscripción de organización — el "pegamento" entre
// "se registró un pago" y "extender org_subscriptions.current_period_end"
// que database/docs/partner-dashboard-architecture.md (yelifin-sistema)
// deja pendiente. Usado desde POST /api/admin/payments; el mismo helper
// sirve más adelante para POST /api/partner/organizations/[id]/sponsor en
// hikonta-partners, pasando paidByPartnerId.
import { sql } from "@/lib/db";

export type ApplyPaymentOpts = {
  amountUsd: number;
  currency?: string;
  provider?: "MANUAL" | "STRIPE" | "PAYPAL";
  paidByPartnerId?: number | null;
  receiptUrl?: string | null;
};

export async function applySubscriptionPayment(
  orgId: number,
  monthsPurchased: number,
  opts: ApplyPaymentOpts
) {
  const [orgSub] = await sql`
    SELECT id, current_period_end FROM org_subscriptions WHERE org_id = ${orgId}
  `;
  if (!orgSub) {
    throw new Error("Esta organización no tiene una suscripción — no se puede registrar el pago");
  }

  const now = new Date();
  const currentEnd = orgSub.current_period_end ? new Date(orgSub.current_period_end) : null;
  const expired = !currentEnd || currentEnd <= now;

  // Si el período actual no venció, el pago se acumula sobre el final
  // existente. Si ya venció (o nunca tuvo fecha), arranca desde hoy.
  const start = expired ? now : currentEnd;
  const end = new Date(start);
  end.setMonth(end.getMonth() + monthsPurchased);

  await sql`
    UPDATE org_subscriptions
    SET
      status                = 'ACTIVE',
      current_period_start  = ${expired ? start.toISOString() : sql`current_period_start`},
      current_period_end    = ${end.toISOString()},
      updated_at             = NOW()
    WHERE id = ${orgSub.id}
  `;

  const [payment] = await sql`
    INSERT INTO subscription_payments (
      org_id, org_subscription_id, amount_usd, currency, status, provider,
      months_purchased, covers_period_start, covers_period_end,
      paid_by_partner_id, paid_at, receipt_url
    ) VALUES (
      ${orgId}, ${orgSub.id}, ${opts.amountUsd}, ${opts.currency ?? "USD"}, 'PAID',
      ${opts.provider ?? "MANUAL"}, ${monthsPurchased},
      ${start.toISOString()}, ${end.toISOString()},
      ${opts.paidByPartnerId ?? null}, NOW(), ${opts.receiptUrl ?? null}
    )
    RETURNING *
  `;

  return { payment, newPeriodEnd: end };
}

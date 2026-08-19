// app/api/admin/payments/route.ts
// Historial de pagos de la plataforma + registro manual. Le da UI a
// subscription_payments, que existe en el schema desde ddl.v2/v3 pero
// nunca tuvo endpoint (ver database/docs/partner-dashboard-architecture.md
// en yelifin-sistema, sección "Suscripciones compradas").
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyAdmin, createErrorResponse, isAuthSuccess } from "@/lib/auth";
import { applySubscriptionPayment } from "@/lib/billing";
import { rateLimit, getClientIP } from "@/lib/rate-limit";

// ── GET /api/admin/payments — historial, paginado ────────────────────────
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status") ?? "all";
    const page   = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit  = 20;
    const offset = (page - 1) * limit;

    const payments = await sql`
      SELECT
        sp.id, sp.org_id, sp.amount_usd, sp.currency, sp.status, sp.provider,
        sp.months_purchased, sp.covers_period_start, sp.covers_period_end,
        sp.paid_at, sp.created_at, sp.receipt_url, sp.paid_by_partner_id,
        o.name          AS org_name,
        u.email         AS owner_email,
        pt.name         AS partner_name
      FROM subscription_payments sp
      LEFT JOIN organizations o ON o.id = sp.org_id
      LEFT JOIN users u         ON u.id = o.owner_user_id
      LEFT JOIN partners pt     ON pt.id = sp.paid_by_partner_id
      WHERE (
        ${search} = ''
        OR o.name  ILIKE ${'%' + search + '%'}
        OR u.email ILIKE ${'%' + search + '%'}
      )
      AND (${status} = 'all' OR sp.status = ${status})
      ORDER BY sp.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [{ total }] = await sql`
      SELECT COUNT(*)::int AS total
      FROM subscription_payments sp
      LEFT JOIN organizations o ON o.id = sp.org_id
      LEFT JOIN users u         ON u.id = o.owner_user_id
      WHERE (
        ${search} = ''
        OR o.name  ILIKE ${'%' + search + '%'}
        OR u.email ILIKE ${'%' + search + '%'}
      )
      AND (${status} = 'all' OR sp.status = ${status})
    `;

    return Response.json({ data: payments, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("GET /api/admin/payments:", error);
    return createErrorResponse("Error al obtener pagos", 500);
  }
}

// ── POST /api/admin/payments — registrar pago manual ─────────────────────
// Extiende la suscripción de la org y deja el registro en
// subscription_payments — ver lib/billing.ts (applySubscriptionPayment).
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  // Extiende suscripciones reales — un límite propio evita que un loop
  // accidental (o un script mal apuntado) dispare pagos en cadena.
  const { allowed, retryAfterSec } = rateLimit(`register-payment:${getClientIP(request)}`, 30, 15 * 60 * 1000);
  if (!allowed) {
    return Response.json(
      { error: "Demasiados pagos registrados seguidos. Esperá unos minutos." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  try {
    const {
      org_id, amount_usd, months_purchased, provider, currency, receipt_url,
      paid_by_partner_id,
    } = await request.json();

    const orgId   = Number(org_id);
    const amount  = Number(amount_usd);
    const months  = Number(months_purchased);

    if (!orgId)                 return createErrorResponse("Seleccioná una organización", 400);
    if (!(amount >= 0))         return createErrorResponse("El monto debe ser mayor o igual a 0", 400);
    if (!(months >= 1))         return createErrorResponse("Los meses cubiertos deben ser al menos 1", 400);
    if (provider && !["MANUAL", "STRIPE", "PAYPAL"].includes(provider)) {
      return createErrorResponse("Proveedor inválido", 400);
    }

    const [org] = await sql`SELECT id FROM organizations WHERE id = ${orgId}`;
    if (!org) return createErrorResponse("Organización no encontrada", 404);

    // Patrocinio de partner — opcional, NULL por defecto (pago propio de la
    // org). Requiere que el partner esté vinculado a esta org
    // (partner_organizations); si no, un admin podría "patrocinar" a nombre
    // de un partner ajeno a la organización sin querer. Cuando el
    // patrocinio del partner se acaba, el siguiente pago que registre la
    // org por su cuenta simplemente no manda paid_by_partner_id — no hay
    // ningún estado global "esta org está patrocinada" que arrastrar, cada
    // pago es independiente, así que nunca se le sigue contando al partner
    // sin que un admin lo marque explícitamente en ESE pago puntual.
    let partnerId: number | null = null;
    if (paid_by_partner_id) {
      partnerId = Number(paid_by_partner_id);
      const [link] = await sql`
        SELECT id FROM partner_organizations WHERE partner_id = ${partnerId} AND org_id = ${orgId}
      `;
      if (!link) {
        return createErrorResponse("Ese partner no está vinculado a esta organización — vinculalo primero desde Partners", 400);
      }
    }

    const { payment, newPeriodEnd } = await applySubscriptionPayment(orgId, months, {
      amountUsd: amount,
      currency: currency || "USD",
      provider: provider || "MANUAL",
      receiptUrl: receipt_url || null,
      paidByPartnerId: partnerId,
    });

    return Response.json({ data: payment, newPeriodEnd }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/admin/payments:", error);
    return createErrorResponse(error?.message ?? "Error al registrar el pago", 500);
  }
}

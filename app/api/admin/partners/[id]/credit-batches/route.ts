// app/api/admin/partners/[id]/credit-batches/route.ts
// Lote de CRÉDITOS de suscripción — la mitad de "invitaciones de
// suscripción patrocinada" (ver documentation/feature-sponsorship-invites.md)
// que se construye ahora: un partner compra N suscripciones de M meses SIN
// asignarlas todavía a ninguna organización. A diferencia de
// POST /api/admin/partners/[id]/sponsor (que exige org_ids ya existentes y
// genera un pago independiente por cada org), acá se genera UN solo cobro
// por todo el lote — precio del plan × meses × cantidad, con descuento
// opcional vía un precio final pactado — y quedan N créditos PENDING sin
// dueño. Asignar un crédito a una organización (canje, por link o por
// email) es un paso futuro, todavía no construido — ver esa doc.
import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { sql } from "@/lib/db";
import { verifyAdmin, createErrorResponse, isAuthSuccess } from "@/lib/auth";
import { rateLimit, getClientIP } from "@/lib/rate-limit";

type Params = { params: Promise<{ id: string }> };

const MAX_QUANTITY = 200;

function generateToken() {
  return randomBytes(24).toString("hex");
}

// ── GET — lotes de créditos del partner + conteo por estado ────────────
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  const { id: rawId } = await params;
  const partnerId = Number(rawId);
  if (!partnerId) return createErrorResponse("ID inválido", 400);

  try {
    const batches = await sql`
      SELECT
        b.id, b.months, b.quantity, b.list_unit_price_usd, b.unit_price_usd,
        b.total_usd, b.currency, b.provider, b.receipt_url, b.notes, b.created_at,
        b.plan_id, p.name AS plan_name,
        COUNT(*) FILTER (WHERE c.status = 'PENDING') ::int AS pending_count,
        COUNT(*) FILTER (WHERE c.status = 'CLAIMED') ::int AS claimed_count,
        COUNT(*) FILTER (WHERE c.status = 'REVOKED') ::int AS revoked_count
      FROM partner_credit_batches b
      JOIN subscription_plans p ON p.id = b.plan_id
      LEFT JOIN partner_subscription_credits c ON c.batch_id = b.id
      WHERE b.partner_id = ${partnerId}
      GROUP BY b.id, p.name
      ORDER BY b.created_at DESC
    `;

    return Response.json({ data: batches });
  } catch (error) {
    console.error("GET /api/admin/partners/[id]/credit-batches:", error);
    return createErrorResponse("Error al obtener los lotes de créditos", 500);
  }
}

// ── POST — comprar un lote de N créditos para el partner ───────────────
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  const { id: rawId } = await params;
  const partnerId = Number(rawId);
  if (!partnerId) return createErrorResponse("ID inválido", 400);

  const { allowed, retryAfterSec } = rateLimit(`credit-batch:${getClientIP(request)}`, 10, 15 * 60 * 1000);
  if (!allowed) {
    return Response.json(
      { error: "Demasiados lotes de créditos seguidos. Esperá unos minutos." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  try {
    const { plan_id, months, quantity, unit_price_usd, provider, currency, receipt_url, notes } = await request.json();

    const [partner] = await sql`SELECT id FROM partners WHERE id = ${partnerId}`;
    if (!partner) return createErrorResponse("Partner no encontrado", 404);

    const monthsNum = Number(months);
    if (!(monthsNum >= 1)) return createErrorResponse("Los meses por suscripción deben ser al menos 1", 400);

    const quantityNum = Number(quantity);
    if (!(quantityNum >= 1)) return createErrorResponse("La cantidad de suscripciones debe ser al menos 1", 400);
    if (quantityNum > MAX_QUANTITY) return createErrorResponse(`Máximo ${MAX_QUANTITY} suscripciones por lote`, 400);

    if (provider && !["MANUAL", "STRIPE", "PAYPAL"].includes(provider)) {
      return createErrorResponse("Proveedor inválido", 400);
    }

    // Igual que el patrocinio por lote: solo planes pagos, y el precio de
    // lista sale del plan — no se tipea a mano. Lo que sí se tipea es el
    // precio FINAL pactado (unit_price_usd): si es menor al de lista, la
    // diferencia es el descuento; no hay un campo de "% descuento" aparte,
    // es una sola cifra clara por crédito.
    const planIdNum = Number(plan_id);
    if (!planIdNum) return createErrorResponse("Seleccioná un plan", 400);

    const [plan] = await sql`SELECT id, name, price_usd FROM subscription_plans WHERE id = ${planIdNum}`;
    if (!plan) return createErrorResponse("Plan no encontrado", 404);
    if (!(Number(plan.price_usd) > 0)) {
      return createErrorResponse("Solo se puede armar un lote con un plan pago (precio mayor a $0)", 400);
    }

    const listUnitPrice = Number(plan.price_usd) * monthsNum;
    const unitPrice = unit_price_usd === undefined || unit_price_usd === null || unit_price_usd === ""
      ? listUnitPrice
      : Number(unit_price_usd);
    if (!(unitPrice >= 0)) return createErrorResponse("El precio por suscripción no puede ser negativo", 400);

    const totalUsd = Math.round(unitPrice * quantityNum * 100) / 100;

    const [batch] = await sql`
      INSERT INTO partner_credit_batches (
        partner_id, plan_id, months, quantity, list_unit_price_usd, unit_price_usd,
        total_usd, currency, provider, receipt_url, notes, created_by_user_id
      ) VALUES (
        ${partnerId}, ${plan.id}, ${monthsNum}, ${quantityNum},
        ${listUnitPrice}, ${unitPrice}, ${totalUsd},
        ${currency || "USD"}, ${provider || "MANUAL"}, ${receipt_url || null}, ${notes || null},
        ${auth.data.userId || null}
      )
      RETURNING *
    `;

    try {
      const tokens = Array.from({ length: quantityNum }, () => generateToken());
      await sql`
        INSERT INTO partner_subscription_credits (batch_id, partner_id, plan_id, months, token)
        SELECT ${batch.id}, ${partnerId}, ${plan.id}, ${monthsNum}, t
        FROM unnest(${tokens}::text[]) AS t
      `;
    } catch (creditsError) {
      // No dejar una "factura" de un lote sin créditos de verdad.
      await sql`DELETE FROM partner_credit_batches WHERE id = ${batch.id}`;
      throw creditsError;
    }

    return Response.json({ data: { ...batch, plan_name: plan.name } }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/partners/[id]/credit-batches:", error);
    return createErrorResponse("Error al registrar el lote de créditos", 500);
  }
}

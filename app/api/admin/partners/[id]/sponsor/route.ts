// app/api/admin/partners/[id]/sponsor/route.ts
// Patrocinar un LOTE de organizaciones de una sola vez — el caso real que
// motivó esto: un partner compra N suscripciones de M meses para N
// emprendedores distintos. Registrarlas una por una desde "Registrar pago"
// (payments/page.tsx) funciona pero es tedioso para un lote de 20; esto
// hace lo mismo N veces en una sola llamada, vinculando la org al partner
// si todavía no lo estaba.
//
// Cada organización sigue quedando como un pago INDEPENDIENTE con su
// propio paid_by_partner_id — no hay ningún "crédito" ni estado de lote
// que arrastrar. Si en 3 meses una de esas orgs paga por su cuenta, ese
// pago nuevo no pasa por acá y no lleva partner — ver nota en
// GET /api/admin/partners/[id] (currently_sponsored).
//
// El monto no se tipea a mano: se elige un PLAN (solo planes con
// price_usd > 0) y el monto sale de price_usd × meses. Patrocinar deja a
// la organización efectivamente en ese plan (applySubscriptionPayment
// actualiza org_subscriptions.plan_id), no solo le cobra su precio.
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyAdmin, createErrorResponse, isAuthSuccess } from "@/lib/auth";
import { applySubscriptionPayment } from "@/lib/billing";
import { rateLimit, getClientIP } from "@/lib/rate-limit";

type Params = { params: Promise<{ id: string }> };

const MAX_BATCH = 100;

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  const { id: rawId } = await params;
  const partnerId = Number(rawId);
  if (!partnerId) return createErrorResponse("ID inválido", 400);

  // Límite propio: un lote ya cubre muchas orgs de una — no hace falta
  // permitir muchos lotes seguidos.
  const { allowed, retryAfterSec } = rateLimit(`sponsor-batch:${getClientIP(request)}`, 10, 15 * 60 * 1000);
  if (!allowed) {
    return Response.json(
      { error: "Demasiados lotes de patrocinio seguidos. Esperá unos minutos." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  try {
    const { org_ids, plan_id, months_purchased, provider, currency, receipt_url } = await request.json();

    if (!Array.isArray(org_ids) || org_ids.length === 0) {
      return createErrorResponse("Seleccioná al menos una organización", 400);
    }
    if (org_ids.length > MAX_BATCH) {
      return createErrorResponse(`Máximo ${MAX_BATCH} organizaciones por lote`, 400);
    }

    const months = Number(months_purchased);
    if (!(months >= 1)) return createErrorResponse("Los meses cubiertos deben ser al menos 1", 400);
    if (provider && !["MANUAL", "STRIPE", "PAYPAL"].includes(provider)) {
      return createErrorResponse("Proveedor inválido", 400);
    }

    const [partner] = await sql`SELECT id FROM partners WHERE id = ${partnerId}`;
    if (!partner) return createErrorResponse("Partner no encontrado", 404);

    // El monto no se tipea a mano — sale del precio del plan elegido, y
    // patrocinar deja a la org efectivamente EN ese plan (no solo cobra su
    // precio). Solo planes pagos: no tiene sentido "patrocinar" un plan
    // gratis/trial, y evita elegir por error un plan sin precio cargado.
    const planIdNum = Number(plan_id);
    if (!planIdNum) return createErrorResponse("Seleccioná un plan", 400);

    const [plan] = await sql`SELECT id, name, price_usd FROM subscription_plans WHERE id = ${planIdNum}`;
    if (!plan) return createErrorResponse("Plan no encontrado", 404);
    if (!(Number(plan.price_usd) > 0)) {
      return createErrorResponse("Solo se puede patrocinar con un plan pago (precio mayor a $0)", 400);
    }

    const amount = Number(plan.price_usd) * months;

    const uniqueOrgIds = [...new Set(org_ids.map((v: unknown) => Number(v)).filter(Boolean))];

    const results: Array<{ org_id: number; org_name: string | null; success: boolean; error?: string }> = [];

    for (const orgId of uniqueOrgIds) {
      try {
        const [org] = await sql`SELECT id, name FROM organizations WHERE id = ${orgId}`;
        if (!org) {
          results.push({ org_id: orgId, org_name: null, success: false, error: "Organización no encontrada" });
          continue;
        }

        // Vincula si todavía no lo estaba — primera vez que este partner
        // cubre a esta org. No pisa share_financials si ya existía el vínculo.
        await sql`
          INSERT INTO partner_organizations (partner_id, org_id, share_financials)
          VALUES (${partnerId}, ${orgId}, FALSE)
          ON CONFLICT (partner_id, org_id) DO NOTHING
        `;

        await applySubscriptionPayment(orgId, months, {
          amountUsd: amount,
          currency: currency || "USD",
          provider: provider || "MANUAL",
          receiptUrl: receipt_url || null,
          paidByPartnerId: partnerId,
          planId: plan.id,
        });

        results.push({ org_id: orgId, org_name: org.name, success: true });
      } catch (err: any) {
        const [org] = await sql`SELECT name FROM organizations WHERE id = ${orgId}`;
        results.push({ org_id: orgId, org_name: org?.name ?? null, success: false, error: err?.message ?? "Error al registrar el pago" });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    return Response.json({ data: results, succeeded, failed: results.length - succeeded }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/partners/[id]/sponsor:", error);
    return createErrorResponse("Error al registrar el lote de patrocinio", 500);
  }
}

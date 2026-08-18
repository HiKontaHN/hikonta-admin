// app/api/admin/plans/[id]/route.ts
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyAdmin, createErrorResponse, isAuthSuccess } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id) return createErrorResponse("ID inválido", 400);

  try {
    const body = await request.json();
    const {
      name,
      description,
      price_usd,
      billing_interval,
      max_products,
      max_sales_per_month,
      max_storage_mb,
      max_transactions_per_month,
      max_accounts,
      max_supplies,
      is_active,
    } = body;

    const [plan] = await sql`
      UPDATE subscription_plans SET
        name                 = COALESCE(${name ?? null}, name),
        description          = COALESCE(${description ?? null}, description),
        price_usd            = COALESCE(${price_usd ?? null}, price_usd),
        billing_interval     = COALESCE(${billing_interval ?? null}, billing_interval),
        max_products         = ${max_products !== undefined ? (max_products === null ? null : Number(max_products)) : sql`max_products`},
        max_sales_per_month  = ${max_sales_per_month !== undefined ? (max_sales_per_month === null ? null : Number(max_sales_per_month)) : sql`max_sales_per_month`},
        max_storage_mb       = ${max_storage_mb !== undefined ? (max_storage_mb === null ? null : Number(max_storage_mb)) : sql`max_storage_mb`},
        max_transactions_per_month = ${max_transactions_per_month !== undefined ? (max_transactions_per_month === null ? null : Number(max_transactions_per_month)) : sql`max_transactions_per_month`},
        max_accounts         = ${max_accounts !== undefined ? (max_accounts === null ? null : Number(max_accounts)) : sql`max_accounts`},
        max_supplies         = ${max_supplies !== undefined ? (max_supplies === null ? null : Number(max_supplies)) : sql`max_supplies`},
        is_active            = COALESCE(${is_active ?? null}, is_active),
        updated_at           = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (!plan) return createErrorResponse("Plan no encontrado", 404);
    return Response.json({ data: plan });
  } catch (error) {
    console.error("PATCH /api/admin/plans/[id]:", error);
    return createErrorResponse("Error al actualizar plan", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id) return createErrorResponse("ID inválido", 400);

  try {
    const [{ org_count }] = await sql`
      SELECT COUNT(os.id)::int AS org_count
      FROM subscription_plans sp
      LEFT JOIN org_subscriptions os ON os.plan_id = sp.id
      WHERE sp.id = ${id}
      GROUP BY sp.id
    `;

    if (org_count > 0) {
      return createErrorResponse(
        `No se puede eliminar: ${org_count} organización${org_count !== 1 ? "es" : ""} usa${org_count !== 1 ? "n" : ""} este plan`,
        409
      );
    }

    await sql`DELETE FROM subscription_plans WHERE id = ${id}`;
    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/plans/[id]:", error);
    return createErrorResponse("Error al eliminar plan", 500);
  }
}

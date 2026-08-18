// app/api/admin/plans/route.ts
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyAdmin, createErrorResponse, isAuthSuccess } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const body = await request.json();
    const { name, slug, description, price_usd, billing_interval, max_products, max_sales_per_month, max_storage_mb, max_transactions_per_month, max_accounts, max_supplies } = body;

    if (!name?.trim() || !slug?.trim() || !billing_interval) {
      return createErrorResponse("Nombre, slug e intervalo de facturación son requeridos", 400);
    }

    const [plan] = await sql`
      INSERT INTO subscription_plans
        (name, slug, description, price_usd, billing_interval, max_products, max_sales_per_month, max_storage_mb, max_transactions_per_month, max_accounts, max_supplies)
      VALUES (
        ${name.trim()},
        ${slug.trim().toLowerCase().replace(/\s+/g, "-")},
        ${description ?? null},
        ${Number(price_usd ?? 0)},
        ${billing_interval},
        ${max_products != null ? Number(max_products) : null},
        ${max_sales_per_month != null ? Number(max_sales_per_month) : null},
        ${max_storage_mb != null ? Number(max_storage_mb) : null},
        ${max_transactions_per_month != null ? Number(max_transactions_per_month) : null},
        ${max_accounts != null ? Number(max_accounts) : null},
        ${max_supplies != null ? Number(max_supplies) : null}
      )
      RETURNING *
    `;

    return Response.json({ data: plan }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/admin/plans:", error);
    if (error?.code === "23505") return createErrorResponse("Ya existe un plan con ese slug", 409);
    return createErrorResponse("Error al crear plan", 500);
  }
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const plans = await sql`
      SELECT
        sp.id,
        sp.name,
        sp.slug,
        sp.description,
        sp.price_usd,
        sp.billing_interval,
        sp.max_products,
        sp.max_sales_per_month,
        sp.max_storage_mb,
        sp.max_transactions_per_month,
        sp.max_accounts,
        sp.max_supplies,
        sp.is_active,
        COUNT(os.id)::int AS user_count
      FROM subscription_plans sp
      LEFT JOIN org_subscriptions os ON os.plan_id = sp.id
      GROUP BY sp.id
      ORDER BY sp.price_usd ASC, sp.name ASC
    `;

    return Response.json({ data: plans });
  } catch (error) {
    console.error("GET /api/admin/plans:", error);
    return createErrorResponse("Error al obtener planes", 500);
  }
}

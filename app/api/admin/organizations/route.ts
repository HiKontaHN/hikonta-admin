// app/api/admin/organizations/route.ts
// Búsqueda de organizaciones — usado por el picker de "registrar pago" y el
// de "vincular organización a un partner". Nunca existió una ruta
// /api/admin/organizations en yelifin-sistema (el panel admin viejo
// trabajaba por usuario, no por org) — es nueva acá.
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyAdmin, createErrorResponse, isAuthSuccess } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const limit  = Math.min(Number(searchParams.get("limit") ?? "20"), 50);

    const orgs = await sql`
      SELECT
        o.id, o.name, o.currency,
        u.email        AS owner_email,
        u.display_name AS owner_display_name,
        os.status      AS subscription_status,
        os.current_period_end,
        sp.name        AS plan_name
      FROM organizations o
      JOIN users u ON u.id = o.owner_user_id
      LEFT JOIN org_subscriptions  os ON os.org_id = o.id
      LEFT JOIN subscription_plans sp ON sp.id     = os.plan_id
      WHERE o.is_active = TRUE
        AND (${search} = '' OR o.name ILIKE ${'%' + search + '%'} OR u.email ILIKE ${'%' + search + '%'})
      ORDER BY o.name ASC
      LIMIT ${limit}
    `;

    return Response.json({ data: orgs });
  } catch (error) {
    console.error("GET /api/admin/organizations:", error);
    return createErrorResponse("Error al buscar organizaciones", 500);
  }
}

// app/api/admin/stats/route.ts
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyAdmin, createErrorResponse, isAuthSuccess } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    // Conteos de usuarios (plataforma)
    const [counts] = await sql`
      SELECT
        COUNT(DISTINCT u.id)::int                                                            AS total_users,
        COUNT(DISTINCT u.id) FILTER (WHERE u.is_active = TRUE)::int                         AS active_users,
        COUNT(DISTINCT u.id) FILTER (WHERE u.is_active = FALSE)::int                        AS inactive_users,
        COUNT(DISTINCT u.id) FILTER (WHERE u.created_at >= DATE_TRUNC('month', NOW()))::int AS new_this_month,
        -- suscripciones por org (una por org)
        COUNT(DISTINCT os.id) FILTER (WHERE os.status = 'TRIAL')::int      AS trial_count,
        COUNT(DISTINCT os.id) FILTER (WHERE os.status = 'ACTIVE')::int     AS active_count,
        COUNT(DISTINCT os.id) FILTER (WHERE os.status = 'CANCELLED')::int  AS cancelled_count,
        COUNT(DISTINCT os.id) FILTER (WHERE os.status = 'EXPIRED')::int    AS expired_count,
        COUNT(DISTINCT os.id) FILTER (WHERE os.status = 'PAST_DUE')::int   AS past_due_count
      FROM users u
      LEFT JOIN organizations     o  ON o.owner_user_id = u.id
      LEFT JOIN org_subscriptions os ON os.org_id       = o.id
    `;

    // Orgs por plan
    const planStats = await sql`
      SELECT
        sp.id,
        sp.name,
        sp.slug,
        COUNT(os.id)::int AS user_count
      FROM subscription_plans sp
      LEFT JOIN org_subscriptions os ON os.plan_id = sp.id
      WHERE sp.is_active = TRUE
      GROUP BY sp.id, sp.name, sp.slug
      ORDER BY user_count DESC
    `;

    // Usuarios recientes
    const recentUsers = await sql`
      SELECT
        u.id,
        u.email,
        u.display_name,
        u.is_active,
        u.created_at,
        COALESCE(o.name, up.business_name) AS business_name,
        os.status AS subscription_status,
        sp.name   AS plan_name
      FROM users u
      LEFT JOIN user_profile       up ON up.user_id      = u.id
      LEFT JOIN organizations       o ON o.owner_user_id = u.id
      LEFT JOIN org_subscriptions  os ON os.org_id       = o.id
      LEFT JOIN subscription_plans sp ON sp.id           = os.plan_id
      ORDER BY u.created_at DESC
      LIMIT 5
    `;

    return Response.json({ counts, planStats, recentUsers });
  } catch (error) {
    console.error("GET /api/admin/stats:", error);
    return createErrorResponse("Error al obtener estadísticas", 500);
  }
}

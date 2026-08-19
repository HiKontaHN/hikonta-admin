// app/api/admin/users/[id]/route.ts
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyAdmin, createErrorResponse, isAuthSuccess } from "@/lib/auth";
import { adminAuth } from "@/lib/firebase-admin";

type Params = { params: Promise<{ id: string }> };

// ── GET /api/admin/users/[id] ─────────────────────────────────────────
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const { id } = await params;
    const userId = Number(id);
    if (isNaN(userId)) return createErrorResponse("ID inválido", 400);

    // Mismo fix que GET /api/admin/users — resolver la org por membresía
    // real (`organization_members`), no por `owner_user_id`, para que un
    // miembro de equipo (no dueño) también muestre su plan/suscripción.
    const [user] = await sql`
      SELECT
        u.id,
        u.firebase_uid,
        u.email,
        u.display_name,
        u.photo_url,
        u.is_active,
        u.created_at,
        up.business_name,
        up.business_logo_url,
        up.timezone,
        up.currency,
        up.locale,
        up.onboarding_completed,
        o.id                         AS org_id,
        o.name                       AS org_name,
        r.name                       AS role_name,
        r.is_owner,
        os.id                        AS subscription_id,
        os.status                    AS subscription_status,
        os.trial_start_date,
        os.trial_end_date,
        os.current_period_start,
        os.current_period_end,
        os.cancel_at_period_end,
        os.cancelled_at,
        os.provider,
        os.created_at                AS subscription_created_at,
        sp.id                        AS plan_id,
        sp.name                      AS plan_name,
        sp.slug                      AS plan_slug,
        sp.price_usd,
        sp.billing_interval,
        sp.max_products,
        sp.max_sales_per_month
      FROM users u
      LEFT JOIN user_profile up ON up.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT om.org_id, om.role_id
        FROM organization_members om
        WHERE om.user_id = u.id AND om.is_active = TRUE
        ORDER BY om.joined_at ASC
        LIMIT 1
      ) om ON TRUE
      LEFT JOIN organizations      o  ON o.id = om.org_id
      LEFT JOIN org_roles          r  ON r.id = om.role_id
      LEFT JOIN org_subscriptions  os ON os.org_id = o.id
      LEFT JOIN subscription_plans sp ON sp.id = os.plan_id
      WHERE u.id = ${userId}
      LIMIT 1
    `;

    if (!user) return createErrorResponse("Usuario no encontrado", 404);

    let firebaseMeta = { last_sign_in_time: null as string | null, last_refresh_time: null as string | null };
    try {
      const fbUser = await adminAuth.getUser(user.firebase_uid);
      firebaseMeta = {
        last_sign_in_time: fbUser.metadata.lastSignInTime ?? null,
        last_refresh_time: fbUser.metadata.lastRefreshTime ?? null,
      };
    } catch { /* usuario puede no existir en Firebase */ }

    // Actividad — usando org_id
    const orgId = user.org_id;
    const [activity] = orgId ? await sql`
      SELECT
        (SELECT COUNT(*) FROM sales        WHERE org_id = ${orgId})::int AS total_sales,
        (SELECT COUNT(*) FROM products     WHERE org_id = ${orgId} AND is_active = TRUE)::int AS total_products,
        (SELECT COUNT(*) FROM transactions WHERE org_id = ${orgId})::int AS total_transactions
    ` : [{ total_sales: 0, total_products: 0, total_transactions: 0 }];

    // Almacenamiento — usando org_id
    const [storage] = orgId ? await sql`
      SELECT
        (SELECT COUNT(*) FROM products                 WHERE org_id = ${orgId})::int AS products,
        (SELECT COUNT(*) FROM sales                    WHERE org_id = ${orgId})::int AS sales,
        (SELECT COUNT(*) FROM transactions             WHERE org_id = ${orgId})::int AS transactions,
        (SELECT COUNT(*) FROM customers                WHERE org_id = ${orgId})::int AS customers,
        (SELECT COUNT(*) FROM accounts                 WHERE org_id = ${orgId})::int AS accounts,
        (SELECT COUNT(*) FROM credit_cards             WHERE org_id = ${orgId})::int AS credit_cards,
        (SELECT COUNT(*) FROM credit_card_transactions WHERE org_id = ${orgId})::int AS cc_transactions,
        (SELECT COUNT(*) FROM inventory_batches        WHERE org_id = ${orgId})::int AS inventory_batches,
        (SELECT COUNT(*) FROM inventory_movements      WHERE org_id = ${orgId})::int AS inventory_movements,
        (SELECT COUNT(*) FROM events                   WHERE org_id = ${orgId})::int AS events,
        (
          CASE WHEN (SELECT photo_url FROM users WHERE id = ${userId}) IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN (SELECT business_logo_url FROM user_profile WHERE user_id = ${userId}) IS NOT NULL THEN 1 ELSE 0 END +
          (SELECT COUNT(*) FROM products WHERE org_id = ${orgId} AND image_url IS NOT NULL)::int
        )::int AS image_count
    ` : [{ products: 0, sales: 0, transactions: 0, customers: 0, accounts: 0, credit_cards: 0, cc_transactions: 0, inventory_batches: 0, inventory_movements: 0, events: 0, image_count: 0 }];

    return Response.json({ user: { ...user, ...firebaseMeta }, activity, storage });
  } catch (error) {
    console.error("GET /api/admin/users/[id]:", error);
    return createErrorResponse("Error al obtener usuario", 500);
  }
}

// ── PATCH /api/admin/users/[id] ───────────────────────────────────────
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const { id } = await params;
    const userId = Number(id);
    if (isNaN(userId)) return createErrorResponse("ID inválido", 400);

    const body = await request.json();
    const { is_active, plan_id, subscription_status, trial_end_date, current_period_end, new_password } = body;

    if (is_active === false && userId === auth.data.userId) {
      return createErrorResponse("No podés desactivar tu propia cuenta", 400);
    }

    // Obtener firebase_uid y org_id del usuario — por membresía real, no
    // por owner_user_id (ver nota en GET de esta misma ruta). Esto también
    // hace que editar la suscripción funcione viendo a un miembro de
    // equipo, no solo al dueño: la suscripción es de la org, no de quién
    // la fundó.
    const [userData] = await sql`
      SELECT u.firebase_uid, om.org_id
      FROM users u
      LEFT JOIN LATERAL (
        SELECT org_id FROM organization_members
        WHERE user_id = u.id AND is_active = TRUE
        ORDER BY joined_at ASC
        LIMIT 1
      ) om ON TRUE
      WHERE u.id = ${userId}
    `;
    if (!userData) return createErrorResponse("Usuario no encontrado", 404);

    // Actualizar estado activo — sincroniza con Firebase
    if (is_active !== undefined) {
      await sql`UPDATE users SET is_active = ${is_active}, updated_at = NOW() WHERE id = ${userId}`;
      try {
        await adminAuth.updateUser(userData.firebase_uid, { disabled: !is_active });
      } catch (fbErr) {
        console.error("Error sincronizando estado en Firebase:", fbErr);
      }
    }

    // Restablecer contraseña
    if (new_password) {
      if (new_password.length < 6) return createErrorResponse("La contraseña debe tener al menos 6 caracteres", 400);
      try {
        await adminAuth.updateUser(userData.firebase_uid, { password: new_password });
      } catch (fbErr: any) {
        return createErrorResponse(fbErr.message ?? "Error al cambiar contraseña", 500);
      }
    }

    // Actualizar suscripción de la org
    const hasSubUpdate = plan_id !== undefined || subscription_status !== undefined ||
                         trial_end_date !== undefined || current_period_end !== undefined;

    if (hasSubUpdate && userData.org_id) {
      const [currentSub] = await sql`SELECT id FROM org_subscriptions WHERE org_id = ${userData.org_id}`;

      if (currentSub) {
        await sql`
          UPDATE org_subscriptions
          SET
            plan_id            = COALESCE(${plan_id             ?? null}::bigint,    plan_id),
            status             = COALESCE(${subscription_status ?? null}::text,      status),
            trial_end_date     = COALESCE(${trial_end_date      ?? null}::timestamp, trial_end_date),
            current_period_end = COALESCE(${current_period_end  ?? null}::timestamp, current_period_end),
            updated_at         = NOW()
          WHERE id = ${currentSub.id}
        `;
      } else if (plan_id) {
        await sql`
          INSERT INTO org_subscriptions (org_id, plan_id, status, provider, created_at, updated_at)
          VALUES (${userData.org_id}, ${plan_id}, ${subscription_status ?? 'TRIAL'}, 'MANUAL', NOW(), NOW())
        `;
      }
    }

    return Response.json({ message: "Usuario actualizado exitosamente" });
  } catch (error) {
    console.error("PATCH /api/admin/users/[id]:", error);
    return createErrorResponse("Error al actualizar usuario", 500);
  }
}

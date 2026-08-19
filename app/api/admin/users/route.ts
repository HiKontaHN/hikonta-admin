// app/api/admin/users/route.ts
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyAdmin, createErrorResponse, isAuthSuccess, ensureOrgExists } from "@/lib/auth";
import { adminAuth } from "@/lib/firebase-admin";

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

    // El join anterior resolvía la org SOLO por `organizations.owner_user_id
    // = u.id` — cualquier usuario agregado por un dueño como miembro de
    // equipo (cajero, bodeguero, etc. — ver /settings/members en
    // yelifin-sistema) nunca es dueño de ninguna organización, así que
    // Plan/Estado le salían siempre en blanco. La membresía real vive en
    // `organization_members`, no en `owner_user_id` (eso solo identifica
    // quién fundó la org). Se resuelve con un LATERAL: la membresía activa
    // más antigua del usuario — mismo criterio que usa `verifyAuth()` en
    // yelifin-sistema (`ORDER BY joined_at ASC LIMIT 1`) para decidir "a
    // qué org pertenece este usuario" cuando podría tener más de una.
    const users = await sql`
      SELECT
        u.id,
        u.firebase_uid,
        u.email,
        u.display_name,
        u.is_active,
        u.created_at,
        up.business_name,
        up.business_logo_url,
        o.currency,
        r.name                  AS role_name,
        r.is_owner,
        os.id                   AS subscription_id,
        os.status               AS subscription_status,
        os.trial_end_date,
        os.current_period_end,
        os.created_at           AS subscription_created_at,
        sp.id                   AS plan_id,
        sp.name                 AS plan_name,
        sp.slug                 AS plan_slug,
        sp.price_usd
      FROM users u
      LEFT JOIN user_profile up ON up.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT om.org_id, om.role_id
        FROM organization_members om
        WHERE om.user_id = u.id AND om.is_active = TRUE
        ORDER BY om.joined_at ASC
        LIMIT 1
      ) om ON TRUE
      LEFT JOIN organizations      o  ON o.id  = om.org_id
      LEFT JOIN org_roles          r  ON r.id  = om.role_id
      LEFT JOIN org_subscriptions  os ON os.org_id = o.id
      LEFT JOIN subscription_plans sp ON sp.id = os.plan_id
      WHERE (
        ${search} = ''
        OR u.email           ILIKE ${'%' + search + '%'}
        OR u.display_name    ILIKE ${'%' + search + '%'}
        OR up.business_name  ILIKE ${'%' + search + '%'}
      )
      AND (${status} = 'all' OR os.status = ${status})
      ORDER BY u.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [{ total }] = await sql`
      SELECT COUNT(DISTINCT u.id)::int AS total
      FROM users u
      LEFT JOIN user_profile up ON up.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT om.org_id
        FROM organization_members om
        WHERE om.user_id = u.id AND om.is_active = TRUE
        ORDER BY om.joined_at ASC
        LIMIT 1
      ) om ON TRUE
      LEFT JOIN organizations     o  ON o.id = om.org_id
      LEFT JOIN org_subscriptions os ON os.org_id = o.id
      WHERE (
        ${search} = ''
        OR u.email          ILIKE ${'%' + search + '%'}
        OR u.display_name   ILIKE ${'%' + search + '%'}
        OR up.business_name ILIKE ${'%' + search + '%'}
      )
      AND (${status} = 'all' OR os.status = ${status})
    `;

    const fbResults = await Promise.allSettled(
      users.map((u: any) => adminAuth.getUser(u.firebase_uid))
    );

    const enriched = users.map((u: any, i: number) => {
      const fb = fbResults[i].status === "fulfilled" ? (fbResults[i] as PromiseFulfilledResult<any>).value : null;
      return {
        ...u,
        last_sign_in_time: fb?.metadata?.lastSignInTime ?? null,
        last_refresh_time: fb?.metadata?.lastRefreshTime ?? null,
      };
    });

    return Response.json({ data: enriched, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("GET /api/admin/users:", error);
    return createErrorResponse("Error al obtener usuarios", 500);
  }
}

// ── POST /api/admin/users — crear usuario completo ─────────────────────
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const {
      email,
      password,
      display_name,
      business_name,
      timezone   = "America/Tegucigalpa",
      currency   = "HNL",
      locale     = "es-HN",
      plan_id,
      email_verified = true,
    } = await request.json();

    if (!email?.trim())    return createErrorResponse("El email es requerido", 400);
    if (!password?.trim()) return createErrorResponse("La contraseña es requerida", 400);
    if (password.length < 6) return createErrorResponse("La contraseña debe tener al menos 6 caracteres", 400);

    // 1. Crear usuario en Firebase
    let fbUser;
    try {
      fbUser = await adminAuth.createUser({
        email:         email.trim().toLowerCase(),
        password,
        displayName:   display_name?.trim() || undefined,
        emailVerified: email_verified,
        disabled:      false,
      });
    } catch (fbErr: any) {
      const msg = fbErr.code === "auth/email-already-exists"
        ? "Ya existe un usuario con ese email"
        : fbErr.message ?? "Error al crear usuario en Firebase";
      return createErrorResponse(msg, 409);
    }

    // 2. Crear usuario en PostgreSQL
    const [user] = await sql`
      INSERT INTO users (firebase_uid, email, display_name, is_active)
      VALUES (
        ${fbUser.uid},
        ${email.trim().toLowerCase()},
        ${display_name?.trim() || null},
        TRUE
      )
      RETURNING id
    `;

    // 3. Crear perfil (onboarding ya completado — creado por admin)
    await sql`
      INSERT INTO user_profile (user_id, business_name, timezone, currency, locale, onboarding_completed)
      VALUES (
        ${user.id},
        ${business_name?.trim() || null},
        ${timezone},
        ${currency},
        ${locale},
        TRUE
      )
    `;

    // 4. Crear org + rol + membresía + suscripción (trial por defecto)
    const orgName = business_name?.trim() || display_name?.trim() || email.trim();
    const { orgId } = await ensureOrgExists(user.id, orgName, timezone, currency, locale);

    // 5. Si se especificó un plan, actualizar la suscripción de la org
    if (plan_id) {
      await sql`
        UPDATE org_subscriptions
        SET plan_id = ${plan_id}, status = 'ACTIVE', updated_at = NOW()
        WHERE org_id = ${orgId}
      `;
    }

    // 6. Devolver el usuario creado
    const [created] = await sql`
      SELECT
        u.id, u.firebase_uid, u.email, u.display_name, u.is_active, u.created_at,
        up.business_name, up.timezone, up.currency, up.locale,
        os.status AS subscription_status,
        sp.name   AS plan_name, sp.slug AS plan_slug
      FROM users u
      LEFT JOIN user_profile      up ON up.user_id = u.id
      LEFT JOIN organizations      o ON o.owner_user_id = u.id
      LEFT JOIN org_subscriptions os ON os.org_id = o.id
      LEFT JOIN subscription_plans sp ON sp.id = os.plan_id
      WHERE u.id = ${user.id}
    `;

    return Response.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/users:", error);
    return createErrorResponse("Error al crear usuario", 500);
  }
}

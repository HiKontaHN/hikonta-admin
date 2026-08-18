// lib/auth.ts
import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { sql } from "@/lib/db";

// ── Tipos ─────────────────────────────────────────────────────────────

export type AdminUser = {
  userId: number;
  adminId: number;
  firebaseUid: string;
  email: string;
  displayName: string | null;
};

type AuthResult =
  | { error: string; status: number; data: null }
  | { error: null; status: 200; data: AdminUser };

// ── BYPASS TEMPORAL (solo para ver el panel sin login) ─────────────────
// Mismo patrón que hikonta-partners. Activado con NEXT_PUBLIC_BYPASS_AUTH=true
// en .env.local. ⚠️ Con esto activo, TODAS las rutas /api/admin/* devuelven
// datos de un admin falso sin validar ningún token — no debe llegar a
// producción así. El adminId usado es configurable con
// NEXT_PUBLIC_BYPASS_ADMIN_ID (por defecto 1) — debe existir esa fila en
// `admins` para ver datos reales.
const BYPASS_AUTH = process.env.NEXT_PUBLIC_BYPASS_AUTH === "true";
const BYPASS_ADMIN_ID = Number(process.env.NEXT_PUBLIC_BYPASS_ADMIN_ID ?? "1");

const BYPASS_USER: AdminUser = {
  userId: 0,
  adminId: BYPASS_ADMIN_ID,
  firebaseUid: "bypass",
  email: "dev@hikonta.local",
  displayName: "Modo sin autenticación",
};

// ── verifyAdmin ─────────────────────────────────────────────────────────
// Análogo a verifyPartner() en hikonta-partners: valida el Firebase JWT y
// resuelve la identidad contra `admins.user_id` — tabla dedicada, NO el
// plan-hack `subscription.planSlug === 'admin'` que sigue usando
// yelifin-sistema (ver database/docs/admin-panel-architecture.md en el repo
// principal para el porqué del cambio).

export async function verifyAdmin(request: NextRequest): Promise<AuthResult> {
  if (BYPASS_AUTH) {
    return { error: null, status: 200, data: BYPASS_USER };
  }

  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "No autorizado", status: 401, data: null };
  }

  const token = authHeader.substring(7);

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch {
    return { error: "Token inválido o expirado", status: 401, data: null };
  }

  try {
    const [row] = await sql`
      SELECT
        u.id          AS user_id,
        u.firebase_uid,
        u.email,
        u.display_name,
        a.id          AS admin_id,
        a.is_active   AS admin_is_active
      FROM users u
      JOIN admins a ON a.user_id = u.id
      WHERE u.firebase_uid = ${decodedToken.uid}
      LIMIT 1
    `;

    if (!row) {
      return { error: "Esta cuenta no tiene acceso al panel de administración", status: 403, data: null };
    }

    if (!row.admin_is_active) {
      return { error: "Tu cuenta de administrador está desactivada", status: 403, data: null };
    }

    return {
      error: null,
      status: 200,
      data: {
        userId: row.user_id,
        adminId: row.admin_id,
        firebaseUid: row.firebase_uid,
        email: row.email,
        displayName: row.display_name,
      },
    };
  } catch (error) {
    console.error("Error en verifyAdmin:", error);
    return { error: "Error interno del servidor", status: 500, data: null };
  }
}

// ── ensureOrgExists ──────────────────────────────────────────────────────
// Idéntico a ensureOrgExists() en yelifin-sistema/lib/auth.ts. Se usa desde
// POST /api/admin/users: un admin puede seguir dando de alta un negocio
// completo (org + rol dueño + membresía + suscripción trial) para un
// usuario nuevo, igual que hace hoy el flujo de onboarding del producto.

export async function ensureOrgExists(
  userId: number,
  orgName: string,
  timezone = "America/Tegucigalpa",
  currency = "HNL",
  locale = "es-HN"
): Promise<{ orgId: number; roleId: number; roleName: string }> {
  const [existing] = await sql`
    SELECT om.org_id, r.id AS role_id, r.name AS role_name
    FROM organization_members om
    JOIN organizations o ON o.id = om.org_id AND o.is_active = TRUE
    JOIN org_roles     r ON r.id = om.role_id
    WHERE om.user_id = ${userId} AND om.is_active = TRUE
    ORDER BY om.joined_at ASC
    LIMIT 1
  `;

  if (existing) {
    return { orgId: existing.org_id, roleId: existing.role_id, roleName: existing.role_name };
  }

  const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + userId;

  const [org] = await sql`
    INSERT INTO organizations (name, slug, timezone, currency, locale, owner_user_id)
    VALUES (${orgName}, ${slug}, ${timezone}, ${currency}, ${locale}, ${userId})
    RETURNING id
  `;

  const [ownerRole] = await sql`
    INSERT INTO org_roles (org_id, name, is_owner)
    VALUES (${org.id}, 'Dueño', TRUE)
    RETURNING id, name
  `;

  await sql`
    INSERT INTO org_role_permissions (role_id, module, can_view, can_edit, can_delete, show_costs, show_profit)
    SELECT ${ownerRole.id}, m.module, TRUE, TRUE, TRUE, TRUE, TRUE
    FROM (VALUES
      ('DASHBOARD'), ('PRODUCTS'), ('INVENTORY'), ('SALES'), ('CUSTOMERS'),
      ('FINANCES'), ('EVENTS'), ('REPORTS'), ('ADMIN')
    ) AS m(module)
  `;

  await sql`
    INSERT INTO organization_members (org_id, user_id, role_id, joined_at)
    VALUES (${org.id}, ${userId}, ${ownerRole.id}, NOW())
  `;

  const [plan] = await sql`
    SELECT id FROM subscription_plans WHERE slug = 'trial' LIMIT 1
  `;

  if (plan) {
    await sql`
      INSERT INTO org_subscriptions (org_id, plan_id, status, trial_start_date, trial_end_date)
      VALUES (${org.id}, ${plan.id}, 'TRIAL', NOW(), NOW() + INTERVAL '30 days')
      ON CONFLICT (org_id) DO NOTHING
    `;
  }

  return { orgId: org.id, roleId: ownerRole.id, roleName: ownerRole.name };
}

// ── createErrorResponse ────────────────────────────────────────────────

export function createErrorResponse(error: string, status: number) {
  return Response.json({ error }, { status });
}

// ── isAuthSuccess ──────────────────────────────────────────────────────

export function isAuthSuccess(
  result: Awaited<ReturnType<typeof verifyAdmin>>
): result is { error: null; status: 200; data: AdminUser } {
  return result.error === null;
}

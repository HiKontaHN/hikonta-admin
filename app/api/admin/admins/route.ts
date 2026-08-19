// app/api/admin/admins/route.ts
// Gestión de la propia tabla `admins` — quién tiene acceso a este panel.
// Antes era INSERT/UPDATE manual en Neon (ver database/admin/01-admin-infrastructure.sql
// en yelifin-sistema); esto le da una UI. No existía en yelifin-sistema porque
// ese repo nunca tuvo esta tabla — es exclusivo de hikonta-admin.
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyAdmin, createErrorResponse, isAuthSuccess } from "@/lib/auth";

// ── GET /api/admin/admins — listar administradores ──────────────────────
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const admins = await sql`
      SELECT
        a.id,
        a.is_active,
        a.created_at,
        u.id            AS user_id,
        u.email,
        u.display_name
      FROM admins a
      JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at ASC
    `;

    return Response.json({ data: admins });
  } catch (error) {
    console.error("GET /api/admin/admins:", error);
    return createErrorResponse("Error al obtener administradores", 500);
  }
}

// ── POST /api/admin/admins — vincular un usuario existente como admin ───
// No crea el usuario (a diferencia de /api/admin/users) — tiene que existir
// ya en `users`. Es intencional: agregar un admin nunca da de alta una
// cuenta nueva, solo eleva privilegios de una que ya se registró normal.
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const { email } = await request.json();
    if (!email?.trim()) return createErrorResponse("El email es requerido", 400);

    const [user] = await sql`
      SELECT id, email, display_name FROM users WHERE email = ${email.trim().toLowerCase()} LIMIT 1
    `;
    if (!user) {
      return createErrorResponse("No existe ningún usuario de HiKonta con ese email", 404);
    }

    const [existing] = await sql`SELECT id FROM admins WHERE user_id = ${user.id}`;
    if (existing) {
      return createErrorResponse("Ese usuario ya es administrador", 409);
    }

    const [admin] = await sql`
      INSERT INTO admins (user_id, is_active)
      VALUES (${user.id}, TRUE)
      RETURNING id, is_active, created_at
    `;

    return Response.json(
      { data: { ...admin, user_id: user.id, email: user.email, display_name: user.display_name } },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/admin/admins:", error);
    return createErrorResponse("Error al agregar administrador", 500);
  }
}

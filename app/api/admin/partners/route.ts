// app/api/admin/partners/route.ts
// CRUD de la tabla `partners` (incubadoras/aceleradoras) — ver
// database/docs/partner-dashboard-architecture.md en yelifin-sistema. El
// panel hikonta-partners es de solo lectura para el coordinador; acá es
// donde se los da de alta y se vinculan sus organizaciones.
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyAdmin, createErrorResponse, isAuthSuccess } from "@/lib/auth";

// ── GET /api/admin/partners — listar ─────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const partners = await sql`
      SELECT
        p.id, p.name, p.contact_name, p.email, p.phone, p.is_active, p.created_at,
        u.email AS user_email,
        COUNT(po.id)::int AS org_count
      FROM partners p
      LEFT JOIN users u                  ON u.id = p.user_id
      LEFT JOIN partner_organizations po ON po.partner_id = p.id
      GROUP BY p.id, u.email
      ORDER BY p.created_at DESC
    `;
    return Response.json({ data: partners });
  } catch (error) {
    console.error("GET /api/admin/partners:", error);
    return createErrorResponse("Error al obtener partners", 500);
  }
}

// ── POST /api/admin/partners — crear ──────────────────────────────────────
// `user_email` es opcional: el coordinador puede vincularse después (el
// login del partner es un usuario Firebase normal, igual que un admin —
// ver database/admin/01-admin-infrastructure.sql para el mismo patrón).
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const { name, contact_name, email, phone, user_email } = await request.json();

    if (!name?.trim())  return createErrorResponse("El nombre es requerido", 400);
    if (!email?.trim()) return createErrorResponse("El email de contacto es requerido", 400);

    const [existing] = await sql`SELECT id FROM partners WHERE email = ${email.trim().toLowerCase()}`;
    if (existing) return createErrorResponse("Ya existe un partner con ese email", 409);

    let userId: number | null = null;
    if (user_email?.trim()) {
      const [user] = await sql`SELECT id FROM users WHERE email = ${user_email.trim().toLowerCase()}`;
      if (!user) return createErrorResponse("No existe ningún usuario de HiKonta con ese email de login", 404);
      userId = user.id;
    }

    const [partner] = await sql`
      INSERT INTO partners (name, contact_name, email, phone, user_id)
      VALUES (${name.trim()}, ${contact_name?.trim() || null}, ${email.trim().toLowerCase()}, ${phone?.trim() || null}, ${userId})
      RETURNING id, name, contact_name, email, phone, is_active, created_at
    `;

    return Response.json({ data: { ...partner, user_email: user_email || null, org_count: 0 } }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/partners:", error);
    return createErrorResponse("Error al crear partner", 500);
  }
}

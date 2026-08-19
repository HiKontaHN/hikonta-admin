// app/api/admin/partners/[id]/route.ts
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyAdmin, createErrorResponse, isAuthSuccess } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// ── GET /api/admin/partners/[id] — detalle + orgs vinculadas ────────────
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id) return createErrorResponse("ID inválido", 400);

  try {
    const [partner] = await sql`
      SELECT p.id, p.name, p.contact_name, p.email, p.phone, p.is_active, p.created_at, p.updated_at,
             p.user_id, u.email AS user_email
      FROM partners p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE p.id = ${id}
    `;
    if (!partner) return createErrorResponse("Partner no encontrado", 404);

    const organizations = await sql`
      SELECT
        po.id AS link_id, po.org_id, po.share_financials, po.linked_at,
        o.name AS org_name, o.currency,
        ou.email AS owner_email
      FROM partner_organizations po
      JOIN organizations o ON o.id = po.org_id
      JOIN users ou         ON ou.id = o.owner_user_id
      WHERE po.partner_id = ${id}
      ORDER BY po.linked_at DESC
    `;

    return Response.json({ data: partner, organizations });
  } catch (error) {
    console.error("GET /api/admin/partners/[id]:", error);
    return createErrorResponse("Error al obtener partner", 500);
  }
}

// ── PATCH /api/admin/partners/[id] — editar / activar-desactivar ────────
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id) return createErrorResponse("ID inválido", 400);

  try {
    const body = await request.json();
    const { name, contact_name, email, phone, is_active, user_email } = body;

    let userIdUpdate: number | null | undefined = undefined; // undefined = no tocar
    if (user_email !== undefined) {
      if (!user_email) {
        userIdUpdate = null; // desvincular login
      } else {
        const [user] = await sql`SELECT id FROM users WHERE email = ${String(user_email).trim().toLowerCase()}`;
        if (!user) return createErrorResponse("No existe ningún usuario de HiKonta con ese email de login", 404);
        userIdUpdate = user.id;
      }
    }

    const [partner] = await sql`
      UPDATE partners SET
        name         = COALESCE(${name?.trim() ?? null}, name),
        contact_name = ${contact_name !== undefined ? (contact_name?.trim() || null) : sql`contact_name`},
        email        = COALESCE(${email?.trim()?.toLowerCase() ?? null}, email),
        phone        = ${phone !== undefined ? (phone?.trim() || null) : sql`phone`},
        is_active    = COALESCE(${is_active ?? null}, is_active),
        user_id      = ${userIdUpdate !== undefined ? userIdUpdate : sql`user_id`},
        updated_at   = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING id
    `;
    if (!partner) return createErrorResponse("Partner no encontrado", 404);

    return Response.json({ message: "Partner actualizado" });
  } catch (error) {
    console.error("PATCH /api/admin/partners/[id]:", error);
    return createErrorResponse("Error al actualizar partner", 500);
  }
}

// ── DELETE /api/admin/partners/[id] — solo si no tiene orgs vinculadas ──
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id) return createErrorResponse("ID inválido", 400);

  try {
    const [{ org_count }] = await sql`
      SELECT COUNT(*)::int AS org_count FROM partner_organizations WHERE partner_id = ${id}
    `;
    if (org_count > 0) {
      return createErrorResponse(
        `No se puede eliminar: tiene ${org_count} organización${org_count !== 1 ? "es" : ""} vinculada${org_count !== 1 ? "s" : ""}. Desvinculalas primero.`,
        409
      );
    }

    await sql`DELETE FROM partners WHERE id = ${id}`;
    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/partners/[id]:", error);
    return createErrorResponse("Error al eliminar partner", 500);
  }
}

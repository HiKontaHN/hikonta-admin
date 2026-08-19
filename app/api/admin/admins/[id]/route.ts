// app/api/admin/admins/[id]/route.ts
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyAdmin, createErrorResponse, isAuthSuccess } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// ── PATCH /api/admin/admins/[id] — activar/desactivar ───────────────────
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id) return createErrorResponse("ID inválido", 400);

  try {
    const { is_active } = await request.json();
    if (typeof is_active !== "boolean") return createErrorResponse("is_active es requerido", 400);

    if (!is_active && id === auth.data.adminId) {
      return createErrorResponse("No podés desactivar tu propia cuenta de administrador", 400);
    }

    if (!is_active) {
      const [{ active_count }] = await sql`SELECT COUNT(*)::int AS active_count FROM admins WHERE is_active = TRUE`;
      const [target] = await sql`SELECT is_active FROM admins WHERE id = ${id}`;
      if (!target) return createErrorResponse("Administrador no encontrado", 404);
      if (target.is_active && active_count <= 1) {
        return createErrorResponse("No podés desactivar al único administrador activo", 400);
      }
    }

    const [admin] = await sql`
      UPDATE admins SET is_active = ${is_active}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING id, is_active
    `;
    if (!admin) return createErrorResponse("Administrador no encontrado", 404);

    return Response.json({ data: admin });
  } catch (error) {
    console.error("PATCH /api/admin/admins/[id]:", error);
    return createErrorResponse("Error al actualizar administrador", 500);
  }
}

// ── DELETE /api/admin/admins/[id] — quitar acceso por completo ──────────
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id) return createErrorResponse("ID inválido", 400);

  if (id === auth.data.adminId) {
    return createErrorResponse("No podés quitarte a vos mismo como administrador", 400);
  }

  try {
    const [target] = await sql`SELECT is_active FROM admins WHERE id = ${id}`;
    if (!target) return createErrorResponse("Administrador no encontrado", 404);

    if (target.is_active) {
      const [{ active_count }] = await sql`SELECT COUNT(*)::int AS active_count FROM admins WHERE is_active = TRUE`;
      if (active_count <= 1) {
        return createErrorResponse("No podés eliminar al único administrador activo", 400);
      }
    }

    await sql`DELETE FROM admins WHERE id = ${id}`;
    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/admins/[id]:", error);
    return createErrorResponse("Error al eliminar administrador", 500);
  }
}

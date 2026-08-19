// app/api/admin/partners/[id]/organizations/[orgId]/route.ts
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyAdmin, createErrorResponse, isAuthSuccess } from "@/lib/auth";

type Params = { params: Promise<{ id: string; orgId: string }> };

// ── PATCH — cambiar share_financials del vínculo ─────────────────────────
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  const { id: rawId, orgId: rawOrgId } = await params;
  const partnerId = Number(rawId);
  const orgId = Number(rawOrgId);
  if (!partnerId || !orgId) return createErrorResponse("ID inválido", 400);

  try {
    const { share_financials } = await request.json();
    if (typeof share_financials !== "boolean") {
      return createErrorResponse("share_financials es requerido", 400);
    }

    const [link] = await sql`
      UPDATE partner_organizations SET share_financials = ${share_financials}
      WHERE partner_id = ${partnerId} AND org_id = ${orgId}
      RETURNING id
    `;
    if (!link) return createErrorResponse("Vínculo no encontrado", 404);

    return Response.json({ message: "Vínculo actualizado" });
  } catch (error) {
    console.error("PATCH /api/admin/partners/[id]/organizations/[orgId]:", error);
    return createErrorResponse("Error al actualizar el vínculo", 500);
  }
}

// ── DELETE — desvincular ─────────────────────────────────────────────────
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  const { id: rawId, orgId: rawOrgId } = await params;
  const partnerId = Number(rawId);
  const orgId = Number(rawOrgId);
  if (!partnerId || !orgId) return createErrorResponse("ID inválido", 400);

  try {
    await sql`DELETE FROM partner_organizations WHERE partner_id = ${partnerId} AND org_id = ${orgId}`;
    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/partners/[id]/organizations/[orgId]:", error);
    return createErrorResponse("Error al desvincular organización", 500);
  }
}

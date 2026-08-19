// app/api/admin/organizations/[id]/partners/route.ts
// Partners vinculados a una org — usado por el selector "Patrocinado por"
// del diálogo de registrar pago. Solo se puede atribuir un pago a un
// partner que ya está vinculado (ver validación en POST /api/admin/payments).
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyAdmin, createErrorResponse, isAuthSuccess } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  const { id: rawId } = await params;
  const orgId = Number(rawId);
  if (!orgId) return createErrorResponse("ID inválido", 400);

  try {
    const partners = await sql`
      SELECT p.id, p.name
      FROM partner_organizations po
      JOIN partners p ON p.id = po.partner_id
      WHERE po.org_id = ${orgId} AND p.is_active = TRUE
      ORDER BY p.name ASC
    `;
    return Response.json({ data: partners });
  } catch (error) {
    console.error("GET /api/admin/organizations/[id]/partners:", error);
    return createErrorResponse("Error al obtener partners vinculados", 500);
  }
}

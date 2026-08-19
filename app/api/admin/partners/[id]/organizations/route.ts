// app/api/admin/partners/[id]/organizations/route.ts
// Vincular una organización a un partner. `share_financials` — ver
// database/docs/partner-dashboard-architecture.md en yelifin-sistema,
// sección "Importante — nada de ingresos/costos sin permiso explícito":
// falso por defecto, es un opt-in consciente, no algo que el admin
// active a la ligera.
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyAdmin, createErrorResponse, isAuthSuccess } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  const { id: rawId } = await params;
  const partnerId = Number(rawId);
  if (!partnerId) return createErrorResponse("ID inválido", 400);

  try {
    const { org_id, share_financials } = await request.json();
    const orgId = Number(org_id);
    if (!orgId) return createErrorResponse("Seleccioná una organización", 400);

    const [partner] = await sql`SELECT id FROM partners WHERE id = ${partnerId}`;
    if (!partner) return createErrorResponse("Partner no encontrado", 404);

    const [org] = await sql`SELECT id FROM organizations WHERE id = ${orgId}`;
    if (!org) return createErrorResponse("Organización no encontrada", 404);

    const [existing] = await sql`
      SELECT id FROM partner_organizations WHERE partner_id = ${partnerId} AND org_id = ${orgId}
    `;
    if (existing) return createErrorResponse("Esa organización ya está vinculada a este partner", 409);

    const [link] = await sql`
      INSERT INTO partner_organizations (partner_id, org_id, share_financials)
      VALUES (${partnerId}, ${orgId}, ${share_financials === true})
      RETURNING id, org_id, share_financials, linked_at
    `;

    return Response.json({ data: link }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/partners/[id]/organizations:", error);
    return createErrorResponse("Error al vincular organización", 500);
  }
}

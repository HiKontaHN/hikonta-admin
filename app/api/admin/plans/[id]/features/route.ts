// app/api/admin/plans/[id]/features/route.ts
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyAdmin, createErrorResponse, isAuthSuccess } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// GET — matriz completa: todas las features del sistema con su estado en este plan
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  const { id: rawId } = await params;
  const planId = Number(rawId);
  if (!planId) return createErrorResponse("ID inválido", 400);

  try {
    const [plan] = await sql`
      SELECT id, name, slug FROM subscription_plans WHERE id = ${planId}
    `;
    if (!plan) return createErrorResponse("Plan no encontrado", 404);

    const features = await sql`
      SELECT
        sf.id,
        sf.feature_key,
        sf.feature_name,
        sf.category,
        COALESCE(pf.is_enabled, FALSE) AS is_enabled
      FROM system_features sf
      LEFT JOIN plan_features pf ON pf.feature_id = sf.id AND pf.plan_id = ${planId}
      WHERE sf.is_active = TRUE
      ORDER BY sf.category, sf.feature_name
    `;

    return Response.json({ plan, data: features });
  } catch (error) {
    console.error("GET /api/admin/plans/[id]/features:", error);
    return createErrorResponse("Error al obtener las opciones del plan", 500);
  }
}

// PUT — guardar toggles
// Body: { features: { [feature_id: string]: boolean } }
export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  const { id: rawId } = await params;
  const planId = Number(rawId);
  if (!planId) return createErrorResponse("ID inválido", 400);

  try {
    const body = await request.json();
    const features = body?.features as Record<string, boolean> | undefined;

    if (!features || typeof features !== "object" || Array.isArray(features)) {
      return createErrorResponse("Formato inválido: se espera { features: { id: boolean } }", 400);
    }

    const entries = Object.entries(features)
      .map(([id, enabled]) => ({ featureId: Number(id), enabled: enabled === true }))
      .filter((e) => Number.isInteger(e.featureId) && e.featureId > 0);

    if (entries.length === 0) {
      return createErrorResponse("No hay opciones para actualizar", 400);
    }

    const [plan] = await sql`
      SELECT id FROM subscription_plans WHERE id = ${planId}
    `;
    if (!plan) return createErrorResponse("Plan no encontrado", 404);

    // Upsert por feature (idempotente; el driver HTTP de Neon no soporta
    // transacciones interactivas, pero reintentar es seguro)
    await Promise.all(
      entries.map(
        ({ featureId, enabled }) => sql`
          INSERT INTO plan_features (plan_id, feature_id, is_enabled)
          VALUES (${planId}, ${featureId}, ${enabled})
          ON CONFLICT (plan_id, feature_id) DO UPDATE SET is_enabled = EXCLUDED.is_enabled
        `
      )
    );

    return Response.json({ message: "Opciones del plan actualizadas" });
  } catch (error) {
    console.error("PUT /api/admin/plans/[id]/features:", error);
    return createErrorResponse("Error al actualizar las opciones del plan", 500);
  }
}

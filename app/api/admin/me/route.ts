import { NextRequest } from "next/server";
import { verifyAdmin, createErrorResponse, isAuthSuccess } from "@/lib/auth";

// GET /api/admin/me — identidad del administrador autenticado. 403 si el
// Firebase UID no está vinculado a una fila en `admins`, o si esa fila
// tiene is_active = FALSE.
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  return Response.json({
    data: {
      adminId: auth.data.adminId,
      email: auth.data.email,
      displayName: auth.data.displayName,
    },
  });
}

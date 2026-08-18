// app/api/admin/storage/route.ts
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyAdmin, createErrorResponse, isAuthSuccess } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const [dbSize] = await sql`
      SELECT pg_database_size(current_database()) AS size_bytes
    `;

    const tableSizes = await sql`
      SELECT
        tablename,
        pg_total_relation_size('public.' || tablename) AS size_bytes
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY size_bytes DESC
      LIMIT 15
    `;

    // Top orgs por volumen de datos (usando org_id en las tablas de datos)
    const topUsers = await sql`
      SELECT
        u.id,
        u.email,
        COALESCE(o.name, up.business_name, u.display_name, u.email) AS display_name,
        (
          (SELECT COUNT(*) FROM products                WHERE org_id = o.id)::int +
          (SELECT COUNT(*) FROM sales                   WHERE org_id = o.id)::int +
          (SELECT COUNT(*) FROM transactions            WHERE org_id = o.id)::int +
          (SELECT COUNT(*) FROM customers               WHERE org_id = o.id)::int +
          (SELECT COUNT(*) FROM credit_card_transactions WHERE org_id = o.id)::int +
          (SELECT COUNT(*) FROM inventory_movements     WHERE org_id = o.id)::int +
          (SELECT COUNT(*) FROM events                  WHERE org_id = o.id)::int
        ) AS total_rows
      FROM users u
      LEFT JOIN user_profile  up ON up.user_id      = u.id
      LEFT JOIN organizations  o ON o.owner_user_id = u.id
      WHERE o.id IS NOT NULL
      ORDER BY total_rows DESC
      LIMIT 10
    `;

    const imageCount = await sql`
      SELECT
        (SELECT COUNT(*) FROM users        WHERE photo_url         IS NOT NULL)::int AS user_photos,
        (SELECT COUNT(*) FROM organizations WHERE logo_url         IS NOT NULL)::int AS logos,
        (SELECT COUNT(*) FROM products     WHERE image_url         IS NOT NULL)::int AS product_images
    `;

    return Response.json({
      db_size_bytes: Number(dbSize.size_bytes),
      table_sizes: tableSizes.map((r) => ({
        tablename: r.tablename,
        size_bytes: Number(r.size_bytes),
      })),
      top_users: topUsers.map((r) => ({
        id: Number(r.id),
        email: r.email,
        display_name: r.display_name,
        total_rows: Number(r.total_rows),
      })),
      image_counts: {
        user_photos: Number(imageCount[0].user_photos),
        logos: Number(imageCount[0].logos),
        product_images: Number(imageCount[0].product_images),
      },
    });
  } catch (error) {
    console.error("GET /api/admin/storage:", error);
    return createErrorResponse("Error al obtener datos de almacenamiento", 500);
  }
}

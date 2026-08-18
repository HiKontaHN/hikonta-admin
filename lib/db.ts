import { neon } from "@neondatabase/serverless";

// Cliente único de Neon, compartido por todas las rutas API. Apunta a la
// MISMA base de datos que yelifin-sistema y hikonta-partners — este proyecto
// lee/escribe directo sobre users, organizations, subscription_plans,
// org_subscriptions, plan_features y la tabla nueva `admins`. Ver
// database/docs/admin-panel-architecture.md en el repo principal.
export const sql = neon(process.env.DATABASE_URL!);

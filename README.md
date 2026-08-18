# HiKonta Admin

Panel de administración de plataforma para HiKonta: gestión de usuarios, planes de suscripción y
límites/features por plan, más un resumen de uso de la base de datos. Proyecto **separado** del
app principal (`yelifin-sistema`) y de `hikonta-partners`, pensado para desplegarse en
`admin.hikonta.com`.

Diseño completo de la migración: `database/docs/admin-panel-architecture.md` en el repo principal
(`yelifin-sistema`). Migración SQL de esta feature: `database/admin/` en ese mismo repo — **hay
que ejecutarla ahí antes de usar este proyecto**:

1. `database/admin/01-admin-infrastructure.sql`

## Por qué es un repo aparte

- Subdominio propio (`admin.hikonta.com`) con su propio despliegue en Vercel.
- Es el panel de mayor privilegio de toda la plataforma (crea/desactiva cualquier usuario,
  resetea contraseñas, edita cualquier suscripción, ve tamaño de la base de datos) — sacarlo del
  bundle del producto principal reduce lo que un usuario normal puede ver en el JS que se le sirve.
- Conexión **directa** a la misma base de datos de Neon (mismo `DATABASE_URL`) — sin pasar por la
  API del app principal.
- Mismo proyecto de Firebase — un administrador inicia sesión igual que cualquier usuario de
  HiKonta; su fila en `users` se vincula a `admins` vía `admins.user_id` (mismo patrón que
  `partners.user_id` en `hikonta-partners`).
- **Sin registro público.** A diferencia de `hikonta-partners`, acá no hay `/register` — un
  administrador se vincula a mano en Neon (`INSERT INTO admins (user_id) VALUES (...)`), nunca por
  auto-alta. Ver sección de seguridad más abajo.

## El problema que corrige

Hoy, `verifyAdmin()` en `yelifin-sistema` funciona leyendo `subscription.planSlug === 'admin'` —
un plan de negocio (con precio, límites, billing_interval) usado como bandera de acceso de
plataforma, y esa fila **no existe en ningún script SQL versionado** del repo principal, se
insertó a mano en Neon. Este proyecto reemplaza esa fuente de identidad, **solo para este panel**,
por una tabla dedicada `admins` — mismo patrón que `partners` en `hikonta-partners`. El
mecanismo viejo (`planSlug === 'admin'`) sigue vivo dentro de `yelifin-sistema` para el bypass de
feature-gating del producto; no se toca. Detalle completo en
`database/docs/admin-panel-architecture.md`.

## Stack

Next.js 16 (App Router) + React 19 + TypeScript, SQL directo sobre Postgres/Neon
(`@neondatabase/serverless`), Firebase Auth, Tailwind CSS v4 + **shadcn/ui + Radix + lucide-react
+ recharts** (a diferencia de `hikonta-partners`, que deliberadamente no usa shadcn — este panel
es mucho más pesado en formularios/diálogos/toggles que patrocinar meses o ver una tabla de solo
lectura, así que portar el mismo kit que ya usaban estas pantallas en `yelifin-sistema` reduce
riesgo de reescritura).

## Setup local

```bash
npm install
npm run dev
```

Este repo **no trae `.env.local`** (a diferencia de `hikonta-partners`, que lo copió de un setup
ya andando) — hay que crearlo a mano con las mismas credenciales que `yelifin-sistema/.env.local`:

```
# Neon — misma base de datos que yelifin-sistema/hikonta-partners
DATABASE_URL=

# Firebase client SDK — mismo proyecto que yelifin-sistema/hikonta-partners
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=

# Firebase Admin SDK (service account) — mismo proyecto
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Opcional — ver "Bypass de autenticación" abajo
NEXT_PUBLIC_BYPASS_AUTH=false
NEXT_PUBLIC_BYPASS_ADMIN_ID=1
```

## Bypass de autenticación (desarrollo)

Mismo patrón que `hikonta-partners`: con `NEXT_PUBLIC_BYPASS_AUTH="true"` en `.env.local`,
`verifyAdmin()` y `proxy.ts` se saltan Firebase por completo y usan el admin `id=1` (configurable
con `NEXT_PUBLIC_BYPASS_ADMIN_ID`). **Hay un banner visible en el panel mientras esté prendido** —
apagarlo (`"false"` o borrar la línea) antes de desplegar a producción.

## Estructura

```
app/
  login/                       login (Firebase email+password) — sin /register
  (admin)/                     layout con sidebar, protegido por proxy.ts
    dashboard/                 stats de la plataforma + uso de BD (gráfico de tamaño por tabla)
    users/                     lista + detalle ([id]) — crear usuario, resetear contraseña,
                                editar suscripción, activar/desactivar
    plans/                     lista + detalle ([id]) — CRUD de planes, límites, matriz de
                                features por categoría
  api/admin/
    me/                        identidad del administrador autenticado
    stats/                     conteos de usuarios/suscripciones + planes con más usuarios
    storage/                   tamaño de BD, tablas más grandes, orgs con más filas, imágenes
    users/                     lista (búsqueda + filtro + paginación) + POST crear usuario completo
    users/[id]/                detalle (actividad + almacenamiento) + PATCH (suscripción,
                                contraseña, activo/inactivo)
    plans/                     lista + POST crear plan
    plans/[id]/                PATCH (límites) + DELETE (solo si ningún org lo usa)
    plans/[id]/features/       GET matriz de features + PUT guardar toggles
lib/
  auth.ts                      verifyAdmin() (contra `admins`) + ensureOrgExists() (portado de
                                yelifin-sistema, usado al crear un usuario nuevo desde el panel)
  db.ts                        cliente Neon compartido
proxy.ts                       middleware (convención Next 16) — protege todo excepto /login
```

## Seguridad

- Es el único panel con capacidad de resetear la contraseña de cualquier usuario de la
  plataforma y de ver el tamaño/contenido agregado de toda la base de datos — tratarlo como
  god-mode.
- Sin auto-registro: un administrador se agrega a mano en Neon
  (`INSERT INTO admins (user_id) VALUES (<id>)`).
- Pendiente evaluar: 2FA o allowlist de IP antes de desplegar a producción (ver
  `database/docs/admin-panel-architecture.md` en el repo principal, sección "Pendiente").

## Deploy (pendiente de hacer)

1. Nuevo proyecto en Vercel apuntando a este repo.
2. Dominio: `admin.hikonta.com` (agregar CNAME en el DNS de `hikonta.com`).
3. Env vars en Vercel: las mismas de `.env.local` (Settings → Environment Variables).
4. Confirmar que `database/admin/01-admin-infrastructure.sql` ya corrió en Neon y que el sembrado
   encontró al menos un admin (`SELECT * FROM admins;`) — si no, agregar el primero a mano.
5. Decidir si se apaga `/admin` en `yelifin-sistema` una vez validado esto en producción.

## Pendiente (no migrado en esta sesión)

- UI de gestión de la propia tabla `admins` (agregar/quitar administradores) — hoy es un
  `INSERT`/`UPDATE` manual en Neon.
- Filtros adicionales, exportar a Excel (no existían tampoco en las páginas originales de
  `yelifin-sistema`).

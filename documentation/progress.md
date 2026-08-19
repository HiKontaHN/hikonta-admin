# Estado del proyecto — HiKonta Admin

> Última actualización: 18 de agosto de 2026

---

## 1. Qué es esto

Panel de administración de plataforma para HiKonta: usuarios, planes de suscripción, pagos
(incluyendo pagos patrocinados por un partner), partners (incubadoras/aceleradoras) y sus
organizaciones vinculadas, y un resumen de uso de la base de datos. Es el panel de **mayor
privilegio** de toda la plataforma — crea y desactiva cualquier usuario, resetea cualquier
contraseña, edita cualquier suscripción, extiende suscripciones registrando pagos.

- **Repo:** `hikonta-admin` (carpeta hermana de `yelifin-sistema` y `hikonta-partners`), pusheado a
  `github.com/HiKontaHN/hikonta-admin`. **Comiteado localmente, no pusheado más allá del primer
  commit** — confirmar con el usuario antes de `git push`.
- **Origen:** migración de `app/(dashboard)/admin/*` + `app/api/admin/*` de `yelifin-sistema` a
  repo separado — mismo patrón que ya se hizo con `hikonta-partners`.
- **Diseño de arquitectura completo:** `database/docs/admin-panel-architecture.md` (panel admin) y
  `database/docs/partner-dashboard-architecture.md` (pagos/partners) en el repo principal
  (`yelifin-sistema`) — no se tocan, solo se les da UI/API acá.

---

## 2. Estado actual — resumen

| Área | Estado |
|---|---|
| Login real (Firebase, sin bypass) | ✅ Funcionando — ver sección 8, 3 bugs encadenados corregidos |
| Usuarios (lista, detalle, crear, resetear contraseña) | ✅ + rol real (dueño/miembro), equipo de la org, permisos del rol, actividad personal |
| Planes (CRUD, límites, features) | ✅ Portado 1:1 desde `yelifin-sistema` |
| Administradores (`admins`) | ✅ UI completa — agregar por email, activar/desactivar, eliminar |
| Pagos (`subscription_payments`) | ✅ Nuevo — historial + registrar pago manual, extiende la suscripción real |
| Partners (`partners`/`partner_organizations`) | ✅ Nuevo — CRUD + vincular orgs + patrocinio de pagos |
| Sidebar/navbar | ✅ Portada de `yelifin-sistema` (shadcn Sidebar), colapsable, pegada (no floating) |
| Rate limiting | ✅ Global (300/min/IP en `/api/*`) + límites extra en endpoints sensibles |
| Deploy (Vercel + dominio) | ⬜ No hecho |
| 2FA / allowlist de IP | ⬜ No evaluado |

---

## 3. Decisiones de arquitectura clave

| Decisión | Por qué |
|---|---|
| **Repo separado**, no una ruta dentro de `yelifin-sistema` | Subdominio propio (`admin.hikonta.com`), y sobre todo: sacar el bundle de mayor privilegio del JS que se le sirve a un usuario normal |
| **Tabla `admins` dedicada**, no `subscription.planSlug === 'admin'` | El mecanismo actual en `yelifin-sistema` es un plan de negocio usado como bandera de acceso, insertado a mano en Neon, sin script SQL versionado. `admins` es el mismo patrón que `partners.user_id` |
| `planSlug === 'admin'` **sigue vivo** en `yelifin-sistema` | No se toca — sigue usándose para el bypass de feature-gating del producto. `admins` es exclusivamente la puerta de `hikonta-admin` |
| **Sin `/register` público** | Este panel es god-mode — un admin se vincula por email desde `/admins` (requiere ya ser admin), nunca por auto-alta |
| **shadcn/ui + Radix + lucide-react + recharts**, no hand-rolled | Panel pesado en formularios/diálogos/toggles — se portó el mismo kit que ya usaban estas pantallas en `yelifin-sistema` |
| Sidebar = el mismo sistema de `yelifin-sistema` (`components/ui/sidebar.tsx`), pero `variant="sidebar"` no `"floating"` | Pedido explícito: sidebar y navbar pegadas, sin el hueco que deja el variant floating del producto principal |
| `paid_by_partner_id` es **por pago, no un estado en la org** | Cuando se acaba el período patrocinado y la org paga por su cuenta, ese pago nuevo simplemente no lleva partner — nunca se le arrastra al partner sin que un admin lo marque explícitamente en ESE pago |
| `ensureOrgExists()` portado a `lib/auth.ts` | `POST /api/admin/users` sigue pudiendo dar de alta un negocio completo (org + rol dueño + membresía + suscripción trial) |
| `lib/rate-limit.ts` portado verbatim de `yelifin-sistema` | Mismo patrón in-memory por IP, sin dependencias nuevas — consistencia entre repos |

---

## 4. Base de datos

Todas las tablas usadas ya existen en Neon (compartida con `yelifin-sistema`/`hikonta-partners`) —
este repo no agrega tablas propias, solo les da UI/API.

| Script (en `yelifin-sistema`) | Qué hace | Estado |
|---|---|---|
| `database/admin/01-admin-infrastructure.sql` | Crea `admins` + siembra desde el owner del plan `'admin'` | ✅ Ejecutado y verificado (1 fila, `is_active = TRUE`) |
| `database/partners/01-migrate-subscription-payments.sql` | Migra `subscription_payments` a `org_id`/`org_subscription_id` | ✅ Ejecutado (confirmado — la tabla ya tiene esas columnas) |
| `database/partners/02-partners-infrastructure.sql` | Crea `partners` + `partner_organizations` + `paid_by_partner_id` | ✅ Ejecutado (1 partner de prueba, 6 orgs vinculadas) |

`subscription_payments` seguía **vacía** (0 filas) hasta el final de esta sesión — el schema existía
pero nunca tuvo endpoint que la usara hasta la sección 9 de abajo.

---

## 5. Backend — rutas API

```
app/api/admin/
  me/                         GET  identidad del admin autenticado
  stats/                      GET  conteos de usuarios/suscripciones + planes con más usuarios
  storage/                    GET  tamaño de BD, tablas más grandes, orgs con más filas, imágenes
  users/                      GET (búsqueda+filtro+paginación) + POST crear usuario completo
  users/[id]/                 GET (detalle+actividad+equipo+permisos+actividad personal+
                               almacenamiento) + PATCH (suscripción, contraseña, activo/inactivo)
  plans/                      GET + POST crear plan
  plans/[id]/                 PATCH (límites) + DELETE (solo si ningún org lo usa)
  plans/[id]/features/        GET matriz de features + PUT guardar toggles
  admins/                     GET listar + POST vincular usuario existente como admin
  admins/[id]/                PATCH (activar/desactivar) + DELETE (quitar acceso)
  organizations/               GET buscar orgs (por nombre o email del dueño) — para pickers
  organizations/[id]/partners/ GET partners vinculados a una org — para el selector de patrocinio
  payments/                   GET historial paginado + POST registrar pago manual
  partners/                   GET listar (con conteo de orgs) + POST crear
  partners/[id]/               GET detalle + orgs vinculadas (con meses patrocinados) + PATCH + DELETE
  partners/[id]/organizations/ POST vincular una org (con share_financials)
  partners/[id]/organizations/[orgId]/  PATCH (share_financials) + DELETE (desvincular)
```

`lib/billing.ts` — `applySubscriptionPayment(orgId, months, opts)`: extiende
`org_subscriptions.current_period_end` (acumula si no venció, arranca desde hoy si venció) e
inserta la fila en `subscription_payments`. Usado por `POST /api/admin/payments`.

`lib/rate-limit.ts` — in-memory por IP, portado verbatim de `yelifin-sistema`.

---

## 6. Frontend — páginas

```
app/
  page.tsx                  redirect a /dashboard (sin landing pública)
  login/                     login (Firebase email+password) — SIN /register, toggle mostrar/ocultar
  (admin)/                   layout con SidebarProvider + AppSidebar + navbar (modo oscuro + logout)
    dashboard/                stats de plataforma + gráfico de tamaño de tablas (recharts)
    users/                    tabla con búsqueda/filtro/paginación + columna Rol + diálogo crear
    users/[id]/                info + rol/organización + equipo de la org + permisos del rol
                               (solo no-dueños) + actividad personal (solo no-dueños) + editar
                               suscripción + resetear contraseña + activar/desactivar
    plans/                     grid de planes (CRUD) + diálogo crear/editar + confirmar borrado
    plans/[id]/                 límites de uso + matriz de features por categoría (switches)
    admins/                    tabla de administradores + agregar por email + activar/eliminar
    payments/                  historial + diálogo "registrar pago" (con buscador de org y
                               selector opcional de patrocinio por partner)
    partners/                  grid de partners (CRUD) + conteo de orgs vinculadas
    partners/[id]/               editar datos + orgs vinculadas (con meses patrocinados) +
                               vincular organización + toggle share_financials
```

Componentes `components/ui/*` copiados verbatim de `yelifin-sistema` (Button, Dialog, AlertDialog,
Select, Switch, Table, Pagination, Sheet, Tooltip, Collapsible, Sidebar, etc.). Paleta "One UI"
(misma familia visual que `hikonta-partners`) adaptada al look shadcn "new-york", con tokens
`--sidebar*` agregados para que el sidebar portado de `yelifin-sistema` tenga su propia paleta.

`components/shared/org-picker.tsx` — buscador de organizaciones con dropdown, sin dependencia
Command/Popover (se evitó a propósito instalar una más).

---

## 7. Seguridad

- Rate limiting global: 300 solicitudes/min por IP en todo `/api/*` (middleware, `proxy.ts`).
- Límites extra sobre endpoints sensibles: reset de contraseña (10/15min), agregar admin (5/15min),
  crear usuario (20/15min), registrar pago (30/15min).
- `verifyAdmin()` (Firebase Admin SDK, runtime Node) es el límite de identidad real en cada API
  route — el middleware de Edge (`proxy.ts`) **no verifica nada de verdad** (ver bug de cripto en
  sección 8), es solo una capa de UX.
- Pendiente: 2FA o allowlist de IP antes de producción.

---

## 8. Bugs de login encontrados y corregidos

Al probar el login real por primera vez aparecieron tres problemas encadenados, todos en el
cliente/middleware — el backend (`verifyAdmin()`, `firebase-admin`, JOIN contra `admins`) se probó
aparte con un token real minteado vía `adminAuth.createCustomToken()` y funcionó perfecto desde el
principio.

1. **Race condition cookie vs. redirect** — `login/page.tsx` hacía `router.push("/dashboard")`
   apenas resolvía `signInWithEmailAndPassword()`, pero la cookie `token` (que lee `proxy.ts`) la
   seteaba el listener `onIdTokenChanged` de `useAuth()`, que dispara async y llegaba después.
   Fix: setear la cookie explícitamente en `login/page.tsx` antes de navegar.
2. **Router cache del cliente** — ni así alcanzaba: `router.push` podía servir una respuesta
   cacheada de `/dashboard` de un intento anterior (rebotado a `/login`). Fix:
   `window.location.href = "/dashboard"` en vez de `router.push`.
3. **El bug real, en `proxy.ts`** — `verifyFirebaseToken()` usa
   `crypto.subtle.importKey("spki", certDer, ...)` sobre el DER de un **certificado X.509
   completo**, que no es una estructura SPKI válida — `importKey` tira `Invalid keyData` siempre,
   para cualquier token, incluso uno válido. **Este mismo bug de cripto existe en
   `yelifin-sistema/proxy.ts`** (no se tocó ese repo, solo se confirmó). La diferencia: ahí "token
   inválido" hace `NextResponse.next()` (no bloquea, la seguridad real vive en `verifyAdmin()` de
   cada API route). Acá redirigía duro a `/login`, causando un loop infinito. Fix: copiado el
   patrón de `yelifin-sistema` — sin cookie o token inválido, dejar pasar.

**Pendiente relacionado, no resuelto:** el import SPKI-sobre-X.509 sigue roto en ambos repos — el
middleware nunca verifica una firma real. Fix real: cambiar al endpoint JWK de Google
(`https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`) e
`importKey("jwk", ...)`. No se hizo — no se pidió, y toca un archivo compartido conceptualmente con
`yelifin-sistema`.

Otros bugs de sesiones anteriores (instalación):
- `local.env` (vacío) casi comiteado por `.gitignore` no cubrir ese nombre exacto — corregido,
  renombrado a `.env.local`.
- `[ERR_PNPM_IGNORED_BUILDS]` — se agregó `"pnpm": { "onlyBuiltDependencies": [...] }` a
  `package.json`.

---

## 9. Fix: usuarios miembros de equipo no mostraban Plan/Estado

`GET/PATCH /api/admin/users` resolvían la org de un usuario con
`organizations.owner_user_id = u.id` — eso solo matchea a quien **fundó** la organización. Un
usuario agregado como miembro de equipo (cajero, bodeguero, etc., desde `/settings/members` en
`yelifin-sistema`) nunca es dueño de nada, así que Plan/Estado le salían siempre vacíos.

Fix: resolver la org por membresía real (`organization_members`), con `LEFT JOIN LATERAL` tomando
la membresía activa más antigua — mismo criterio que `verifyAuth()` en `yelifin-sistema`
(`ORDER BY joined_at ASC LIMIT 1`). Aplicado en GET lista, GET detalle y PATCH (editar suscripción
ahora también funciona viendo a un miembro, no solo al dueño).

Verificado con un caso real: un miembro con rol "Ferias" en una org ajena a su propiedad, que antes
resolvía `NULL`, ahora resuelve `ACTIVE` / plan real correctamente.

Features agregadas junto con el fix:
- Columna **Rol** en la tabla de usuarios (Dueño / Miembro · rol).
- **Equipo de la organización** en el detalle — lista al resto de personas de la misma org
  (dueño + miembros), clickeable hacia el detalle de cada uno. Solo se muestra si hay más de una
  persona.
- **Permisos de su rol** (solo no-dueños) — grilla módulo × (ver/editar/borrar/costos/ganancias),
  leída de `org_role_permissions`. No se muestra al dueño: tiene bypass total sin consultar esa
  tabla, la grilla sería engañosa.
- **Actividad de {nombre}** (solo no-dueños) — ventas/productos/transacciones que ESA persona
  registró puntualmente (`created_by`, no `org_id`), con sus últimas 5 ventas. Distinto de la
  tarjeta "Actividad" existente, que sigue siendo el total de la organización.

---

## 10. Módulos nuevos: Pagos, Partners y patrocinio

Ambos módulos le dan UI/API a tablas que ya existían en Neon (ver sección 4) pero nunca tuvieron
endpoint — diseño documentado en `partner-dashboard-architecture.md` de `yelifin-sistema`.

**Pagos** — historial + registrar pago manual (monto, meses, proveedor, comprobante). Extiende de
verdad `org_subscriptions.current_period_end` vía `lib/billing.ts`.

**Partners** — CRUD completo (crear con login opcional ya existente, editar, activar/desactivar,
eliminar si no tiene orgs vinculadas) + gestión de qué organizaciones ve cada uno, con
`share_financials` en falso por defecto (opt-in explícito, nunca ingresos sin permiso).

**Patrocinio** — el diálogo de "Registrar pago" tiene un selector opcional "Patrocinado por" (solo
si la org tiene un partner vinculado). El backend valida que el partner esté realmente vinculado a
esa org antes de aceptar el patrocinio. El detalle de cada partner muestra, por organización, meses
pagados por el partner y hasta cuándo está cubierto — calculado en vivo desde
`subscription_payments`, nunca un contador que se pueda desincronizar. Como el patrocinio es por
pago y no un estado de la org, un pago posterior que la organización pague por su cuenta
automáticamente NO se le cuenta a ningún partner salvo que un admin lo marque explícitamente en
ese pago puntual.

**Patrocinio en lote** — caso real: un partner compra N suscripciones de M meses para N orgs
distintas de una vez (ej. 20 emprendedores por 3 meses). `POST /api/admin/partners/[id]/sponsor`
registra el mismo pago patrocinado para varias organizaciones en una sola llamada (vinculándolas
si hace falta), cada una como resultado independiente — si una falla no aborta el resto. En el
detalle de partner, cada organización vinculada muestra un badge **"Activo"** o **"Vencido — paga
por su cuenta"** (`currently_sponsored`, calculado en vivo comparando `sponsored_until` con `NOW()`)
más un contador "X con patrocinio activo ahora" en el header — así queda visible, sin ambigüedad,
cuáles de las orgs que el partner alguna vez cubrió siguen bajo su patrocinio hoy y cuáles ya
"se graduaron" a pagar por su cuenta.

---

## 11. Pendiente

- [ ] Deploy: proyecto en Vercel + dominio `admin.hikonta.com` + variables de entorno
- [ ] Evaluar 2FA o allowlist de IP antes de producción
- [ ] Decidir si se apaga `/admin` en `yelifin-sistema` una vez validado esto en producción —
      **decisión pospuesta a propósito**, sigue siendo el fallback
- [ ] Fix real del bug de cripto en `verifyFirebaseToken()` (sección 8) — el middleware de Edge no
      verifica nada de verdad, solo delega a las API routes
- [ ] `git push` — todo sigue comiteado solo localmente desde el commit inicial; confirmar con el
      usuario antes de subir
- [ ] Probar en el navegador, con datos reales, los flujos nuevos que solo se verificaron a nivel
      de query/código: registrar un pago real (incluyendo con patrocinio de partner), crear un
      partner y vincularle una organización, y patrocinar un lote de varias orgs de una vez
- [ ] UI de exportar a Excel / filtros adicionales — no existían tampoco en las páginas originales
      de `yelifin-sistema`

---

## 12. Cómo retomar

```bash
cd hikonta-admin
pnpm install
pnpm run dev
```

`.env.local` ya está lleno y las migraciones de `database/admin/` y `database/partners/` ya
corrieron en Neon — el panel debería mostrar datos reales con un login de Firebase normal (la
cuenta vinculada en `admins`). `NEXT_PUBLIC_BYPASS_AUTH` no está seteado, así que no hay bypass
activo por defecto; para probar sin loguearse hay que agregarlo a mano a `.env.local` (ver
`README.md`).

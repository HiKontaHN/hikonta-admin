# Estado del proyecto — HiKonta Admin

> Última actualización: 18 de agosto de 2026 (sesión de verificación + UI de admins)

---

## 1. Qué es esto

Panel de administración de plataforma para HiKonta: gestión de usuarios, planes de suscripción,
límites/features por plan, y un resumen de uso de la base de datos (tamaño por tabla, orgs con más
registros, imágenes almacenadas). Es el panel de **mayor privilegio** de toda la plataforma — crea
y desactiva cualquier usuario, resetea cualquier contraseña, edita cualquier suscripción.

- **Repo:** `hikonta-admin` (carpeta hermana de `yelifin-sistema` y `hikonta-partners`), pusheado a
  `github.com/HiKontaHN/hikonta-admin`. El código base está comiteado (commit `2424ff4`) — ver
  sección 6 para lo que se agregó después.
- **Origen:** migración de `app/(dashboard)/admin/*` + `app/api/admin/*` de `yelifin-sistema` a
  repo separado — mismo patrón que ya se hizo con `hikonta-partners`.
- **Diseño de arquitectura completo:** `database/docs/admin-panel-architecture.md` en el repo
  principal (`yelifin-sistema`).

---

## 2. Decisiones de arquitectura clave

| Decisión | Por qué |
|---|---|
| **Repo separado**, no una ruta dentro de `yelifin-sistema` | Subdominio propio (`admin.hikonta.com`), y sobre todo: sacar el bundle de mayor privilegio del JS que se le sirve a un usuario normal |
| **Tabla `admins` dedicada**, no `subscription.planSlug === 'admin'` | El mecanismo actual en `yelifin-sistema` es un plan de negocio usado como bandera de acceso, insertado a mano en Neon, sin script SQL versionado — mismo hallazgo que ya se hizo con partners. `admins` es el mismo patrón que `partners.user_id` |
| `planSlug === 'admin'` **sigue vivo** en `yelifin-sistema` | No se toca — ese plan sigue usándose para el bypass de feature-gating del producto (`feature-gate.tsx`, `use-plan-guard.ts`). `admins` es exclusivamente la puerta de `hikonta-admin` |
| **Sin `/register` público** | A diferencia de `hikonta-partners`, este panel es god-mode — un admin se vincula a mano en Neon, nunca por auto-alta |
| **shadcn/ui + Radix + lucide-react + recharts**, no hand-rolled | A diferencia de `hikonta-partners` (panel chico, solo lectura, sin shadcn), este panel es pesado en formularios/diálogos/toggles — se portó el mismo kit que ya usaban estas pantallas en `yelifin-sistema`, componentes copiados verbatim |
| `ensureOrgExists()` portado a `lib/auth.ts` | `POST /api/admin/users` sigue pudiendo dar de alta un negocio completo (org + rol dueño + membresía + suscripción trial), igual que hace hoy el onboarding del producto |

---

## 3. Base de datos — pendiente de ejecutar en Neon

Script en `database/admin/` del repo principal (`yelifin-sistema`):

| Script | Qué hace | Estado |
|---|---|---|
| `01-admin-infrastructure.sql` | Crea `admins(id, user_id UNIQUE, is_active, created_at, updated_at)` + siembra automáticamente desde cualquier org cuyo dueño tenga hoy el plan `'admin'` | ✅ **Ejecutado y verificado** |

Verificado directo contra Neon en esta sesión: la tabla existe y tiene 1 fila sembrada
(`is_active = TRUE`, vinculada al owner del plan `admin`). Consulta de referencia:
```sql
SELECT a.id, a.is_active, u.email FROM admins a JOIN users u ON u.id = a.user_id;
```
Agregar administradores adicionales ya no requiere SQL manual — ver sección 4/5, página
`/admins`.

---

## 4. Backend — rutas API (este repo)

```
app/api/admin/
  me/                       GET  — identidad del admin autenticado
  stats/                    GET  — conteos de usuarios/suscripciones + planes con más usuarios
  storage/                  GET  — tamaño de BD, tablas más grandes, orgs con más filas, imágenes
  users/                    GET (búsqueda+filtro+paginación) + POST crear usuario completo
  users/[id]/               GET (detalle+actividad+almacenamiento) + PATCH (suscripción,
                             contraseña, activo/inactivo)
  plans/                    GET + POST crear plan
  plans/[id]/                PATCH (límites) + DELETE (solo si ningún org lo usa)
  plans/[id]/features/       GET matriz de features + PUT guardar toggles
  admins/                   GET listar + POST vincular un usuario existente como admin (nuevo,
                             no existía en yelifin-sistema)
  admins/[id]/                PATCH (activar/desactivar) + DELETE (quitar acceso) — ambos
                             bloquean auto-desactivarse/auto-eliminarse y dejar el panel sin
                             ningún admin activo
```

Todas las rutas portadas 1:1 desde `yelifin-sistema`, cambiando únicamente la fuente de identidad
(`verifyAdmin()` contra `admins`, no `planSlug`). `lib/auth.ts` también trae `ensureOrgExists()`
portado.

---

## 5. Frontend

```
app/
  page.tsx               redirect a /dashboard (sin landing pública)
  login/                  login (Firebase email+password) — SIN /register
  (admin)/                layout protegido — sidebar fija desktop / drawer mobile
    dashboard/             stats de plataforma + gráfico de tamaño de tablas (recharts)
    users/                 tabla con búsqueda/filtro/paginación + diálogo "crear usuario"
    users/[id]/             info + actividad + editar suscripción + resetear contraseña +
                            activar/desactivar (con AlertDialog de confirmación)
    plans/                  grid de planes (CRUD) + diálogo crear/editar + confirmar borrado
    plans/[id]/              límites de uso + matriz de features por categoría (switches)
    admins/                 tabla de administradores + diálogo "agregar por email" +
                             activar/desactivar + eliminar (con AlertDialog de confirmación)
```

15 componentes `components/ui/*` copiados verbatim de `yelifin-sistema` (Button, Dialog,
AlertDialog, Select, Switch, Table, Pagination, etc.). Paleta "One UI" (misma familia visual que
`hikonta-partners`) adaptada al look shadcn "new-york".

---

## 6. Historial de bugs ya resueltos (sesiones anteriores)

Quedan documentados por si algo similar reaparece en otro entorno:

- **Archivo mal nombrado casi comiteado:** al correr `pnpm install`, quedó un `local.env` (vacío)
  en staging de git — `.gitignore` solo cubría `.env.local` exacto. Se corrigió con
  `git rm --cached local.env` + renombrado a `.env.local`.
- **`[ERR_PNPM_IGNORED_BUILDS]`** al correr `pnpm run dev` — pnpm bloquea por default los scripts
  `postinstall` fuera de un allowlist. Se agregó a `package.json`:
  ```json
  "pnpm": { "onlyBuiltDependencies": ["@firebase/util", "protobufjs", "sharp"] }
  ```

---

## 7. Estado real verificado (sesión del 18 de agosto de 2026)

Todo lo siguiente se confirmó directo en esta sesión, no es solo lo que dice este documento:

- ✅ Código comiteado y pusheado — commit `2424ff4` en `github.com/HiKontaHN/hikonta-admin`,
  working tree limpio.
- ✅ `pnpm install` corrido — `node_modules` presente, sin `ERR_PNPM_IGNORED_BUILDS`.
- ✅ `.env.local` lleno con credenciales reales (Neon + Firebase client + Firebase admin) — **no**
  tiene `NEXT_PUBLIC_BYPASS_AUTH`, así que el panel corre con login real de Firebase por defecto.
- ✅ `database/admin/01-admin-infrastructure.sql` **ya corrió en Neon** — se consultó la tabla
  directo: 1 fila en `admins`, `is_active = TRUE`, vinculada al owner del plan `admin` original.
- ✅ `tsc --noEmit` y `next build` (producción, Turbopack) — ambos limpios, sin errores.

Es decir: los tres bloqueadores que quedaban pendientes en la versión anterior de este documento
(comitear, llenar `.env.local`, correr el SQL) ya estaban resueltos antes de esta sesión — solo
faltaba actualizar este archivo para que no generara confusión.

---

## 8. UI de gestión de `admins` (agregada en esta sesión)

Implementada la página `/admins` + rutas `api/admin/admins` y `api/admin/admins/[id]` (ver
secciones 4 y 5). Reemplaza el `INSERT`/`UPDATE` manual en Neon que quedaba como único mecanismo.

Reglas de negocio en el backend (no solo deshabilitado en el botón — también validado server-side):
- Agregar un admin requiere que el email ya exista en `users` — no da de alta cuentas nuevas.
- Un admin no puede desactivarse ni eliminarse a sí mismo.
- No se puede desactivar ni eliminar al último administrador activo (evita quedar sin acceso).

---

## 9. Bugs de login encontrados y corregidos (sesión del 18 de agosto de 2026, continuación)

Al probar el login real por primera vez aparecieron tres problemas encadenados, todos en el
cliente/middleware — el backend (`verifyAdmin()`, `firebase-admin`, JOIN contra `admins`) se probó
aparte con un token real minteado vía `adminAuth.createCustomToken()` y funcionó perfecto desde el
principio, así que nunca fue sospechoso.

1. **Race condition cookie vs. redirect** — `login/page.tsx` hacía `router.push("/dashboard")`
   apenas resolvía `signInWithEmailAndPassword()`, pero la cookie `token` (que lee `proxy.ts`) la
   seteaba el listener `onIdTokenChanged` de `useAuth()`, que dispara async y llegaba después.
   Fix: setear la cookie explícitamente en `login/page.tsx` con el ID token recién obtenido, antes
   de navegar.
2. **Router cache del cliente** — ni así alcanzaba: `router.push` podía servir una respuesta
   cacheada de `/dashboard` de un intento anterior (rebotado a `/login` por el middleware, de antes
   de tener cookie). Fix: `window.location.href = "/dashboard"` en vez de `router.push` — fuerza
   una petición fresca sin caché.
3. **El bug real, en `proxy.ts`** — `verifyFirebaseToken()` usa
   `crypto.subtle.importKey("spki", certDer, ...)` sobre el DER de un **certificado X.509
   completo**, que no es una estructura SPKI válida (son ASN.1 distintos) — `importKey` tira
   `Invalid keyData` **siempre**, para cualquier token, incluso uno perfectamente válido.
   Verificado directo: se minteó un token real y se le pasó a una copia exacta de esta función —
   falló. **Este mismo bug de cripto existe también en `yelifin-sistema/proxy.ts`** (código casi
   idéntico) — no se tocó ese repo, solo se confirmó ahí. La diferencia es que en
   `yelifin-sistema`, "token inválido" hace `NextResponse.next()` (no bloquea — la seguridad real
   vive en `verifyAdmin()`/`firebase-admin` de cada API route, sin este bug), mientras que acá
   redirigía duro a `/login`, causando un loop infinito para cualquier usuario real. Fix: copiado
   el patrón de `yelifin-sistema` — sin cookie o token inválido, dejar pasar. `proxy.ts` queda como
   gate de UX, no como límite de seguridad real (ese sigue siendo `verifyAdmin()` en cada
   `/api/admin/*`, ya verificado funcionando).

**Pendiente relacionado, no resuelto:** el import SPKI-sobre-X.509 sigue roto en ambos repos — el
middleware nunca hace una verificación de firma real, solo pasa o no según haya cookie. Si se
quiere que el gate de Edge verifique de verdad (no solo delegar todo a las API routes), hay que
cambiar a un endpoint que devuelva JWK directo
(`https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`) e
`importKey("jwk", ...)` en vez de parsear el X.509. No se hizo en esta sesión — no se pidió, y
toca un archivo compartido conceptualmente con `yelifin-sistema` que se decidió no tocar todavía.

---

## 10. Pendiente

- [ ] Deploy: proyecto en Vercel + dominio `admin.hikonta.com` + variables de entorno
- [ ] Evaluar 2FA o allowlist de IP antes de producción (es el panel con capacidad de resetear
      cualquier contraseña de la plataforma)
- [ ] Decidir si se apaga `/admin` en `yelifin-sistema` una vez validado esto en producción —
      **decisión pospuesta a propósito**, `/admin` en `yelifin-sistema` sigue siendo el fallback
      hasta validar `hikonta-admin` en producción real
- [ ] Considerar el fix real del bug de cripto en `verifyFirebaseToken()` (ver sección 9) — hoy el
      middleware no verifica nada de verdad, solo delega a las API routes
- [ ] Confirmar login real de punta a punta con el tercer fix (sección 9, punto 3) aplicado — los
      dos primeros fixes no alcanzaron solos, este tercero recién se probó a nivel de código
      (token real + función copiada), falta la confirmación interactiva en el navegador

---

## 11. Cómo retomar

```bash
cd hikonta-admin
pnpm install
pnpm run dev
```

`.env.local` ya está lleno y `database/admin/01-admin-infrastructure.sql` ya corrió en Neon — el
panel debería mostrar datos reales con un login de Firebase normal (la cuenta vinculada en
`admins`). `NEXT_PUBLIC_BYPASS_AUTH` no está seteado, así que no hay bypass activo por defecto;
para probar sin loguearse hay que agregarlo a mano a `.env.local` (ver README.md).

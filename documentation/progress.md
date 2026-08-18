# Estado del proyecto — HiKonta Admin

> Última actualización: 18 de agosto de 2026

---

## 1. Qué es esto

Panel de administración de plataforma para HiKonta: gestión de usuarios, planes de suscripción,
límites/features por plan, y un resumen de uso de la base de datos (tamaño por tabla, orgs con más
registros, imágenes almacenadas). Es el panel de **mayor privilegio** de toda la plataforma — crea
y desactiva cualquier usuario, resetea cualquier contraseña, edita cualquier suscripción.

- **Repo:** `hikonta-admin` (carpeta hermana de `yelifin-sistema` y `hikonta-partners`) — con un
  primer commit (`.gitattributes` + `.gitignore`), el resto del código está generado pero
  **todavía no comiteado** (ver sección 6).
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
| `01-admin-infrastructure.sql` | Crea `admins(id, user_id UNIQUE, is_active, created_at, updated_at)` + siembra automáticamente desde cualquier org cuyo dueño tenga hoy el plan `'admin'` | ⏳ **No ejecutado todavía** |

Después de correrlo, verificar el sembrado:
```sql
SELECT a.id, a.is_active, u.email FROM admins a JOIN users u ON u.id = a.user_id;
```
Si no encontró filas (el plan `admin` se asignó de otra forma en Neon), agregar el primero a mano:
```sql
INSERT INTO admins (user_id) VALUES (<user_id>);
```

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
```

15 componentes `components/ui/*` copiados verbatim de `yelifin-sistema` (Button, Dialog,
AlertDialog, Select, Switch, Table, Pagination, etc.). Paleta "One UI" (misma familia visual que
`hikonta-partners`) adaptada al look shadcn "new-york".

---

## 6. ⚠️ Nada comiteado todavía — y un archivo mal nombrado que casi se comitea

Todo el código (backend + frontend + componentes) está generado en el working tree pero **no hay
segundo commit** — solo existe el inicial (`.gitattributes` + `.gitignore`). Hay que revisar y
comitear.

**Bug encontrado y corregido en esta sesión:** al correr `pnpm install`, quedó un archivo
`local.env` (vacío) agregado al staging de git. `.gitignore` solo cubre `.env.local` exacto —
`local.env` no matcheaba ningún patrón, así que si se llenaba con credenciales reales y se
comiteaba así, quedaban en el historial de git. Se corrigió: `git rm --cached local.env` +
renombrado a `.env.local` (queda ignorado correctamente). **El archivo está vacío** — falta
llenarlo con las credenciales reales antes de poder correr el panel con datos.

---

## 7. Bug de instalación encontrado y corregido

`pnpm run dev` fallaba con `[ERR_PNPM_IGNORED_BUILDS]` (exit code 1) — pnpm bloquea por default
los scripts `postinstall` de paquetes fuera de un allowlist (`@firebase/util`, `protobufjs`,
`sharp` — transitivos de `firebase`/`firebase-admin`/`next`). Se agregó a `package.json`:

```json
"pnpm": {
  "onlyBuiltDependencies": ["@firebase/util", "protobufjs", "sharp"]
}
```

**Pendiente de confirmar:** el usuario todavía no volvió a correr `pnpm install` con este fix —
falta verificar que `pnpm run dev` levante limpio.

---

## 8. Pendiente

- [ ] Confirmar que `pnpm install` + `pnpm run dev` levantan limpio con el fix de `onlyBuiltDependencies`
- [ ] Llenar `.env.local` (Neon `DATABASE_URL`, Firebase client + admin SDK — mismas credenciales
      que `yelifin-sistema`/`hikonta-partners`, ver `README.md` de este repo)
- [ ] Ejecutar `database/admin/01-admin-infrastructure.sql` en Neon (repo `yelifin-sistema`) y
      verificar el sembrado de `admins`
- [ ] Probar el panel con `NEXT_PUBLIC_BYPASS_AUTH="true"` antes de probar login real
- [ ] Correr `tsc --noEmit` / `pnpm run build` — todo el código se escribió sin poder compilarlo
      en la sesión donde se generó (sin `node_modules` en ese entorno), así que es la primera
      verificación real de tipos
- [ ] Hacer el primer commit real del código (todo sigue sin comitear, ver sección 6)
- [ ] UI de gestión de la tabla `admins` (agregar/quitar administradores) — hoy es `INSERT`/`UPDATE`
      manual en Neon
- [ ] Deploy: proyecto en Vercel + dominio `admin.hikonta.com` + variables de entorno
- [ ] Evaluar 2FA o allowlist de IP antes de producción (es el panel con capacidad de resetear
      cualquier contraseña de la plataforma)
- [ ] Decidir si se apaga `/admin` en `yelifin-sistema` una vez validado esto en producción

---

## 9. Cómo retomar

```bash
cd hikonta-admin
pnpm install        # ya no debería tirar ERR_PNPM_IGNORED_BUILDS
pnpm run dev
```

Antes de que el panel muestre datos reales, faltan dos cosas fuera de este repo:
1. Llenar `.env.local` (está vacío, ver sección 8).
2. Correr `database/admin/01-admin-infrastructure.sql` contra Neon desde `yelifin-sistema` (ver
   `database/docs/admin-panel-architecture.md` en ese repo para el detalle completo).

Con `NEXT_PUBLIC_BYPASS_AUTH="true"` en `.env.local` se puede ver el panel sin loguearse (usa el
admin `id=1` — necesita que exista esa fila en `admins`, si no, los endpoints devuelven listas
vacías en vez de fallar).

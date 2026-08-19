# Feature pendiente — Invitaciones de suscripción patrocinada

> **Estado:** Diseño en pausa a propósito — el usuario pidió guardar esto en un doc y continuar
> después, no construirlo todavía.
> **Fecha:** 19 de agosto de 2026

---

## El problema (en palabras del usuario)

> "yo quiero que puede seleccionar para cuantas personas y ellos desde la plataforma de partners
> pueden ingresar el correo electronico o darles tipo como un enlace unico por suscripcion para
> que los usuarios se registren"

Hoy (ver `documentation/progress.md`, sección 10), patrocinar solo funciona para organizaciones
que **ya existen** en HiKonta — un admin (o el propio partner desde `hikonta-partners`) busca una
org ya registrada y le aplica el pago patrocinado. Lo que falta es un flujo para **gente que
todavía no tiene cuenta**: el partner compra N suscripciones (ej. 20, de 3 meses cada una) sin
saber todavía quién las va a usar, y después las reparte una por una — por email o por un link
único — para que cada persona se registre desde cero y su cuenta nueva salga ya con el plan
patrocinado puesto.

Esto es un feature nuevo de verdad, no un hueco en algo ya diseñado — no existe en ningún repo
hoy. Revisado antes de escribir esto: `hikonta-partners` ya tiene `POST /api/partner/sponsor` +
`SponsorModal` en `/subscriptions`, pero **solo para orgs ya vinculadas al portafolio del
partner** (`requireOwnedOrganization`) — ninguna noción de "plaza sin asignar" ni de registro
público.

---

## Decisiones ya tomadas

| Pregunta | Respuesta |
|---|---|
| ¿Dónde se genera el lote de N plazas patrocinadas? | **Panel admin (`hikonta-admin`)** — el admin de HiKonta crea el lote para un partner (ver sección "Cómo encaja con lo que ya existe" abajo), no el propio partner desde su panel. |

## Preguntas abiertas (sin resolver)

### 1. ¿Qué pasa cuando alguien usa el link único de una plaza?

Dos opciones, sin decidir:

- **(a) Registro nuevo desde cero** — el link lleva a un formulario "crear cuenta" (nombre del
  negocio, email, contraseña) que crea un usuario + organización nueva, con el plan patrocinado ya
  puesto — nunca pasa por Trial. Coincide más con "para que los usuarios se registren" del pedido
  original.
- **(b) Reclamar una cuenta existente** — alguien que YA tiene cuenta/organización en HiKonta
  (quizás en Trial) usa el link para que SU organización quede vinculada al partner y suba a ese
  plan.

### 2. ¿Qué pasa cuando el partner tipea un email en vez de compartir un link?

Dos opciones, sin decidir:

- **(a) Se manda un correo con el link de esa plaza** — requiere integrar un servicio de envío de
  emails (Resend/SendGrid). **Hoy no existe ningún envío de email saliente en ningún repo de
  HiKonta** — confirmado al revisar `hikonta-admin`, `hikonta-partners` y las notas de
  `multi-org-progress.md` en `yelifin-sistema`, que ya deja anotado como pendiente futuro un
  "Flujo de invitación por email" con la misma necesidad (`org_invitations`, sección 2 de ese
  documento — mismo patrón que esto necesitaría, pero para partners en vez de organization_members).
- **(b) Se crea la cuenta al toque** — al tipear el email, el sistema crea el usuario + org de una
  con una contraseña temporal/aleatoria. No hace falta email saliente, pero alguien tiene que
  pasarle esa contraseña a la persona para que pueda entrar la primera vez (problema de
  distribución sin resolver: ¿SMS? ¿WhatsApp manual del partner?).

---

## Cómo encaja con lo que ya existe

- `lib/billing.ts` → `applySubscriptionPayment(orgId, months, opts)` — ya soporta `planId` y
  `paidByPartnerId`. Este feature reutilizaría el mismo helper en el momento en que la plaza se
  "canjea" (se crea o se vincula la org), no cuando se genera el lote.
- `POST /api/admin/partners/[id]/sponsor` (`hikonta-admin`) — hoy exige `org_ids` de orgs ya
  existentes. Este feature necesitaría una variante o un modo nuevo: generar plazas SIN `org_id`
  todavía, cada una con su propio token.
- `partner_organizations` — el vínculo se crearía recién cuando la plaza se canjea (registro nuevo
  u org reclamada), no al generar el lote.

## Boceto técnico (sin implementar — para cuando se retome)

Tabla nueva, borrador, mismo estilo que `org_invitations` en `multi-org-progress.md`:

```sql
CREATE TABLE partner_sponsorship_slots (
  id           BIGSERIAL PRIMARY KEY,
  partner_id   BIGINT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  plan_id      BIGINT NOT NULL REFERENCES subscription_plans(id),
  months       INT NOT NULL,
  token        VARCHAR(255) UNIQUE NOT NULL,
  email        VARCHAR(255),              -- opcional: si el partner ya sabe a quién es
  status       VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING | CLAIMED | EXPIRED | REVOKED
  claimed_by_user_id BIGINT REFERENCES users(id),
  claimed_org_id     BIGINT REFERENCES organizations(id),
  expires_at   TIMESTAMP,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  claimed_at   TIMESTAMP
);
```

Rutas nuevas (borrador, nombres sin confirmar):
- `POST /api/admin/partners/[id]/sponsorship-slots` — crear el lote de N plazas (hikonta-admin,
  ya decidido que va acá).
- `GET /api/partner/sponsorship-slots` — que el partner vea sus plazas (usadas/pendientes) desde
  `hikonta-partners`.
- `GET /invite/[token]` (pública, sin auth) — landing para canjear una plaza — formato exacto
  depende de la respuesta a la pregunta 1.
- `POST /api/public/sponsorship-slots/[token]/claim` — pública, sin auth, con su propio rate limit
  estricto (mismo criterio que `POST /api/partner/register`, que ya es pública y hoy limita a
  10/15min/IP).

---

## Siguiente paso cuando se retome

1. Resolver las dos preguntas abiertas de arriba con el usuario.
2. Confirmar si el envío de email (si se elige la opción (a) de la pregunta 2) se resuelve con
   Resend, SendGrid, u otro proveedor — y quién paga esa cuenta.
3. Diseñar la tabla definitiva (la de arriba es un borrador) y dónde vive el script SQL — mismo
   patrón que el resto: `database/partners/0X-....sql` en `yelifin-sistema`.
4. Recién ahí implementar: tabla → rutas → UI en `hikonta-admin` (crear lote) → UI en
   `hikonta-partners` (repartir plazas) → página pública de registro/reclamo.

# Feature — Invitaciones de suscripción patrocinada

> **Estado:** **Fase 1 construida** (19 de agosto de 2026, sesión 2) — el lote de créditos
> facturado por adelantado. La fase 2 (canje: link/email → organización real) sigue en pausa,
> ver sección "Preguntas abiertas" más abajo — no cambiaron desde la sesión 1.
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
| ¿Cómo se factura el lote? (sesión 2) | **Se cobra completo al crearlo** — un solo cargo (precio del plan × meses × cantidad, con un precio final editable para aplicar descuento) en el momento de comprar el lote. Los créditos ya quedan pagos; canjear uno después NO genera un cobro nuevo. Distinto del "patrocinio en lote" que ya existía (sección 10 de `progress.md`), que sigue cobrando pago-por-pago por organización. |
| ¿Alcance de la sesión 2? | Solo generar el lote de créditos (plan + meses + cantidad + precio/descuento) desde `hikonta-admin`, sin organización. **Sin link de canje ni email todavía** — eso es la fase 2, sigue pendiente (preguntas abiertas sin cambios). |

## Fase 1 — construida (sesión 2, 19 de agosto de 2026)

- **Schema:** `database/partners/05-credit-batches.sql` (en `yelifin-sistema`, **todavía no ejecutado
  en Neon** — este entorno no tenía `DATABASE_URL` cargado, confirmar con el usuario antes de
  correrlo). Crea:
  - `partner_credit_batches` — la "factura": partner, plan, meses, cantidad, precio de lista
    (snapshot de `subscription_plans.price_usd × months`), precio final pactado, total cobrado,
    método de pago, comprobante, notas, quién lo creó.
  - `partner_subscription_credits` — una fila por cada suscripción individual del lote (si
    quantity=20, son 20 filas), todas `PENDING`. Ya tiene `token`/`status`/`claimed_org_id` para
    la fase 2, aunque ningún endpoint los usa todavía — evita otra migración después.
- **Backend (`hikonta-admin`):** `GET/POST /api/admin/partners/[id]/credit-batches`. El POST valida
  plan pago, meses ≥ 1, cantidad 1–200, y que el precio final sea ≥ 0; si falla la inserción de los
  créditos individuales, borra la fila de factura para no dejar un lote fantasma sin créditos.
- **Frontend (`hikonta-admin`):** en el detalle de partner (`/partners/[id]`), sección nueva
  "Créditos de suscripción" con tabla de lotes (plan, duración, cantidad, precio pactado + %
  descuento, total cobrado, pendientes/canjeados, fecha) y diálogo "Comprar créditos" — precio se
  autocompleta con el de lista y es editable (eso ES el mecanismo de descuento, sin campo de %
  aparte).
- **Lado del partner (`hikonta-partners`, sesión 3):** `GET /api/partner/credits` — de **solo
  lectura**, a propósito: el lote lo arma un admin de HiKonta, el partner solo lo ve. Sección nueva
  "Créditos de suscripción" en `/subscriptions` (debajo de la tabla de organizaciones, arriba del
  historial de patrocinios), mismo estilo que esa página — muestra plan, duración, cantidad, total
  pagado, y pendientes/asignados por lote. Sin ninguna acción todavía (nada que repartir hasta que
  exista la fase 2).
- **Pendiente de esta fase:** correr `05-credit-batches.sql` contra Neon y probar el flujo end-to-end
  con datos reales en ambos repos — no se pudo en ninguna sesión por falta de credenciales de base
  de datos (ni `hikonta-admin/.env.local` ni `hikonta-partners/.env.local` tienen `DATABASE_URL`
  cargado en este entorno).

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
  `paidByPartnerId`. La fase 2 reutilizaría el mismo helper en el momento en que el crédito se
  "canjea" (se crea o se vincula la org) — aunque, a diferencia del boceto original, el cobro real
  ya pasó al comprar el lote (fase 1), así que el canje probablemente NO debería crear otra fila en
  `subscription_payments` con `amount_usd` — falta decidir cómo se refleja el canje sin duplicar el
  cobro (¿un pago con `amount_usd = 0` y una referencia al crédito? ¿directamente actualizar
  `org_subscriptions` sin pasar por `subscription_payments`?).
- `POST /api/admin/partners/[id]/sponsor` (`hikonta-admin`) — sigue existiendo tal cual, para el
  caso de orgs que YA existen (cobra pago-por-pago). No se toca.
- `partner_organizations` — el vínculo se crearía recién cuando el crédito se canjea (registro nuevo
  u org reclamada), no al generar el lote — igual que estaba pensado.

## Fase 2 — todavía sin construir: el canje

El schema de la fase 1 (`partner_subscription_credits`, ver arriba) ya tiene `token`, `status` y
`claimed_org_id`/`claimed_at` reservados para esto — no hace falta otra migración para arrancar la
fase 2, solo construir sobre lo que ya existe:

- `GET /api/partner/credits` (`hikonta-partners`) — que el partner vea sus créditos
  (pendientes/canjeados) del portafolio.
- `GET /invite/[token]` (pública, sin auth) — landing para canjear un crédito — formato exacto
  depende de la respuesta a la pregunta 1 de abajo.
- `POST /api/public/credits/[token]/claim` — pública, sin auth, con su propio rate limit estricto
  (mismo criterio que `POST /api/partner/register`, que ya es pública y hoy limita a 10/15min/IP).
- UI en `hikonta-admin` y/o `hikonta-partners` para generar el link o mandar el email de un crédito
  puntual del lote.

---

## Siguiente paso cuando se retome (fase 2)

1. Resolver las dos preguntas abiertas de arriba con el usuario.
2. Confirmar si el envío de email (si se elige la opción (a) de la pregunta 2) se resuelve con
   Resend, SendGrid, u otro proveedor — y quién paga esa cuenta.
3. Decidir cómo se refleja el canje en `subscription_payments` sin duplicar el cobro (ver "Cómo
   encaja con lo que ya existe" arriba) — es la pregunta técnica nueva que dejó la fase 1.
4. Implementar: rutas de canje → UI en `hikonta-admin` (generar link/email de un crédito) → UI en
   `hikonta-partners` (ver créditos del portafolio) → página pública de registro/reclamo.

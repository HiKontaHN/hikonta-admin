// lib/rate-limit.ts — copiado verbatim de yelifin-sistema.
// In-memory rate limiter por IP. Funciona por instancia de servidor.
// Para producción serverless con múltiples instancias es suficiente para
// frenar ataques básicos; para máxima cobertura usar Upstash Redis.

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

/**
 * Verifica si una key (ej. "login:1.2.3.4") está dentro del límite.
 * @param key     Identificador único (acción + IP)
 * @param limit   Máximo de intentos permitidos en la ventana
 * @param windowMs Duración de la ventana en milisegundos
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  cleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  entry.count += 1;
  const remaining = Math.max(0, limit - entry.count);
  const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);

  return { allowed: entry.count <= limit, remaining, retryAfterSec };
}

/** Extrae la IP real del request (Vercel pone x-forwarded-for). */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}

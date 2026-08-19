// proxy.ts — Next.js 16 middleware convention (reemplaza a middleware.ts).
// Mismo patrón que proxy.ts en hikonta-partners: protege todo detrás de una
// cookie de sesión con un Firebase ID token válido y verificado en Edge.
// A diferencia de hikonta-partners, acá NO hay /register público — un
// administrador se da de alta a mano en Neon (ver database/admin/ en
// yelifin-sistema), nunca por auto-registro. Esto es intencional: es el
// único panel con capacidad de resetear contraseñas de cualquier usuario de
// la plataforma.

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/rate-limit";

const PUBLIC_PATHS = ["/login"];

type VerifiedTokenPayload = {
  aud?: string;
  exp?: number;
  email_verified?: boolean;
  [key: string]: any;
};

async function verifyFirebaseToken(
  token: string
): Promise<{ valid: true; payload: VerifiedTokenPayload } | { valid: false }> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { valid: false };

    const [headerB64, payloadB64, signatureB64] = parts;
    const header = JSON.parse(atob(headerB64.replace(/-/g, "+").replace(/_/g, "/")));
    const payload: VerifiedTokenPayload = JSON.parse(
      atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))
    );

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) return { valid: false };
    if (payload.aud !== process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return { valid: false };

    const keysRes = await fetch(
      "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com",
      { next: { revalidate: 3600 } }
    );
    if (!keysRes.ok) return { valid: false };

    const keys = await keysRes.json();
    const certPem = keys[header.kid];
    if (!certPem) return { valid: false };

    const certDer = pemToDer(certPem);
    const cryptoKey = await crypto.subtle.importKey(
      "spki",
      certDer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlDecode(signatureB64);
    const isValid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, signature, data);
    if (!isValid) return { valid: false };

    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

function pemToDer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/, "")
    .replace(/-----END CERTIFICATE-----/, "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function base64UrlDecode(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ⚠️ BYPASS TEMPORAL — ver nota en lib/auth.ts. Con esto activo, el
// middleware deja pasar cualquier ruta sin pedir sesión.
const BYPASS_AUTH = process.env.NEXT_PUBLIC_BYPASS_AUTH === "true";

export async function proxy(request: NextRequest) {
  if (BYPASS_AUTH) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // ── Rate limit global para toda la API ─────────────────────────────
  // Mismo patrón que proxy.ts en yelifin-sistema: 300 solicitudes por
  // minuto por IP, antes de que la request llegue a ninguna route
  // (que hace su propia verifyAdmin() aparte, esto no la reemplaza).
  // Endpoints puntuales especialmente sensibles (resetear contraseña,
  // elevar un usuario a admin, registrar un pago) tienen además su propio
  // límite más estricto dentro del route handler — ver lib/rate-limit.ts.
  if (pathname.startsWith("/api")) {
    const { allowed, retryAfterSec } = rateLimit(
      `api:${getClientIP(request)}`,
      300,
      60 * 1000,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intentá de nuevo en unos segundos." },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
      );
    }
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Mismo patrón que proxy.ts en yelifin-sistema: sin cookie o token
  // inválido, DEJAR PASAR (NextResponse.next()), no redirigir duro. Este
  // gate de Edge runtime no es la capa de seguridad real — no puede serlo,
  // verifyFirebaseToken() de acá abajo (igual que en yelifin-sistema) usa
  // crypto.subtle.importKey("spki", ...) sobre el DER de un certificado
  // X.509 completo, que NO es una estructura SPKI válida — falla siempre,
  // para cualquier token, incluso uno perfectamente legítimo (verificado
  // en esta sesión con un token real). La identidad real se valida en cada
  // API route vía verifyAdmin() (firebase-admin, runtime Node, sin este
  // bug) y en el cliente vía useAuth(). Si acá se redirige duro en vez de
  // dejar pasar, un usuario ya logueado queda en loop infinito hacia
  // /login porque su token real "no es válido" para este chequeo roto.
  if (!token) return NextResponse.next();

  const result = await verifyFirebaseToken(token);
  if (!result.valid) return NextResponse.next();

  // Token válido + ruta pública (/login) → mandar directo al dashboard
  if (isPublic) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

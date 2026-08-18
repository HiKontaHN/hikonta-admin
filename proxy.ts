// proxy.ts — Next.js 16 middleware convention (reemplaza a middleware.ts).
// Mismo patrón que proxy.ts en hikonta-partners: protege todo detrás de una
// cookie de sesión con un Firebase ID token válido y verificado en Edge.
// A diferencia de hikonta-partners, acá NO hay /register público — un
// administrador se da de alta a mano en Neon (ver database/admin/ en
// yelifin-sistema), nunca por auto-registro. Esto es intencional: es el
// único panel con capacidad de resetear contraseñas de cualquier usuario de
// la plataforma.

import { NextRequest, NextResponse } from "next/server";

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

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") || // las rutas API hacen su propia verifyAdmin()
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!token) {
    return isPublic ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url));
  }

  const result = await verifyFirebaseToken(token);
  if (!result.valid) {
    return isPublic ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url));
  }

  // Token válido + ruta pública (/login) → mandar directo al dashboard
  if (isPublic) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

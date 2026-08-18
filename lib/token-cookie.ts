// lib/token-cookie.ts
// Único dueño de la cookie `token` que lee proxy.ts (middleware). Idéntico
// al patrón de yelifin-sistema/hikonta-partners — se setea desde el cliente
// porque el SDK de Firebase refresca el ID token cada hora.

const MAX_AGE = 3600;

export function setTokenCookie(token: string) {
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `token=${token}; path=/; max-age=${MAX_AGE}; SameSite=Lax${secure}`;
}

export function clearTokenCookie() {
  document.cookie = "token=; path=/; max-age=0; SameSite=Lax";
}

"use client";

import { useEffect, useState } from "react";
import { User as FirebaseUser, onIdTokenChanged, signOut as fbSignOut } from "firebase/auth";
import { auth } from "@/firebase.config";
import { setTokenCookie, clearTokenCookie } from "@/lib/token-cookie";
import useSWR from "swr";

export type AdminMe = {
  adminId: number;
  email: string;
  displayName: string | null;
};

class MeError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const ME_KEY = "/api/admin/me";

// ⚠️ BYPASS TEMPORAL — ver nota en lib/auth.ts. Con esto activo se salta
// Firebase por completo: token/me quedan fijos, sin pedir login.
const BYPASS_AUTH = process.env.NEXT_PUBLIC_BYPASS_AUTH === "true";
const BYPASS_ME: AdminMe = {
  adminId: Number(process.env.NEXT_PUBLIC_BYPASS_ADMIN_ID ?? "1"),
  email: "dev@hikonta.local",
  displayName: "Modo sin autenticación",
};

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [token, setToken] = useState<string | null>(BYPASS_AUTH ? "bypass" : null);
  const [firebaseLoading, setFirebaseLoading] = useState(!BYPASS_AUTH);

  useEffect(() => {
    if (BYPASS_AUTH) return; // no toca Firebase en modo bypass

    const unsubscribe = onIdTokenChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const idToken = await fbUser.getIdToken();
        setTokenCookie(idToken);
        setToken(idToken);
      } else {
        clearTokenCookie();
        setToken(null);
      }
      setFirebaseLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const { data: me, error: meError, isLoading: meLoading } = useSWR<{ data: AdminMe }>(
    !BYPASS_AUTH && token ? ME_KEY : null,
    async (url: string) => {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new MeError(body?.error ?? "Error al obtener el perfil de administrador", res.status);
      }
      return res.json();
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
      // Una cuenta sin acceso (403 — no está en `admins`, o está desactivada)
      // no se auto-reintenta.
      shouldRetryOnError: (err) => !(err instanceof MeError && err.status === 403),
    }
  );

  async function signOut() {
    if (BYPASS_AUTH) return;
    await fbSignOut(auth);
  }

  // Sesión de Firebase válida, pero sin acceso al panel (no está en `admins`,
  // o `is_active = FALSE`).
  const denied = !BYPASS_AUTH && meError instanceof MeError && meError.status === 403;

  return {
    firebaseUser,
    token,
    me: BYPASS_AUTH ? BYPASS_ME : (me?.data ?? null),
    denied,
    loading: BYPASS_AUTH ? false : firebaseLoading || (!!token && meLoading),
    bypassing: BYPASS_AUTH,
    signOut,
  };
}

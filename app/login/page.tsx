"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase.config";
import { setTokenCookie } from "@/lib/token-cookie";
import { HiKontaIcon } from "@/components/shared/hikonta-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2 } from "lucide-react";

// Sin /register — un administrador se vincula a mano en Neon (tabla
// `admins`, ver database/admin/ en yelifin-sistema). Este panel es el único
// con capacidad de resetear contraseñas de cualquier usuario de la
// plataforma; no tiene alta pública.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      // proxy.ts (middleware) valida la cookie `token`, no el estado de
      // Firebase en el cliente — hay que setearla ACÁ antes de navegar. Si
      // se deja que la setee el listener onIdTokenChanged de useAuth() (que
      // dispara async, después de esta función), router.push llega primero:
      // el middleware no encuentra cookie y rebota de vuelta a /login.
      const idToken = await cred.user.getIdToken();
      setTokenCookie(idToken);
      router.push("/dashboard");
    } catch {
      setError("Correo o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <HiKontaIcon className="h-14 w-14" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Panel de administración</h1>
            <p className="text-sm text-muted-foreground">Acceso restringido — solo administradores de HiKonta</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="flex items-center gap-1.5">
              <Mail className="size-3.5" /> Correo
            </Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <Button type="submit" disabled={loading} className="mt-2 gap-2">
            {loading && <Loader2 className="size-4 animate-spin" />}
            Iniciar sesión
          </Button>
        </form>
      </div>
    </main>
  );
}

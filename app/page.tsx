import { redirect } from "next/navigation";

// Sin landing pública — este panel no tiene nada que mostrarle a alguien sin
// sesión (proxy.ts ya lo manda a /login antes de llegar acá). Con sesión
// válida, "/" no tiene contenido propio: al dashboard.
export default function RootPage() {
  redirect("/dashboard");
}

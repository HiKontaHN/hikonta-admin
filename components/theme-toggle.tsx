"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Mismo patrón que components/theme-toggle.tsx en hikonta-partners — el
// guard `mounted` evita el mismatch de hidratación (el theme real solo se
// conoce en el cliente). Íconos lucide (no Lineicons) para estar en línea
// con el resto del kit shadcn que usa este repo.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const toggle = () => setTheme(isDark ? "light" : "dark");
  const label = isDark ? "Modo claro" : "Modo oscuro";

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={label} title={label}>
      {isDark ? <Sun className={!mounted ? "opacity-0" : ""} /> : <Moon className={!mounted ? "opacity-0" : ""} />}
    </Button>
  );
}

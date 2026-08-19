// components/shared/org-picker.tsx
// Buscador de organizaciones con resultados en dropdown — usado por
// "Registrar pago" y "Vincular organización" (partners). Sin componente
// Command/Popover de shadcn instalado; se resuelve con un Input +
// lista absoluta, mismo criterio que el resto de este repo de no sumar
// dependencias nuevas salvo que hagan falta de verdad.
"use client";

import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useAdminOrgSearch, AdminOrgSearchResult } from "@/hooks/swr/use-admin";
import { Input } from "@/components/ui/input";
import { Search, Building2, Loader2, X } from "lucide-react";

export function OrgPicker({
  selected,
  onSelect,
}: {
  selected: AdminOrgSearchResult | null;
  onSelect: (org: AdminOrgSearchResult | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const debounced = useDebounce(query, 300);
  const { results, isLoading } = useAdminOrgSearch(debounced);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Building2 className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{selected.name}</p>
            <p className="truncate text-xs text-muted-foreground">{selected.owner_email}</p>
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 text-xs font-medium text-primary hover:underline"
          onClick={() => onSelect(null)}
        >
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Buscar por nombre del negocio o email del dueño…"
          className="pl-9"
        />
        {isLoading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      {focused && debounced.trim().length > 0 && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          {isLoading ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Sin resultados</p>
          ) : (
            results.map((org) => (
              <button
                key={org.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => { onSelect(org); setQuery(""); }}
              >
                <Building2 className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{org.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{org.owner_email}</p>
                </div>
                {org.plan_name && <span className="shrink-0 text-xs text-muted-foreground">{org.plan_name}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Variante multi-selección ────────────────────────────────────────────
// Para patrocinar un lote de organizaciones de una — ver
// app/api/admin/partners/[id]/sponsor/route.ts. Muestra los ya elegidos
// como chips removibles arriba del buscador.
export function MultiOrgPicker({
  selected,
  onChange,
}: {
  selected: AdminOrgSearchResult[];
  onChange: (orgs: AdminOrgSearchResult[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const debounced = useDebounce(query, 300);
  const { results, isLoading } = useAdminOrgSearch(debounced);

  const selectedIds = new Set(selected.map((o) => o.id));
  const add = (org: AdminOrgSearchResult) => {
    if (!selectedIds.has(org.id)) onChange([...selected, org]);
    setQuery("");
  };
  const remove = (orgId: number) => onChange(selected.filter((o) => o.id !== orgId));

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((org) => (
            <span key={org.id} className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
              <Building2 className="size-3 text-muted-foreground" />
              {org.name}
              <button type="button" onClick={() => remove(org.id)} className="text-muted-foreground hover:text-foreground">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Buscar y agregar organizaciones…"
            className="pl-9"
          />
          {isLoading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>

        {focused && debounced.trim().length > 0 && (
          <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
            {isLoading ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">Buscando…</p>
            ) : results.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">Sin resultados</p>
            ) : (
              results.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  disabled={selectedIds.has(org.id)}
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
                  onClick={() => add(org)}
                >
                  <Building2 className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{org.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{org.owner_email}</p>
                  </div>
                  {selectedIds.has(org.id) && <span className="shrink-0 text-xs text-muted-foreground">Agregada</span>}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";

// Idéntico a components/shared/hikonta-icon.tsx en hikonta-partners —
// mismo asset (public/icon.svg), copiado tal cual.
export function HiKontaIcon({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="HiKonta"
      className={cn("shrink-0 bg-[url('/icon.svg')] bg-contain bg-center bg-no-repeat", className)}
    />
  );
}

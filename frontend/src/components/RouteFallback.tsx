import { Loader2 } from "lucide-react";

/** Shown while a lazily loaded route chunk arrives. Says what it is waiting for. */
export function RouteFallback() {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">Abriendo la sección…</p>
    </div>
  );
}

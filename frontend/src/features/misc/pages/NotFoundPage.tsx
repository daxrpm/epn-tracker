import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth.store";

/**
 * Unknown routes used to redirect silently to the public calculator, which reads as the app
 * losing your place. This says what happened and offers the way back.
 */
export function NotFoundPage() {
  const isAuthenticated = useAuthStore((state) => state.status === "authenticated");
  const home = isAuthenticated ? "/app/dashboard" : "/";

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-5 px-5 text-center">
      <p className="font-mono text-sm tracking-wide text-muted-foreground">404</p>
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold">Esta página no existe</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Puede que el enlace esté mal escrito o que la sección se haya movido.
        </p>
      </div>
      <Button asChild>
        <Link to={home}>{isAuthenticated ? "Ir a mi panel" : "Ir a la calculadora"}</Link>
      </Button>
    </div>
  );
}

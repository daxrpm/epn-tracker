import { Outlet } from "react-router-dom";

import { AuroraBackground } from "@/components/aceternity/aurora-background";

/** Layout for unauthenticated pages: a calm Aurora backdrop with a centered card. */
export function AuthLayout() {
  return (
    <AuroraBackground>
      <main className="relative z-10 flex w-full max-w-md flex-col gap-6 px-6 py-10">
        <header className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">EPN Notas Mallas</h1>
          <p className="mt-1 text-sm text-slate-600">
            Controla tus notas, tu malla y tus simulaciones.
          </p>
        </header>
        <Outlet />
      </main>
    </AuroraBackground>
  );
}

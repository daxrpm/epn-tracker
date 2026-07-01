import { Spinner } from "@heroui/react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuthStore } from "@/stores/auth.store";

/** Gate for authenticated routes. Waits for bootstrap, then redirects if unauthenticated. */
export function ProtectedRoute() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === "idle") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Cargando…" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

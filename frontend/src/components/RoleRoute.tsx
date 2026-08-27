import { Navigate, Outlet } from "react-router-dom";

import type { UserRole } from "@/lib/api/types";
import { useAuthStore } from "@/stores/auth.store";

/**
 * Route-level role gate.
 *
 * The four admin pages each carried their own copy of this check, with two different conditions
 * between them. One guard on the route is one place to get it right. The API enforces the same
 * rules independently; this only keeps a student from landing on a screen that would 403.
 */
export function RoleRoute({ roles }: { roles: UserRole[] }) {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);

  // ProtectedRoute already waited for bootstrap, but a null user here would otherwise fall
  // through and render the admin screen for an instant.
  if (status !== "authenticated" || user == null) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <Outlet />;
}

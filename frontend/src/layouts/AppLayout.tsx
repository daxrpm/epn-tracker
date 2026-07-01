import { Button } from "@heroui/react";
import { NavLink, Outlet } from "react-router-dom";

import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/stores/auth.store";

const NAV_ITEMS = [
  { to: "/app/dashboard", label: "Inicio" },
  { to: "/app/calculadora", label: "Calculadora" },
];

/** Authenticated shell: minimal top bar + routed content. */
export function AppLayout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-default-100">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <span className="text-sm font-semibold tracking-tight">EPN Notas Mallas</span>
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "rounded-md px-3 py-1.5 text-sm text-default-500 transition-colors hover:text-foreground",
                      isActive && "bg-default-100 text-foreground",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-default-500 sm:inline">{user?.email}</span>
            <ThemeToggle />
            <Button size="sm" variant="flat" onPress={() => void logout()}>
              Salir
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

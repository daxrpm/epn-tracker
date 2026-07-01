import {
  Calculator,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Network,
} from "lucide-react";
import { useState } from "react";
import { Link, Outlet } from "react-router-dom";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { useAuthStore } from "@/stores/auth.store";

const NAV_LINKS = [
  { label: "Inicio", href: "/app/dashboard", icon: <LayoutDashboard className="size-5 shrink-0" /> },
  { label: "Malla", href: "/app/curriculum", icon: <Network className="size-5 shrink-0" /> },
  { label: "Requisitos", href: "/app/requisitos", icon: <ListChecks className="size-5 shrink-0" /> },
  { label: "Calculadora", href: "/app/calculadora", icon: <Calculator className="size-5 shrink-0" /> },
];

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-1 flex-col overflow-hidden">
            <Link to="/app/dashboard" className="flex items-center gap-2 py-1">
              <GraduationCap className="size-6 shrink-0 text-primary" />
              {open && <span className="whitespace-pre font-semibold">EPN Notas</span>}
            </Link>
            <nav className="mt-8 flex flex-col gap-2">
              {NAV_LINKS.map((link) => (
                <SidebarLink key={link.href} link={link} as={Link} />
              ))}
            </nav>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="flex items-center justify-start gap-2 py-2 text-sm text-neutral-700 dark:text-neutral-200"
          >
            <LogOut className="size-5 shrink-0" />
            {open && <span className="whitespace-pre">Salir</span>}
          </button>
        </SidebarBody>
      </Sidebar>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-end gap-3 border-b border-border px-6">
          <span className="hidden text-sm text-muted-foreground sm:inline">{user?.email}</span>
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={() => void logout()}>
            Salir
          </Button>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import {
  Calculator,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  Loader2,
  LogOut,
  Menu,
  Network,
  NotebookPen,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";

import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/features/student/hooks";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles?: string[];
};

const NAV_LINKS: NavItem[] = [
  { label: "Inicio", href: "/app/dashboard", icon: LayoutDashboard },
  { label: "Malla", href: "/app/curriculum", icon: Network },
  { label: "Simulador", href: "/app/simulacion", icon: GitBranch },
  { label: "Notas", href: "/app/notas", icon: NotebookPen },
  { label: "Requisitos", href: "/app/requisitos", icon: ListChecks },
  { label: "Calculadora", href: "/app/calculadora", icon: Calculator },
  { label: "Consola", href: "/app/admin", icon: ShieldCheck, roles: ["ADMIN", "SUPER_ADMIN"] },
  { label: "Ajustes", href: "/app/ajustes", icon: Settings2 },
];

const ONBOARDING_PATH = "/app/onboarding";

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const profileQuery = useProfile();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  // Force first-time users through onboarding until they pick a carrera + pénsum.
  // (Kept after every hook so the hook order never changes between renders.)
  if (profileQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const needsOnboarding =
    profileQuery.data != null && profileQuery.data.current_curriculum_id == null;
  if (needsOnboarding && location.pathname !== ONBOARDING_PATH) {
    return <Navigate to={ONBOARDING_PATH} replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border/70 bg-background/90 backdrop-blur-xl md:block">
        <SidebarContent email={user?.email} role={user?.role} onLogout={() => void logout()} />
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Cerrar menú"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="fixed inset-y-0 left-0 z-50 w-[min(84vw,20rem)] border-r border-border bg-background shadow-2xl md:hidden"
              aria-label="Navegación principal"
            >
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="absolute right-4 top-4 grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Cerrar menú"
              >
                <X className="size-5" />
              </button>
              <SidebarContent email={user?.email} role={user?.role} onLogout={() => void logout()} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="min-h-screen md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="size-5" />
            </Button>
            <div className="min-w-0 md:hidden">
              <p className="truncate text-sm font-semibold">EPN Notas</p>
              <p className="truncate text-xs text-muted-foreground">Panel académico</p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden max-w-64 truncate text-sm text-muted-foreground sm:block">
              {user?.email}
            </span>
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  email,
  role,
  onLogout,
}: {
  email?: string;
  role?: string;
  onLogout: () => void;
}) {
  const links = NAV_LINKS.filter((link) => !link.roles || (role != null && link.roles.includes(role)));
  return (
    <div className="relative flex h-full flex-col overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,color-mix(in_oklch,var(--foreground)_6%,transparent),transparent_34%)]" />
      <Link to="/app/dashboard" className="relative flex h-12 items-center gap-3 px-2">
        <BrandMark className="size-5" />
        <div>
          <p className="text-sm font-semibold tracking-tight">EPN Notas</p>
          <p className="text-[11px] text-muted-foreground">Tu progreso académico</p>
        </div>
      </Link>

      <nav className="relative mt-7 space-y-1" aria-label="Principal">
        {links.map(({ label, href, icon: Icon }) => (
          <NavLink
            key={href}
            to={href}
            className={({ isActive }) =>
              cn(
                "group flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
                isActive && "bg-muted text-foreground shadow-sm",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn("size-4.5", isActive && "text-foreground")} />
                <span>{label}</span>
                {isActive && <span className="ml-auto size-1.5 rounded-full bg-foreground" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="relative mt-auto border-t border-border/70 pt-4">
        {email && (
          <div className="mb-3 min-w-0 rounded-lg bg-muted/50 px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">Sesión iniciada</p>
            <p className="truncate text-xs font-medium" title={email}>{email}</p>
          </div>
        )}
        <button
          type="button"
          onClick={onLogout}
          className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-4.5" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

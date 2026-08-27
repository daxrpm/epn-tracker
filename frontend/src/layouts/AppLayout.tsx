import {
  Calculator,
  GitBranch,
  LayoutDashboard,
  Library,
  ListChecks,
  Loader2,
  LogOut,
  Menu,
  Network,
  NotebookPen,
  RotateCw,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";

import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/features/student/hooks";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles?: string[];
};

const NAV_LINKS: NavItem[] = [
  { label: "Inicio", href: "/app/dashboard", icon: LayoutDashboard },
  { label: "Malla", href: "/app/curriculum", icon: Network },
  { label: "Notas", href: "/app/notas", icon: NotebookPen },
  { label: "Simulador", href: "/app/simulacion", icon: GitBranch },
  { label: "Requisitos", href: "/app/requisitos", icon: ListChecks },
  { label: "Recursos", href: "/app/recursos", icon: Library },
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

  // Kept after every hook so the hook order never changes between renders.
  if (profileQuery.isLoading) {
    return <ShellFallback>Cargando tu perfil…</ShellFallback>;
  }

  // A failed profile fetch used to fall through and render the whole app with no data.
  if (profileQuery.isError) {
    return (
      <ShellFallback>
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          No pudimos cargar tu perfil. Revisa tu conexión y vuelve a intentarlo.
        </p>
        <Button variant="outline" size="sm" onClick={() => void profileQuery.refetch()}>
          <RotateCw /> Reintentar
        </Button>
      </ShellFallback>
    );
  }

  const needsOnboarding = profileQuery.data?.current_curriculum_id == null;
  if (needsOnboarding && location.pathname !== ONBOARDING_PATH) {
    return <Navigate to={ONBOARDING_PATH} replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-sm focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Saltar al contenido
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-card md:block">
        <SidebarContent email={user?.email} role={user?.role} onLogout={() => void logout()} />
      </aside>

      {/* The drawer is a CSS transition rather than an animation library: one slide is not
          worth 97 KB, and `prefers-reduced-motion` already neutralises it in the stylesheet. */}
      <div
        aria-hidden={!mobileOpen}
        className={cn(
          "fixed inset-0 z-40 bg-foreground/40 transition-opacity duration-200 md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        aria-label="Navegación principal"
        aria-hidden={!mobileOpen}
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[min(82vw,17rem)] border-r border-border bg-card shadow-lg transition-transform duration-200 ease-out md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          tabIndex={mobileOpen ? 0 : -1}
          className="absolute top-3 right-3 grid size-9 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Cerrar menú"
        >
          <X className="size-5" />
        </button>
        <SidebarContent email={user?.email} role={user?.role} onLogout={() => void logout()} />
      </aside>

      <div className="min-h-screen md:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="size-5" />
            </Button>
            <span className="truncate font-heading text-sm font-semibold md:hidden">
              EPN Notas
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden max-w-56 truncate text-sm text-muted-foreground sm:block">
              {user?.email}
            </span>
            <ThemeToggle />
          </div>
        </header>

        <main
          id="contenido"
          className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function ShellFallback({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6">
      <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
      {typeof children === "string" ? (
        <p className="text-sm text-muted-foreground">{children}</p>
      ) : (
        children
      )}
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
  const links = NAV_LINKS.filter(
    (link) => !link.roles || (role != null && link.roles.includes(role)),
  );

  return (
    <div className="flex h-full flex-col">
      <Link
        to="/app/dashboard"
        className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4"
      >
        <BrandMark className="size-5 text-primary" />
        <span className="font-heading text-base font-semibold tracking-tight">EPN Notas</span>
      </Link>

      <nav className="flex-1 overflow-y-auto py-2" aria-label="Principal">
        {links.map(({ label, href, icon: Icon }) => (
          <NavLink
            key={href}
            to={href}
            className={({ isActive }) =>
              cn(
                "relative flex h-10 items-center gap-3 px-4 text-sm transition-colors",
                isActive
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* The margin rule of a notebook page: it marks where you are, and only ever
                    appears on one item at a time. */}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-sm bg-primary"
                  />
                )}
                <Icon
                  className={cn("size-4.5", isActive ? "text-primary" : "text-current")}
                  aria-hidden
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border p-3">
        {email && (
          <p className="mb-2 truncate px-1 text-xs text-muted-foreground" title={email}>
            {email}
          </p>
        )}
        <button
          type="button"
          onClick={onLogout}
          className="flex h-9 w-full items-center gap-3 rounded-sm px-1 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-4.5" aria-hidden />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

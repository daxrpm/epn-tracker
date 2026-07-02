import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = Exclude<Theme, "system">;

interface ThemeState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
  syncSystemTheme: () => void;
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Apply the resolved class read by shadcn, Aceternity and HeroUI. */
function applyThemeClass(theme: Theme): ResolvedTheme {
  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolvedTheme);
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
  return resolvedTheme;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "system",
      resolvedTheme: getSystemTheme(),
      setTheme: (theme) => {
        const resolvedTheme = applyThemeClass(theme);
        set({ theme, resolvedTheme });
      },
      toggle: () => get().setTheme(get().resolvedTheme === "light" ? "dark" : "light"),
      syncSystemTheme: () => {
        if (get().theme !== "system") return;
        set({ resolvedTheme: applyThemeClass("system") });
      },
    }),
    {
      name: "epn.theme",
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        if (state) state.setTheme(state.theme);
      },
    },
  ),
);

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

/** Apply the theme class HeroUI reads (`light` / `dark`) to the <html> element. */
function applyThemeClass(theme: Theme): void {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "light",
      setTheme: (theme) => {
        applyThemeClass(theme);
        set({ theme });
      },
      toggle: () => get().setTheme(get().theme === "light" ? "dark" : "light"),
    }),
    {
      name: "epn.theme",
      onRehydrateStorage: () => (state) => {
        // Re-apply the persisted theme once it is loaded from storage.
        if (state) applyThemeClass(state.theme);
      },
    },
  ),
);

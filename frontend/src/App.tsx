import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { env } from "@/config/env";
import { queryClient } from "@/lib/query";
import { router } from "@/router";
import { useAuthStore } from "@/stores/auth.store";
import { useThemeStore } from "@/stores/theme.store";

export function App() {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const syncSystemTheme = useThemeStore((state) => state.syncSystemTheme);

  // Restore the session once on startup (uses the persisted refresh token).
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Ensure the theme class is applied to <html> on first mount.
  useEffect(() => {
    setTheme(theme);
  }, [theme, setTheme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", syncSystemTheme);
    return () => media.removeEventListener("change", syncSystemTheme);
  }, [syncSystemTheme]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <RouterProvider router={router} />
        <Toaster richColors position="top-center" />
        {env.isDev && <ReactQueryDevtools initialIsOpen={false} />}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

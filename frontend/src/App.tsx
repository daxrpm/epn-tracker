import { HeroUIProvider } from "@heroui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";

import { env } from "@/config/env";
import { queryClient } from "@/lib/query";
import { router } from "@/router";
import { useAuthStore } from "@/stores/auth.store";
import { useThemeStore } from "@/stores/theme.store";

export function App() {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  // Restore the session once on startup (uses the persisted refresh token).
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Ensure the theme class is applied to <html> on first mount.
  useEffect(() => {
    setTheme(theme);
  }, [theme, setTheme]);

  return (
    <HeroUIProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        {env.isDev && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </HeroUIProvider>
  );
}

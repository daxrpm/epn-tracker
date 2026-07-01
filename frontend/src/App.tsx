import { HeroUIProvider } from "@heroui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";

import { env } from "@/config/env";
import { queryClient } from "@/lib/query";
import { router } from "@/router";
import { useAuthStore } from "@/stores/auth.store";

export function App() {
  const bootstrap = useAuthStore((state) => state.bootstrap);

  // Restore the session once on startup (uses the persisted refresh token).
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <HeroUIProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        {env.isDev && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </HeroUIProvider>
  );
}

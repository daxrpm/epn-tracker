import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./api/types";

/** Shared React Query client with sensible defaults for an authenticated SPA. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Never retry auth/validation errors; they will not succeed on retry.
        if (error instanceof ApiError && [400, 401, 403, 404, 422].includes(error.status)) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

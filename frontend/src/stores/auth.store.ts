import { create } from "zustand";

import { apiClient, setAuthFailureHandler } from "@/lib/api/client";
import { tokenStorage } from "@/lib/api/token-storage";
import type { CurrentUser, TokenPair } from "@/lib/api/types";

type AuthStatus = "idle" | "authenticated" | "unauthenticated";

interface AuthState {
  user: CurrentUser | null;
  status: AuthStatus;
  /** Restore the session on app start using the persisted refresh token. */
  bootstrap: () => Promise<void>;
  /** Persist a fresh token pair and load the current user. */
  setSession: (tokens: TokenPair) => Promise<void>;
  logout: () => Promise<void>;
}

async function fetchCurrentUser(): Promise<CurrentUser> {
  const { data } = await apiClient.get<CurrentUser>("/auth/me");
  return data;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "idle",

  bootstrap: async () => {
    if (!tokenStorage.hasSession()) {
      set({ status: "unauthenticated", user: null });
      return;
    }
    try {
      const user = await fetchCurrentUser();
      set({ user, status: "authenticated" });
    } catch {
      tokenStorage.clear();
      set({ user: null, status: "unauthenticated" });
    }
  },

  setSession: async (tokens) => {
    tokenStorage.setTokens(tokens);
    const user = await fetchCurrentUser();
    set({ user, status: "authenticated" });
  },

  logout: async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    tokenStorage.clear();
    set({ user: null, status: "unauthenticated" });
    // Best-effort server-side revocation; ignore failures.
    try {
      await apiClient.post("/auth/logout", { refresh_token: refreshToken });
    } catch {
      /* already logged out locally */
    }
  },
}));

// When the client gives up refreshing, force the store into an unauthenticated state.
setAuthFailureHandler(() => {
  useAuthStore.setState({ user: null, status: "unauthenticated" });
});

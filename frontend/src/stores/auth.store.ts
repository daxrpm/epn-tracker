import { create } from "zustand";

import { apiClient, refreshSession, setAuthFailureHandler } from "@/lib/api/client";
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

/** In-flight bootstrap, shared by every caller. See `bootstrap` for why this matters. */
let bootstrapPromise: Promise<void> | null = null;

async function runBootstrap(set: (partial: Partial<AuthState>) => void): Promise<void> {
  if (!tokenStorage.hasSession()) {
    set({ status: "unauthenticated", user: null });
    return;
  }
  try {
    // The access token lives in memory only, so after a reload there is none. Refreshing first
    // turns "every parallel query 401s and retries" into a single request.
    if (!tokenStorage.getAccessToken()) {
      await refreshSession();
    }
    const user = await fetchCurrentUser();
    set({ user, status: "authenticated" });
  } catch {
    tokenStorage.clear();
    set({ user: null, status: "unauthenticated" });
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "idle",

  bootstrap: async () => {
    // Bootstrapping twice concurrently is a real hazard, not just waste: React StrictMode runs
    // the effect twice in development, both runs read the same refresh token, and the second
    // rotation presents a jti the first already consumed — which the backend correctly treats
    // as token reuse and answers by revoking every session. Sharing one promise makes the
    // second caller wait for the first instead of racing it.
    bootstrapPromise ??= runBootstrap(set).finally(() => {
      bootstrapPromise = null;
    });
    return bootstrapPromise;
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

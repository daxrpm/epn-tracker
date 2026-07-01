/**
 * Token storage strategy.
 *
 * - Access token: kept in memory only (not persisted) to minimise XSS exposure.
 * - Refresh token: persisted in localStorage so the session survives reloads. The backend rotates
 *   refresh tokens and detects reuse, which limits the blast radius of a leaked refresh token.
 *
 * Upgrade path for higher security: move the refresh token to an httpOnly, Secure, SameSite cookie
 * issued by the backend and drop the localStorage usage here.
 */
import type { TokenPair } from "./types";

const REFRESH_KEY = "epn.refresh_token";

let accessToken: string | null = null;

export const tokenStorage = {
  getAccessToken(): string | null {
    return accessToken;
  },
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  setTokens(tokens: TokenPair): void {
    accessToken = tokens.access_token;
    localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
  },
  clear(): void {
    accessToken = null;
    localStorage.removeItem(REFRESH_KEY);
  },
  hasSession(): boolean {
    return Boolean(this.getRefreshToken());
  },
};

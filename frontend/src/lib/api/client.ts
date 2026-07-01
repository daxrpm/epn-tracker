/**
 * Central HTTP client.
 *
 * Responsibilities:
 * - Attach the access token to every request.
 * - Transparently refresh an expired access token once (single-flight) and retry the request.
 * - Normalise backend error envelopes into `ApiError` so feature code stays clean.
 */
import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

import { env } from "@/config/env";

import { tokenStorage } from "./token-storage";
import { ApiError, type ApiErrorResponse, type TokenPair } from "./types";

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

/** Bare instance without interceptors, used for the refresh call to avoid recursion. */
const bareClient: AxiosInstance = axios.create({ baseURL: env.apiBaseUrl });

export const apiClient: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Ensures concurrent 401s trigger a single refresh instead of a stampede.
let refreshPromise: Promise<TokenPair> | null = null;

async function refreshTokens(): Promise<TokenPair> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }
  const { data } = await bareClient.post<TokenPair>("/auth/refresh", {
    refresh_token: refreshToken,
  });
  tokenStorage.setTokens(data);
  return data;
}

/** Hook invoked when the session cannot be recovered (set by the auth store). */
let onAuthFailure: (() => void) | null = null;
export function setAuthFailureHandler(handler: () => void): void {
  onAuthFailure = handler;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    if (status === 401 && original && !original._retry && tokenStorage.getRefreshToken()) {
      original._retry = true;
      try {
        refreshPromise ??= refreshTokens();
        await refreshPromise;
        refreshPromise = null;
        original.headers.Authorization = `Bearer ${tokenStorage.getAccessToken()}`;
        return apiClient(original);
      } catch (refreshError) {
        refreshPromise = null;
        tokenStorage.clear();
        onAuthFailure?.();
        return Promise.reject(toApiError(refreshError));
      }
    }

    return Promise.reject(toApiError(error));
  },
);

function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiErrorResponse | undefined;
    const status = error.response?.status ?? 0;
    if (body?.error) {
      return new ApiError(body.error.code, body.error.message, status, body.error.details);
    }
    return new ApiError("NETWORK_ERROR", error.message || "Error de red.", status);
  }
  return new ApiError("UNKNOWN_ERROR", "Ocurrió un error inesperado.", 0);
}

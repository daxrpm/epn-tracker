/**
 * Typed access to build-time environment variables.
 * Keep every `import.meta.env` read behind this module so config is centralised and validated.
 */
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
  isDev: import.meta.env.DEV,
} as const;

/** Shared API contract types mirroring the backend response envelope (ERS §26). */

export interface ApiErrorDetail {
  field?: string | null;
  message: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details: ApiErrorDetail[];
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export type UserRole = "STUDENT" | "ADMIN" | "SUPER_ADMIN";

export interface CurrentUser {
  id: string;
  email: string;
  role: UserRole;
  is_verified: boolean;
}

/** Normalised error thrown by the API client so UI code never touches Axios internals. */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

import { apiClient } from "@/lib/api/client";
import type { TokenPair } from "@/lib/api/types";

import type { LoginInput, RequestCodeInput, VerifyCodeInput } from "./schemas";

interface MessageResponse {
  message: string;
}

/** Typed wrappers around the backend auth endpoints (ERS §17.1). */
export const authApi = {
  async requestCode(input: RequestCodeInput): Promise<MessageResponse> {
    const { data } = await apiClient.post<MessageResponse>(
      "/auth/register/request-code",
      input,
    );
    return data;
  },

  async verifyCode(input: VerifyCodeInput): Promise<TokenPair> {
    const { data } = await apiClient.post<TokenPair>("/auth/register/verify-code", input);
    return data;
  },

  async login(input: LoginInput): Promise<TokenPair> {
    const { data } = await apiClient.post<TokenPair>("/auth/login", input);
    return data;
  },
};

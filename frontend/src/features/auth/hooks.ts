import { useMutation } from "@tanstack/react-query";

import { useAuthStore } from "@/stores/auth.store";

import { authApi } from "./api";
import type { LoginInput, RequestCodeInput, VerifyCodeInput } from "./schemas";

export function useRequestCode() {
  return useMutation({
    mutationFn: (input: RequestCodeInput) => authApi.requestCode(input),
  });
}

export function useVerifyCode() {
  const setSession = useAuthStore((state) => state.setSession);
  return useMutation({
    mutationFn: async (input: VerifyCodeInput) => {
      const tokens = await authApi.verifyCode(input);
      await setSession(tokens);
    },
  });
}

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession);
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const tokens = await authApi.login(input);
      await setSession(tokens);
    },
  });
}

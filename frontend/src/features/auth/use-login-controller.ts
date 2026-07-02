import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";

import { ApiError } from "@/lib/api/types";

import { useLogin } from "./hooks";
import { loginSchema, type LoginInput } from "./schemas";

interface LoginLocationState {
  from?: string;
}

export function useLoginController() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      const destination = (location.state as LoginLocationState | null)?.from ?? "/app/dashboard";
      navigate(destination, { replace: true });
    } catch {
      // React Query exposes the normalized error below; avoid an unhandled promise rejection.
    }
  });

  return {
    form,
    login,
    onSubmit,
    serverError: login.error instanceof ApiError ? login.error.message : null,
  };
}

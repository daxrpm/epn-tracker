import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, CardBody, Input, Link } from "@heroui/react";
import { useForm } from "react-hook-form";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { ApiError } from "@/lib/api/types";

import { useLogin } from "../hooks";
import { loginSchema, type LoginInput } from "../schemas";

export function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    await login.mutateAsync(values);
    navigate("/app/dashboard", { replace: true });
  });

  const serverError = login.error instanceof ApiError ? login.error.message : null;

  return (
    <Card className="border border-slate-100 shadow-sm">
      <CardBody className="gap-4 p-6">
        <h2 className="text-lg font-medium">Iniciar sesión</h2>
        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <Input
            type="email"
            label="Correo institucional"
            placeholder="tu.nombre@epn.edu.ec"
            variant="bordered"
            isInvalid={Boolean(errors.email)}
            errorMessage={errors.email?.message}
            {...register("email")}
          />
          <Input
            type="password"
            label="Contraseña"
            variant="bordered"
            isInvalid={Boolean(errors.password)}
            errorMessage={errors.password?.message}
            {...register("password")}
          />
          {serverError && <p className="text-sm text-danger">{serverError}</p>}
          <Button type="submit" color="primary" isLoading={login.isPending} fullWidth>
            Entrar
          </Button>
        </form>
        <p className="text-center text-sm text-slate-500">
          ¿No tienes cuenta?{" "}
          <Link as={RouterLink} to="/registro" size="sm">
            Regístrate
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}

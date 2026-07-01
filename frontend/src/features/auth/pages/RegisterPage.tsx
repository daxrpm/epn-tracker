import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, CardBody, Input, Link } from "@heroui/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { ApiError } from "@/lib/api/types";

import { useRequestCode, useVerifyCode } from "../hooks";
import { requestCodeSchema, verifyCodeSchema, type VerifyCodeInput } from "../schemas";

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  if (!email) {
    return <RequestStep onSent={setEmail} />;
  }
  return <VerifyStep email={email} onDone={() => navigate("/app/dashboard", { replace: true })} />;
}

function RequestStep({ onSent }: { onSent: (email: string) => void }) {
  const requestCode = useRequestCode();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ email: string }>({ resolver: zodResolver(requestCodeSchema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    await requestCode.mutateAsync({ email });
    onSent(email);
  });

  const serverError = requestCode.error instanceof ApiError ? requestCode.error.message : null;

  return (
    <Card className="border border-slate-100 shadow-sm">
      <CardBody className="gap-4 p-6">
        <h2 className="text-lg font-medium">Crear cuenta</h2>
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
          {serverError && <p className="text-sm text-danger">{serverError}</p>}
          <Button type="submit" color="primary" isLoading={requestCode.isPending} fullWidth>
            Enviar código
          </Button>
        </form>
        <p className="text-center text-sm text-slate-500">
          ¿Ya tienes cuenta?{" "}
          <Link as={RouterLink} to="/login" size="sm">
            Inicia sesión
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}

function VerifyStep({ email, onDone }: { email: string; onDone: () => void }) {
  const verifyCode = useVerifyCode();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyCodeInput>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: { email },
  });

  const onSubmit = handleSubmit(async (values) => {
    await verifyCode.mutateAsync(values);
    onDone();
  });

  const serverError = verifyCode.error instanceof ApiError ? verifyCode.error.message : null;

  return (
    <Card className="border border-slate-100 shadow-sm">
      <CardBody className="gap-4 p-6">
        <h2 className="text-lg font-medium">Verifica tu correo</h2>
        <p className="text-sm text-slate-500">
          Enviamos un código a <span className="font-medium">{email}</span>.
        </p>
        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <input type="hidden" value={email} {...register("email")} />
          <Input
            label="Código de verificación"
            variant="bordered"
            isInvalid={Boolean(errors.code)}
            errorMessage={errors.code?.message}
            {...register("code")}
          />
          <Input
            type="password"
            label="Crea una contraseña"
            variant="bordered"
            isInvalid={Boolean(errors.password)}
            errorMessage={errors.password?.message}
            {...register("password")}
          />
          {serverError && <p className="text-sm text-danger">{serverError}</p>}
          <Button type="submit" color="primary" isLoading={verifyCode.isPending} fullWidth>
            Crear cuenta
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

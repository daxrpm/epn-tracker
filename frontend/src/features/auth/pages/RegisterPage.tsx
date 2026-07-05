import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <Card>
      <CardContent className="flex flex-col gap-5 p-6">
        <h2 className="text-lg font-semibold">Crear cuenta</h2>
        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Correo institucional</Label>
            <Input
              id="email"
              type="email"
              placeholder="tu.nombre@epn.edu.ec"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <Button type="submit" className="w-full" disabled={requestCode.isPending}>
            {requestCode.isPending && <Loader2 className="size-4 animate-spin" />}
            Enviar código
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function VerifyStep({ email, onDone }: { email: string; onDone: () => void }) {
  const verifyCode = useVerifyCode();
  const resendCode = useRequestCode();
  const [cooldown, setCooldown] = useState(0);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyCodeInput>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: { email },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const onSubmit = handleSubmit(async (values) => {
    await verifyCode.mutateAsync(values);
    onDone();
  });

  async function resend() {
    try {
      await resendCode.mutateAsync({ email });
      setCooldown(60);
      toast.success("Te reenviamos un código.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo reenviar el código.");
    }
  }

  const serverError = verifyCode.error instanceof ApiError ? verifyCode.error.message : null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-6">
        <div>
          <h2 className="text-lg font-semibold">Verifica tu correo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enviamos un código a <span className="font-medium text-foreground">{email}</span>.
          </p>
        </div>
        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <input type="hidden" value={email} {...register("email")} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code">Código de verificación</Label>
            <Input id="code" aria-invalid={Boolean(errors.code)} {...register("code")} />
            {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Crea una contraseña</Label>
            <Input
              id="password"
              type="password"
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <Button type="submit" className="w-full" disabled={verifyCode.isPending}>
            {verifyCode.isPending && <Loader2 className="size-4 animate-spin" />}
            Crear cuenta
          </Button>
          <button
            type="button"
            onClick={() => void resend()}
            disabled={cooldown > 0 || resendCode.isPending}
            className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline disabled:no-underline disabled:opacity-60"
          >
            {cooldown > 0 ? `Reenviar código en ${cooldown}s` : "Reenviar código"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}

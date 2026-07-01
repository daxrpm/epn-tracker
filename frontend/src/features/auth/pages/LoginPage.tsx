import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useLoginController } from "../use-login-controller";

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const { form, login, onSubmit, serverError } = useLoginController();
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <section aria-labelledby="login-title">
      <BrandMark className="mb-6" />
      <h1 id="login-title" className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
        Qué bueno verte de nuevo
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground sm:text-base">
        Inicia sesión para guardar tus notas, seguir tu malla y preparar tu próxima matrícula.
      </p>

      <form className="mt-8 space-y-5" onSubmit={onSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">
            Correo institucional
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="tu.nombre@epn.edu.ec"
            className="h-11 border-border/70 bg-muted/55 px-3.5"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : "email-hint"}
            {...register("email")}
          />
          {errors.email ? (
            <p id="email-error" className="text-sm text-destructive" role="alert">
              {errors.email.message}
            </p>
          ) : (
            <p id="email-hint" className="text-xs text-muted-foreground">
              Usa tu cuenta terminada en @epn.edu.ec.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium">
            Contraseña
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Ingresa tu contraseña"
              className="h-11 border-border/70 bg-muted/55 px-3.5 pr-11"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="text-sm text-destructive" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        {serverError && (
          <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive" role="alert">
            {serverError}
          </p>
        )}

        <Button type="submit" size="lg" className="h-11 w-full" disabled={login.isPending}>
          {login.isPending ? <Loader2 className="animate-spin" /> : null}
          {login.isPending ? "Iniciando sesión…" : "Iniciar sesión"}
        </Button>
      </form>

      <div className="my-7 flex items-center gap-4 text-xs text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        o
        <span className="h-px flex-1 bg-border" />
      </div>

      <p className="text-center text-sm text-muted-foreground">
        ¿Aún no tienes cuenta?{" "}
        <Link to="/registro" className="font-medium text-foreground hover:underline">
          Crear cuenta
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Comparar con{" "}
        <Link to="/login/hero" className="font-medium text-foreground hover:underline">
          la versión HeroUI
        </Link>
      </p>
    </section>
  );
}

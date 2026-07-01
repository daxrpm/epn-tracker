import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import { Input } from "@heroui/input";
import { HeroUIProvider } from "@heroui/system";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { BrandMark } from "@/components/BrandMark";

import { useLoginController } from "../use-login-controller";

export function HeroLoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const { form, login, onSubmit, serverError } = useLoginController();
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <HeroUIProvider>
    <section aria-labelledby="hero-login-title">
      <div className="mb-6 flex items-center justify-between">
        <BrandMark />
        <span className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
          HeroUI
        </span>
      </div>
      <h1 id="hero-login-title" className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
        Qué bueno verte de nuevo
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground sm:text-base">
        Inicia sesión para guardar tus notas, seguir tu malla y preparar tu próxima matrícula.
      </p>

      <form className="mt-8 space-y-5" onSubmit={onSubmit} noValidate>
        <Input
          type="email"
          label="Correo institucional"
          labelPlacement="outside"
          placeholder="tu.nombre@epn.edu.ec"
          autoComplete="email"
          variant="flat"
          size="lg"
          radius="sm"
          description={!errors.email ? "Usa tu cuenta terminada en @epn.edu.ec." : undefined}
          isInvalid={Boolean(errors.email)}
          errorMessage={errors.email?.message}
          classNames={{
            label: "font-medium text-foreground",
            inputWrapper: "bg-muted/55 shadow-none group-data-[focus=true]:bg-muted/70",
            input: "placeholder:text-muted-foreground",
          }}
          {...register("email")}
        />

        <Input
          type={showPassword ? "text" : "password"}
          label="Contraseña"
          labelPlacement="outside"
          placeholder="Ingresa tu contraseña"
          autoComplete="current-password"
          variant="flat"
          size="lg"
          radius="sm"
          isInvalid={Boolean(errors.password)}
          errorMessage={errors.password?.message}
          endContent={
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          }
          classNames={{
            label: "font-medium text-foreground",
            inputWrapper: "bg-muted/55 shadow-none group-data-[focus=true]:bg-muted/70",
            input: "placeholder:text-muted-foreground",
          }}
          {...register("password")}
        />

        {serverError && (
          <p className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2.5 text-sm text-danger" role="alert">
            {serverError}
          </p>
        )}

        <Button
          type="submit"
          color="primary"
          size="lg"
          radius="sm"
          className="w-full font-medium"
          isLoading={login.isPending}
        >
          {login.isPending ? "Iniciando sesión…" : "Iniciar sesión"}
        </Button>
      </form>

      <div className="my-7 flex items-center gap-4 text-xs text-muted-foreground">
        <Divider className="flex-1" />
        o
        <Divider className="flex-1" />
      </div>

      <p className="text-center text-sm text-muted-foreground">
        ¿Aún no tienes cuenta?{" "}
        <Link to="/registro" className="font-medium text-foreground hover:underline">
          Crear cuenta
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Comparar con{" "}
        <Link to="/login" className="font-medium text-foreground hover:underline">
          Aceternity + shadcn
        </Link>
      </p>
    </section>
    </HeroUIProvider>
  );
}

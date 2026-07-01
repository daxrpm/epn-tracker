import { z } from "zod";

const EPN_DOMAIN = "@epn.edu.ec";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Ingresa un correo válido.")
  .refine((value) => value.endsWith(EPN_DOMAIN), {
    message: `El correo debe terminar en ${EPN_DOMAIN}.`,
  });

export const requestCodeSchema = z.object({
  email: emailSchema,
});

export const verifyCodeSchema = z.object({
  email: emailSchema,
  code: z.string().trim().min(4, "Código inválido.").max(12),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Ingresa tu contraseña."),
});

export type RequestCodeInput = z.infer<typeof requestCodeSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

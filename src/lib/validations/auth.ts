import { z } from "zod";

/** Client login form (email/password → Firebase Auth). */
export const loginSchema = z.object({
  email: z.string().email("Ingresá un email válido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Server exchange: Firebase ID token → session cookie. */
export const sessionExchangeSchema = z.object({
  idToken: z.string().min(1, "Token de sesión requerido"),
});

export type SessionExchangeInput = z.infer<typeof sessionExchangeSchema>;

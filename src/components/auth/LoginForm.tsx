"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toUserFacingAuthError } from "@/lib/auth/errors";
import { getClientAuth } from "@/lib/firebase/client";
import { type LoginInput, loginSchema } from "@/lib/validations/auth";

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: standardSchemaResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginInput) {
    setServerError(null);

    try {
      const credential = await signInWithEmailAndPassword(
        getClientAuth(),
        values.email,
        values.password,
      );
      const idToken = await credential.user.getIdToken();

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setServerError(data?.error ?? "No se pudo iniciar sesión");
        return;
      }

      router.push("/generate");
      router.refresh();
    } catch (error) {
      setServerError(toUserFacingAuthError(error));
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex w-full flex-col gap-5"
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="admin@kors.com"
          aria-invalid={Boolean(errors.email)}
          disabled={isSubmitting}
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          aria-invalid={Boolean(errors.password)}
          disabled={isSubmitting}
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        ) : null}
      </div>

      {serverError ? (
        <p
          role="alert"
          className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {serverError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Ingresando...
          </>
        ) : (
          "Iniciar sesión"
        )}
      </Button>
    </form>
  );
}

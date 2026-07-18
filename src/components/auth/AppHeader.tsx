"use client";

import { signOut } from "firebase/auth";
import { LogOut } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { getClientAuth } from "@/lib/firebase/client";

export function AppHeader() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });

    try {
      await signOut(getClientAuth());
    } catch {
      // Server cookie already cleared; continue to login.
    }

    window.location.href = "/login";
  }

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src="/assets/brand/logo_madero.png"
            alt="Madero Travel"
            width={120}
            height={40}
            className="h-8 w-auto shrink-0 object-contain sm:h-9"
            priority
          />
          <div className="hidden h-6 w-px bg-border sm:block" aria-hidden />
          <p className="truncate text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Cotizador
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => void logout()}
          aria-label="Cerrar sesión"
        >
          <LogOut />
        </Button>
      </div>
    </header>
  );
}

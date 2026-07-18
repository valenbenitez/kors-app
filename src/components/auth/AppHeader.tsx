"use client";

import { signOut } from "firebase/auth";
import { LogOut } from "lucide-react";
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
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          KORS · Cotizador MVP
        </p>
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

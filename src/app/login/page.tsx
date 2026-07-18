import Image from "next/image";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-full flex-1 items-center justify-center overflow-hidden px-4 py-12">
      {/* Soft navy / gold atmosphere — not a marketing landing */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgb(26_43_76_/_0.08),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgb(197_160_89_/_0.12),_transparent_45%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-accent to-primary"
      />

      <div className="relative w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center space-y-4 text-center">
          <Image
            src="/assets/brand/logo_madero.png"
            alt="Madero Travel"
            width={160}
            height={64}
            priority
            className="h-14 w-auto object-contain"
          />
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
              KORS · Cotizador
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-primary">
              Iniciar sesión
            </h1>
            <p className="text-sm text-muted-foreground">
              Accedé al cotizador para generar propuestas PDF
            </p>
          </div>
        </div>

        <div className="rounded-4xl border border-border bg-card p-6 shadow-sm ring-1 ring-accent/20">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}

"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CotizacionFormInput } from "@/lib/validations/cotizacion";

type PdfPreviewProps = {
  formValues: CotizacionFormInput;
  /** When false, skips fetch and clears the iframe. */
  open: boolean;
};

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; blobUrl: string }
  | { status: "error"; message: string };

/**
 * Fetches the PDF HTML template and shows it in an iframe via a blob URL.
 * Responsive on screen — not an exact A4 layout.
 */
export function PdfPreview({ formValues, open }: PdfPreviewProps) {
  const [state, setState] = useState<PreviewState>({ status: "idle" });
  const blobUrlRef = useRef<string | null>(null);
  const formValuesRef = useRef(formValues);
  formValuesRef.current = formValues;

  useEffect(() => {
    function revokeBlob() {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    }

    if (!open) {
      revokeBlob();
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    void (async () => {
      try {
        const response = await fetch("/api/preview-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formValuesRef.current),
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          if (cancelled) return;
          setState({
            status: "error",
            message:
              data?.error ??
              "No se pudo cargar la vista previa. Intentá de nuevo.",
          });
          return;
        }

        const html = await response.text();
        if (cancelled) return;

        revokeBlob();
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        setState({ status: "ready", blobUrl });
      } catch {
        if (cancelled) return;
        setState({
          status: "error",
          message:
            "No se pudo conectar para la vista previa. Revisá tu conexión.",
        });
      }
    })();

    return () => {
      cancelled = true;
      revokeBlob();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="mt-4 flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Vista previa del documento (puede diferir levemente del PDF final).
      </p>

      {state.status === "loading" || state.status === "idle" ? (
        <output
          className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border bg-muted/30"
          aria-live="polite"
        >
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <span className="sr-only">Cargando vista previa…</span>
        </output>
      ) : null}

      {state.status === "error" ? (
        <p
          role="alert"
          className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.message}
        </p>
      ) : null}

      {state.status === "ready" ? (
        <iframe
          title="Vista previa del PDF"
          src={state.blobUrl}
          className="h-[min(70vh,720px)] w-full rounded-2xl border border-border bg-white"
        />
      ) : null}
    </div>
  );
}

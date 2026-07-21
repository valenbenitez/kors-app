"use client";

import { Loader2, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { UseFormGetValues, UseFormSetValue } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { applyHotelPrefill } from "@/lib/ai/apply-hotel-prefill";
import { applyVueloPrefill } from "@/lib/ai/apply-vuelo-prefill";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  isAllowedImageMime,
  MAX_HOTEL_IMAGES,
  MAX_IMAGE_BYTES,
  MAX_VUELO_IMAGES,
} from "@/lib/ai/constants";
import {
  type ExtractTipo,
  extractQuoteImageResponseSchema,
} from "@/lib/ai/schemas";
import type { CotizacionFormInput } from "@/lib/validations/cotizacion";

const MAX_MB = MAX_IMAGE_BYTES / (1024 * 1024);

export type ImagePrefillUploadProps = {
  tipo: ExtractTipo;
  setValue: UseFormSetValue<CotizacionFormInput>;
  getValues: UseFormGetValues<CotizacionFormInput>;
  /**
   * Adults count for hotel extracts (`paxAdultos` form field).
   * Required when `tipo="hotel"`; ignored for vuelo.
   */
  paxAdultos?: number;
  /**
   * Destino index to prefill when `tipo="hotel"`. Ignored for vuelo.
   */
  destinoIndex?: number;
  /** Called after a successful prefill with form paths that were set. */
  onPrefill?: (filledPaths: string[]) => void;
  className?: string;
};

function validateClientFile(file: File): string | null {
  const mime = file.type.trim().toLowerCase();
  if (mime && !isAllowedImageMime(mime)) {
    return "Formato no soportado. Usá JPEG, PNG o WebP.";
  }
  if (!mime) {
    const name = file.name.toLowerCase();
    const okExt =
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg") ||
      name.endsWith(".png") ||
      name.endsWith(".webp");
    if (!okExt) {
      return "Formato no soportado. Usá JPEG, PNG o WebP.";
    }
  }
  if (file.size <= 0) {
    return "El archivo está vacío.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `La imagen supera el límite de ${MAX_MB} MB.`;
  }
  return null;
}

/**
 * Upload control that calls `/api/extract-quote-image` and prefills the form.
 * Reusable for vuelo and hotel (1..MAX_*_IMAGES) via `tipo`.
 */
export function ImagePrefillUpload({
  tipo,
  setValue,
  getValues,
  paxAdultos,
  destinoIndex,
  onPrefill,
  className,
}: ImagePrefillUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filledLabels, setFilledLabels] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const allowMultiple = true;
  const maxImages = tipo === "hotel" ? MAX_HOTEL_IMAGES : MAX_VUELO_IMAGES;
  const title =
    tipo === "vuelo"
      ? "Prefill desde imagen de vuelo"
      : "Prefill desde imagen de hotel";
  const hint =
    tipo === "vuelo"
      ? `Subí una o más capturas del itinerario (ida y vuelta si hace falta; hasta ${MAX_VUELO_IMAGES}; JPEG, PNG o WebP, máx. ${MAX_MB} MB c/u).`
      : `Subí una o más capturas de la cotización de hotel (hasta ${MAX_HOTEL_IMAGES}; JPEG, PNG o WebP, máx. ${MAX_MB} MB c/u).`;
  const loadingHint =
    tipo === "vuelo" ? "Leyendo itinerario…" : "Leyendo cotización de hotel…";
  const buttonLabel = "Subir imágenes";
  const ariaLabel =
    tipo === "vuelo" ? "Subir imágenes de vuelo" : "Subir imágenes de hotel";

  async function handleFiles(fileList: FileList | File[]) {
    setError(null);
    setFilledLabels([]);
    setWarnings([]);
    onPrefill?.([]);

    const files = Array.from(fileList);
    if (files.length === 0) return;

    if (files.length > maxImages) {
      setError(
        tipo === "hotel"
          ? `Podés subir hasta ${MAX_HOTEL_IMAGES} imágenes de hotel por vez.`
          : `Podés subir hasta ${MAX_VUELO_IMAGES} imágenes de vuelo por vez.`,
      );
      return;
    }

    for (const file of files) {
      const clientError = validateClientFile(file);
      if (clientError) {
        setError(clientError);
        return;
      }
    }

    const pax = Number(paxAdultos);

    if (tipo === "hotel" && (!Number.isFinite(pax) || pax < 1)) {
      setError(
        "Indicá la cantidad de adultos antes de subir la imagen de hotel.",
      );
      return;
    }

    if (
      tipo === "hotel" &&
      (destinoIndex == null ||
        !Number.isInteger(destinoIndex) ||
        destinoIndex < 0)
    ) {
      setError("No hay destino seleccionado para completar el hotel.");
      return;
    }

    setLoading(true);
    try {
      const body = new FormData();
      body.set("tipo", tipo);
      for (const file of files) {
        body.append("image", file);
      }
      if (tipo === "hotel") {
        body.set("paxAdultos", String(pax));
      }
      const destinos = getValues("destinos") ?? [];
      const monedaIndex = tipo === "hotel" ? (destinoIndex ?? 0) : 0;
      const moneda = destinos[monedaIndex]?.moneda;
      if (moneda) {
        body.set("moneda", moneda);
      }

      const res = await fetch("/api/extract-quote-image", {
        method: "POST",
        body,
      });

      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          json &&
          typeof json === "object" &&
          "error" in json &&
          typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : "No se pudo procesar la imagen. Intentá de nuevo.";
        setError(message);
        return;
      }

      const parsed = extractQuoteImageResponseSchema.safeParse(json);
      if (!parsed.success) {
        setError("Respuesta inválida del servidor. Intentá de nuevo.");
        return;
      }

      if (parsed.data.tipo !== tipo) {
        setError(
          "La imagen no coincide con el tipo pedido. Revisá el archivo.",
        );
        return;
      }

      if (parsed.data.tipo === "vuelo") {
        const result = applyVueloPrefill(
          parsed.data.fields,
          setValue,
          getValues,
        );
        const extraWarnings = [...parsed.data.warnings];
        if (result.skippedPricesWarning) {
          extraWarnings.push(result.skippedPricesWarning);
        }
        if (result.skippedFilledLabels.length > 0) {
          extraWarnings.push(
            `No se sobrescribieron campos ya cargados: ${result.skippedFilledLabels.join(", ")}.`,
          );
        }
        setFilledLabels(result.filledLabels);
        setWarnings(extraWarnings);
        onPrefill?.(result.filledPaths);
        if (result.filledLabels.length === 0 && extraWarnings.length === 0) {
          setError(
            "No se completó ningún campo. Revisá la imagen o cargá los datos a mano.",
          );
        }
        return;
      }

      const result = applyHotelPrefill(
        parsed.data.fields,
        setValue,
        destinoIndex as number,
      );
      const extraWarnings = [...parsed.data.warnings];
      setFilledLabels(result.filledLabels);
      setWarnings(extraWarnings);
      onPrefill?.(result.filledPaths);
      if (result.filledLabels.length === 0 && extraWarnings.length === 0) {
        setError(
          "No se completó ningún campo. Revisá la imagen o cargá los datos a mano.",
        );
      }
    } catch {
      setError("No se pudo procesar la imagen. Intentá de nuevo.");
    } finally {
      setLoading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div
      className={
        className ??
        "space-y-3 rounded-2xl border border-dashed border-border bg-muted/20 p-4"
      }
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ALLOWED_IMAGE_MIME_TYPES.join(",")}
          multiple={allowMultiple}
          className="sr-only"
          disabled={loading}
          onChange={(e) => {
            const selected = e.target.files;
            if (selected && selected.length > 0) {
              void handleFiles(selected);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
          aria-label={ariaLabel}
        >
          {loading ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Upload aria-hidden />
          )}
          {loading ? "Extrayendo…" : buttonLabel}
        </Button>
        {loading ? (
          <output className="text-xs text-muted-foreground">
            {loadingHint}
          </output>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {filledLabels.length > 0 ? (
        <output className="block rounded-xl border border-success/25 bg-success/10 px-3 py-2 text-sm text-success">
          <p className="font-medium">Campos completados (editables):</p>
          <ul className="mt-1 list-inside list-disc text-xs">
            {filledLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </output>
      ) : null}

      {warnings.length > 0 ? (
        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Avisos:</p>
          <ul className="mt-1 list-inside list-disc">
            {warnings.map((w, i) => (
              <li key={`${w + i}`}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

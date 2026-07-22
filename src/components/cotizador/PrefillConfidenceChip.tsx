"use client";

import {
  confidenceToUiState,
  type OcrConfidence,
} from "@/lib/ai/prefill-confidence";
import { cn } from "@/lib/utils";

export type PrefillConfidenceChipProps = {
  level: OcrConfidence | undefined;
  className?: string;
};

/**
 * Green / yellow / red OCR confidence chip next to a prefilled field label.
 * Returns null when the field was not OCR-prefilled.
 */
export function PrefillConfidenceChip({
  level,
  className,
}: PrefillConfidenceChipProps) {
  if (!level) return null;
  const ui = confidenceToUiState(level);
  return (
    <output
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-wide uppercase",
        ui.chipClass,
        className,
      )}
      title={`Confianza OCR: ${ui.label}`}
    >
      {ui.label}
    </output>
  );
}

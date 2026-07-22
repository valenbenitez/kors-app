import { z } from "zod";

export const OCR_CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export type OcrConfidence = (typeof OCR_CONFIDENCE_LEVELS)[number];

export const ocrConfidenceSchema = z.enum(OCR_CONFIDENCE_LEVELS);

/** Form-field-keyed confidence map returned by the extract API. */
export const fieldConfidenceMapSchema = z
  .record(z.string(), ocrConfidenceSchema)
  .default({});

export type FieldConfidenceMap = Record<string, OcrConfidence>;

export type PrefillConfidenceUi = {
  level: OcrConfidence;
  /** Spanish chip label for product UI. */
  label: string;
  chipClass: string;
  fieldClass: string;
};

const UI_BY_LEVEL: Record<OcrConfidence, PrefillConfidenceUi> = {
  high: {
    level: "high",
    label: "Alta",
    chipClass: "border-success/30 bg-success/15 text-success",
    fieldClass: "ring-2 ring-success/40 bg-success/5",
  },
  medium: {
    level: "medium",
    label: "Media",
    chipClass: "border-amber-500/35 bg-amber-500/15 text-amber-800",
    fieldClass: "ring-2 ring-amber-500/45 bg-amber-500/5",
  },
  low: {
    level: "low",
    label: "Baja",
    chipClass: "border-destructive/35 bg-destructive/15 text-destructive",
    // Stronger highlight so low-confidence OCR is hard to miss.
    fieldClass: "ring-2 ring-destructive/55 bg-destructive/10",
  },
};

/**
 * Maps OCR confidence → chip + field highlight classes for the wizard.
 * Fields always remain editable; this only drives visual state.
 */
export function confidenceToUiState(level: OcrConfidence): PrefillConfidenceUi {
  return UI_BY_LEVEL[level];
}

const RANK: Record<OcrConfidence, number> = {
  high: 2,
  medium: 1,
  low: 0,
};

/** Lowest confidence among known levels (conservative for derived fields). */
export function minConfidence(
  ...levels: Array<OcrConfidence | undefined>
): OcrConfidence | undefined {
  let worst: OcrConfidence | undefined;
  for (const level of levels) {
    if (!level) continue;
    if (!worst || RANK[level] < RANK[worst]) {
      worst = level;
    }
  }
  return worst;
}

export function resolveFieldConfidence(
  map: FieldConfidenceMap | undefined,
  fieldKey: string,
  fallback: OcrConfidence = "medium",
): OcrConfidence {
  const value = map?.[fieldKey];
  return value ?? fallback;
}

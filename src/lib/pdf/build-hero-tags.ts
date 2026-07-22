import { getPdfCopy } from "@/data/pdf-copy";
import type { CotizacionFormInput } from "@/lib/validations/cotizacion";

export type HeroTag = {
  emoji: string;
  label: string;
  accent?: boolean;
};

/** Spec §6.1 / PRD Paso 3 — premium accent chip. */
export const PREMIUM_HERO_TAG: HeroTag = {
  emoji: "🎖",
  label: "Paquete premium",
  accent: true,
};

export function isPremiumHeroTag(tag: {
  emoji: string;
  label: string;
}): boolean {
  return (
    tag.label.trim().toLowerCase() === "paquete premium" ||
    (tag.emoji === PREMIUM_HERO_TAG.emoji &&
      tag.label.toLowerCase().includes("premium"))
  );
}

/** Strip premium chips so the checkbox owns that tag. */
export function withoutPremiumTags<T extends { emoji: string; label: string }>(
  tags: T[],
): T[] {
  return tags.filter((t) => !isPremiumHeroTag(t));
}

/**
 * Sync premium chip with checkbox: prepend when on, remove when off.
 * Preserves relative order of non-premium tags.
 */
export function syncPremiumTag<T extends HeroTag>(
  tags: T[],
  paquetePremium: boolean,
): T[] {
  const base = withoutPremiumTags(tags);
  if (!paquetePremium) return base;
  return [{ ...PREMIUM_HERO_TAG } as T, ...base];
}

/** Expand bare "Familia" label with total pax (legacy defaultTags behavior). */
export function withFamiliaPaxLabel(
  tags: HeroTag[],
  totalPax: number,
): HeroTag[] {
  if (totalPax <= 0) return tags;
  return tags.map((t) =>
    t.label === "Familia" ? { ...t, label: `Familia ${totalPax} pax` } : t,
  );
}

/**
 * Resolve hero tags for PDF:
 * 1. Fixture `data.tags` override (caller)
 * 2. Non-empty `form.heroTags` (seller edits + premium checkbox)
 * 3. Destination `defaultTags` + `form.paquetePremium`
 */
export function resolveHeroTags(
  form: CotizacionFormInput,
  totalPax: number,
): HeroTag[] {
  if (form.heroTags.length > 0) {
    return withFamiliaPaxLabel(
      syncPremiumTag(form.heroTags, form.paquetePremium),
      totalPax,
    );
  }

  const primary = form.destinos[0]?.destino ?? form.destinosSeleccionados[0];
  const presets = withoutPremiumTags(getPdfCopy(primary).defaultTags);
  return withFamiliaPaxLabel(
    syncPremiumTag(presets, form.paquetePremium),
    totalPax,
  );
}

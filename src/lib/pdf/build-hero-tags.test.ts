import { describe, expect, it } from "vitest";
import {
  isPremiumHeroTag,
  PREMIUM_HERO_TAG,
  resolveHeroTags,
  syncPremiumTag,
  withFamiliaPaxLabel,
  withoutPremiumTags,
} from "@/lib/pdf/build-hero-tags";
import { defaultCotizacionValues } from "@/lib/validations/cotizacion";

describe("build-hero-tags", () => {
  it("detects premium by label", () => {
    expect(isPremiumHeroTag(PREMIUM_HERO_TAG)).toBe(true);
    expect(isPremiumHeroTag({ emoji: "💧", label: "Cataratas" })).toBe(false);
  });

  it("strips premium chips from presets", () => {
    expect(
      withoutPremiumTags([
        PREMIUM_HERO_TAG,
        { emoji: "💧", label: "Cataratas UNESCO" },
      ]),
    ).toEqual([{ emoji: "💧", label: "Cataratas UNESCO" }]);
  });

  it("syncPremiumTag prepends or removes premium", () => {
    const base = [{ emoji: "💧", label: "Cataratas UNESCO" }];
    expect(syncPremiumTag(base, true)[0]).toEqual(PREMIUM_HERO_TAG);
    expect(syncPremiumTag([{ ...PREMIUM_HERO_TAG }, ...base], false)).toEqual(
      base,
    );
  });

  it("expands Familia label with total pax", () => {
    expect(
      withFamiliaPaxLabel([{ emoji: "👨‍👩‍👧‍👦", label: "Familia" }], 4),
    ).toEqual([{ emoji: "👨‍👩‍👧‍👦", label: "Familia 4 pax" }]);
  });

  it("resolveHeroTags prefers non-empty form.heroTags + checkbox", () => {
    const form = {
      ...defaultCotizacionValues,
      heroTags: [{ emoji: "💧", label: "Custom tag" }],
      paquetePremium: true,
    };
    const tags = resolveHeroTags(form, 2);
    expect(tags[0]).toEqual(PREMIUM_HERO_TAG);
    expect(tags.some((t) => t.label === "Custom tag")).toBe(true);
  });

  it("resolveHeroTags falls back to destination presets without baked premium", () => {
    const form = {
      ...defaultCotizacionValues,
      destinosSeleccionados: ["Misiones" as const],
      heroTags: [],
      paquetePremium: false,
    };
    const tags = resolveHeroTags(form, 2);
    expect(tags.some(isPremiumHeroTag)).toBe(false);
    expect(tags.some((t) => t.label.startsWith("Familia"))).toBe(true);
  });
});

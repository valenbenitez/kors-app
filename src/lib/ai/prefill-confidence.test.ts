import { describe, expect, test } from "vitest";
import {
  confidenceToUiState,
  minConfidence,
  resolveFieldConfidence,
} from "@/lib/ai/prefill-confidence";

describe("confidenceToUiState", () => {
  test("maps high → green chip and soft success ring", () => {
    const ui = confidenceToUiState("high");
    expect(ui.label).toBe("Alta");
    expect(ui.chipClass).toContain("success");
    expect(ui.fieldClass).toContain("ring-success");
  });

  test("maps medium → yellow/amber chip and ring", () => {
    const ui = confidenceToUiState("medium");
    expect(ui.label).toBe("Media");
    expect(ui.chipClass).toContain("amber");
    expect(ui.fieldClass).toContain("ring-amber");
  });

  test("maps low → red chip and stronger destructive highlight", () => {
    const ui = confidenceToUiState("low");
    expect(ui.label).toBe("Baja");
    expect(ui.chipClass).toContain("destructive");
    expect(ui.fieldClass).toContain("ring-destructive");
    // Low must be visually stronger than medium.
    expect(ui.fieldClass).toMatch(/ring-destructive\/5[0-9]/);
  });
});

describe("minConfidence", () => {
  test("returns the most conservative level", () => {
    expect(minConfidence("high", "medium", "low")).toBe("low");
    expect(minConfidence("high", "medium")).toBe("medium");
    expect(minConfidence(undefined, "high")).toBe("high");
    expect(minConfidence()).toBeUndefined();
  });
});

describe("resolveFieldConfidence", () => {
  test("uses map value when present, else fallback", () => {
    expect(resolveFieldConfidence({ aerolinea: "low" }, "aerolinea")).toBe(
      "low",
    );
    expect(resolveFieldConfidence({}, "aerolinea")).toBe("medium");
    expect(resolveFieldConfidence(undefined, "aerolinea", "high")).toBe("high");
  });
});

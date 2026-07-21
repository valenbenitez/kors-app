import { describe, expect, test } from "vitest";
import { formatCotNumber } from "@/lib/firebase/counters/cotizaciones";

describe("formatCotNumber", () => {
  test("pads to 4 digits", () => {
    expect(formatCotNumber(1)).toBe("COT-0001");
    expect(formatCotNumber(42)).toBe("COT-0042");
    expect(formatCotNumber(9999)).toBe("COT-9999");
  });

  test("allows more than 4 digits when seq grows", () => {
    expect(formatCotNumber(10000)).toBe("COT-10000");
  });

  test("rejects non-positive sequences", () => {
    expect(() => formatCotNumber(0)).toThrow(/Invalid cot sequence/);
    expect(() => formatCotNumber(-1)).toThrow(/Invalid cot sequence/);
    expect(() => formatCotNumber(1.5)).toThrow(/Invalid cot sequence/);
  });
});

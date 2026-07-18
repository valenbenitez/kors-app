import { beforeAll, describe, expect, test } from "vitest";
import { formToFormulaInput } from "@/lib/cotizador/build-input";
import { calcularCotizacion } from "@/lib/cotizador/formula";
import { TripQuoteNotFoundError } from "@/lib/firebase/errors";
import {
  createTripQuote,
  getTripQuoteById,
} from "@/lib/firebase/trip-quotes/repository";
import { buildCot0010Form } from "@/lib/pdf/fixture-cot-0010";

/**
 * Integration tests against the Firestore emulator.
 *
 * Run with: `pnpm test:firestore`
 * (starts emulator via `firebase emulators:exec`, sets FIRESTORE_EMULATOR_HOST)
 *
 * Excluded from default `pnpm test` via vitest.config.ts (`*.emulator.test.ts`).
 */
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST?.trim();

if (!emulatorHost) {
  describe.skip("trip quotes repository (Firestore emulator)", () => {
    test("requires FIRESTORE_EMULATOR_HOST — run `pnpm test:firestore`", () => {
      // Skipped when emulator host is not set.
    });
  });
} else {
  describe("trip quotes repository (Firestore emulator)", () => {
    beforeAll(() => {
      process.env.FIREBASE_PROJECT_ID ??= "demo-kors";
    });

    test("createTripQuote + getTripQuoteById roundtrip", async () => {
      const form = buildCot0010Form();
      const result = calcularCotizacion({
        ...formToFormulaInput(form),
        tcArsUsd: 1420,
      });

      const id = await createTripQuote({
        cotNumber: "COT-0010",
        status: "generated",
        form,
        result,
        createdBy: { uid: "uid-emulator", email: "test@kors.com" },
      });

      expect(id).toBeTruthy();

      const loaded = await getTripQuoteById(id);
      expect(loaded.id).toBe(id);
      expect(loaded.cotNumber).toBe("COT-0010");
      expect(loaded.status).toBe("generated");
      expect(loaded.createdBy).toEqual({
        uid: "uid-emulator",
        email: "test@kors.com",
      });
      expect(loaded.form.clienteNombre).toBe(form.clienteNombre);
      expect(loaded.result.precioFinalCliente).toBe(result.precioFinalCliente);
      expect(loaded.createdAt).toBeInstanceOf(Date);
      expect(loaded.updatedAt).toBeInstanceOf(Date);
    });

    test("getTripQuoteById throws TripQuoteNotFoundError", async () => {
      await expect(
        getTripQuoteById("missing-doc-id-xyz"),
      ).rejects.toBeInstanceOf(TripQuoteNotFoundError);
    });
  });
}

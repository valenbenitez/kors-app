// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { FormulaBreakdown } from "@/components/cotizador/FormulaBreakdown";
import { KELLY_IGUAZU_V28_INPUT } from "@/lib/cotizador/fixtures/kelly-iguazu-v28";
import { calcularCotizacion } from "@/lib/cotizador/formula";

afterEach(() => {
  cleanup();
});

describe("FormulaBreakdown", () => {
  const result = calcularCotizacion(KELLY_IGUAZU_V28_INPUT);

  it("is collapsed by default and expands to show steps 1–9", async () => {
    const user = userEvent.setup();
    render(<FormulaBreakdown result={result} metodoPago="tarjeta" />);

    const toggle = screen.getByRole("button", { name: "Ver breakdown" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/Paso 1/)).not.toBeInTheDocument();

    await user.click(toggle);

    expect(
      screen.getByRole("button", { name: "Ocultar breakdown" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Paso 1 — ARS → USD/)).toBeInTheDocument();
    expect(screen.getByText(/Paso 2 — Gross-up/)).toBeInTheDocument();
    expect(screen.getByText(/Paso 3 — Subtotal/)).toBeInTheDocument();
    expect(screen.getByText(/Paso 4 — Margen agencia/)).toBeInTheDocument();
    expect(screen.getByText(/Paso 5 — Fee de cobro/)).toBeInTheDocument();
    expect(screen.getByText(/Paso 6 — Precio por persona/)).toBeInTheDocument();
    expect(screen.getByText(/Paso 7 — Moneda local/)).toBeInTheDocument();
    expect(screen.getByText(/N\/A — MVP/)).toBeInTheDocument();
    expect(screen.getByText(/Paso 8 — Margen vendedor/)).toBeInTheDocument();
    expect(screen.getByText(/Paso 9 — Redondeo CEILING/)).toBeInTheDocument();
    expect(screen.getAllByText(/US\$\s*1\.289/).length).toBeGreaterThan(0);
  });
});

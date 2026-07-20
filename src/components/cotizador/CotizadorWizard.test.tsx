// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CotizadorWizard } from "@/components/cotizador/CotizadorWizard";
import { fallbackFxRates } from "@/lib/cotizador/rates";

const fetchMock = vi.fn<typeof fetch>();

function ratesResponse(
  rates: Record<string, number> = fallbackFxRates(),
): Response {
  return {
    ok: true,
    json: async () => rates,
  } as unknown as Response;
}

function pdfResponse(cotNumber = "COT-0042"): Response {
  return {
    ok: true,
    blob: async () => new Blob(["pdf"], { type: "application/pdf" }),
    headers: {
      get: (name: string) => {
        if (name === "Content-Disposition") {
          return `attachment; filename="${cotNumber}_cliente.pdf"`;
        }
        if (name === "X-Cotizacion-Numero") {
          return cotNumber;
        }
        return null;
      },
    },
  } as unknown as Response;
}

function errorResponse(): Response {
  return {
    ok: false,
    json: async () => ({ error: "Fallo del servidor" }),
  } as unknown as Response;
}

function getForm(): HTMLFormElement {
  const form = document.querySelector("form");
  if (!form) throw new Error("No se encontró el <form> del wizard");
  return form;
}

/** Espera a que terminen validaciones async pendientes antes de asertar. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

async function waitForRatesReady() {
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
  });
}

async function fillStep0(user: UserEvent) {
  await user.type(
    screen.getByLabelText("Nombre completo"),
    "Cliente de Prueba",
  );
  await user.type(screen.getByLabelText("WhatsApp"), "+54 9 11 12345678");
  fireEvent.change(screen.getByLabelText("Fecha ida"), {
    target: { value: "2026-08-10" },
  });
  fireEvent.change(screen.getByLabelText("Fecha vuelta"), {
    target: { value: "2026-08-15" },
  });
}

async function goToFinalStep(user: UserEvent) {
  await waitForRatesReady();
  await fillStep0(user);
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByText("Nombre hotel");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByRole("button", { name: "Generar PDF" });
}

function generatePdfCalls() {
  return fetchMock.mock.calls.filter(
    ([url]) => typeof url === "string" && url.includes("/api/generate-pdf"),
  );
}

function previewPdfCalls() {
  return fetchMock.mock.calls.filter(
    ([url]) => typeof url === "string" && url.includes("/api/preview-pdf"),
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  fetchMock.mockImplementation((input) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.includes("/api/rates")) {
      return Promise.resolve(ratesResponse());
    }
    return Promise.resolve(pdfResponse());
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

describe("CotizadorWizard — generación del PDF", () => {
  it("no llama a /api/generate-pdf al presionar Enter en un input del paso 0", async () => {
    const user = userEvent.setup();
    render(<CotizadorWizard />);
    await waitForRatesReady();

    // Datos válidos: sin el guard de paso, el submit dispararía la generación.
    await fillStep0(user);
    await user.type(screen.getByLabelText("Nombre completo"), "{Enter}");
    // Fuerza el evento submit del form (equivalente al submit implícito por Enter).
    fireEvent.submit(getForm());
    await settle();

    expect(generatePdfCalls()).toHaveLength(0);
  });

  it("no llama a /api/generate-pdf con el formulario incompleto en el paso 0", async () => {
    const user = userEvent.setup();
    render(<CotizadorWizard />);
    await waitForRatesReady();

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByText("Ingresá el nombre del cliente");
    fireEvent.submit(getForm());
    await settle();

    expect(generatePdfCalls()).toHaveLength(0);
  });

  it("navegar hasta el paso final no llama a /api/generate-pdf", async () => {
    const user = userEvent.setup();
    render(<CotizadorWizard />);

    await goToFinalStep(user);

    expect(generatePdfCalls()).toHaveLength(0);
  });

  it("submit nativo en el paso final no llama a /api/generate-pdf", async () => {
    const user = userEvent.setup();
    render(<CotizadorWizard />);

    await goToFinalStep(user);
    fireEvent.submit(getForm());
    await settle();

    expect(generatePdfCalls()).toHaveLength(0);
  });

  it("con formulario válido, click en Generar PDF llama exactamente 1 vez a fetch", async () => {
    const user = userEvent.setup();
    render(<CotizadorWizard />);

    await goToFinalStep(user);
    await user.click(screen.getByRole("button", { name: "Generar PDF" }));

    await waitFor(() => expect(generatePdfCalls()).toHaveLength(1));
    expect(generatePdfCalls()[0]?.[0]).toBe("/api/generate-pdf");
    expect(generatePdfCalls()[0]?.[1]).toEqual(
      expect.objectContaining({ method: "POST" }),
    );
    // Termina la generación y vuelve al estado normal sin peticiones extra.
    await screen.findByRole("button", { name: "Generar PDF" });
    expect(generatePdfCalls()).toHaveLength(1);
  });

  it("tras descargar el PDF muestra banner de éxito con el número COT", async () => {
    fetchMock.mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/rates")) {
        return Promise.resolve(ratesResponse());
      }
      return Promise.resolve(pdfResponse("COT-0042"));
    });
    const user = userEvent.setup();
    render(<CotizadorWizard />);

    await goToFinalStep(user);
    await user.click(screen.getByRole("button", { name: "Generar PDF" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("COT-0042");
    expect(status).toHaveTextContent("descargó correctamente");
  });

  it("doble click rápido en Generar PDF produce exactamente 1 petición", async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    fetchMock.mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/rates")) {
        return Promise.resolve(ratesResponse());
      }
      return new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
    });
    const user = userEvent.setup();
    render(<CotizadorWizard />);

    await goToFinalStep(user);
    const generateButton = screen.getByRole("button", { name: "Generar PDF" });
    // Dos clicks antes de que el rerender deshabilite el botón.
    fireEvent.click(generateButton);
    fireEvent.click(generateButton);

    await waitFor(() => expect(generatePdfCalls()).toHaveLength(1));
    await act(async () => {
      resolveFetch?.(pdfResponse());
    });
    await screen.findByRole("button", { name: "Generar PDF" });
    expect(generatePdfCalls()).toHaveLength(1);
  });

  it("ante error del server muestra el mensaje y permite reintentar", async () => {
    let generateCount = 0;
    fetchMock.mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/rates")) {
        return Promise.resolve(ratesResponse());
      }
      generateCount += 1;
      if (generateCount === 1) {
        return Promise.resolve(errorResponse());
      }
      return Promise.resolve(pdfResponse());
    });
    const user = userEvent.setup();
    render(<CotizadorWizard />);

    await goToFinalStep(user);
    await user.click(screen.getByRole("button", { name: "Generar PDF" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Fallo del servidor");

    // Reintento sin perder datos: el botón vuelve a estar disponible.
    await user.click(screen.getByRole("button", { name: "Generar PDF" }));
    await waitFor(() => expect(generatePdfCalls()).toHaveLength(2));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });

  it("toggle Ver preview llama a /api/preview-pdf y muestra el iframe", async () => {
    fetchMock.mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/rates")) {
        return Promise.resolve(ratesResponse());
      }
      return Promise.resolve({
        ok: true,
        text: async () => "<!DOCTYPE html><html><body>preview</body></html>",
        headers: { get: () => null },
      } as unknown as Response);
    });
    const user = userEvent.setup();
    render(<CotizadorWizard />);

    await goToFinalStep(user);
    expect(
      screen.getByRole("button", { name: "Ver preview" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver preview" }));

    await waitFor(() => expect(previewPdfCalls()).toHaveLength(1));
    expect(previewPdfCalls()[0]?.[1]).toEqual(
      expect.objectContaining({ method: "POST" }),
    );
    expect(
      await screen.findByTitle("Vista previa del PDF"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ocultar preview" }),
    ).toBeInTheDocument();
  });

  it("shows live TC when /api/rates succeeds", async () => {
    fetchMock.mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/rates")) {
        return Promise.resolve(
          ratesResponse({
            USD: 1,
            ARS: 1500,
            CLP: 950,
            COP: 4100,
            PIX: 5.5,
            PEN: 3.75,
          }),
        );
      }
      return Promise.resolve(pdfResponse());
    });
    render(<CotizadorWizard />);
    await waitFor(() => {
      expect(screen.getByText(/TC ARS\/USD 1500/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/fallback/)).not.toBeInTheDocument();
  });

  it("falls back to hardcoded rates with warning when /api/rates fails", async () => {
    fetchMock.mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/rates")) {
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: "down" }),
        } as unknown as Response);
      }
      return Promise.resolve(pdfResponse());
    });
    render(<CotizadorWizard />);
    await waitForRatesReady();
    expect(screen.getByText(/TC ARS\/USD .*fallback/)).toBeInTheDocument();
    expect(screen.getByText(/valores de respaldo/i)).toBeInTheDocument();
  });
});

describe("CotizadorWizard — campos vuelo/hotel prefill", () => {
  it("shows optional flight segment fields on step 0", async () => {
    render(<CotizadorWizard />);
    await waitForRatesReady();

    expect(screen.getByText("Vuelo ida (opcional)")).toBeInTheDocument();
    expect(screen.getByText("Vuelo vuelta (opcional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Número de vuelo ida")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Aeropuerto salida ida (IATA)"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Número de vuelo vuelta")).toBeInTheDocument();
  });

  it("shows hotel incluye/excluye/condiciones on costos step", async () => {
    const user = userEvent.setup();
    render(<CotizadorWizard />);
    await waitForRatesReady();
    await fillStep0(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByLabelText("Hotel incluye (opcional)");
    expect(
      screen.getByLabelText("Hotel excluye (opcional)"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Condiciones del hotel (opcional)"),
    ).toBeInTheDocument();
  });
});

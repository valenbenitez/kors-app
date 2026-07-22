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
  rates: Record<string, unknown> = fallbackFxRates(),
): Response {
  return {
    ok: true,
    json: async () => rates,
  } as unknown as Response;
}

function catalogExcursionesResponse(items: unknown[] = []): Response {
  return {
    ok: true,
    json: async () => ({ items }),
  } as unknown as Response;
}

/** Shared fetch routing used by most wizard tests. */
function routeTestFetch(
  input: RequestInfo | URL,
  overrides?: {
    rates?: () => Promise<Response>;
    catalog?: () => Promise<Response>;
    other?: (url: string) => Promise<Response> | null;
  },
): Promise<Response> {
  const url = typeof input === "string" ? input : input.url;
  if (url.includes("/api/rates")) {
    return overrides?.rates?.() ?? Promise.resolve(ratesResponse());
  }
  if (url.includes("/api/catalog/")) {
    return (
      overrides?.catalog?.() ?? Promise.resolve(catalogExcursionesResponse())
    );
  }
  const custom = overrides?.other?.(url);
  if (custom) return custom;
  return Promise.resolve(pdfResponse());
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

function cotizacionesCalls() {
  return fetchMock.mock.calls.filter(
    ([url]) => typeof url === "string" && url.includes("/api/cotizaciones"),
  );
}

function catalogCalls() {
  return fetchMock.mock.calls.filter(
    ([url]) => typeof url === "string" && url.includes("/api/catalog/"),
  );
}

function previewPdfCalls() {
  return fetchMock.mock.calls.filter(
    ([url]) => typeof url === "string" && url.includes("/api/preview-pdf"),
  );
}

function saveResponse(
  cotNumber = "COT-0007",
  pdfDriveUrl: string | null = null,
): Response {
  return {
    ok: true,
    json: async () => ({
      cot_number: cotNumber,
      pdf_drive_url: pdfDriveUrl,
      saved_at: "2026-07-21T18:00:00.000Z",
    }),
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  fetchMock.mockImplementation((input) => routeTestFetch(input));
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

  it("con formulario válido, click en Guardar cotización llama a /api/cotizaciones", async () => {
    fetchMock.mockImplementation((input) =>
      routeTestFetch(input, {
        other: (url) =>
          url.includes("/api/cotizaciones")
            ? Promise.resolve(saveResponse("COT-0007"))
            : null,
      }),
    );
    const user = userEvent.setup();
    render(<CotizadorWizard />);

    await goToFinalStep(user);
    await user.click(
      screen.getByRole("button", { name: "Guardar cotización" }),
    );

    await waitFor(() => expect(cotizacionesCalls()).toHaveLength(1));
    expect(cotizacionesCalls()[0]?.[0]).toBe("/api/cotizaciones");
    expect(cotizacionesCalls()[0]?.[1]).toEqual(
      expect.objectContaining({ method: "POST" }),
    );
    expect(generatePdfCalls()).toHaveLength(0);

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("COT-0007");
    expect(status).toHaveTextContent("Cotización guardada");
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
    fetchMock.mockImplementation((input) =>
      routeTestFetch(input, {
        other: () => Promise.resolve(pdfResponse("COT-0042")),
      }),
    );
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
    fetchMock.mockImplementation((input) =>
      routeTestFetch(input, {
        other: (url) => {
          if (url.includes("/api/generate-pdf")) {
            return new Promise<Response>((resolve) => {
              resolveFetch = resolve;
            });
          }
          return null;
        },
      }),
    );
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
    fetchMock.mockImplementation((input) =>
      routeTestFetch(input, {
        other: (url) => {
          if (!url.includes("/api/generate-pdf")) return null;
          generateCount += 1;
          if (generateCount === 1) {
            return Promise.resolve(errorResponse());
          }
          return Promise.resolve(pdfResponse());
        },
      }),
    );
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
    fetchMock.mockImplementation((input) =>
      routeTestFetch(input, {
        other: (url) => {
          if (url.includes("/api/preview-pdf")) {
            return Promise.resolve({
              ok: true,
              text: async () =>
                "<!DOCTYPE html><html><body>preview</body></html>",
              headers: { get: () => null },
            } as unknown as Response);
          }
          return null;
        },
      }),
    );
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

  it("shows live TC when /api/rates succeeds (ignores formulaParams)", async () => {
    fetchMock.mockImplementation((input) =>
      routeTestFetch(input, {
        rates: () =>
          Promise.resolve(
            ratesResponse({
              USD: 1,
              ARS: 1500,
              CLP: 950,
              COP: 4100,
              PIX: 5.5,
              PEN: 3.75,
              formulaParams: {
                tcArsUsd: 1500,
                flightTaxPct: 0.05,
                hotelTaxPct: 0.03,
                agencyMarginPct: 0.3,
                cardFeePct: 0.1,
                beetransferFeePct: 0.03,
                cashFeePct: 0,
                sellerMarginPct: 0.05,
              },
            }),
          ),
      }),
    );
    render(<CotizadorWizard />);
    await waitFor(() => {
      expect(screen.getByText(/TC ARS\/USD 1500/)).toBeInTheDocument();
    });
    expect(screen.getByText(/fórmula v2\.8/)).toBeInTheDocument();
    expect(screen.queryByText(/fallback/)).not.toBeInTheDocument();
  });

  it("falls back to hardcoded rates with warning when /api/rates fails", async () => {
    fetchMock.mockImplementation((input) =>
      routeTestFetch(input, {
        rates: () =>
          Promise.resolve({
            ok: false,
            json: async () => ({ error: "down" }),
          } as unknown as Response),
      }),
    );
    render(<CotizadorWizard />);
    await waitForRatesReady();
    expect(screen.getByText(/TC ARS\/USD .*fallback/)).toBeInTheDocument();
    expect(screen.getByText(/valores de respaldo/i)).toBeInTheDocument();
  });
});

describe("CotizadorWizard — campos vuelo/hotel prefill", () => {
  it("shows optional flight segment fields and prices on step 0", async () => {
    render(<CotizadorWizard />);
    await waitForRatesReady();

    expect(screen.getByText("Vuelo ida (opcional)")).toBeInTheDocument();
    expect(screen.getByText("Vuelo vuelta (opcional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Número de vuelo ida")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Aeropuerto salida ida (IATA)"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Número de vuelo vuelta")).toBeInTheDocument();
    expect(screen.getByLabelText("Vuelo ida adulto (ARS)")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Vuelo vuelta adulto (ARS)"),
    ).toBeInTheDocument();
  });

  it("hides flight controls when cliente aporta vuelos is checked", async () => {
    const user = userEvent.setup();
    render(<CotizadorWizard />);
    await waitForRatesReady();

    expect(screen.getByText("Vuelo ida (opcional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Aerolínea (opcional)")).toBeInTheDocument();
    expect(
      screen.getByText("Prefill desde imagen de vuelo"),
    ).toBeInTheDocument();

    await user.click(screen.getByLabelText("Cliente aporta vuelos propios"));

    expect(screen.queryByText("Vuelo ida (opcional)")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Vuelo vuelta (opcional)"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Aerolínea (opcional)"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Vuelo ida adulto (ARS)"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Prefill desde imagen de vuelo"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Cliente aporta vuelos propios"),
    ).toBeChecked();
  });

  it("keeps flight prices on step 0 and starts Costos with hotel fields", async () => {
    const user = userEvent.setup();
    render(<CotizadorWizard />);
    await waitForRatesReady();

    expect(screen.getByLabelText("Vuelo ida adulto (ARS)")).toBeInTheDocument();

    await fillStep0(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByLabelText("Hotel incluye (opcional)");
    expect(screen.getByText(/Hotel adulto \/ noche/i)).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Vuelo ida adulto (ARS)"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Vuelo ida", { exact: true }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Vuelo vuelta", { exact: true }),
    ).not.toBeInTheDocument();
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

describe("CotizadorWizard — AI flight image prefill", () => {
  function extractCalls() {
    return fetchMock.mock.calls.filter(
      ([url]) =>
        typeof url === "string" && url.includes("/api/extract-quote-image"),
    );
  }

  function vueloExtractResponse(
    overrides: Record<string, unknown> = {},
  ): Response {
    return {
      ok: true,
      json: async () => ({
        tipo: "vuelo",
        fields: {
          aerolinea: "Aerolíneas Argentinas",
          vueloIdaFecha: "2026-08-10",
          vueloIdaHoraSalida: "20:58",
          vueloIdaHoraLlegada: "22:52",
          vueloIdaNumero: "AR3150",
          vueloIdaAeropuertoSalida: "EZE",
          vueloIdaAeropuertoLlegada: "IGR",
          vueloVueltaFecha: "2026-08-15",
          vueloVueltaHoraSalida: "18:10",
          vueloVueltaHoraLlegada: "20:05",
          vueloVueltaNumero: "AR3151",
          vueloVueltaAeropuertoSalida: "IGR",
          vueloVueltaAeropuertoLlegada: "EZE",
          vueloIdaAdultoArs: 180000,
          vueloVueltaAdultoArs: 175000,
          moneda: "ARS",
          ...overrides,
        },
        warnings: ["Horario de escala ambiguo"],
      }),
    } as unknown as Response;
  }

  it("shows flight-only upload control on step 0", async () => {
    render(<CotizadorWizard />);
    await waitForRatesReady();

    expect(
      screen.getByText("Prefill desde imagen de vuelo"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Subir imágenes de vuelo" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Prefill desde imagen de hotel"),
    ).not.toBeInTheDocument();
  });

  it("rejects unsupported file types client-side without calling extract", async () => {
    render(<CotizadorWizard />);
    await waitForRatesReady();

    const input = document.querySelector(
      'input[type="file"][accept*="image/jpeg"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();

    const bad = new File(["hello"], "itinerary.gif", { type: "image/gif" });
    // Bypass browser accept filtering so client-side mime validation runs.
    fireEvent.change(input, { target: { files: [bad] } });

    expect(
      await screen.findByText(/Formato no soportado/i),
    ).toBeInTheDocument();
    expect(extractCalls()).toHaveLength(0);
  });

  it("on upload calls extract with tipo=vuelo and prefills flight fields", async () => {
    fetchMock.mockImplementation((input) =>
      routeTestFetch(input, {
        other: (url) =>
          url.includes("/api/extract-quote-image")
            ? Promise.resolve(vueloExtractResponse())
            : null,
      }),
    );
    const user = userEvent.setup();
    render(<CotizadorWizard />);
    await waitForRatesReady();

    // Preserve client fields — type them first
    await user.type(
      screen.getByLabelText("Nombre completo"),
      "Cliente Intacta",
    );
    await user.type(screen.getByLabelText("WhatsApp"), "+54 9 11 99999999");

    const input = document.querySelector(
      'input[type="file"][accept*="image/jpeg"]',
    ) as HTMLInputElement;
    const image = new File(["fake-png"], "vuelo.png", { type: "image/png" });
    await user.upload(input, image);

    await waitFor(() => expect(extractCalls()).toHaveLength(1));
    const extractCall = extractCalls()[0];
    expect(extractCall).toBeDefined();
    const init = extractCall?.[1];
    expect(init).toEqual(expect.objectContaining({ method: "POST" }));
    const body = init?.body as FormData;
    expect(body.get("tipo")).toBe("vuelo");
    expect(body.get("image")).toBeInstanceOf(File);

    await waitFor(() => {
      expect(screen.getByLabelText("Aerolínea (opcional)")).toHaveValue(
        "Aerolíneas Argentinas",
      );
    });
    expect(screen.getByLabelText("Fecha ida")).toHaveValue("2026-08-10");
    expect(screen.getByLabelText("Fecha vuelta")).toHaveValue("2026-08-15");
    expect(screen.getByLabelText("Número de vuelo ida")).toHaveValue("AR3150");
    expect(screen.getByLabelText("Aeropuerto salida ida (IATA)")).toHaveValue(
      "EZE",
    );
    expect(screen.getByLabelText("Número de vuelo vuelta")).toHaveValue(
      "AR3151",
    );

    // Client fields untouched
    expect(screen.getByLabelText("Nombre completo")).toHaveValue(
      "Cliente Intacta",
    );
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("+54 9 11 99999999");

    // Feedback lists filled fields + API warnings; fields stay editable
    const status = await screen.findByText(/Campos completados/i);
    expect(status).toBeInTheDocument();
    expect(screen.getByText("Aerolínea")).toBeInTheDocument();
    expect(screen.getByText("Horario de escala ambiguo")).toBeInTheDocument();
    expect(screen.getByLabelText("Número de vuelo ida")).not.toBeDisabled();
  });

  it("shows readable API errors", async () => {
    fetchMock.mockImplementation((input) =>
      routeTestFetch(input, {
        other: (url) =>
          url.includes("/api/extract-quote-image")
            ? Promise.resolve({
                ok: false,
                json: async () => ({
                  error:
                    "La imagen no es legible. Probá con otra captura más clara.",
                }),
              } as unknown as Response)
            : null,
      }),
    );
    const user = userEvent.setup();
    render(<CotizadorWizard />);
    await waitForRatesReady();

    const input = document.querySelector(
      'input[type="file"][accept*="image/jpeg"]',
    ) as HTMLInputElement;
    await user.upload(
      input,
      new File(["x"], "blur.png", { type: "image/png" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no es legible/i,
    );
  });
});

describe("CotizadorWizard — AI hotel image prefill", () => {
  function extractCalls() {
    return fetchMock.mock.calls.filter(
      ([url]) =>
        typeof url === "string" && url.includes("/api/extract-quote-image"),
    );
  }

  function hotelExtractResponse(
    overrides: Record<string, unknown> = {},
  ): Response {
    return {
      ok: true,
      json: async () => ({
        tipo: "hotel",
        fields: {
          hotelNombre: "Hotel Saint George",
          hotelCategoria: "4★",
          hotelUbicacion: "Puerto Iguazú",
          hotelHabitacion: "Twin Master",
          hotelRegimen: "Desayuno",
          hotelIncluye: "WiFi\nPileta",
          hotelExcluye: "Spa",
          hotelCondiciones: "No reembolsable",
          hotelNoches: 3,
          hotelAdultoNocheArs: 71_263,
          hotelTotalDetectado: 427575,
          hotelEstadiaDetalle: "3 noches · 2 adultos",
          moneda: "ARS",
          ...overrides,
        },
        warnings: [
          "Precio por adulto = total 427575 ÷ 2 adultos (redondeo HALF_UP a entero)",
        ],
      }),
    } as unknown as Response;
  }

  async function goToCostos(user: UserEvent) {
    await waitForRatesReady();
    await fillStep0(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByText("Prefill desde imagen de hotel");
  }

  it("shows hotel upload on costos step, independent of flight upload", async () => {
    const user = userEvent.setup();
    render(<CotizadorWizard />);
    await goToCostos(user);

    expect(
      screen.getByText("Prefill desde imagen de hotel"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Subir imágenes de hotel" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Prefill desde imagen de vuelo"),
    ).not.toBeInTheDocument();
  });

  it("calls extract with tipo=hotel and paxAdultos, prefills only that destino", async () => {
    fetchMock.mockImplementation((input) =>
      routeTestFetch(input, {
        other: (url) =>
          url.includes("/api/extract-quote-image")
            ? Promise.resolve(hotelExtractResponse())
            : null,
      }),
    );
    const user = userEvent.setup();
    render(<CotizadorWizard />);
    await waitForRatesReady();
    await fillStep0(user);
    // Two destinos: hotel upload for Misiones must not touch Salta
    await user.click(screen.getByRole("button", { name: "Salta" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findAllByText("Prefill desde imagen de hotel");

    const hotelUploads = screen.getAllByRole("button", {
      name: "Subir imágenes de hotel",
    });
    expect(hotelUploads).toHaveLength(2);

    const fileInputs = document.querySelectorAll(
      'input[type="file"][accept*="image/jpeg"]',
    );
    expect(fileInputs.length).toBe(2);

    const image = new File(["fake-png"], "hotel.png", { type: "image/png" });
    await user.upload(fileInputs[0] as HTMLInputElement, image);

    await waitFor(() => expect(extractCalls()).toHaveLength(1));
    const extractCall = extractCalls()[0];
    const init = extractCall?.[1];
    const body = init?.body as FormData;
    expect(body.get("tipo")).toBe("hotel");
    expect(body.get("paxAdultos")).toBe("1");
    expect(body.get("image")).toBeInstanceOf(File);

    await waitFor(() => {
      expect(
        screen.getByDisplayValue("Hotel Saint George"),
      ).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("Puerto Iguazú")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Twin Master")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Desayuno")).toBeInTheDocument();
    expect(
      document.getElementById("hotelIncluye-0") as HTMLTextAreaElement,
    ).toHaveValue("WiFi\nPileta");
    expect(
      document.getElementById("hotelExcluye-0") as HTMLTextAreaElement,
    ).toHaveValue("Spa");
    expect(
      document.getElementById("hotelIncluye-1") as HTMLTextAreaElement,
    ).toHaveValue("");
    expect(screen.getByDisplayValue("71.263")).toBeInTheDocument();

    // Only one destino got the hotel name (Misiones); Salta stays empty.
    expect(screen.getAllByDisplayValue("Hotel Saint George")).toHaveLength(1);
    expect(screen.getByText("Salta")).toBeInTheDocument();

    expect(await screen.findByText(/Campos completados/i)).toBeInTheDocument();
    expect(
      screen.getByText("Hotel adulto / noche", { exact: true }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Hotel Saint George")).not.toBeDisabled();
  });

  it("shows readable API errors on hotel upload", async () => {
    fetchMock.mockImplementation((input) =>
      routeTestFetch(input, {
        other: (url) =>
          url.includes("/api/extract-quote-image")
            ? Promise.resolve({
                ok: false,
                json: async () => ({
                  error:
                    "La imagen no es legible. Probá con otra captura más clara.",
                }),
              } as unknown as Response)
            : null,
      }),
    );

    const user = userEvent.setup();
    render(<CotizadorWizard />);
    await goToCostos(user);

    const input = document.querySelector(
      'input[type="file"][accept*="image/jpeg"]',
    ) as HTMLInputElement;
    await user.upload(
      input,
      new File(["x"], "blur.png", { type: "image/png" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no es legible/i,
    );
  });
});

describe("CotizadorWizard — catalog excursions API", () => {
  it("fetches excursiones on Costos step and shows loading then list", async () => {
    const sample = {
      id: "exc-1",
      nombre: "Cataratas Argentino",
      nombreLimpio: "Cataratas Argentino",
      activa: true,
      destino: "Iguazú",
      moneda: "USD",
      neto: 50,
      precioMenor: null,
      politicaMenores: "Mismo adulto",
      proveedor: "Test",
      observaciones: "",
      notas: "",
      tipo: "Regular",
      validezDesde: null,
      validezHasta: null,
      categoriaPaquete: "",
    };

    let resolveCatalog: ((response: Response) => void) | undefined;
    fetchMock.mockImplementation((input) =>
      routeTestFetch(input, {
        catalog: () =>
          new Promise<Response>((resolve) => {
            resolveCatalog = resolve;
          }),
      }),
    );

    const user = userEvent.setup();
    render(<CotizadorWizard />);
    await waitForRatesReady();
    await fillStep0(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(
      await screen.findByText(/Cargando excursiones/i),
    ).toBeInTheDocument();
    expect(catalogCalls().length).toBeGreaterThan(0);
    expect(String(catalogCalls()[0]?.[0])).toContain(
      "/api/catalog/excursiones?",
    );
    expect(String(catalogCalls()[0]?.[0])).toContain("destino=Misiones");
    expect(String(catalogCalls()[0]?.[0])).toContain("fechaIda=2026-08-10");

    await act(async () => {
      resolveCatalog?.(catalogExcursionesResponse([sample]));
    });

    await waitFor(() => {
      expect(
        screen.queryByText(/Cargando excursiones/i),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText("Cataratas Argentino")).toBeInTheDocument();
    expect(screen.getByText(/Excursiones \(1 vigentes\)/)).toBeInTheDocument();
  });
});

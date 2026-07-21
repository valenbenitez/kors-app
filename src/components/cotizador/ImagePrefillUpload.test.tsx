// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImagePrefillUpload } from "@/components/cotizador/ImagePrefillUpload";

const fetchMock = vi.fn<typeof fetch>();

describe("ImagePrefillUpload — hotel", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("blocks hotel upload when paxAdultos is 0 and does not call extract", async () => {
    const setValue = vi.fn();
    const getValues = vi.fn(() => ({ destinos: [{ moneda: "ARS" }] }));
    const user = userEvent.setup();

    render(
      <ImagePrefillUpload
        tipo="hotel"
        destinoIndex={0}
        paxAdultos={0}
        setValue={setValue as never}
        getValues={getValues as never}
      />,
    );

    const input = document.querySelector(
      'input[type="file"][accept*="image/jpeg"]',
    ) as HTMLInputElement;
    await user.upload(
      input,
      new File(["x"], "hotel.png", { type: "image/png" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /cantidad de adultos/i,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setValue).not.toHaveBeenCalled();
  });

  it("blocks hotel upload when paxAdultos is invalid", async () => {
    const setValue = vi.fn();
    const user = userEvent.setup();

    render(
      <ImagePrefillUpload
        tipo="hotel"
        destinoIndex={0}
        paxAdultos={Number.NaN}
        setValue={setValue as never}
        getValues={vi.fn(() => ({ destinos: [] })) as never}
      />,
    );

    const input = document.querySelector(
      'input[type="file"][accept*="image/jpeg"]',
    ) as HTMLInputElement;
    await user.upload(
      input,
      new File(["x"], "hotel.png", { type: "image/png" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /cantidad de adultos/i,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("applies hotel prefill to the given destinoIndex on success", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        tipo: "hotel",
        fields: {
          hotelNombre: "Hotel Saint George",
          hotelCategoria: "4★",
          hotelUbicacion: "Puerto Iguazú",
          hotelHabitacion: "Twin Master",
          hotelRegimen: "Desayuno",
          hotelIncluye: "WiFi",
          hotelExcluye: "Spa",
          hotelCondiciones: "No reembolsable",
          hotelNoches: 3,
          hotelAdultoNocheArs: 71_263,
          hotelTotalDetectado: 427575,
          hotelEstadiaDetalle: "3 noches",
          moneda: "ARS",
        },
        warnings: [],
      }),
    } as unknown as Response);

    const setValue = vi.fn();
    const getValues = vi.fn((name?: string) => {
      if (name === "destinos") {
        return [{ moneda: "ARS" }, { moneda: "USD" }];
      }
      return { destinos: [{ moneda: "ARS" }, { moneda: "USD" }] };
    });
    const onPrefill = vi.fn();
    const user = userEvent.setup();

    render(
      <ImagePrefillUpload
        tipo="hotel"
        destinoIndex={1}
        paxAdultos={2}
        setValue={setValue as never}
        getValues={getValues as never}
        onPrefill={onPrefill}
      />,
    );

    const input = document.querySelector(
      'input[type="file"][accept*="image/jpeg"]',
    ) as HTMLInputElement;
    await user.upload(
      input,
      new File(["x"], "hotel.png", { type: "image/png" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const extractCall = fetchMock.mock.calls[0];
    expect(extractCall).toBeDefined();
    const init = extractCall?.[1];
    const body = init?.body as FormData;
    expect(body.get("tipo")).toBe("hotel");
    expect(body.get("paxAdultos")).toBe("2");
    expect(body.get("moneda")).toBe("USD");
    expect(body.getAll("image")).toHaveLength(1);

    await waitFor(() => expect(onPrefill).toHaveBeenCalled());
    const paths = setValue.mock.calls.map(([path]) => path);
    expect(paths).toContain("destinos.1.hotelNombre");
    expect(paths).toContain("destinos.1.hotelAdultoNocheArs");
    expect(paths).toContain("destinos.1.hotelNoches");
    expect(paths.every((p) => String(p).startsWith("destinos.1."))).toBe(true);
    expect(screen.getByText(/Campos completados/i)).toBeInTheDocument();
  });

  it("appends multiple hotel images as repeated image fields", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        tipo: "hotel",
        fields: {
          hotelNombre: "Hotel Multi",
          hotelCategoria: "4★",
          hotelUbicacion: "Iguazú",
          hotelHabitacion: "Doble",
          hotelRegimen: "Desayuno",
          hotelIncluye: "WiFi",
          hotelExcluye: "",
          hotelCondiciones: "",
          hotelNoches: 2,
          hotelAdultoNocheArs: 50_000,
          hotelTotalDetectado: 100_000,
          hotelEstadiaDetalle: "2 noches",
          moneda: "ARS",
        },
        warnings: ["Una captura no era legible; se usaron las demás."],
      }),
    } as unknown as Response);

    const setValue = vi.fn();
    const getValues = vi.fn(() => ({ destinos: [{ moneda: "ARS" }] }));
    const user = userEvent.setup();

    render(
      <ImagePrefillUpload
        tipo="hotel"
        destinoIndex={0}
        paxAdultos={2}
        setValue={setValue as never}
        getValues={getValues as never}
      />,
    );

    const input = document.querySelector(
      'input[type="file"][accept*="image/jpeg"]',
    ) as HTMLInputElement;
    expect(input.multiple).toBe(true);

    await user.upload(input, [
      new File(["a"], "rate.png", { type: "image/png" }),
      new File(["b"], "conds.png", { type: "image/png" }),
    ]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(body.getAll("image")).toHaveLength(2);
    expect(body.get("tipo")).toBe("hotel");
    expect(await screen.findByText(/Avisos/i)).toBeInTheDocument();
  });
});

describe("ImagePrefillUpload — vuelo", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const vueloFields = {
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
  };

  it("appends a single vuelo image (regression)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        tipo: "vuelo",
        fields: vueloFields,
        warnings: [],
      }),
    } as unknown as Response);

    const setValue = vi.fn();
    const getValues = vi.fn((name?: string) => {
      if (name === "destinos") return [];
      if (!name) return { destinos: [] };
      return "";
    });
    const user = userEvent.setup();

    render(
      <ImagePrefillUpload
        tipo="vuelo"
        setValue={setValue as never}
        getValues={getValues as never}
      />,
    );

    const input = document.querySelector(
      'input[type="file"][accept*="image/jpeg"]',
    ) as HTMLInputElement;
    expect(input.multiple).toBe(true);

    await user.upload(input, new File(["x"], "ida.png", { type: "image/png" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(body.getAll("image")).toHaveLength(1);
    expect(body.get("tipo")).toBe("vuelo");
  });

  it("appends multiple vuelo images as repeated image fields", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        tipo: "vuelo",
        fields: vueloFields,
        warnings: ["Una captura no era legible; se usaron las demás."],
      }),
    } as unknown as Response);

    const setValue = vi.fn();
    const getValues = vi.fn((name?: string) => {
      if (name === "destinos") return [];
      if (!name) return { destinos: [] };
      return "";
    });
    const user = userEvent.setup();

    render(
      <ImagePrefillUpload
        tipo="vuelo"
        setValue={setValue as never}
        getValues={getValues as never}
      />,
    );

    const input = document.querySelector(
      'input[type="file"][accept*="image/jpeg"]',
    ) as HTMLInputElement;
    expect(input.multiple).toBe(true);

    await user.upload(input, [
      new File(["a"], "ida.png", { type: "image/png" }),
      new File(["b"], "vuelta.png", { type: "image/png" }),
    ]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(body.getAll("image")).toHaveLength(2);
    expect(body.get("tipo")).toBe("vuelo");
    expect(await screen.findByText(/Avisos/i)).toBeInTheDocument();
  });
});

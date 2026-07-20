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
          hotelAdultoArs: 213788,
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

    await waitFor(() => expect(onPrefill).toHaveBeenCalled());
    const paths = setValue.mock.calls.map(([path]) => path);
    expect(paths).toContain("destinos.1.hotelNombre");
    expect(paths).toContain("destinos.1.hotelAdultoArs");
    expect(paths.every((p) => String(p).startsWith("destinos.1."))).toBe(true);
    expect(screen.getByText(/Campos completados/i)).toBeInTheDocument();
  });
});

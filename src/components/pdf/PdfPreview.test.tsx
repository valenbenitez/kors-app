// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfPreview } from "@/components/pdf/PdfPreview";
import { defaultCotizacionValues } from "@/lib/validations/cotizacion";

const fetchMock = vi.fn<typeof fetch>();

function htmlResponse(html = "<!DOCTYPE html><html></html>"): Response {
  return {
    ok: true,
    text: async () => html,
    headers: { get: () => null },
  } as unknown as Response;
}

function errorResponse(message = "Fallo preview"): Response {
  return {
    ok: false,
    json: async () => ({ error: message }),
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = vi.fn(() => "blob:preview-mock");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

describe("PdfPreview", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <PdfPreview formValues={defaultCotizacionValues} open={false} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches preview HTML and shows iframe when open", async () => {
    fetchMock.mockResolvedValue(htmlResponse("<!DOCTYPE html><p>preview</p>"));
    render(<PdfPreview formValues={defaultCotizacionValues} open />);

    expect(screen.getByRole("status")).toBeInTheDocument();

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/preview-pdf",
        expect.objectContaining({ method: "POST" }),
      ),
    );

    const iframe = await screen.findByTitle("Vista previa del PDF");
    expect(iframe).toHaveAttribute("src", "blob:preview-mock");
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("shows error message when the API fails", async () => {
    fetchMock.mockResolvedValue(errorResponse("Sin sesión"));
    render(<PdfPreview formValues={defaultCotizacionValues} open />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Sin sesión");
    expect(screen.queryByTitle("Vista previa del PDF")).not.toBeInTheDocument();
  });
});

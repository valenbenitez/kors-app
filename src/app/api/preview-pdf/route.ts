import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { formToFormulaInput } from "@/lib/cotizador/build-input";
import { calcularCotizacion, FormulaError } from "@/lib/cotizador/formula";
import { renderPdfHtml } from "@/lib/pdf/template";
import { cotizacionFormSchema } from "@/lib/validations/cotizacion";

export const runtime = "nodejs";

/** Placeholder cot number for HTML preview — never persisted. */
export const PREVIEW_COT_NUMBER = "COT-PREVIEW";

/**
 * Returns the same HTML Puppeteer would render, without generating a PDF
 * or writing to Firestore.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo de solicitud inválido" },
      { status: 400 },
    );
  }

  const parsed = cotizacionFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Datos inválidos",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    const formulaInput = formToFormulaInput(parsed.data);
    const result = calcularCotizacion(formulaInput);
    const generatedAt = new Date().toISOString().slice(0, 10);

    const html = renderPdfHtml({
      cotNumber: PREVIEW_COT_NUMBER,
      form: parsed.data,
      result,
      generatedAt,
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Cotizacion-Numero": PREVIEW_COT_NUMBER,
      },
    });
  } catch (error) {
    if (error instanceof FormulaError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("preview-pdf error", error);
    return NextResponse.json(
      { error: "No se pudo generar la vista previa" },
      { status: 500 },
    );
  }
}

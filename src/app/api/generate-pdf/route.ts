import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { formToFormulaInput } from "@/lib/cotizador/build-input";
import { calcularCotizacion, FormulaError } from "@/lib/cotizador/formula";
import { resolveRates } from "@/lib/cotizador/rates";
import { createTripQuote } from "@/lib/firebase/trip-quotes/repository";
import { clientPdfFilename, generateCotNumber } from "@/lib/pdf/cot-number";
import { htmlToPdf } from "@/lib/pdf/generate";
import { renderPdfHtml } from "@/lib/pdf/template";
import { cotizacionFormSchema } from "@/lib/validations/cotizacion";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Persistence failure policy: if Firestore write fails after the PDF was
 * generated, the request fails with 500 and no PDF bytes are returned.
 * The client must retry; we prefer an explicit audit trail over a silent
 * download without a saved quote.
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
    // Prefer live sheet rates; fall back to FX_RATES_TO_USD if RATES_URL is
    // missing or the sheet is unreachable (same policy as the wizard).
    const { rates } = await resolveRates();
    const formulaInput = formToFormulaInput(parsed.data, rates);
    const result = calcularCotizacion(formulaInput);
    const generatedAt = new Date().toISOString().slice(0, 10);
    const cotNumber = generateCotNumber();
    const filename = clientPdfFilename(cotNumber);

    const html = renderPdfHtml({
      cotNumber,
      form: parsed.data,
      result,
      generatedAt,
    });

    const pdf = await htmlToPdf(html);

    try {
      await createTripQuote({
        cotNumber,
        status: "generated",
        form: parsed.data,
        result,
        createdBy: { uid: session.sub, email: session.email },
      });
    } catch (persistError) {
      console.error("generate-pdf persist error", persistError);
      return NextResponse.json(
        {
          error: "No se pudo guardar la cotización. Intentá de nuevo.",
        },
        { status: 500 },
      );
    }

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Cotizacion-Precio-Final": String(result.precioFinalCliente),
        "X-Cotizacion-Numero": cotNumber,
      },
    });
  } catch (error) {
    if (error instanceof FormulaError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("generate-pdf error", error);
    return NextResponse.json(
      { error: "No se pudo generar el PDF" },
      { status: 500 },
    );
  }
}

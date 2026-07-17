import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { formToFormulaInput } from "@/lib/cotizador/build-input";
import { calcularCotizacion, FormulaError } from "@/lib/cotizador/formula";
import { clientPdfFilename, generateCotNumber } from "@/lib/pdf/cot-number";
import { htmlToPdf } from "@/lib/pdf/generate";
import { renderPdfHtml } from "@/lib/pdf/template";
import { cotizacionFormSchema } from "@/lib/validations/cotizacion";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    const cotNumber = generateCotNumber();
    const filename = clientPdfFilename(cotNumber);

    const html = renderPdfHtml({
      cotNumber,
      form: parsed.data,
      result,
      generatedAt,
    });

    const pdf = await htmlToPdf(html);

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

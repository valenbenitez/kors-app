import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { buildQuotePdf } from "@/lib/cotizador/build-quote-pdf";
import { FormulaError } from "@/lib/cotizador/formula";
import { allocateCotNumber } from "@/lib/firebase/counters/cotizaciones";
import { createTripQuote } from "@/lib/firebase/trip-quotes/repository";
import { ROUNDING_RULE_CEILING_V1 } from "@/lib/firebase/trip-quotes/types";
import { clientPdfFilename } from "@/lib/pdf/cot-number";
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
    const cotNumber = await allocateCotNumber();
    const built = await buildQuotePdf(parsed.data, cotNumber);
    const filename = clientPdfFilename(cotNumber);
    const premiumTag = parsed.data.paquetePremium;

    try {
      await createTripQuote({
        cotNumber,
        status: "generated",
        form: parsed.data,
        result: built.result,
        createdBy: { uid: session.sub, email: session.email },
        roundingRule: ROUNDING_RULE_CEILING_V1,
        costoNetoUsd: built.result.subtotalUsd,
        margenAgenciaUsd: built.result.margenAgenciaUsd,
        margenVendedorUsd: built.result.margenVendedorUsd,
        precioFinalCliente: built.result.precioFinalCliente,
        perfil: parsed.data.perfil,
        premiumTag,
        clienteNombre: parsed.data.clienteNombre,
        pdfClienteUrl: null,
        pdfStoragePath: null,
        driveFileId: null,
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

    return new NextResponse(new Uint8Array(built.pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Cotizacion-Precio-Final": String(built.result.precioFinalCliente),
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

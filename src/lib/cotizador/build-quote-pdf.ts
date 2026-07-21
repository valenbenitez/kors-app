import { formToFormulaInput } from "@/lib/cotizador/build-input";
import {
  calcularCotizacion,
  type FormulaResult,
} from "@/lib/cotizador/formula";
import { resolveRates } from "@/lib/cotizador/rates";
import { clientPdfFilename } from "@/lib/pdf/cot-number";
import { htmlToPdf } from "@/lib/pdf/generate";
import { renderPdfHtml } from "@/lib/pdf/template";
import type { CotizacionFormInput } from "@/lib/validations/cotizacion";

export type BuiltQuotePdf = {
  cotNumber: string;
  filename: string;
  pdf: Buffer;
  form: CotizacionFormInput;
  result: FormulaResult;
  generatedAt: string;
};

/**
 * Shared PDF build pipeline for generate-pdf and cotizaciones routes:
 * resolve rates → formula → HTML → PDF bytes.
 */
export async function buildQuotePdf(
  form: CotizacionFormInput,
  cotNumber: string,
): Promise<BuiltQuotePdf> {
  const { rates } = await resolveRates();
  const formulaInput = formToFormulaInput(form, rates);
  const result = calcularCotizacion(formulaInput);
  const generatedAt = new Date().toISOString().slice(0, 10);
  const filename = clientPdfFilename(cotNumber);

  const html = renderPdfHtml({
    cotNumber,
    form,
    result,
    generatedAt,
  });

  const pdf = await htmlToPdf(html);

  return {
    cotNumber,
    filename,
    pdf,
    form,
    result,
    generatedAt,
  };
}

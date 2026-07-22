import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { buildQuotePdf } from "@/lib/cotizador/build-quote-pdf";
import { FormulaError } from "@/lib/cotizador/formula";
import { computePremiumTag } from "@/lib/cotizador/premium";
import {
  buildDriveStoragePath,
  createDriveClient,
  type DriveClient,
  DriveUploadError,
} from "@/lib/drive";
import { allocateCotNumber } from "@/lib/firebase/counters/cotizaciones";
import { FirebaseDomainError } from "@/lib/firebase/errors";
import { isAdmin } from "@/lib/firebase/trip-quotes/access";
import {
  createTripQuote,
  listTripQuotesAll,
  listTripQuotesForUser,
  updateTripQuoteDriveFields,
} from "@/lib/firebase/trip-quotes/repository";
import { toTripQuoteSummary } from "@/lib/firebase/trip-quotes/summary";
import { ROUNDING_RULE_CEILING_V1 } from "@/lib/firebase/trip-quotes/types";
import { cotizacionFormSchema } from "@/lib/validations/cotizacion";

export const runtime = "nodejs";
export const maxDuration = 60;

export type CotizacionesRouteDeps = {
  drive?: DriveClient;
  allocateCotNumber?: () => Promise<string>;
  buildQuotePdf?: typeof buildQuotePdf;
  createTripQuote?: typeof createTripQuote;
  updateTripQuoteDriveFields?: typeof updateTripQuoteDriveFields;
};

export type CotizacionesListDeps = {
  listTripQuotesForUser?: typeof listTripQuotesForUser;
  listTripQuotesAll?: typeof listTripQuotesAll;
};

/** Next.js App Router entry — no DI second arg (context is reserved). */
export async function GET(request: Request) {
  return handleCotizacionesGet(request);
}

/** Next.js App Router entry — no DI second arg (context is reserved). */
export async function POST(request: Request) {
  return handleCotizacionesPost(request);
}

/**
 * GET /api/cotizaciones — list trip quotes for the session user.
 *
 * Sellers see only their own quotes; admins see all.
 * Optional query: `?limit=` (default 50, max 200).
 * Response: `{ items: TripQuoteSummary[] }`.
 */
export async function handleCotizacionesGet(
  request: Request,
  deps: CotizacionesListDeps = {},
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitRaw = url.searchParams.get("limit");
  let limit = 50;
  if (limitRaw !== null) {
    const parsed = Number.parseInt(limitRaw, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return NextResponse.json(
        { error: "Parámetro limit inválido" },
        { status: 400 },
      );
    }
    limit = Math.min(parsed, 200);
  }

  const listOwn = deps.listTripQuotesForUser ?? listTripQuotesForUser;
  const listAll = deps.listTripQuotesAll ?? listTripQuotesAll;

  try {
    const docs = isAdmin(session)
      ? await listAll({ limit })
      : await listOwn(session.sub, { limit });

    return NextResponse.json(
      { items: docs.map(toTripQuoteSummary) },
      { status: 200 },
    );
  } catch (error) {
    console.error("cotizaciones list error", error);
    const detail =
      error instanceof FirebaseDomainError
        ? error.message
        : "No se pudieron listar las cotizaciones.";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}

/**
 * POST /api/cotizaciones — persist quote + optional Drive PDF upload.
 *
 * Drive behavior:
 * - Env unset / invalid credentials → noop, `pdf_drive_url: null`, save succeeds.
 * - Persist Firestore first (null Drive fields), then upload, then patch URL.
 * - Drive upload failure after persist → 200 with `pdf_drive_url: null`
 *   (save is not blocked); error is logged. Patch failure is also logged.
 *
 * Response (PRD snake_case): `{ cot_number, pdf_drive_url, saved_at }`.
 */
export async function handleCotizacionesPost(
  request: Request,
  deps: CotizacionesRouteDeps = {},
) {
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

  const drive = deps.drive ?? createDriveClient();
  const allocate = deps.allocateCotNumber ?? allocateCotNumber;
  const buildPdf = deps.buildQuotePdf ?? buildQuotePdf;
  const persist = deps.createTripQuote ?? createTripQuote;
  const patchDrive =
    deps.updateTripQuoteDriveFields ?? updateTripQuoteDriveFields;

  try {
    const cotNumber = await allocate();
    const built = await buildPdf(parsed.data, cotNumber);
    const storagePath = buildDriveStoragePath(cotNumber);
    const premiumTag = computePremiumTag(parsed.data, built.result);

    let docId: string;
    const savedAt = new Date().toISOString();

    try {
      docId = await persist({
        cotNumber,
        status: "generated",
        form: parsed.data,
        result: built.result,
        createdBy: { uid: session.sub, email: session.email },
        pdfClienteUrl: null,
        pdfStoragePath: storagePath,
        driveFileId: null,
        roundingRule: ROUNDING_RULE_CEILING_V1,
        costoNetoUsd: built.result.subtotalUsd,
        margenAgenciaUsd: built.result.margenAgenciaUsd,
        margenVendedorUsd: built.result.margenVendedorUsd,
        precioFinalCliente: built.result.precioFinalCliente,
        perfil: parsed.data.perfil,
        premiumTag,
        clienteNombre: parsed.data.clienteNombre,
      });
    } catch (persistError) {
      console.error("cotizaciones persist error", persistError);
      const detail =
        persistError instanceof FirebaseDomainError
          ? persistError.message
          : "No se pudo guardar la cotización en Firestore.";
      return NextResponse.json({ error: detail }, { status: 500 });
    }

    let driveUrl: string | null = null;
    let driveFileId: string | null = null;
    let pdfStoragePath: string | null = storagePath;

    try {
      const uploaded = await drive.uploadPdf({
        storagePath,
        pdf: built.pdf,
        filename: built.filename,
      });
      driveUrl = uploaded.url;
      driveFileId = uploaded.fileId;
      pdfStoragePath = uploaded.storagePath;

      if (driveUrl || driveFileId) {
        try {
          await patchDrive(docId, {
            pdfClienteUrl: driveUrl,
            pdfStoragePath,
            driveFileId,
          });
        } catch (patchError) {
          console.error(
            "cotizaciones drive patch error (quote already saved)",
            patchError,
          );
        }
      }
    } catch (driveError) {
      console.error(
        "cotizaciones drive upload error (quote already saved)",
        driveError,
      );
      if (!(driveError instanceof DriveUploadError)) {
        // keep null URL; save already succeeded
      }
      driveUrl = null;
      driveFileId = null;
    }

    return NextResponse.json(
      {
        cot_number: cotNumber,
        pdf_drive_url: driveUrl,
        saved_at: savedAt,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof FormulaError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("cotizaciones error", error);
    return NextResponse.json(
      { error: "No se pudo guardar la cotización" },
      { status: 500 },
    );
  }
}

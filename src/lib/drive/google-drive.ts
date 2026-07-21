import { Readable } from "node:stream";
import { google } from "googleapis";
import { DriveUploadError } from "./errors";
import type { DriveClient, DriveUploadInput, DriveUploadResult } from "./types";

export type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
};

type DriveFilesApi = {
  files: {
    list: (params: {
      q: string;
      fields: string;
      spaces?: string;
      supportsAllDrives?: boolean;
      includeItemsFromAllDrives?: boolean;
    }) => Promise<{ data: { files?: Array<{ id?: string | null }> | null } }>;
    create: (params: {
      requestBody: Record<string, unknown>;
      media?: { mimeType: string; body: Readable };
      fields: string;
      supportsAllDrives?: boolean;
    }) => Promise<{
      data: {
        id?: string | null;
        webViewLink?: string | null;
      };
    }>;
  };
  permissions: {
    create: (params: {
      fileId: string;
      requestBody: { role: string; type: string };
      supportsAllDrives?: boolean;
    }) => Promise<unknown>;
  };
};

/**
 * Parses service-account JSON from env (raw JSON or base64-encoded JSON).
 * Returns null when missing required fields — callers should fall back to noop.
 */
export function parseServiceAccountCredentials(
  raw: string,
): ServiceAccountCredentials | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    try {
      parsed = JSON.parse(Buffer.from(trimmed, "base64").toString("utf8"));
    } catch {
      return null;
    }
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as ServiceAccountCredentials).client_email !== "string" ||
    typeof (parsed as ServiceAccountCredentials).private_key !== "string" ||
    !(parsed as ServiceAccountCredentials).client_email.trim() ||
    !(parsed as ServiceAccountCredentials).private_key.trim()
  ) {
    return null;
  }

  const creds = parsed as ServiceAccountCredentials;
  return {
    client_email: creds.client_email,
    private_key: creds.private_key.replace(/\\n/g, "\n"),
  };
}

/**
 * Builds the relative storage path under the Drive root folder:
 * `PDF-Cotizaciones-cliente-whatsapp/{YYYY-MM}/COT-XXXX.pdf`
 *
 * `GOOGLE_DRIVE_FOLDER_ID` should point at the root folder
 * (`PDF-Cotizaciones-cliente-whatsapp`); we create/find `{YYYY-MM}` under it.
 */
export function buildDriveStoragePath(
  cotNumber: string,
  now = new Date(),
): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `PDF-Cotizaciones-cliente-whatsapp/${year}-${month}/${cotNumber}.pdf`;
}

/** Extracts `YYYY-MM` and filename from a storage path. */
export function parseDriveStoragePath(storagePath: string): {
  monthFolderName: string;
  filename: string;
} {
  const parts = storagePath.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new DriveUploadError(`Invalid Drive storage path: ${storagePath}`);
  }
  const filename = parts[parts.length - 1] ?? "";
  const monthFolderName = parts[parts.length - 2] ?? "";
  if (!filename || !monthFolderName) {
    throw new DriveUploadError(`Invalid Drive storage path: ${storagePath}`);
  }
  return { monthFolderName, filename };
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findOrCreateMonthFolder(
  drive: DriveFilesApi,
  parentFolderId: string,
  monthFolderName: string,
): Promise<string> {
  const name = escapeDriveQueryValue(monthFolderName);
  const parent = escapeDriveQueryValue(parentFolderId);
  const q = [
    `name='${name}'`,
    `'${parent}' in parents`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
  ].join(" and ");

  const listed = await drive.files.list({
    q,
    fields: "files(id,name)",
    spaces: "drive",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const existingId = listed.data.files?.[0]?.id;
  if (existingId) {
    return existingId;
  }

  const created = await drive.files.create({
    requestBody: {
      name: monthFolderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  const folderId = created.data.id;
  if (!folderId) {
    throw new DriveUploadError("Drive did not return a month folder id");
  }
  return folderId;
}

function buildDriveApi(credentials: ServiceAccountCredentials): DriveFilesApi {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  return google.drive({ version: "v3", auth }) as unknown as DriveFilesApi;
}

/**
 * Google Drive upload client.
 * Returns null when credentials JSON is invalid (factory must use noop).
 */
export function createGoogleDriveClient(options: {
  folderId: string;
  serviceAccountJson: string;
  /** Injectable API for unit tests. */
  driveApi?: DriveFilesApi;
}): DriveClient | null {
  const credentials = parseServiceAccountCredentials(
    options.serviceAccountJson,
  );
  if (!credentials) {
    return null;
  }

  const folderId = options.folderId.trim();
  if (!folderId) {
    return null;
  }

  const drive = options.driveApi ?? buildDriveApi(credentials);

  return {
    async uploadPdf(input: DriveUploadInput): Promise<DriveUploadResult> {
      try {
        const { monthFolderName, filename } = parseDriveStoragePath(
          input.storagePath,
        );
        const monthFolderId = await findOrCreateMonthFolder(
          drive,
          folderId,
          monthFolderName,
        );

        const created = await drive.files.create({
          requestBody: {
            name: filename,
            parents: [monthFolderId],
          },
          media: {
            mimeType: "application/pdf",
            body: Readable.from(input.pdf),
          },
          fields: "id, webViewLink",
          supportsAllDrives: true,
        });

        const fileId = created.data.id;
        if (!fileId) {
          throw new DriveUploadError("Drive did not return a file id");
        }

        try {
          await drive.permissions.create({
            fileId,
            requestBody: { role: "reader", type: "anyone" },
            supportsAllDrives: true,
          });
        } catch (permError) {
          // Link may still work for shared-drive members; keep upload success.
          console.warn(
            "Drive: could not set anyone-reader permission",
            permError,
          );
        }

        const url =
          created.data.webViewLink?.trim() ||
          `https://drive.google.com/file/d/${fileId}/view`;

        return {
          url,
          fileId,
          storagePath: input.storagePath,
        };
      } catch (error) {
        if (error instanceof DriveUploadError) {
          throw error;
        }
        const detail =
          error instanceof Error ? error.message : "unknown Drive error";
        throw new DriveUploadError(`Google Drive upload failed: ${detail}`, {
          cause: error,
        });
      }
    },
  };
}

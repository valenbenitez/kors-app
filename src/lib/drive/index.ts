import { createGoogleDriveClient } from "./google-drive";
import { createNoopDriveClient } from "./noop";
import type { DriveClient } from "./types";

export { DriveError, DriveUploadError } from "./errors";
export { buildDriveStoragePath } from "./google-drive";
export { createNoopDriveClient } from "./noop";
export type { DriveClient, DriveUploadInput, DriveUploadResult } from "./types";

/**
 * True when both folder id and service-account JSON are present.
 * Missing either → treat Drive as unset (noop, `pdf_drive_url: null`).
 */
export function isDriveConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(
    env.GOOGLE_DRIVE_FOLDER_ID?.trim() &&
      env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON?.trim(),
  );
}

/**
 * Factory: noop when Drive env is missing or credentials are invalid;
 * Google client when configured with a valid service-account JSON.
 * Tests may inject a mock via `createDriveClient({ client })`.
 *
 * Never returns a client that always throws on construction/env presence alone.
 */
export function createDriveClient(options?: {
  client?: DriveClient;
  env?: NodeJS.ProcessEnv;
}): DriveClient {
  if (options?.client) {
    return options.client;
  }

  const env = options?.env ?? process.env;
  if (!isDriveConfigured(env)) {
    return createNoopDriveClient();
  }

  const folderId = env.GOOGLE_DRIVE_FOLDER_ID?.trim() ?? "";
  const serviceAccountJson =
    env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON?.trim() ?? "";

  const googleClient = createGoogleDriveClient({
    folderId,
    serviceAccountJson,
  });

  if (!googleClient) {
    console.warn(
      "Google Drive env is set but credentials JSON is invalid — using noop (pdf_drive_url will be null).",
    );
    return createNoopDriveClient();
  }

  return googleClient;
}

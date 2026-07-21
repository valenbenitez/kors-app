import type { DriveClient, DriveUploadInput, DriveUploadResult } from "./types";

/** No-op Drive client — returns null URL without failing. */
export function createNoopDriveClient(): DriveClient {
  return {
    async uploadPdf(input: DriveUploadInput): Promise<DriveUploadResult> {
      return {
        url: null,
        fileId: null,
        storagePath: input.storagePath,
      };
    },
  };
}

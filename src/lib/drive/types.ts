/** Result of uploading a PDF to Drive (or noop). */
export type DriveUploadResult = {
  /** Web view / share URL, or null when Drive is not configured. */
  url: string | null;
  /** Drive file id when uploaded; null for noop. */
  fileId: string | null;
  /** Storage path used for the upload (audit). */
  storagePath: string;
};

export type DriveUploadInput = {
  /** Absolute-ish path under the configured root, e.g. `2026-07/COT-0001.pdf`. */
  storagePath: string;
  /** PDF bytes. */
  pdf: Buffer;
  /** MIME filename hint. */
  filename: string;
};

/**
 * Adapter for client-facing PDF storage.
 * Implementations must not swallow failures — throw named Drive errors.
 */
export interface DriveClient {
  uploadPdf(input: DriveUploadInput): Promise<DriveUploadResult>;
}

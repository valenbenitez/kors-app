/** Base domain error for Google Drive adapter failures. */
export class DriveError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DriveError";
  }
}

/** Thrown when Drive is configured but the upload fails. */
export class DriveUploadError extends DriveError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DriveUploadError";
  }
}

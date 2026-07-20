/** Named domain errors for quote-image extraction. Messages are English. */

export class AiExtractError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AiExtractError";
    this.code = code;
  }
}

/** Image is blank, corrupted, or vision model cannot read it. */
export class UnreadableImageError extends AiExtractError {
  constructor(message = "Image is unreadable") {
    super("unreadable_image", message);
    this.name = "UnreadableImageError";
  }
}

/** Uploaded image does not match the requested tipo (hotel vs vuelo). */
export class TypeMismatchError extends AiExtractError {
  constructor(
    message = "Image type does not match the requested extract tipo",
  ) {
    super("type_mismatch", message);
    this.name = "TypeMismatchError";
  }
}

/** Model returned nothing usable for form prefill. */
export class NothingUsableError extends AiExtractError {
  constructor(message = "No usable fields could be extracted from the image") {
    super("nothing_usable", message);
    this.name = "NothingUsableError";
  }
}

/** Multipart / body validation failed before calling the model. */
export class InvalidExtractRequestError extends AiExtractError {
  constructor(message: string) {
    super("invalid_request", message);
    this.name = "InvalidExtractRequestError";
  }
}

/** AI_GATEWAY_API_KEY missing or invalid at call time. */
export class AiGatewayConfigError extends AiExtractError {
  constructor(message = "AI Gateway is not configured") {
    super("ai_gateway_config", message);
    this.name = "AiGatewayConfigError";
  }
}

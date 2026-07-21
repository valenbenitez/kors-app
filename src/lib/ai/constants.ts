/** Vision model routed through Vercel AI Gateway (`provider/model`). */
// export const AI_EXTRACT_MODEL = "anthropic/claude-sonnet-4.6";
export const AI_EXTRACT_MODEL = "amazon/nova-lite";

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Max screenshots per hotel extract. */
export const MAX_HOTEL_IMAGES = 5;

/** Max screenshots per flight extract (e.g. outbound + return captures). */
export const MAX_VUELO_IMAGES = 5;

export function isAllowedImageMime(value: string): value is AllowedImageMime {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(value);
}

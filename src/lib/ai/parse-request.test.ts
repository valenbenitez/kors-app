import { describe, expect, test } from "vitest";
import {
  MAX_HOTEL_IMAGES,
  MAX_IMAGE_BYTES,
  MAX_VUELO_IMAGES,
} from "@/lib/ai/constants";
import { parseExtractRequest } from "@/lib/ai/parse-request";

function tinyPng(name = "a.png"): File {
  return new File([new Uint8Array([1, 2, 3, 4])], name, {
    type: "image/png",
  });
}

function multipartRequest(form: FormData): Request {
  return new Request("http://localhost/api/extract-quote-image", {
    method: "POST",
    body: form,
  });
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/extract-quote-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("parseExtractRequest — multipart", () => {
  test("parses hotel with a single image (regression)", async () => {
    const form = new FormData();
    form.set("tipo", "hotel");
    form.set("paxAdultos", "2");
    form.set("image", tinyPng());

    const parsed = await parseExtractRequest(multipartRequest(form));
    expect(parsed.tipo).toBe("hotel");
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0].mediaType).toBe("image/png");
    expect(parsed.images[0].bytes.byteLength).toBe(4);
    expect(parsed.paxAdultos).toBe(2);
  });

  test("parses hotel with multiple image fields", async () => {
    const form = new FormData();
    form.set("tipo", "hotel");
    form.set("paxAdultos", "2");
    form.append("image", tinyPng("rate.png"));
    form.append("image", tinyPng("conditions.png"));

    const parsed = await parseExtractRequest(multipartRequest(form));
    expect(parsed.images).toHaveLength(2);
    expect(parsed.images.every((img) => img.mediaType === "image/png")).toBe(
      true,
    );
  });

  test("collects images from both image and images fields", async () => {
    const form = new FormData();
    form.set("tipo", "hotel");
    form.set("paxAdultos", "1");
    form.append("image", tinyPng("a.png"));
    form.append("images", tinyPng("b.png"));

    const parsed = await parseExtractRequest(multipartRequest(form));
    expect(parsed.images).toHaveLength(2);
  });

  test("parses vuelo with a single image (regression)", async () => {
    const form = new FormData();
    form.set("tipo", "vuelo");
    form.set("image", tinyPng());

    const parsed = await parseExtractRequest(multipartRequest(form));
    expect(parsed.tipo).toBe("vuelo");
    expect(parsed.images).toHaveLength(1);
  });

  test("parses vuelo with multiple images (ida+vuelta)", async () => {
    const form = new FormData();
    form.set("tipo", "vuelo");
    form.append("image", tinyPng("ida.png"));
    form.append("image", tinyPng("vuelta.png"));

    const parsed = await parseExtractRequest(multipartRequest(form));
    expect(parsed.images).toHaveLength(2);
  });

  test("rejects vuelo over MAX_VUELO_IMAGES", async () => {
    const form = new FormData();
    form.set("tipo", "vuelo");
    for (let i = 0; i < MAX_VUELO_IMAGES + 1; i++) {
      form.append("image", tinyPng(`v${i}.png`));
    }

    await expect(parseExtractRequest(multipartRequest(form))).rejects.toThrow(
      new RegExp(`at most ${MAX_VUELO_IMAGES}`),
    );
  });

  test("rejects hotel over MAX_HOTEL_IMAGES", async () => {
    const form = new FormData();
    form.set("tipo", "hotel");
    form.set("paxAdultos", "1");
    for (let i = 0; i < MAX_HOTEL_IMAGES + 1; i++) {
      form.append("image", tinyPng(`h${i}.png`));
    }

    await expect(parseExtractRequest(multipartRequest(form))).rejects.toThrow(
      new RegExp(`at most ${MAX_HOTEL_IMAGES}`),
    );
  });

  test("rejects image over MAX_IMAGE_BYTES", async () => {
    const form = new FormData();
    form.set("tipo", "hotel");
    form.set("paxAdultos", "1");
    form.set(
      "image",
      new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "big.png", {
        type: "image/png",
      }),
    );

    await expect(parseExtractRequest(multipartRequest(form))).rejects.toThrow(
      /exceeds/,
    );
  });
});

describe("parseExtractRequest — JSON", () => {
  const b64 = Buffer.from([1, 2, 3]).toString("base64");

  test("accepts single imageBase64 (back-compat)", async () => {
    const parsed = await parseExtractRequest(
      jsonRequest({
        tipo: "hotel",
        paxAdultos: 2,
        imageBase64: b64,
        mediaType: "image/jpeg",
      }),
    );
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0].mediaType).toBe("image/jpeg");
  });

  test("accepts images array for hotel", async () => {
    const parsed = await parseExtractRequest(
      jsonRequest({
        tipo: "hotel",
        paxAdultos: 1,
        images: [
          { imageBase64: b64, mediaType: "image/png" },
          { imageBase64: b64, mediaType: "image/webp" },
        ],
      }),
    );
    expect(parsed.images).toHaveLength(2);
    expect(parsed.images[1].mediaType).toBe("image/webp");
  });

  test("accepts images array for vuelo (ida+vuelta)", async () => {
    const parsed = await parseExtractRequest(
      jsonRequest({
        tipo: "vuelo",
        images: [
          { imageBase64: b64, mediaType: "image/png" },
          { imageBase64: b64, mediaType: "image/jpeg" },
        ],
      }),
    );
    expect(parsed.images).toHaveLength(2);
    expect(parsed.images[1].mediaType).toBe("image/jpeg");
  });

  test("rejects vuelo images array over MAX_VUELO_IMAGES", async () => {
    const images = Array.from({ length: MAX_VUELO_IMAGES + 1 }, () => ({
      imageBase64: b64,
      mediaType: "image/png",
    }));
    await expect(
      parseExtractRequest(jsonRequest({ tipo: "vuelo", images })),
    ).rejects.toThrow(new RegExp(`at most ${MAX_VUELO_IMAGES}`));
  });
});

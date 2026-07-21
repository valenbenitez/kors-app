import { describe, expect, test, vi } from "vitest";
import {
  createDriveClient,
  createNoopDriveClient,
  isDriveConfigured,
} from "@/lib/drive";
import {
  buildDriveStoragePath,
  createGoogleDriveClient,
  parseDriveStoragePath,
  parseServiceAccountCredentials,
} from "@/lib/drive/google-drive";

const validSaJson = JSON.stringify({
  client_email: "sa@project.iam.gserviceaccount.com",
  private_key:
    "-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n",
});

describe("Drive factory", () => {
  test("isDriveConfigured is false when env is missing", () => {
    expect(isDriveConfigured({})).toBe(false);
    expect(isDriveConfigured({ GOOGLE_DRIVE_FOLDER_ID: "folder-only" })).toBe(
      false,
    );
  });

  test("isDriveConfigured is true when both vars are set", () => {
    expect(
      isDriveConfigured({
        GOOGLE_DRIVE_FOLDER_ID: "folder",
        GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: "{}",
      }),
    ).toBe(true);
  });

  test("createDriveClient returns noop when env unset", async () => {
    const client = createDriveClient({ env: {} });
    const result = await client.uploadPdf({
      storagePath: "PDF-Cotizaciones-cliente-whatsapp/2026-07/COT-0001.pdf",
      pdf: Buffer.from("%PDF"),
      filename: "COT-0001.pdf",
    });
    expect(result.url).toBeNull();
    expect(result.fileId).toBeNull();
  });

  test("createDriveClient returns noop when credentials JSON is invalid", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = createDriveClient({
      env: {
        GOOGLE_DRIVE_FOLDER_ID: "folder",
        GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: "not-json",
      },
    });
    const result = await client.uploadPdf({
      storagePath: "PDF-Cotizaciones-cliente-whatsapp/2026-07/COT-0001.pdf",
      pdf: Buffer.from("%PDF"),
      filename: "COT-0001.pdf",
    });
    expect(result.url).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test("injected mock Drive returns a URL", async () => {
    const mock = {
      uploadPdf: async () => ({
        url: "https://drive.example/file",
        fileId: "id-1",
        storagePath: "path",
      }),
    };
    const client = createDriveClient({ client: mock });
    const result = await client.uploadPdf({
      storagePath: "path",
      pdf: Buffer.from("%PDF"),
      filename: "x.pdf",
    });
    expect(result.url).toBe("https://drive.example/file");
  });

  test("noop client always returns null URL", async () => {
    const result = await createNoopDriveClient().uploadPdf({
      storagePath: "x",
      pdf: Buffer.from("%PDF"),
      filename: "x.pdf",
    });
    expect(result).toEqual({
      url: null,
      fileId: null,
      storagePath: "x",
    });
  });

  test("buildDriveStoragePath uses YYYY-MM and cot number", () => {
    const path = buildDriveStoragePath(
      "COT-0007",
      new Date("2026-07-21T12:00:00Z"),
    );
    expect(path).toBe("PDF-Cotizaciones-cliente-whatsapp/2026-07/COT-0007.pdf");
  });
});

describe("parseServiceAccountCredentials", () => {
  test("parses raw JSON and unescapes private_key newlines", () => {
    const creds = parseServiceAccountCredentials(validSaJson);
    expect(creds?.client_email).toBe("sa@project.iam.gserviceaccount.com");
    expect(creds?.private_key).toContain("\nABC\n");
  });

  test("parses base64-encoded JSON", () => {
    const b64 = Buffer.from(validSaJson, "utf8").toString("base64");
    expect(parseServiceAccountCredentials(b64)?.client_email).toBe(
      "sa@project.iam.gserviceaccount.com",
    );
  });

  test("returns null for invalid payloads", () => {
    expect(parseServiceAccountCredentials("")).toBeNull();
    expect(parseServiceAccountCredentials("{}")).toBeNull();
    expect(parseServiceAccountCredentials("not-json")).toBeNull();
  });
});

describe("createGoogleDriveClient upload", () => {
  test("returns null for invalid credentials (never a throwing stub)", () => {
    expect(
      createGoogleDriveClient({
        folderId: "folder",
        serviceAccountJson: "{}",
      }),
    ).toBeNull();
  });

  test("uploads into YYYY-MM folder and returns webViewLink", async () => {
    const list = vi.fn(async () => ({ data: { files: [] } }));
    const create = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: "month-folder-id" } })
      .mockResolvedValueOnce({
        data: {
          id: "file-id",
          webViewLink: "https://drive.google.com/file/d/file-id/view",
        },
      });
    const permissionsCreate = vi.fn(async () => ({}));

    const client = createGoogleDriveClient({
      folderId: "root-folder",
      serviceAccountJson: validSaJson,
      driveApi: {
        files: { list, create },
        permissions: { create: permissionsCreate },
      },
    });

    if (!client) {
      throw new Error("expected Google Drive client");
    }
    const result = await client.uploadPdf({
      storagePath: "PDF-Cotizaciones-cliente-whatsapp/2026-07/COT-0001.pdf",
      pdf: Buffer.from("%PDF-1.4"),
      filename: "COT-0001_cliente.pdf",
    });

    expect(parseDriveStoragePath(result.storagePath)).toEqual({
      monthFolderName: "2026-07",
      filename: "COT-0001.pdf",
    });
    expect(list).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]?.[0]?.requestBody).toEqual(
      expect.objectContaining({
        name: "2026-07",
        mimeType: "application/vnd.google-apps.folder",
        parents: ["root-folder"],
      }),
    );
    expect(create.mock.calls[1]?.[0]?.requestBody).toEqual(
      expect.objectContaining({
        name: "COT-0001.pdf",
        parents: ["month-folder-id"],
      }),
    );
    expect(permissionsCreate).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        fileId: "file-id",
        requestBody: { role: "reader", type: "anyone" },
      }),
    );
    expect(result).toEqual({
      url: "https://drive.google.com/file/d/file-id/view",
      fileId: "file-id",
      storagePath: "PDF-Cotizaciones-cliente-whatsapp/2026-07/COT-0001.pdf",
    });
  });

  test("reuses existing month folder when found", async () => {
    const list = vi.fn(async () => ({
      data: { files: [{ id: "existing-month" }] },
    }));
    const create = vi.fn(async () => ({
      data: { id: "file-2", webViewLink: null },
    }));

    const client = createGoogleDriveClient({
      folderId: "root",
      serviceAccountJson: validSaJson,
      driveApi: {
        files: { list, create },
        permissions: { create: vi.fn(async () => ({})) },
      },
    });

    if (!client) {
      throw new Error("expected Google Drive client");
    }
    const result = await client.uploadPdf({
      storagePath: "PDF-Cotizaciones-cliente-whatsapp/2026-08/COT-0002.pdf",
      pdf: Buffer.from("%PDF"),
      filename: "COT-0002.pdf",
    });

    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]?.[0]?.requestBody.parents).toEqual([
      "existing-month",
    ]);
    expect(result.url).toBe("https://drive.google.com/file/d/file-2/view");
  });
});

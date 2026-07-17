import { z } from "zod";

const envSchema = z.object({
  AUTH_EMAIL: z.string().email(),
  AUTH_PASSWORD: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  PDF_RUNTIME: z.enum(["local", "serverless"]).default("local"),
  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `Invalid or missing environment variables: ${missing}. Copy .env.example to .env.local and configure values.`,
    );
  }

  return parsed.data;
}

/** Server-only validated env. Throws at runtime if vars are missing. */
export function getEnv(): Env {
  return loadEnv();
}

/** True when deployed to a serverless platform (Vercel, etc.). */
export function isServerlessPdfRuntime(): boolean {
  return process.env.PDF_RUNTIME === "serverless" || process.env.VERCEL === "1";
}

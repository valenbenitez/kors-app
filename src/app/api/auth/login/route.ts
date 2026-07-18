import { NextResponse } from "next/server";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { verifyIdToken } from "@/lib/firebase/admin";
import { sessionExchangeSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo de solicitud inválido" },
      { status: 400 },
    );
  }

  const parsed = sessionExchangeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const { idToken } = parsed.data;

  try {
    await verifyIdToken(idToken);
    const sessionCookie = await createSessionToken(idToken);
    await setSessionCookie(sessionCookie);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Email o contraseña incorrectos" },
      { status: 401 },
    );
  }
}

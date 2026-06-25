import { NextResponse } from "next/server";

const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET;

export function requireAdminAuth(request: Request): NextResponse | null {
  if (!ADMIN_API_SECRET) {
    return NextResponse.json(
      { error: "ADMIN_API_SECRET no configurado en el servidor" },
      { status: 500 },
    );
  }

  const providedKey = request.headers.get("x-admin-key");
  if (providedKey !== ADMIN_API_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return null;
}

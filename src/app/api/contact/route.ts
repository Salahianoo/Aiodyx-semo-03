import { NextResponse } from "next/server";

/**
 * STUB — validates and logs, delivers nothing. Replace the marked block with
 * a real lead API call, email service, or CRM webhook before production.
 */
export async function POST(request: Request) {
  let body: Record<string, string>;
  try {
    body = (await request.json()) as Record<string, string>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Honeypot: accept silently so the bot sees success and doesn't retry
  if (body.website) return NextResponse.json({ ok: true });

  const missing = ["name", "email", "message"].filter((f) => !body[f]?.trim());
  if (missing.length) {
    return NextResponse.json({ error: "missing_fields", missing }, { status: 422 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 422 });
  }

  // ---- Replace with real delivery ------------------------------------
  console.log("[contact] lead", { name: body.name, email: body.email });
  // --------------------------------------------------------------------

  return NextResponse.json({ ok: true });
}

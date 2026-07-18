// app/api/scan-state/route.ts
// GET  /api/scan-state — returns cached scan state (lastScannedBlock + tokens)
// POST /api/scan-state — persists newly discovered tokens + block position

import { NextResponse } from "next/server";
import { getScanState, addCachedTokens } from "@/lib/kv-store";
import type { CachedToken } from "@/lib/kv-store";

export const runtime = "nodejs";
export const revalidate = 0;

// ─── GET: Load cached scan state ────────────────────────────────────────────
export async function GET() {
  try {
    const state = await getScanState();
    return NextResponse.json(state, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── POST: Save new discoveries ─────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const lastScannedBlock = typeof body.lastScannedBlock === "number"
      ? body.lastScannedBlock
      : 0;

    const newTokens: CachedToken[] = Array.isArray(body.newTokens)
      ? body.newTokens
      : [];

    // Validate token entries minimally
    const validated = newTokens.filter(
      (t: CachedToken) =>
        typeof t.address === "string" &&
        t.address.startsWith("0x") &&
        typeof t.name === "string" &&
        typeof t.symbol === "string",
    );

    await addCachedTokens(validated, lastScannedBlock);

    return NextResponse.json(
      { ok: true, cached: validated.length },
      { status: 200 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

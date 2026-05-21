import { NextResponse, type NextRequest } from "next/server";
import { firebaseDataSource, verifyAccessCode } from "@/lib/data/firebaseDataSource";
import { buildMasterUnlockCookie, buildUnlockCookie } from "@/lib/auth/cookies";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { fundraiserId?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const { fundraiserId, code } = body;
  if (!fundraiserId || typeof code !== "string") {
    return NextResponse.json({ ok: false, error: "Missing fundraiserId or code" }, { status: 400 });
  }

  const fundraiser = await firebaseDataSource.getFundraiser(fundraiserId);
  if (!fundraiser) {
    return NextResponse.json({ ok: false, error: "Unknown fundraiser" }, { status: 404 });
  }

  const result = await verifyAccessCode(fundraiserId, code);
  if (!result.ok) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, matchedAs: result.matchedAs });
  const unlockCookie = buildUnlockCookie(fundraiserId);
  res.cookies.set(unlockCookie.name, unlockCookie.value, unlockCookie.options);
  if (result.matchedAs === "master") {
    const master = buildMasterUnlockCookie();
    res.cookies.set(master.name, master.value, master.options);
  }
  return res;
}

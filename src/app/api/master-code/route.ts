import { NextResponse, type NextRequest } from "next/server";
import { getMasterCode, setMasterCode } from "@/lib/data/firebaseDataSource";
import { isMasterUnlockedRequest } from "@/lib/auth/cookies";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isMasterUnlockedRequest(req)) {
    return NextResponse.json({ error: "Not master-unlocked" }, { status: 401 });
  }
  const code = await getMasterCode();
  return NextResponse.json({ masterCode: code });
}

export async function PATCH(req: NextRequest) {
  if (!isMasterUnlockedRequest(req)) {
    return NextResponse.json({ error: "Not master-unlocked" }, { status: 401 });
  }
  let body: { masterCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.masterCode !== "string") {
    return NextResponse.json({ error: "masterCode required" }, { status: 400 });
  }
  try {
    await setMasterCode(body.masterCode);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

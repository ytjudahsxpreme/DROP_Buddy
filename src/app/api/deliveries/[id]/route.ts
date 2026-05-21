import { NextResponse, type NextRequest } from "next/server";
import { getDeliveries, setDelivered } from "@/lib/data/firebaseDataSource";
import { isUnlockedRequest } from "@/lib/auth/cookies";

export const runtime = "nodejs";

function isValidIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUnlockedRequest(req, id)) {
    return NextResponse.json({ error: "Not unlocked" }, { status: 401 });
  }
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !isValidIsoDate(date)) {
    return NextResponse.json({ error: "date=YYYY-MM-DD required" }, { status: 400 });
  }
  const delivered = await getDeliveries(id, date);
  return NextResponse.json({ date, delivered });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUnlockedRequest(req, id)) {
    return NextResponse.json({ error: "Not unlocked" }, { status: 401 });
  }
  let body: { date?: string; studentKey?: string; delivered?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { date, studentKey, delivered } = body;
  if (!date || !isValidIsoDate(date)) {
    return NextResponse.json({ error: "date=YYYY-MM-DD required" }, { status: 400 });
  }
  if (!studentKey || typeof studentKey !== "string") {
    return NextResponse.json({ error: "studentKey required" }, { status: 400 });
  }
  if (typeof delivered !== "boolean") {
    return NextResponse.json({ error: "delivered (boolean) required" }, { status: 400 });
  }
  await setDelivered(id, date, studentKey, delivered);
  return NextResponse.json({ ok: true });
}

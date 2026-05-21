import "server-only";
import { getDb } from "../firebase/admin";
import { fetchManyWorksheets } from "../sheets/client";
import { parseFundraiser, type RawRow } from "./parser";
import type {
  Fundraiser,
  SheetConfig,
  StudentOrder,
} from "./types";
import type { DataSource, FundraiserPatch } from "./dataSource";

const COLLECTION = "fundraisers";

function docToFundraiser(id: string, data: FirebaseFirestore.DocumentData | undefined): Fundraiser | null {
  if (!data) return null;
  return {
    id,
    name: data.name,
    classYear: data.classYear,
    accessCode: data.accessCode,
    color: data.color,
    emoji: data.emoji,
    sheetConfig: data.sheetConfig as SheetConfig,
  };
}

export const firebaseDataSource: DataSource = {
  async listFundraisers() {
    const db = getDb();
    const snap = await db.collection(COLLECTION).get();
    return snap.docs
      .map((d) => docToFundraiser(d.id, d.data()))
      .filter((f): f is Fundraiser => f !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async getFundraiser(id) {
    const db = getDb();
    const snap = await db.collection(COLLECTION).doc(id).get();
    return docToFundraiser(snap.id, snap.data());
  },

  async listOrders(fundraiserId) {
    const fundraiser = await firebaseDataSource.getFundraiser(fundraiserId);
    if (!fundraiser) return [];
    const { sheetConfig } = fundraiser;
    if (!sheetConfig.sheetUrl || sheetConfig.worksheets.length === 0) return [];

    const worksheetNames = sheetConfig.worksheets.map((w) => w.name);
    const rawByName = await fetchManyWorksheets(sheetConfig.sheetUrl, worksheetNames);

    // parseFundraiser keys rows by worksheet.id; map sheet-tab-name back to id.
    const rawById: Record<string, RawRow[]> = {};
    for (const ws of sheetConfig.worksheets) {
      rawById[ws.id] = rawByName[ws.name] ?? [];
    }

    const result = parseFundraiser(fundraiserId, rawById, sheetConfig);
    return result.orders;
  },

  async updateFundraiser(id, patch: FundraiserPatch) {
    const db = getDb();
    const ref = db.collection(COLLECTION).doc(id);
    const update: Record<string, unknown> = {};
    if (patch.accessCode !== undefined) update.accessCode = patch.accessCode;
    if (patch.sheetConfig !== undefined) update.sheetConfig = patch.sheetConfig;
    await ref.set(update, { merge: true });
    const fresh = await ref.get();
    const out = docToFundraiser(fresh.id, fresh.data());
    if (!out) throw new Error(`Fundraiser ${id} not found after update`);
    return out;
  },
};

const AUTH_DOC = ["config", "auth"] as const;

/**
 * Read the master access code from Firestore. Falls back to the
 * MASTER_ACCESS_CODE env var, then to a development default. Trims to
 * guard against env-var paste artifacts (trailing newline / space).
 */
export async function getMasterCode(): Promise<string> {
  try {
    const db = getDb();
    const snap = await db.collection(AUTH_DOC[0]).doc(AUTH_DOC[1]).get();
    const v = snap.data()?.masterCode;
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  } catch {
    // Fall through to env-var fallback if Firestore is unreachable.
  }
  return (process.env.MASTER_ACCESS_CODE ?? "admin-2026").trim();
}

/**
 * Persist a new master access code. Caller must already be master-unlocked.
 */
export async function setMasterCode(newCode: string): Promise<void> {
  const trimmed = newCode.trim();
  if (!trimmed) throw new Error("Master code cannot be empty");
  if (trimmed.length < 4) throw new Error("Master code must be at least 4 characters");
  const db = getDb();
  await db
    .collection(AUTH_DOC[0])
    .doc(AUTH_DOC[1])
    .set({ masterCode: trimmed, updatedAt: new Date().toISOString() }, { merge: true });
}

export type VerifyAccessResult =
  | { ok: true; matchedAs: "master" | "fundraiser" }
  | { ok: false };

/**
 * Server-side verification of an access code. Reports whether the match was
 * via the master code or the per-fundraiser code so the caller can decide
 * which cookies to issue.
 */
export async function verifyAccessCode(
  fundraiserId: string,
  code: string,
): Promise<VerifyAccessResult> {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false };
  const master = await getMasterCode();
  if (trimmed === master) return { ok: true, matchedAs: "master" };
  const fundraiser = await firebaseDataSource.getFundraiser(fundraiserId);
  if (!fundraiser) return { ok: false };
  if (trimmed === (fundraiser.accessCode ?? "").trim()) {
    return { ok: true, matchedAs: "fundraiser" };
  }
  return { ok: false };
}

/**
 * Bulk upsert (used by the seed script).
 */
export async function seedFundraisers(fundraisers: Fundraiser[]): Promise<void> {
  const db = getDb();
  const batch = db.batch();
  for (const f of fundraisers) {
    const ref = db.collection(COLLECTION).doc(f.id);
    const { id: _omit, ...rest } = f;
    void _omit;
    batch.set(ref, rest, { merge: false });
  }
  await batch.commit();
}

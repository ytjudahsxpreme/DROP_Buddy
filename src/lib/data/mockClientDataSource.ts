import { MOCK_FUNDRAISERS, MOCK_ORDERS } from "./mockData";
import type { DataSource, FundraiserPatch } from "./dataSource";
import type { Fundraiser } from "./types";

/**
 * Client-side mock data source. Used only when NEXT_PUBLIC_USE_MOCK_DATA=1.
 * Uses localStorage for settings overrides so the Settings UI is testable
 * without a backend.
 */

const LS_OVERRIDES_KEY = "drop-buddy:fundraiser-overrides:v2";

interface StoredOverride {
  accessCode?: string;
  sheetConfig?: Fundraiser["sheetConfig"];
}

function loadOverrides(): Record<string, StoredOverride> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(LS_OVERRIDES_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveOverrides(overrides: Record<string, StoredOverride>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_OVERRIDES_KEY, JSON.stringify(overrides));
}

function applyOverride(f: Fundraiser, overrides: Record<string, StoredOverride>): Fundraiser {
  const o = overrides[f.id];
  if (!o) return f;
  return {
    ...f,
    accessCode: o.accessCode ?? f.accessCode,
    sheetConfig: o.sheetConfig ?? f.sheetConfig,
  };
}

export const mockClientDataSource: DataSource = {
  async listFundraisers() {
    const overrides = loadOverrides();
    return MOCK_FUNDRAISERS.map((f) => applyOverride(f, overrides));
  },
  async getFundraiser(id) {
    const overrides = loadOverrides();
    const found = MOCK_FUNDRAISERS.find((f) => f.id === id);
    return found ? applyOverride(found, overrides) : null;
  },
  async listOrders(fundraiserId) {
    return MOCK_ORDERS.filter((o) => o.fundraiserId === fundraiserId);
  },
  async updateFundraiser(id, patch: FundraiserPatch) {
    const overrides = loadOverrides();
    const existing: StoredOverride = overrides[id] ?? {};
    overrides[id] = {
      accessCode: patch.accessCode ?? existing.accessCode,
      sheetConfig: patch.sheetConfig ?? existing.sheetConfig,
    };
    saveOverrides(overrides);
    const updated = await this.getFundraiser(id);
    if (!updated) throw new Error(`Fundraiser ${id} not found`);
    return updated;
  },
};

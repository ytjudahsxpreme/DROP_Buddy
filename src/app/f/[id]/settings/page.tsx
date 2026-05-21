"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { MasterCodeCard } from "@/components/MasterCodeCard";
import { dataSource } from "@/lib/data/dataSource";
import type {
  ColumnMapping,
  Fundraiser,
  FundraiserItem,
  WorksheetSource,
} from "@/lib/data/types";
import { cn } from "@/lib/utils/cn";

const COMMON_FIELDS: { key: keyof ColumnMapping; label: string; required?: boolean }[] = [
  { key: "firstName", label: "First Name", required: true },
  { key: "lastName", label: "Last Name", required: true },
  { key: "grade", label: "Grade" },
  { key: "building", label: "Building" },
  { key: "notes", label: "Notes" },
];

export default function SettingsPage() {
  const params = useParams<{ id: string }>();
  const fundraiserId = params?.id ?? "";
  const [fundraiser, setFundraiser] = useState<Fundraiser | null>(null);
  const [draft, setDraft] = useState<Fundraiser | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    dataSource.getFundraiser(fundraiserId).then((f) => {
      setFundraiser(f);
      setDraft(f ? structuredClone(f) : null);
    });
  }, [fundraiserId]);

  if (!fundraiser || !draft) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-4">
        <div className="h-40 rounded-2xl bg-white border border-slate-200 animate-pulse" />
      </div>
    );
  }

  const dirty = JSON.stringify(fundraiser) !== JSON.stringify(draft);

  async function save() {
    if (!draft) return;
    setSaving(true);
    const updated = await dataSource.updateFundraiser(fundraiserId, {
      accessCode: draft.accessCode,
      sheetConfig: draft.sheetConfig,
    });
    setFundraiser(updated);
    setDraft(structuredClone(updated));
    setSaving(false);
    setSavedAt(new Date());
  }

  function reset() {
    setDraft(structuredClone(fundraiser!));
  }

  function updateDraft(patch: Partial<Fundraiser>) {
    setDraft({ ...draft!, ...patch });
  }

  function updateWorksheet(index: number, next: WorksheetSource) {
    const worksheets = [...draft!.sheetConfig.worksheets];
    worksheets[index] = next;
    updateDraft({
      sheetConfig: { ...draft!.sheetConfig, worksheets },
    });
  }

  function addWorksheet() {
    const newWs: WorksheetSource = {
      id: `ws-${Date.now()}`,
      name: "New Tab",
      headerRow: 1,
      dataStartRow: 2,
      columnMapping: {
        firstName: "First Name",
        lastName: "Last Name",
      },
      items: [],
    };
    updateDraft({
      sheetConfig: {
        ...draft!.sheetConfig,
        worksheets: [...draft!.sheetConfig.worksheets, newWs],
      },
    });
  }

  function removeWorksheet(index: number) {
    const worksheets = draft!.sheetConfig.worksheets.filter((_, i) => i !== index);
    updateDraft({ sheetConfig: { ...draft!.sheetConfig, worksheets } });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
      <MasterCodeCard />
      <Card title="Access code">
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Code shared with class advisors and officers
        </label>
        <input
          type="text"
          value={draft.accessCode}
          onChange={(e) => updateDraft({ accessCode: e.target.value })}
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-base font-mono outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
        />
        <p className="mt-1.5 text-xs text-slate-500">
          The master/admin code also grants access to every fundraiser.
        </p>
      </Card>

      <Card title="Google Sheet">
        <Field label="Sheet URL">
          <input
            type="url"
            value={draft.sheetConfig.sheetUrl}
            onChange={(e) =>
              updateDraft({
                sheetConfig: { ...draft.sheetConfig, sheetUrl: e.target.value },
              })
            }
            placeholder="https://docs.google.com/spreadsheets/d/…"
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 font-mono"
          />
        </Field>
        <p className="text-xs text-slate-500">
          Each fundraiser pulls from one Sheet but can read many tabs from it. Add a worksheet below
          for every tab you want the app to pull from.
        </p>
      </Card>

      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Worksheets</h2>
        <button
          type="button"
          onClick={addWorksheet}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 text-white text-sm font-medium px-3 py-2 hover:bg-slate-800"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add tab
        </button>
      </div>

      {draft.sheetConfig.worksheets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 px-6 py-8 text-center">
          <p className="text-sm text-slate-600">No worksheets configured yet.</p>
          <p className="mt-1 text-xs text-slate-500">
            Add a tab to start mapping columns from your sheet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {draft.sheetConfig.worksheets.map((ws, i) => (
            <WorksheetEditor
              key={ws.id}
              worksheet={ws}
              onChange={(next) => updateWorksheet(i, next)}
              onRemove={() => removeWorksheet(i)}
              canRemove={draft.sheetConfig.worksheets.length > 1}
            />
          ))}
        </div>
      )}

      <div className="sticky bottom-24 z-10 -mx-4 px-4">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white/95 backdrop-blur border border-slate-200 shadow-lg p-3 flex items-center gap-3">
          <div className="flex-1 text-xs text-slate-500">
            {dirty
              ? "Unsaved changes"
              : savedAt
                ? `Saved at ${savedAt.toLocaleTimeString()}`
                : "All changes saved"}
          </div>
          <button
            type="button"
            onClick={reset}
            disabled={!dirty || saving}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WorksheetEditor({
  worksheet,
  onChange,
  onRemove,
  canRemove,
}: {
  worksheet: WorksheetSource;
  onChange: (next: WorksheetSource) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  function updateMapping(key: keyof ColumnMapping, value: string) {
    onChange({
      ...worksheet,
      columnMapping: { ...worksheet.columnMapping, [key]: value || undefined },
    });
  }

  function updateItem(index: number, next: FundraiserItem) {
    const items = [...worksheet.items];
    items[index] = next;
    onChange({ ...worksheet, items });
  }

  function addItem() {
    const item: FundraiserItem = {
      id: `item-${Date.now()}`,
      name: "New item",
      quantityColumn: "",
    };
    onChange({ ...worksheet, items: [...worksheet.items, item] });
  }

  function removeItem(index: number) {
    onChange({ ...worksheet, items: worksheet.items.filter((_, i) => i !== index) });
  }

  return (
    <details className="group rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden" open>
      <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none">
        <div className="flex items-center gap-2 min-w-0">
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4 text-slate-400 shrink-0 transition-transform group-open:rotate-90"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
          <h3 className="text-sm font-semibold truncate">
            {worksheet.name || <span className="text-slate-400">Untitled tab</span>}
          </h3>
          <span className="text-[11px] uppercase tracking-wide text-slate-500 font-medium shrink-0">
            · {worksheet.items.length} item{worksheet.items.length === 1 ? "" : "s"}
          </span>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
            className="text-xs font-medium text-rose-600 hover:text-rose-700 px-2 py-1 rounded-md hover:bg-rose-50"
          >
            Remove
          </button>
        )}
      </summary>

      <div className="border-t border-slate-100 p-4 space-y-4">
        <Field label="Tab name">
          <input
            type="text"
            value={worksheet.name}
            onChange={(e) => onChange({ ...worksheet, name: e.target.value })}
            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Header row">
            <input
              type="number"
              min={1}
              value={worksheet.headerRow}
              onChange={(e) =>
                onChange({
                  ...worksheet,
                  headerRow: Math.max(1, parseInt(e.target.value || "1", 10)),
                })
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            />
          </Field>
          <Field label="Data starts on row">
            <input
              type="number"
              min={1}
              value={worksheet.dataStartRow}
              onChange={(e) =>
                onChange({
                  ...worksheet,
                  dataStartRow: Math.max(1, parseInt(e.target.value || "1", 10)),
                })
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            />
          </Field>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Column mapping
          </h4>
          <div className="space-y-2">
            {COMMON_FIELDS.map((f) => (
              <div key={f.key} className="grid grid-cols-[110px_1fr] items-center gap-3">
                <label className="text-sm text-slate-700">
                  {f.label}
                  {f.required && <span className="text-rose-500 ml-0.5">*</span>}
                </label>
                <input
                  type="text"
                  value={worksheet.columnMapping[f.key] ?? ""}
                  onChange={(e) => updateMapping(f.key, e.target.value)}
                  placeholder={f.required ? "Required" : "Optional"}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Items</h4>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add item
            </button>
          </div>
          {worksheet.items.length === 0 ? (
            <p className="text-xs text-slate-500 italic px-1 py-2">
              No items yet. Add the products this tab sells (e.g. Pizza, Chips, Juice).
            </p>
          ) : (
            <div className="space-y-2">
              {worksheet.items.map((item, i) => (
                <ItemEditor
                  key={item.id}
                  item={item}
                  onChange={(next) => updateItem(i, next)}
                  onRemove={() => removeItem(i)}
                />
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">
            For items handed out by number (e.g. Subway), set <span className="font-mono">Identifier column</span> to
            the sheet column that holds the numbers. Lookup cards will show those next to the
            quantity.
          </p>
        </div>
      </div>
    </details>
  );
}

function ItemEditor({
  item,
  onChange,
  onRemove,
}: {
  item: FundraiserItem;
  onChange: (next: FundraiserItem) => void;
  onRemove: () => void;
}) {
  const hasIdentifier = item.identifierColumn !== undefined;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={item.name}
          onChange={(e) => onChange({ ...item, name: e.target.value })}
          placeholder="Item name"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
        />
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
          aria-label="Remove item"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-[110px_1fr] items-center gap-3">
        <label className="text-xs text-slate-600">Quantity col</label>
        <input
          type="text"
          value={item.quantityColumn}
          onChange={(e) => onChange({ ...item, quantityColumn: e.target.value })}
          placeholder="e.g. Pizza #"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
        />
      </div>
      <div className="grid grid-cols-[110px_1fr] items-center gap-3">
        <label className="text-xs text-slate-600">Identifier col</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={item.identifierColumn ?? ""}
            onChange={(e) =>
              onChange({ ...item, identifierColumn: e.target.value || undefined })
            }
            placeholder="Optional · e.g. Sub Numbers"
            className={cn(
              "flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10",
              !hasIdentifier && "text-slate-400",
            )}
          />
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

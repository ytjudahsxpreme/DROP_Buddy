"use client";

import { useEffect, useState } from "react";

/**
 * Settings card for editing the master access code. Only renders if the
 * current session is master-unlocked (detected by a successful GET to
 * /api/master-code). Otherwise renders nothing.
 */
export function MasterCodeCard() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "hidden" }
    | { status: "ready"; current: string; draft: string; savedAt: Date | null; error: string | null; saving: boolean }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/master-code", { credentials: "same-origin" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 200) {
          const body = (await res.json()) as { masterCode: string };
          setState({
            status: "ready",
            current: body.masterCode,
            draft: body.masterCode,
            savedAt: null,
            error: null,
            saving: false,
          });
        } else {
          setState({ status: "hidden" });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "hidden" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading" || state.status === "hidden") return null;

  const dirty = state.draft.trim() !== state.current.trim();
  const tooShort = state.draft.trim().length < 4;

  async function save() {
    if (state.status !== "ready") return;
    setState({ ...state, saving: true, error: null });
    try {
      const res = await fetch("/api/master-code", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ masterCode: state.draft.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setState({ ...state, saving: false, error: body.error ?? `HTTP ${res.status}` });
        return;
      }
      // Re-fetch to confirm and pick up any normalized value
      const fresh = await fetch("/api/master-code", { credentials: "same-origin" });
      const body = (await fresh.json()) as { masterCode: string };
      setState({
        status: "ready",
        current: body.masterCode,
        draft: body.masterCode,
        savedAt: new Date(),
        error: null,
        saving: false,
      });
    } catch (err) {
      setState({ ...state, saving: false, error: (err as Error).message });
    }
  }

  return (
    <section className="rounded-2xl bg-violet-50 border border-violet-200 p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-md bg-violet-200 text-violet-900 text-[11px] font-semibold uppercase tracking-wide px-1.5 py-0.5">
          Master
        </span>
        <h2 className="text-sm font-semibold text-violet-900">Master access code</h2>
      </div>
      <p className="text-xs text-violet-800/80">
        Grants access to every fundraiser. Only visible to staff who unlocked with the master code.
        Change it any time — the new value takes effect immediately. Existing unlock sessions stay
        valid for up to 12 hours.
      </p>
      <input
        type="text"
        value={state.draft}
        onChange={(e) => setState({ ...state, draft: e.target.value, error: null })}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        className="w-full rounded-xl border border-violet-300 bg-white px-4 py-2.5 text-base font-mono outline-none focus:border-violet-700 focus:ring-2 focus:ring-violet-300/40"
      />
      {state.error && (
        <p className="text-sm text-rose-700">Error: {state.error}</p>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-violet-700">
          {state.saving
            ? "Saving…"
            : dirty
              ? tooShort
                ? "Code must be at least 4 characters."
                : "Unsaved changes"
              : state.savedAt
                ? `Saved at ${state.savedAt.toLocaleTimeString()}`
                : "Current value loaded"}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => state.status === "ready" && setState({ ...state, draft: state.current, error: null })}
            disabled={!dirty || state.saving}
            className="rounded-lg border border-violet-300 px-3 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-40"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || tooShort || state.saving}
            className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-40"
          >
            {state.saving ? "Saving…" : "Save master code"}
          </button>
        </div>
      </div>
    </section>
  );
}

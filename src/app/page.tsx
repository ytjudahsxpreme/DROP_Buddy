import { FundraiserCard } from "@/components/FundraiserCard";
import { firebaseDataSource } from "@/lib/data/firebaseDataSource";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const list = await firebaseDataSource.listFundraisers();
  // Never ship access codes to the browser.
  const safe = list.map(({ accessCode: _omit, ...rest }) => {
    void _omit;
    return rest;
  });

  return (
    <div className="flex-1 flex flex-col">
      <header className="px-5 pt-8 pb-4 sm:pt-12">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              DROP
            </span>
            <span className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-600">
              Buddy
            </span>
          </div>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Drop-Ready Order Portal
          </p>
          <h1 className="mt-5 text-xl sm:text-2xl font-bold tracking-tight">
            Choose a fundraiser
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-md">
            Pick a fundraiser and enter the access code shared by your class advisor to look up
            students and view live stats.
          </p>
        </div>
      </header>
      <main className="flex-1 px-5 pb-12">
        <div className="mx-auto max-w-3xl space-y-3">
          {safe.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 px-6 py-10 text-center">
              <p className="text-sm font-semibold text-slate-700">No fundraisers configured yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Run <code className="font-mono">npm run seed</code> to load the default fundraisers,
                or add one in Firestore at <code className="font-mono">/fundraisers</code>.
              </p>
            </div>
          ) : (
            safe.map((f) => <FundraiserCard key={f.id} fundraiser={f} />)
          )}
        </div>
      </main>
      <footer className="px-5 py-6 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl flex items-center justify-between text-xs text-slate-500">
          <span>
            <span className="font-bold tracking-tight">DROP</span>
            <span className="ml-1 font-medium">Buddy</span>
            <span className="mx-2 text-slate-300">·</span>
            <span>Internal use only</span>
          </span>
          <span className="font-mono">v0.3</span>
        </div>
      </footer>
    </div>
  );
}

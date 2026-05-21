"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { DeliveryDatePicker, pickDefaultDeliveryDate } from "@/components/DeliveryDatePicker";
import { EmptyState } from "@/components/EmptyState";
import { FilterChips } from "@/components/FilterChips";
import { SearchBar } from "@/components/SearchBar";
import { StudentCard } from "@/components/StudentCard";
import { dataSource } from "@/lib/data/dataSource";
import { fetchDeliveries, setDeliveryStatus } from "@/lib/data/clientDataSource";
import {
  EMPTY_FILTERS,
  studentKey,
  type LookupFilters,
  type StudentOrder,
} from "@/lib/data/types";
import { applyFilters, sortByName } from "@/lib/utils/search";
import { cn } from "@/lib/utils/cn";

const POLL_INTERVAL_MS = 20_000;

type DeliveryFilter = "all" | "pending" | "delivered";

export default function LookupPage() {
  const params = useParams<{ id: string }>();
  const fundraiserId = params?.id ?? "";
  const [orders, setOrders] = useState<StudentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<LookupFilters>(EMPTY_FILTERS);
  const [defaultedDate, setDefaultedDate] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  // Delivery (fulfillment) state — keyed by studentKey, only meaningful when
  // filters.deliveryDate is set.
  const [delivered, setDelivered] = useState<Record<string, string>>({});
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");

  const activeFundraiserRef = useRef(fundraiserId);
  activeFundraiserRef.current = fundraiserId;
  const activeDateRef = useRef<string | null>(filters.deliveryDate);
  activeDateRef.current = filters.deliveryDate;

  const fetchAll = useCallback(
    async (opts: { initial: boolean }) => {
      if (!fundraiserId) return;
      if (opts.initial) setLoading(true);
      const date = filters.deliveryDate;
      try {
        const [ordersData, deliveriesData] = await Promise.all([
          dataSource.listOrders(fundraiserId),
          date ? fetchDeliveries(fundraiserId, date) : Promise.resolve(null),
        ]);
        if (activeFundraiserRef.current !== fundraiserId) return;
        setOrders(ordersData);
        if (date && deliveriesData && activeDateRef.current === date) {
          setDelivered(deliveriesData.delivered);
        }
        setLastUpdated(new Date());
        setPollError(null);
      } catch (err) {
        if (activeFundraiserRef.current !== fundraiserId) return;
        if (opts.initial) console.error("Failed to load:", err);
        setPollError((err as Error).message ?? "Refresh failed");
      } finally {
        if (opts.initial) setLoading(false);
      }
    },
    [fundraiserId, filters.deliveryDate],
  );

  // Initial load + re-load when fundraiser or date changes.
  useEffect(() => {
    fetchAll({ initial: true });
  }, [fetchAll]);

  // Background polling.
  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchAll({ initial: false });
    };
    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (!document.hidden) fetchAll({ initial: false });
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetchAll]);

  const availableDates = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) {
      for (const l of o.lines) if (l.deliveryDate) set.add(l.deliveryDate);
    }
    return Array.from(set).sort();
  }, [orders]);

  useEffect(() => {
    if (defaultedDate) return;
    if (availableDates.length === 0) return;
    const def = pickDefaultDeliveryDate(availableDates);
    setFilters((f) => ({ ...f, deliveryDate: def }));
    setDefaultedDate(true);
  }, [availableDates, defaultedDate]);

  // Compute filtered orders: filters → date restriction → delivery filter.
  const filtered = useMemo(() => {
    const base = sortByName(applyFilters(orders, filters));
    let withDate: StudentOrder[];
    if (!filters.deliveryDate) {
      withDate = base;
    } else {
      withDate = [];
      for (const o of base) {
        const lines = o.lines.filter((l) => l.deliveryDate === filters.deliveryDate);
        if (lines.length === 0) continue;
        const totalQuantity = lines.reduce((s, l) => s + l.quantity, 0);
        withDate.push({ ...o, lines, totalQuantity });
      }
    }
    if (!filters.deliveryDate || deliveryFilter === "all") return withDate;
    return withDate.filter((o) => {
      const k = studentKey(o.firstName, o.lastName, o.grade);
      const isDelivered = !!delivered[k];
      return deliveryFilter === "delivered" ? isDelivered : !isDelivered;
    });
  }, [orders, filters, delivered, deliveryFilter]);

  // Counters for the stats row.
  const studentsForCurrentDate = useMemo(() => {
    if (!filters.deliveryDate) return null;
    return sortByName(applyFilters(orders, filters)).filter((o) =>
      o.lines.some((l) => l.deliveryDate === filters.deliveryDate),
    );
  }, [orders, filters]);

  const deliveredCount = useMemo(() => {
    if (!studentsForCurrentDate) return 0;
    return studentsForCurrentDate.filter(
      (o) => !!delivered[studentKey(o.firstName, o.lastName, o.grade)],
    ).length;
  }, [studentsForCurrentDate, delivered]);

  const totals = useMemo(() => {
    const items = filtered.reduce((s, o) => s + o.totalQuantity, 0);
    return { students: filtered.length, items };
  }, [filtered]);

  const availableGrades = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => { if (o.grade) set.add(o.grade); });
    return Array.from(set).sort((a, b) => {
      const order = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
      return order.indexOf(a) - order.indexOf(b);
    });
  }, [orders]);

  const availableItems = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((o) => o.lines.forEach((l) => map.set(l.itemId, l.itemName)));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [orders]);

  const anyFilterActive =
    filters.query || filters.grade || filters.building || filters.itemId;

  const toggleDelivered = useCallback(
    async (order: StudentOrder) => {
      if (!filters.deliveryDate) return;
      const date = filters.deliveryDate;
      const key = studentKey(order.firstName, order.lastName, order.grade);
      const wasDelivered = !!delivered[key];
      // Optimistic update
      setDelivered((prev) => {
        const next = { ...prev };
        if (wasDelivered) delete next[key];
        else next[key] = new Date().toISOString();
        return next;
      });
      try {
        await setDeliveryStatus(fundraiserId, date, key, !wasDelivered);
      } catch (err) {
        // Revert on failure
        setDelivered((prev) => {
          const next = { ...prev };
          if (wasDelivered) next[key] = new Date().toISOString();
          else delete next[key];
          return next;
        });
        setPollError((err as Error).message);
      }
    },
    [fundraiserId, filters.deliveryDate, delivered],
  );

  const canMarkDelivered = !!filters.deliveryDate;

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
      <div className="space-y-3 sticky top-14 z-10 -mx-4 px-4 py-2 bg-slate-50/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/80">
        <SearchBar
          value={filters.query}
          onChange={(query) => setFilters((f) => ({ ...f, query }))}
        />
        {availableDates.length > 0 && (
          <DeliveryDatePicker
            dates={availableDates}
            value={filters.deliveryDate}
            onChange={(d) => setFilters((f) => ({ ...f, deliveryDate: d }))}
          />
        )}
        <FilterChips
          filters={filters}
          onChange={setFilters}
          availableGrades={availableGrades}
          availableItems={availableItems}
        />
        {canMarkDelivered && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["all", "pending", "delivered"] as DeliveryFilter[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setDeliveryFilter(v)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold border transition-colors",
                  deliveryFilter === v
                    ? v === "pending"
                      ? "bg-amber-500 text-white border-amber-500"
                      : v === "delivered"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300",
                )}
              >
                {v === "all" ? "All" : v === "pending" ? "Pending" : "Delivered"}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
          <span className="flex items-center gap-2">
            <LiveIndicator
              lastUpdated={lastUpdated}
              pollError={pollError}
              loading={loading}
            />
            <span>
              {loading
                ? "Loading…"
                : canMarkDelivered && studentsForCurrentDate
                  ? `${deliveredCount} of ${studentsForCurrentDate.length} delivered`
                  : `${totals.students} student${totals.students === 1 ? "" : "s"} · ${totals.items} item${totals.items === 1 ? "" : "s"}`}
            </span>
          </span>
          {orders.length > 0 && filtered.length !== orders.length && (
            <span>{orders.length - filtered.length} hidden</span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={
            deliveryFilter === "delivered"
              ? "Nobody marked delivered yet"
              : deliveryFilter === "pending"
                ? "Everyone is delivered!"
                : anyFilterActive || filters.deliveryDate
                  ? "No matching students"
                  : "No orders yet"
          }
          description={
            deliveryFilter !== "all"
              ? "Switch the filter back to 'All' to see everyone."
              : anyFilterActive || filters.deliveryDate
                ? "Try a shorter name, pick a different delivery date, or clear filters."
                : "Once the linked Google Sheet has data, orders will appear here."
          }
          icon={
            <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((o) => {
            const key = studentKey(o.firstName, o.lastName, o.grade);
            const isDelivered = !!delivered[key];
            return (
              <li key={o.id}>
                <StudentCard
                  order={o}
                  delivered={canMarkDelivered ? isDelivered : undefined}
                  onToggleDelivered={canMarkDelivered ? () => toggleDelivered(o) : undefined}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function LiveIndicator({
  lastUpdated,
  pollError,
  loading,
}: {
  lastUpdated: Date | null;
  pollError: string | null;
  loading: boolean;
}) {
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (loading) return null;
  if (pollError) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-rose-700"
        title={`Refresh failed: ${pollError}`}
      >
        <span className="w-2 h-2 rounded-full bg-rose-500" />
        <span className="font-medium">Offline</span>
      </span>
    );
  }
  if (!lastUpdated) return null;
  const ageSec = Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 1000));
  const ageLabel = ageSec < 5 ? "just now" : `${ageSec}s ago`;
  return (
    <span className="inline-flex items-center gap-1.5 text-emerald-700">
      <span className="relative flex w-2 h-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
        <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
      </span>
      <span className="font-medium">Live</span>
      <span className="text-slate-400 font-normal">· {ageLabel}</span>
    </span>
  );
}

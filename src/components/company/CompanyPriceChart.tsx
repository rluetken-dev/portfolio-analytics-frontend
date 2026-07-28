// src/components/company/CompanyPriceChart.tsx
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
} from "recharts";
import { useContext, useEffect, useState, useCallback, useMemo } from "react";
import { CurrencyContext } from "../../context/CurrencyContextObject";
import { convertCurrency } from "../../utils/currencyUtils";

/* =========================================================
   🧩 Types
========================================================= */
type Pt = { date: string; close: number };

type TimeseriesApiRow = {
  date?: string | null;
  close?: number | null;
};

type BrushRange = { startIndex?: number; endIndex?: number };
type Range = { start: number; end: number } | null;

type Props = {
  symbol: string;
  range: Range;
  onRangeChange: (r: Range) => void;
};

type LatestQuote = { date: string; close: number };

/* =========================================================
   🧩 Utilities
========================================================= */

function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function parseISO(s: string): Date {
  const d = new Date(s);
  return Number.isNaN(+d) ? new Date(s.replace("Z", "")) : d;
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}
function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

/* =========================================================
   🧩 API helpers
========================================================= */

async function fetchLatestQuote(baseUrl: string, symbol: string): Promise<LatestQuote | null> {
  const qs = new URLSearchParams({ symbol });
  const resp = await fetch(`${baseUrl}/api/Quotes/latest?${qs.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) return null;

  const raw: unknown = await resp.json();
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const dateCandidate = obj["date"] ?? obj["Date"] ?? obj["tradingDate"] ?? obj["TradingDate"];
    const closeCandidate = obj["close"] ?? obj["Close"];
    if (isNonEmptyString(dateCandidate) && isFiniteNumber(closeCandidate)) {
      return { date: dateCandidate, close: closeCandidate };
    }
  }
  return null;
}

async function fetchTimeseries(
  baseUrl: string,
  symbol: string,
  fromISO?: string,
  toISO?: string,
): Promise<Pt[]> {
  const qs = new URLSearchParams({ symbol });
  if (fromISO) qs.set("from", fromISO);
  if (toISO) qs.set("to", toISO);

  const resp = await fetch(`${baseUrl}/api/quotes/timeseries?${qs.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const raw: unknown = await resp.json();
  const arr: TimeseriesApiRow[] = Array.isArray(raw) ? (raw as TimeseriesApiRow[]) : [];

  return arr
    .map(
      (r): Pt => ({
        date: String(r?.date ?? ""),
        close: typeof r?.close === "number" ? r.close : NaN,
      }),
    )
    .filter((p) => p.date && Number.isFinite(p.close))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/* =========================================================
   🧩 Component
========================================================= */

export default function CompanyPriceChart({ symbol, range, onRangeChange }: Props) {
  const sym = (symbol ?? "").trim().toUpperCase();
  const backendBase = "";

  const { currency, formatMoneyFrom } = useContext(CurrencyContext)!;

  const [baseData, setBaseData] = useState<Pt[]>([]);
  const [data, setData] = useState<Pt[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // 🔄 Load base USD data
  useEffect(() => {
    let aborted = false;

    async function run() {
      if (!sym) {
        setData([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErr(null);

        const latest = await fetchLatestQuote(backendBase, sym);
        let pts: Pt[] = [];

        if (latest?.date) {
          const to = new Date(latest.date);
          const from = new Date(to);
          from.setDate(to.getDate() - 180);
          pts = await fetchTimeseries(backendBase, sym, fmtDate(from), fmtDate(to));
        } else {
          pts = await fetchTimeseries(backendBase, sym);
        }

        if (aborted) return;
        setBaseData(pts);
        setData(pts);
        onRangeChange(null);
      } catch (e) {
        if (aborted) return;
        setErr(e instanceof Error ? e.message : String(e));
        setData([]);
      } finally {
        if (!aborted) setLoading(false);
      }
    }

    run();
    return () => {
      aborted = true;
    };
  }, [sym, backendBase, onRangeChange]);

  // 💱 Recalculate on currency change
  useEffect(() => {
    if (!baseData.length) return;

    const converted = baseData.map((p) => ({
      ...p,
      close: convertCurrency(p.close, "USD", currency),
    }));

    setData(converted);
  }, [currency, baseData]);

  // 📊 Handle zoom/view
  const view = useMemo(() => {
    if (!data.length) return [];
    if (!range) return data;
    const start = Math.max(0, Math.min(range.start, data.length - 1));
    const end = Math.max(start, Math.min(range.end, data.length - 1));
    return data.slice(start, end + 1);
  }, [data, range]);

  const resetView = useCallback(() => onRangeChange(null), [onRangeChange]);

  // 🧠 Formatters
  const tickFmt = useCallback((iso: string) => {
    const d = parseISO(iso);
    return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }, []);

  const tooltipFmt = useCallback(
    (value: number | string): string => {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) return "n/a";
      return formatMoneyFrom(n, "USD");
    },
    [formatMoneyFrom],
  );

  if (!sym) return null;

  const fullMax = Math.max(0, data.length - 1);
  const currentStart = range ? Math.max(0, Math.min(range.start, fullMax)) : 0;
  const currentEnd = range ? Math.max(currentStart, Math.min(range.end, fullMax)) : fullMax;

  return (
    <section style={{ marginTop: 12 }}>
      <div
        style={{
          marginBottom: 8,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16, opacity: 0.9 }}>Price (6M)</h2>
        {range && (
          <button
            onClick={resetView}
            title="Reset zoom"
            style={{
              border: "1px solid #333",
              background: "transparent",
              color: "inherit",
              fontSize: 12,
              padding: "2px 8px",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        )}
      </div>

      {err && <div style={{ marginBottom: 8, fontSize: 12, color: "#f87171" }}>{err}</div>}

      <div style={{ height: 260, border: "1px solid #222", borderRadius: 12, padding: 8 }}>
        {loading ? (
          <div
            style={{
              height: "100%",
              borderRadius: 8,
              background:
                "linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 37%, rgba(255,255,255,0.06) 63%)",
              backgroundSize: "400% 100%",
              animation: "shine 1.2s ease-in-out infinite",
            }}
          >
            <style>
              {`@keyframes shine { 0%{background-position:100% 0;} 100%{background-position:0 0;} }`}
            </style>
          </div>
        ) : data.length === 0 ? (
          <div style={{ height: "100%", display: "grid", placeItems: "center", opacity: 0.7 }}>
            No data
          </div>
        ) : (
          <div
            style={{
              height: "100%",
              display: "grid",
              gridTemplateRows: "1fr 56px",
              rowGap: 6,
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={view}
                onDoubleClick={resetView}
                margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="gPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="currentColor" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeOpacity={0.2} />
                <XAxis dataKey="date" tickFormatter={tickFmt} minTickGap={28} tickMargin={8} />
                <YAxis
                  domain={["auto", "auto"]}
                  tickCount={6}
                  allowDecimals={true}
                  width={70}
                  tickFormatter={(v) => formatMoneyFrom(v, "USD")}
                />
                <Tooltip
                  formatter={tooltipFmt}
                  labelFormatter={(iso) =>
                    parseISO(String(iso)).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "2-digit",
                    })
                  }
                />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke="currentColor"
                  fill="url(#gPrice)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  name="Close"
                />
              </AreaChart>
            </ResponsiveContainer>

            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
                <XAxis dataKey="date" hide />
                <YAxis domain={["dataMin", "dataMax"]} hide />
                <Brush
                  dataKey="date"
                  height={26}
                  travellerWidth={8}
                  startIndex={currentStart}
                  endIndex={currentEnd}
                  onChange={(r: BrushRange | undefined) => {
                    if (!r || typeof r.startIndex !== "number" || typeof r.endIndex !== "number")
                      return;
                    const max = Math.max(0, data.length - 1);
                    const MIN = Math.min(5, max);
                    let start = Math.max(0, Math.min(r.startIndex, max));
                    let end = Math.max(start, Math.min(r.endIndex, max));
                    if (end - start < MIN) {
                      const center = Math.round((start + end) / 2);
                      start = Math.max(0, center - Math.floor(MIN / 2));
                      end = Math.min(max, start + MIN);
                      start = Math.max(0, Math.min(start, end - MIN));
                    }
                    onRangeChange({ start, end });
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}

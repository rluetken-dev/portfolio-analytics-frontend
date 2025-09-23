// src/components/company/CompanyPriceChart.tsx
import * as React from "react";
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

/** ---------------- Types ---------------- */
type Pt = { date: string; close: number };

type TimeseriesApiRow = {
  date?: string | null;
  close?: number | null;
};

type BrushRange = { startIndex?: number; endIndex?: number };

type Range = { start: number; end: number } | null;

type Props = {
  symbol: string;
  range: Range; // controlled brush window (indices)
  onRangeChange: (r: Range) => void;
  currency?: string;
};

type LatestQuote = { date: string; close: number };

/** ---------------- Utilities ---------------- */

// English: zero-padded yyyy-MM-dd for URL query
function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// English: locale-aware money formatter using Intl (safe fallback)
function fmtMoney(v: number, currency = "USD") {
  if (!Number.isFinite(v)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${v.toFixed(2)} ${currency}`;
  }
}

// English: robust ISO parser (tolerate missing 'Z')
function parseISO(s: string): Date {
  const d = new Date(s);
  return Number.isNaN(+d) ? new Date(s.replace("Z", "")) : d;
}

// English: small type guards to avoid 'any'
function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}
function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

/** ---------------- API helpers ---------------- */

// English: load latest quote (date + close) for anchoring the time window
async function fetchLatestQuote(baseUrl: string, symbol: string): Promise<LatestQuote | null> {
  const qs = new URLSearchParams({ symbol });
  const resp = await fetch(`${baseUrl}/api/Quotes/latest?${qs.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) return null;

  // Avoid 'any' – parse as unknown and narrow at runtime
  const raw: unknown = await resp.json();

  // Tolerate different shapes: { date, close } OR PascalCase, etc.
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const dateCandidate =
      obj["date"] ?? obj["Date"] ?? obj["tradingDate"] ?? obj["TradingDate"];
    const closeCandidate = obj["close"] ?? obj["Close"];

    if (isNonEmptyString(dateCandidate) && isFiniteNumber(closeCandidate)) {
      return { date: dateCandidate, close: closeCandidate };
    }
  }
  return null;
}

// English: fetch timeseries within [from..to]
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

  // English: normalize, guard, and sort ascending by date
  const pts: Pt[] = arr
    .map((r): Pt => ({
      date: String(r?.date ?? ""),
      close: typeof r?.close === "number" ? r.close : NaN,
    }))
    .filter((p) => p.date && Number.isFinite(p.close))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return pts;
}

/** ---------------- Component ---------------- */

export default function CompanyPriceChart({
  symbol,
  range,
  onRangeChange,
  currency = "USD",
}: Props) {
  const sym = (symbol ?? "").trim().toUpperCase();
  const backendBase = React.useMemo(() => "http://localhost:5046", []);

  const [data, setData] = React.useState<Pt[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
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

        // 1) Try anchoring to DB's latest date
        const latest = await fetchLatestQuote(backendBase, sym);

        let pts: Pt[] = [];
        if (latest?.date) {
          // English: DB-anchored window [latest-180d .. latest]
          const to = new Date(latest.date);
          const from = new Date(to);
          from.setDate(to.getDate() - 180);

          pts = await fetchTimeseries(backendBase, sym, fmtDate(from), fmtDate(to));
        } else {
          // English: Backend fallback (no dates) – it will use its default window/fallback logic
          pts = await fetchTimeseries(backendBase, sym);
        }

        if (aborted) return;
        setData(pts);
        onRangeChange(null); // English: reset brush after reload
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

  // English: apply current brush window to full data
  const view = React.useMemo(() => {
    if (!data.length) return [];
    if (!range) return data;
    const start = Math.max(0, Math.min(range.start, data.length - 1));
    const end = Math.max(start, Math.min(range.end, data.length - 1));
    return data.slice(start, end + 1);
  }, [data, range]);

  const resetView = React.useCallback(() => onRangeChange(null), [onRangeChange]);

  const tickFmt = React.useCallback((iso: string) => {
    const d = parseISO(iso);
    return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }, []);

  const tooltipFmt = React.useCallback(
    (value: number | string): string => {
      // English: 2 decimals, currently fixed currency
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) ? fmtMoney(n, currency) : "n/a";
    },
    [currency],
  );

  if (!sym) return null;

  // English: compute current brush indices on FULL data
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
              // English: split area into main chart (flex 1) + navigator (56px)
              height: "100%",
              display: "grid",
              gridTemplateRows: "1fr 56px",
              rowGap: 6,
            }}
          >
            {/* ===== Main chart (uses 'view') ===== */}
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
                  domain={["dataMin", "dataMax"]}
                  width={50}
                  tickFormatter={(v) => (typeof v === "number" ? v.toFixed(0) : String(v))}
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
                  isAnimationActive={false} // keep it snappy
                  name="Close"
                />
                {/* NOTE: no Brush here */}
              </AreaChart>
            </ResponsiveContainer>

            {/* ===== Navigator with FULL data + Brush ===== */}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
                {/* English: hide axes in navigator */}
                <XAxis dataKey="date" hide />
                <YAxis domain={["dataMin", "dataMax"]} hide />
                <Brush
                  dataKey="date"
                  height={26}
                  travellerWidth={8}
                  // English: control brush window in FULL 'data' indices
                  startIndex={currentStart}
                  endIndex={currentEnd}
                  onChange={(r: BrushRange | undefined) => {
                    if (!r || typeof r.startIndex !== "number" || typeof r.endIndex !== "number")
                      return;

                    // English: clamp and enforce a small minimum window to avoid collapsing
                    const max = Math.max(0, data.length - 1);
                    const MIN = Math.min(5, max); // min ~5 points

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

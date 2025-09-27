// src/components/company/CompanyCandleChart.tsx
import * as React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

/** ---------------- Types ---------------- */
// English: full OHLC point aligned by the same 'date' key
type CandlePt = { date: string; open: number; high: number; low: number; close: number };

// English: tolerant OHLC row from backend (accept multiple field names)
type OhlcApiRow = {
  // date/time variants
  date?: string | null;
  time?: string | number | null;
  timestamp?: number | null;
  t?: string | number | null;

  // price variants
  open?: number | string | null;
  o?: number | string | null;
  high?: number | string | null;
  h?: number | string | null;
  low?: number | string | null;
  l?: number | string | null;
  close?: number | string | null;
  c?: number | string | null;
};

// English: price point reused for candle follower (area baseline)
type Pt = { date: string; close: number };

// English: tolerant API row for closes
type TimeseriesApiRow = {
  date?: string | null;
  time?: string | number | null;
  timestamp?: number | null;
  t?: string | number | null;

  close?: number | null;
  adjustedClose?: number | null;
  adjClose?: number | null;
  c?: number | null;
  price?: number | null;
};

// English: follower props – parent owns the visible range (indices in full data)
type Props = {
  symbol: string;
  range: { start: number; end: number } | null; // follow the price chart's brush selection
  height?: number; // optional height (default 260)
  currency?: string;
};

// // English: latest quote contract for anchoring
// type LatestQuote = { date: string; close: number };

/** ---------------- Utilities ---------------- */

/** English: visible history window size (days) */
const LOOKBACK_DAYS = 210;

// English: zero-padded yyyy-MM-dd
function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// English: currency formatter using Intl API
function fmtMoney(v: number, currency = "USD") {
  if (!Number.isFinite(v)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return v.toFixed(2) + " " + currency;
  }
}

function parseISO(s: string): Date {
  // English: tolerant to missing timezone
  const d = new Date(s);
  return Number.isNaN(+d) ? new Date(s.replace("Z", "")) : d;
}

// function isFiniteNumber(x: unknown): x is number {
//   return typeof x === "number" && Number.isFinite(x);
// }
// function isNonEmptyString(x: unknown): x is string {
//   return typeof x === "string" && x.trim().length > 0;
// }

// ---------- helpers for flexible API fields ----------
function toISODateYmd(x: unknown): string {
  // English: accept "YYYY-MM-DD" | epoch millis/seconds | ISO string
  if (typeof x === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(x)) return x;
    const d = parseISO(x);
    return fmtDate(d);
  }
  if (typeof x === "number" && Number.isFinite(x)) {
    const ms = x > 1e12 ? x : x * 1000; // seconds vs millis
    return fmtDate(new Date(ms));
  }
  return "";
}

function pickNumber(...candidates: Array<unknown>): number | null {
  // English: pick the first finite number (string-to-number tolerant)
  for (const c of candidates) {
    const n = typeof c === "number" ? c : Number(c);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** ---------------- API helpers ---------------- */

// // English: get DB-latest quote to anchor the window
// async function fetchLatestQuote(baseUrl: string, symbol: string): Promise<LatestQuote | null> {
//   const qs = new URLSearchParams({ symbol });
//   const resp = await fetch(`${baseUrl}/api/Quotes/latest?${qs.toString()}`, {
//     headers: { Accept: "application/json" },
//   });
//   if (!resp.ok) return null;

//   const raw: unknown = await resp.json();
//   if (typeof raw === "object" && raw !== null) {
//     const obj = raw as Record<string, unknown>;
//     const dateCandidate =
//       obj["date"] ?? obj["Date"] ?? obj["tradingDate"] ?? obj["TradingDate"];
//     const closeCandidate = obj["close"] ?? obj["Close"];
//     if (isNonEmptyString(dateCandidate) && isFiniteNumber(closeCandidate)) {
//       return { date: dateCandidate, close: closeCandidate };
//     }
//   }
//   return null;
// }

// English: fetch close timeseries within [from..to] (or backend default if omitted)
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

  const pts: Pt[] = arr
    .map((r): Pt => {
      const d = r.date ?? r.time ?? r.timestamp ?? r.t ?? null;
      const c = pickNumber(r.close, r.adjustedClose, r.adjClose, r.c, r.price);
      return { date: toISODateYmd(d), close: c ?? NaN };
    })
    .filter((p) => p.date && Number.isFinite(p.close))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return pts;
}

// English: fetch OHLC bars within [from..to]
async function fetchOhlc(
  baseUrl: string,
  symbol: string,
  fromISO?: string,
  toISO?: string,
): Promise<CandlePt[]> {
  const qs = new URLSearchParams({ symbol });
  if (fromISO) qs.set("from", fromISO);
  if (toISO) qs.set("to", toISO);

  const resp = await fetch(`${baseUrl}/api/quotes/ohlc?${qs.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) return [];

  const raw: unknown = await resp.json();
  const arr: OhlcApiRow[] = Array.isArray(raw) ? (raw as OhlcApiRow[]) : [];

  const out: CandlePt[] = arr
    .map((r): CandlePt => {
      const d = r.date ?? r.time ?? r.timestamp ?? r.t ?? null;
      const date = toISODateYmd(d);

      const open = pickNumber(r.open, r.o);
      const high = pickNumber(r.high, r.h);
      const low = pickNumber(r.low, r.l);
      const close = pickNumber(r.close, r.c);

      return {
        date,
        open: (open ?? NaN) as number,
        high: (high ?? NaN) as number,
        low: (low ?? NaN) as number,
        close: (close ?? NaN) as number,
      };
    })
    .filter(
      (c) =>
        c.date &&
        [c.open, c.high, c.low, c.close].every((n) => typeof n === "number" && Number.isFinite(n)),
    )
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return out;
}

/** ---------------- Component ---------------- */

export default function CompanyCandleChart({
  symbol,
  range,
  height = 260,
  currency = "USD",
}: Props) {
  const sym = (symbol ?? "").trim().toUpperCase();
  const backendBase = React.useMemo(() => "http://localhost:5046", []);

  const [data, setData] = React.useState<Pt[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  // English: parsed OHLC kept in sync by 'date'
  const [candles, setCandles] = React.useState<CandlePt[]>([]);

  React.useEffect(() => {
    let aborted = false;

    async function run() {
      if (!sym) {
        setData([]);
        setCandles([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setErr(null);

        // 1) English: fetch closes without window; anchor to the latest point we *actually* have
        const ptsAll = await fetchTimeseries(backendBase, sym); // no from/to here
        if (aborted) return;

        let fromISO: string | undefined;
        let toISO: string | undefined;

        if (ptsAll.length) {
          // English: anchor window to the last local close
          toISO = ptsAll[ptsAll.length - 1].date;
          const to = new Date(toISO);
          const from = new Date(to);
          from.setDate(to.getDate() - LOOKBACK_DAYS);
          fromISO = fmtDate(from);

          // English: slice locally to avoid an extra network call for closes
          const pts = ptsAll.filter((p) => p.date >= fromISO! && p.date <= toISO!);
          setData(pts);
        } else {
          setData([]);
        }

        // 2) English: fetch OHLC bars for the exact same [from..to] window
        const bars = await fetchOhlc(backendBase, sym, fromISO, toISO);
        if (!aborted) setCandles(bars);

        if (!aborted) setCandles(bars);
      } catch (e) {
        if (aborted) return;
        setErr(e instanceof Error ? e.message : String(e));
        setData([]);
        setCandles([]);
      } finally {
        if (!aborted) setLoading(false);
      }
    }

    run();
    return () => {
      aborted = true;
    };
  }, [sym, backendBase]);

  // ---------- derive the visible view from parent's range ----------
  const view = React.useMemo(() => {
    if (!data.length) return [];
    if (!range) return data; // English: no selection → show full
    const start = Math.max(0, Math.min(range.start, data.length - 1));
    const end = Math.max(start, Math.min(range.end, data.length - 1));
    return data.slice(start, end + 1);
  }, [data, range]);

  // English: map date -> index in the visible area series to align x positions with Recharts
  const idxByDate = React.useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 0; i < view.length; i++) m.set(view[i].date, i);
    return m;
  }, [view]);

  // English: map parent range (indices over `data`) to a date window → filter candles by date
  const viewCandles = React.useMemo(() => {
    if (!candles.length) return [];
    if (!data.length || !range) return candles;

    const max = data.length - 1;
    const startIdx = Math.max(0, Math.min(range.start, max));
    const endIdx = Math.max(startIdx, Math.min(range.end, max));

    const fromDate = data[startIdx]?.date;
    const toDate = data[endIdx]?.date;
    if (!fromDate || !toDate) return candles;

    // English: strings are "YYYY-MM-DD" → safe lexicographic compare
    return candles.filter((c) => c.date >= fromDate && c.date <= toDate);
  }, [candles, data, range]);

  // English: Y domain based on visible candle lows/highs
  const yDomain = React.useMemo(() => {
    if (!viewCandles.length) return null;
    const min = Math.min(...viewCandles.map((c) => c.low));
    const max = Math.max(...viewCandles.map((c) => c.high));
    return [min, max] as [number, number];
  }, [viewCandles]);

  // English: fast lookup to get the candle (O/H/L/C) by ISO date for tooltips
  const ohlcByDate = React.useMemo(() => {
    const m = new Map<string, CandlePt>();
    for (const c of candles) {
      if (c.date) m.set(c.date, c);
    }
    return m;
  }, [candles]);

  // English: minimal, explicit props for our tooltip
  type CandleTooltipProps = {
    active?: boolean;
    label?: string | number;
  };

  // English: simple tooltip to show O/H/L/C for the hovered date
  function CandleTooltip({ active, label }: CandleTooltipProps) {
    if (!active || label == null) return null;

    const key = typeof label === "string" ? label : String(label);
    const c = ohlcByDate.get(key);
    if (!c) return null;

    const dOpen = c.close - c.open;
    const dOpenPct = c.open ? dOpen / c.open : 0;
    const rangeAbs = c.high - c.low;
    const rangePct = c.open ? rangeAbs / c.open : 0;
    const up = c.close >= c.open;
    const col = up ? "#22c55e" : "#ef4444";

    return (
      <div
        style={{
          background: "rgba(20,20,24,0.92)",
          color: "#fff",
          padding: "6px 8px",
          borderRadius: 6,
          fontSize: 12,
          position: "relative",
          zIndex: 9999,
        }}
      >
        <div style={{ opacity: 0.8, marginBottom: 4 }}>{key}</div>

        <div>O: {fmtMoney(c.open, currency)}</div>
        <div>H: {fmtMoney(c.high, currency)}</div>
        <div>L: {fmtMoney(c.low, currency)}</div>
        <div>C: {fmtMoney(c.close, currency)}</div>

        <div style={{ marginTop: 4 }}>
          <div>
            {/* English: intraday range (abs + %) */}
            Range: {fmtMoney(rangeAbs, currency)} ({(rangePct * 100).toFixed(2)}%)
          </div>
          <div style={{ color: col, fontWeight: 600 }}>
            {/* English: change vs open (abs + %) */}Δ vs Open: {fmtMoney(dOpen, currency)} (
            {(dOpenPct * 100).toFixed(2)}%)
          </div>
        </div>
      </div>
    );
  }

  // English: draw ALL visible candles aligned to the area chart's x-indexes
  function MiniCandles(props: {
    candles: CandlePt[];
    indexByDate: Map<string, number>;
    count: number; // total visible points in 'view' (area)
    yMin: number; // from area view (aligns with Recharts Y axis)
    yMax: number;
  }) {
    const { candles, indexByDate, count, yMin, yMax } = props;
    if (count <= 1 || candles.length === 0 || !Number.isFinite(yMin) || !Number.isFinite(yMax)) {
      return null;
    }

    const W = 1000,
      H = 600;
    const step = count > 1 ? W / (count - 1) : W;
    const bodyW = Math.max(1, Math.min(12, Math.floor(step * 0.7)));

    const denom = yMax - yMin || 1;
    const y = (v: number) => (1 - (v - yMin) / denom) * H;

    const els = candles.map((c) => {
      const idx = indexByDate.get(c.date);
      if (idx == null) return null; // date not in the visible area series
      const x = idx * step;

      const up = c.close >= c.open;
      const color = up ? "#22c55e" : "#ef4444";

      const yHigh = y(c.high);
      const yLow = y(c.low);
      const yOpen = y(c.open);
      const yClose = y(c.close);

      const bx = Math.round(x - bodyW / 2);
      const by = Math.round(Math.min(yOpen, yClose));
      const bh = Math.max(1, Math.abs(Math.round(yClose - yOpen)));

      return (
        <g key={c.date}>
          {/* wick */}
          <line
            x1={Math.round(x)}
            y1={Math.round(yHigh)}
            x2={Math.round(x)}
            y2={Math.round(yLow)}
            stroke={color}
            strokeWidth={Math.max(1, Math.floor(bodyW / 6))}
          />
          {/* body */}
          <rect x={bx} y={by} width={bodyW} height={bh} fill={color} opacity={0.9} />
        </g>
      );
    });

    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none">
        {els}
      </svg>
    );
  }

  const candleCount = candles.length;
  const cviewCount = viewCandles.length;

  if (!sym) return null;

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
      ></div>

      {err && <div style={{ marginBottom: 8, fontSize: 12, color: "#f87171" }}>{err}</div>}
      {!loading && !err && data.length === 0 && (
        <div style={{ marginBottom: 8, fontSize: 11, opacity: 0.7 }}>
          No timeseries received for <code>{sym}</code>.
        </div>
      )}

      <div
        style={{ height, border: "1px solid #222", borderRadius: 12, padding: 8 }}
        data-candles={candleCount}
        data-candles-view={cviewCount}
      >
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
          <div style={{ position: "relative", height: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={view} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gCandle" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="currentColor" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeOpacity={0.2} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(iso) =>
                    parseISO(iso).toLocaleDateString(undefined, { month: "short", year: "2-digit" })
                  }
                  minTickGap={28}
                  tickMargin={8}
                />
                <YAxis
                  domain={yDomain ?? ["dataMin", "dataMax"]}
                  width={50}
                  tickFormatter={(v) => (typeof v === "number" ? v.toFixed(0) : String(v))}
                />
                <Tooltip
                  content={<CandleTooltip />}
                  wrapperStyle={{ zIndex: 2 }} // English: force tooltip above overlay
                />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke="currentColor"
                  fill="none"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  name="Close"
                />
              </AreaChart>
            </ResponsiveContainer>

            <div
              style={{
                position: "absolute",
                // English: align overlay to the plotting area (match AreaChart margins + YAxis width)
                left: 50, // YAxis width
                right: 12, // chart margin right
                top: 8, // chart margin top
                bottom: 30, // chart margin bottom
                pointerEvents: "none",
                zIndex: 1,
              }}
            >
              <MiniCandles
                candles={viewCandles}
                indexByDate={idxByDate}
                count={view.length}
                // English: use area view's close-range when no explicit yDomain
                yMin={
                  yDomain ? yDomain[0] : view.length ? Math.min(...view.map((p) => p.close)) : 0
                }
                yMax={
                  yDomain ? yDomain[1] : view.length ? Math.max(...view.map((p) => p.close)) : 1
                }
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

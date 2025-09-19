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

// English: price point reused for candle follower (we'll swap to real candles later)
type Pt = { date: string; close: number };

// English: tolerant API row type (handles multiple providers)
type TimeseriesApiRow = {
  // date/time variants
  date?: string | null;
  time?: string | number | null;
  timestamp?: number | null;
  t?: string | number | null;

  // close price variants
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
};

function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function parseISO(s: string): Date {
  // English: tolerant to missing timezone
  const d = new Date(s);
  return Number.isNaN(+d) ? new Date(s.replace("Z", "")) : d;
}

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
  // English: pick the first finite number
  for (const c of candidates) {
    const n = typeof c === "number" ? c : Number(c);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export default function CompanyCandleChart({ symbol, range, height = 260 }: Props) {
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
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setErr(null);

        // English: request last ~6 months from backend
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - 180);

        const resp = await fetch(
          `${backendBase}/api/quotes/timeseries?symbol=${encodeURIComponent(sym)}&from=${fmtDate(
            from,
          )}&to=${fmtDate(to)}`,
          { headers: { Accept: "application/json" } },
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const raw = (await resp.json()) as unknown;
        const arr: TimeseriesApiRow[] = Array.isArray(raw) ? (raw as TimeseriesApiRow[]) : [];

        // English: tolerant mapping
        const pts: Pt[] = arr
          .map((r: TimeseriesApiRow): Pt => {
            const d = r.date ?? r.time ?? r.timestamp ?? r.t ?? null;
            const c = pickNumber(r.close, r.adjustedClose, r.adjClose, r.c, r.price);
            return { date: toISODateYmd(d), close: c ?? NaN };
          })
          .filter((p) => p.date && Number.isFinite(p.close));

        // English: ensure chronological order
        pts.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

        if (aborted) return;
        setData(pts);

        // --- Load OHLC into 'candles' (display unchanged) ---
        try {
          const resp2 = await fetch(
            `${backendBase}/api/quotes/ohlc?symbol=${encodeURIComponent(sym)}&from=${fmtDate(from)}&to=${fmtDate(to)}`,
            { headers: { Accept: "application/json" } },
          );
          if (resp2.ok) {
            const raw2 = (await resp2.json()) as unknown;
            const arr2: OhlcApiRow[] = Array.isArray(raw2) ? (raw2 as OhlcApiRow[]) : [];

            const out: CandlePt[] = arr2
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
                  [c.open, c.high, c.low, c.close].every(
                    (n) => typeof n === "number" && Number.isFinite(n),
                  ),
              )
              .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

            if (!aborted) setCandles(out);

            console.debug("candles loaded:", out.length);
          }
        } catch {
          /* ignore OHLC fetch errors for now */
        }

        // English: follower – no own brush; we do NOT change parent's range here
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
    const min = Math.min(...viewCandles.map(c => c.low));
    const max = Math.max(...viewCandles.map(c => c.high));
    return [min, max] as [number, number];
  }, [viewCandles]);
 
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

    // English: SVG fills the plot area (container handles margins), so no inner padding here
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

  // English: read candles once (prepares next step and satisfies lint)
  const candleCount = candles.length;
  const cviewCount = viewCandles.length;

  //console.debug("candles:", candleCount, "viewCandles:", cviewCount);

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
                  formatter={(value: number | string): string => {
                    const n = typeof value === "number" ? value : Number(value);
                    return Number.isFinite(n) ? `${n.toFixed(2)} USD` : "n/a";
                  }}
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
                // align overlay to the actual plotting area (match AreaChart margins + YAxis width)
                left: 50, // YAxis width
                right: 12, // chart margin right
                top: 8, // chart margin top
                bottom: 30, // chart margin bottom
                pointerEvents: "none",
              }}
            >
              <MiniCandles
                candles={viewCandles}
                indexByDate={idxByDate}
                count={view.length}
                // English: use area view's close-range so Y matches Recharts axis
                yMin={yDomain ? yDomain[0] : (view.length ? Math.min(...view.map(p => p.close)) : 0)}
                yMax={yDomain ? yDomain[1] : (view.length ? Math.max(...view.map(p => p.close)) : 1)}                
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

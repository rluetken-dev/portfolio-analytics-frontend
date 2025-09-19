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
      >
        <h2 style={{ margin: 0, fontSize: 16, opacity: 0.9 }}>Candle (6M)</h2>
        {/* English: follower has no own reset or brush */}
      </div>

      {err && <div style={{ marginBottom: 8, fontSize: 12, color: "#f87171" }}>{err}</div>}
      {!loading && !err && data.length === 0 && (
        <div style={{ marginBottom: 8, fontSize: 11, opacity: 0.7 }}>
          No timeseries received for <code>{sym}</code>.
        </div>
      )}

      <div style={{ height, border: "1px solid #222", borderRadius: 12, padding: 8 }}>
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
          // English: temporary AreaChart as placeholder for real candles (to be swapped later)
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
                domain={["dataMin", "dataMax"]}
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
                fill="url(#gCandle)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false} // English: keep it snappy
                name="Close"
              />
              {/* English: no Brush here (follower) */}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

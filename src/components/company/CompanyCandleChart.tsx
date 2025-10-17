import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useContext, useEffect, useState, useMemo } from "react";
import { CurrencyContext } from "../../context/CurrencyContextObject";
import { convertCurrency } from "../../utils/currencyUtils";

/* =========================================================
   🧩 Types
========================================================= */
type CandlePt = { date: string; open: number; high: number; low: number; close: number };
type Pt = { date: string; close: number };

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

type OhlcApiRow = {
  date?: string | null;
  time?: string | number | null;
  timestamp?: number | null;
  t?: string | number | null;
  open?: number | string | null;
  o?: number | string | null;
  high?: number | string | null;
  h?: number | string | null;
  low?: number | string | null;
  l?: number | string | null;
  close?: number | string | null;
  c?: number | string | null;
};

type Props = {
  symbol: string;
  range: { start: number; end: number } | null;
  height?: number;
};

/* =========================================================
   🧩 Utilities
========================================================= */
const LOOKBACK_DAYS = 210;

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

function toISODateYmd(x: unknown): string {
  if (typeof x === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(x)) return x;
    const d = parseISO(x);
    return fmtDate(d);
  }
  if (typeof x === "number" && Number.isFinite(x)) {
    const ms = x > 1e12 ? x : x * 1000;
    return fmtDate(new Date(ms));
  }
  return "";
}

function pickNumber(...candidates: Array<unknown>): number | null {
  for (const c of candidates) {
    const n = typeof c === "number" ? c : Number(c);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/* =========================================================
   🧩 API Helpers
========================================================= */
async function fetchTimeseries(baseUrl: string, symbol: string): Promise<Pt[]> {
  const qs = new URLSearchParams({ symbol });
  const resp = await fetch(`${baseUrl}/api/quotes/timeseries?${qs.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const raw: unknown = await resp.json();
  const arr: TimeseriesApiRow[] = Array.isArray(raw) ? raw : [];

  return arr
    .map((r) => {
      const d = r.date ?? r.time ?? r.timestamp ?? r.t ?? null;
      const c = pickNumber(r.close, r.adjustedClose, r.adjClose, r.c, r.price);
      return { date: toISODateYmd(d), close: c ?? NaN };
    })
    .filter((p) => p.date && Number.isFinite(p.close))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

async function fetchOhlc(baseUrl: string, symbol: string, fromISO?: string, toISO?: string) {
  const qs = new URLSearchParams({ symbol });
  if (fromISO) qs.set("from", fromISO);
  if (toISO) qs.set("to", toISO);

  const resp = await fetch(`${baseUrl}/api/quotes/ohlc?${qs.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) return [];

  const raw: unknown = await resp.json();
  const arr: OhlcApiRow[] = Array.isArray(raw) ? raw : [];

  return arr
    .map((r): CandlePt => {
      const d = r.date ?? r.time ?? r.timestamp ?? r.t ?? null;
      const date = toISODateYmd(d);
      return {
        date,
        open: pickNumber(r.open, r.o) ?? NaN,
        high: pickNumber(r.high, r.h) ?? NaN,
        low: pickNumber(r.low, r.l) ?? NaN,
        close: pickNumber(r.close, r.c) ?? NaN,
      };
    })
    .filter((c) => [c.open, c.high, c.low, c.close].every((v) => Number.isFinite(v)))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/* =========================================================
   🧩 Component
========================================================= */
export default function CompanyCandleChart({ symbol, range, height = 260 }: Props) {
  const sym = symbol?.trim().toUpperCase();
  const backendBase = useMemo(() => "http://localhost:5046", []);
  const { currency, formatMoneyFrom } = useContext(CurrencyContext)!;

  const [baseData, setBaseData] = useState<Pt[]>([]);
  const [data, setData] = useState<Pt[]>([]);
  const [candlesBase, setCandlesBase] = useState<CandlePt[]>([]);
  const [candles, setCandles] = useState<CandlePt[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    async function run() {
      try {
        setLoading(true);
        const ptsAll = await fetchTimeseries(backendBase, sym);
        if (aborted) return;

        let fromISO: string | undefined;
        let toISO: string | undefined;

        if (ptsAll.length) {
          toISO = ptsAll[ptsAll.length - 1].date;
          const to = new Date(toISO);
          const from = new Date(to);
          from.setDate(to.getDate() - LOOKBACK_DAYS);
          fromISO = fmtDate(from);
          const pts = ptsAll.filter((p) => p.date >= fromISO! && p.date <= toISO!);
          setBaseData(pts);
          setData(pts);
        }

        const bars = await fetchOhlc(backendBase, sym, fromISO, toISO);
        if (!aborted) {
          setCandlesBase(bars);
          setCandles(bars);
        }
      } catch (e) {
        if (aborted) return;
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    run();
    return () => {
      aborted = true;
    };
  }, [sym, backendBase]);

  useEffect(() => {
    if (!baseData.length || !candlesBase.length) return;

    setData(baseData.map((p) => ({ ...p, close: convertCurrency(p.close, "USD", currency) })));

    setCandles(
      candlesBase.map((c) => ({
        ...c,
        open: convertCurrency(c.open, "USD", currency),
        high: convertCurrency(c.high, "USD", currency),
        low: convertCurrency(c.low, "USD", currency),
        close: convertCurrency(c.close, "USD", currency),
      })),
    );
  }, [currency, baseData, candlesBase]);

  const view = useMemo(() => {
    if (!data.length) return [];
    if (!range) return data;
    const start = Math.max(0, Math.min(range.start, data.length - 1));
    const end = Math.max(start, Math.min(range.end, data.length - 1));
    return data.slice(start, end + 1);
  }, [data, range]);

  const idxByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 0; i < view.length; i++) m.set(view[i].date, i);
    return m;
  }, [view]);

  const viewCandles = useMemo(() => {
    if (!candles.length || !data.length) return candles;
    if (!range) return candles;
    const startIdx = Math.max(0, range.start);
    const endIdx = Math.min(data.length - 1, range.end);
    const fromDate = data[startIdx]?.date;
    const toDate = data[endIdx]?.date;
    return candles.filter((c) => c.date >= fromDate && c.date <= toDate);
  }, [candles, data, range]);

  const yDomain = useMemo(() => {
    if (!viewCandles.length) return ["auto", "auto"];
    const min = Math.min(...viewCandles.map((c) => c.low));
    const max = Math.max(...viewCandles.map((c) => c.high));
    return [min, max];
  }, [viewCandles]);

  const ohlcByDate = useMemo(() => {
    const m = new Map<string, CandlePt>();
    for (const c of candles) m.set(c.date, c);
    return m;
  }, [candles]);

  const CandleTooltip = ({ active, label }: { active?: boolean; label?: string | number }) => {
    if (!active || label == null) return null;
    const key = String(label);
    const c = ohlcByDate.get(key);
    if (!c) return null;

    const diff = c.close - c.open;
    const pct = c.open ? (diff / c.open) * 100 : 0;
    const up = diff >= 0;
    const color = up ? "#22c55e" : "#ef4444";

    return (
      <div
        style={{
          background: "rgba(20,20,24,0.92)",
          color: "#fff",
          padding: "6px 8px",
          borderRadius: 6,
          fontSize: 12,
        }}
      >
        <div style={{ opacity: 0.8, marginBottom: 4 }}>{key}</div>
        <div>O: {formatMoneyFrom(c.open, "USD")}</div>
        <div>H: {formatMoneyFrom(c.high, "USD")}</div>
        <div>L: {formatMoneyFrom(c.low, "USD")}</div>
        <div>C: {formatMoneyFrom(c.close, "USD")}</div>
        <div style={{ color, marginTop: 4, fontWeight: 600 }}>
          Δ: {formatMoneyFrom(diff, "USD")} ({pct.toFixed(2)}%)
        </div>
      </div>
    );
  };

  function MiniCandles({
    candles,
    indexByDate,
    count,
    yMin,
    yMax,
  }: {
    candles: CandlePt[];
    indexByDate: Map<string, number>;
    count: number;
    yMin: number;
    yMax: number;
  }) {
    if (count <= 1 || !candles.length) return null;
    const W = 1000,
      H = 600;
    const step = count > 1 ? W / (count - 1) : W;
    const bodyW = Math.max(1, Math.min(12, Math.floor(step * 0.7)));
    const denom = yMax - yMin || 1;
    const y = (v: number) => (1 - (v - yMin) / denom) * H;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none">
        {candles.map((c) => {
          const idx = indexByDate.get(c.date);
          if (idx == null) return null;
          const x = idx * step;
          const up = c.close >= c.open;
          const color = up ? "#22c55e" : "#ef4444";
          const yHigh = y(c.high);
          const yLow = y(c.low);
          const yOpen = y(c.open);
          const yClose = y(c.close);
          const bx = x - bodyW / 2;
          const by = Math.min(yOpen, yClose);
          const bh = Math.abs(yClose - yOpen);
          return (
            <g key={c.date}>
              <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth={bodyW / 6} />
              <rect
                x={bx}
                y={by}
                width={bodyW}
                height={Math.max(1, bh)}
                fill={color}
                opacity={0.9}
              />
            </g>
          );
        })}
      </svg>
    );
  }

  if (!sym) return null;

  return (
    <section style={{ marginTop: 12 }}>
      {err && <div style={{ marginBottom: 8, color: "#f87171", fontSize: 12 }}>{err}</div>}
      <div style={{ height, border: "1px solid #222", borderRadius: 12, padding: 8 }}>
        {loading ? (
          <div style={{ height: "100%", borderRadius: 8, background: "rgba(255,255,255,0.05)" }} />
        ) : data.length === 0 ? (
          <div style={{ height: "100%", display: "grid", placeItems: "center", opacity: 0.7 }}>
            No data
          </div>
        ) : (
          <div style={{ position: "relative", height: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={view} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
                  domain={yDomain}
                  width={70}
                  tickFormatter={(v) => formatMoneyFrom(v, "USD")}
                />
                <Tooltip content={<CandleTooltip />} wrapperStyle={{ zIndex: 2 }} />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke="currentColor"
                  fill="none"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>

            <div
              style={{
                position: "absolute",
                left: 70,
                right: 12,
                top: 8,
                bottom: 30,
                pointerEvents: "none",
                zIndex: 1,
              }}
            >
              <MiniCandles
                candles={viewCandles}
                indexByDate={idxByDate}
                count={view.length}
                yMin={yDomain[0] as number}
                yMax={yDomain[1] as number}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

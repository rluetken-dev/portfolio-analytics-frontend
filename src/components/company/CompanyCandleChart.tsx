// src/components/company/CompanyCandleChart.tsx
import * as React from "react";
import { createChart, ColorType } from "lightweight-charts";

/** --- Types (keine anys) --------------------------------------------------- */
type BusinessDay = { year: number; month: number; day: number };

type CandlePoint = { time: BusinessDay; open: number; high: number; low: number; close: number };
type VolumePoint = { time: BusinessDay; value: number; up: boolean };
type AreaPoint = { time: BusinessDay; value: number };

type PriceFormat =
  | { type: "price"; precision?: number; minMove?: number }
  | { type: "volume" }
  | { type: "custom"; formatter: (price: number) => string; minMove?: number };

type SeriesCommonOpts = { priceFormat?: PriceFormat; priceScaleId?: string };

type PriceScaleApi = {
  applyOptions(opts: { scaleMargins?: { top: number; bottom: number } }): void;
};
type TimeScaleApi = { fitContent(): void };

type CandlestickSeriesApi = {
  setData(data: CandlePoint[]): void;
  applyOptions(opts: SeriesCommonOpts & Record<string, unknown>): void;
};
type HistogramSeriesApi = {
  setData(data: VolumePoint[]): void;
  applyOptions(opts: SeriesCommonOpts & Record<string, unknown>): void;
};
type AreaSeriesApi = {
  setData(data: AreaPoint[]): void;
  applyOptions(opts: SeriesCommonOpts & Record<string, unknown>): void;
};
type LineSeriesApi = {
  setData(data: AreaPoint[]): void;
  applyOptions(opts: SeriesCommonOpts & Record<string, unknown>): void;
};

type CrosshairMoveParam = {
  time?: BusinessDay | number;
  point?: { x: number; y: number } | null;
  seriesData?: Map<object, unknown>;
  seriesPrices?: Map<object, unknown>;
};
type CrosshairMoveHandler = (param: CrosshairMoveParam) => void;

type MinimalChartApi = {
  addCandlestickSeries?: (opts?: Record<string, unknown>) => CandlestickSeriesApi;
  addHistogramSeries?: (opts?: Record<string, unknown>) => HistogramSeriesApi;
  addAreaSeries?: (opts?: Record<string, unknown>) => AreaSeriesApi;
  addLineSeries?: (opts?: Record<string, unknown>) => LineSeriesApi;
  priceScale(id?: string): PriceScaleApi;
  timeScale(): TimeScaleApi;
  remove(): void;
  applyOptions(opts: Record<string, unknown>): void;
  subscribeCrosshairMove?: (handler: CrosshairMoveHandler) => void;
  unsubscribeCrosshairMove?: (handler: CrosshairMoveHandler) => void;
};

type OhlcDto = {
  date: string; // "YYYY-MM-DD"
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
};

/** --- Helfer ---------------------------------------------------------------- */
function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function toBusinessDayFlexible(input: string): BusinessDay | null {
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = Number(m[1]),
      mo = Number(m[2]),
      d = Number(m[3]);
    if (Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(d)) {
      return { year: y, month: mo, day: d };
    }
  }
  const dt = new Date(input);
  if (!Number.isNaN(dt.getTime())) {
    return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
  }
  return null;
}

const byDay = (a: BusinessDay, b: BusinessDay) =>
  a.year !== b.year ? a.year - b.year : a.month !== b.month ? a.month - b.month : a.day - b.day;

/** --- Komponente ------------------------------------------------------------ */
export default function CompanyCandleChart({ symbol = "" }: { symbol?: string }) {
  const sym = symbol.trim().toUpperCase();
  const backendBase = React.useMemo(() => "http://localhost:5046", []);

  // Chart + Series
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const chartRef = React.useRef<MinimalChartApi | null>(null);
  const candleRef = React.useRef<CandlestickSeriesApi | null>(null);
  const volumeRef = React.useRef<HistogramSeriesApi | null>(null);
  const areaRef = React.useRef<AreaSeriesApi | null>(null);
  const lineRef = React.useRef<LineSeriesApi | null>(null);

  // Tooltip
  const tooltipRef = React.useRef<HTMLDivElement | null>(null);
  const crosshairHandlerRef = React.useRef<CrosshairMoveHandler | null>(null);

  // State
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [hasData, setHasData] = React.useState(false);
  const [useFallbackSvg, setUseFallbackSvg] = React.useState(false);

  // English: fast lookup "YYYY-MM-DD" -> candle at that day
  const candleIndexRef = React.useRef<Map<string, CandlePoint>>(new Map());

  // Fallback-Daten
  const [fallback, setFallback] = React.useState<{
    candles: CandlePoint[];
    volumes: VolumePoint[];
    area: AreaPoint[];
  }>({ candles: [], volumes: [], area: [] });

  // Formatter
  const fmtPriceUSD = React.useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format,
    [],
  );

  const fmtDateShort = React.useCallback((time: BusinessDay | number): string => {
    if (typeof time === "object") {
      const dd = String(time.day).padStart(2, "0");
      const mm = String(time.month).padStart(2, "0");
      return `${dd}.${mm}.${time.year}`;
    }
    const d = new Date(time * 1000);
    if (Number.isNaN(d.getTime())) return String(time);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}.${mm}.${yy}`;
  }, []);

  /** Create / destroy chart */
  React.useLayoutEffect(() => {
    const el = containerRef.current;
    const tipEl = tooltipRef.current; // snapshot once (should be set in layout effect)
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255,255,255,0.82)",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.08)" },
        horzLines: { color: "rgba(255,255,255,0.08)" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.12)" },
      timeScale: {
        borderColor: "rgba(255,255,255,0.12)",
        rightOffset: 8,
        barSpacing: 8,
        timeVisible: true,
        tickMarkFormatter: (t: BusinessDay | number) => fmtDateShort(t),
      },
      crosshair: {
        mode: 1, // Normal
        vertLine: { color: "#00E5FF", width: 2, style: 0, visible: true, labelVisible: true },
        horzLine: { color: "#00E5FF", width: 2, style: 0, visible: true, labelVisible: true },
      },
      autoSize: true,
      localization: { locale: "en-US" },
    }) as unknown as MinimalChartApi;

    chartRef.current = chart;

    const canCandles = typeof chart.addCandlestickSeries === "function";
    const canHistogram = typeof chart.addHistogramSeries === "function";
    const canArea = typeof chart.addAreaSeries === "function";
    const canLine = typeof chart.addLineSeries === "function";

    if (!canCandles && !canArea && !canLine) {
      chart.remove();
      chartRef.current = null;
      setUseFallbackSvg(true);
      return;
    }

    // Close line under candle
    if (canArea && chart.addAreaSeries) {
      areaRef.current = chart.addAreaSeries({
        lineWidth: 2,
        lineColor: "rgba(255,255,255,0.85)",
        topColor: "rgba(0,0,0,0)",
        bottomColor: "rgba(0,0,0,0)",
        priceLineVisible: false,
      });
    } else if (canLine && chart.addLineSeries) {
      lineRef.current = chart.addLineSeries({
        lineWidth: 2,
        color: "rgba(255,255,255,0.85)",
        priceLineVisible: false,
      });
    }

    // Volume (overlay)
    if (canHistogram && chart.addHistogramSeries) {
      volumeRef.current = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "",
        overlay: true,
        color: "rgba(120,144,156,0.6)",
        base: 0,
        lastValueVisible: false,
      });
      chart.priceScale("").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    }

    // Candles (top)
    if (canCandles && chart.addCandlestickSeries) {
      candleRef.current = chart.addCandlestickSeries({
        upColor: "#22c55e",
        downColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
      });
    }

    // USD formatter for price series
    const usdPriceFormat: PriceFormat = {
      type: "custom",
      formatter: (p: number) => fmtPriceUSD(p),
      minMove: 0.01,
    };
    if (areaRef.current) areaRef.current.applyOptions({ priceFormat: usdPriceFormat });
    if (lineRef.current) lineRef.current.applyOptions({ priceFormat: usdPriceFormat });
    if (candleRef.current) candleRef.current.applyOptions({ priceFormat: usdPriceFormat });

    // Tooltip update via crosshair
    function isBarLike(
      v: unknown,
    ): v is { open: number; high: number; low: number; close: number } {
      if (typeof v !== "object" || v === null) return false;
      const o = v as Record<string, unknown>;
      return (
        typeof o.open === "number" &&
        typeof o.high === "number" &&
        typeof o.low === "number" &&
        typeof o.close === "number"
      );
    }

    function readBarAtCursor(param: CrosshairMoveParam) {
      const s = candleRef.current as unknown as object | null;
      if (!s) return null;
      const d = param.seriesData?.get(s);
      if (d && isBarLike(d)) return d;
      const p = param.seriesPrices?.get(s);
      if (typeof p === "number") return { open: p, high: p, low: p, close: p };
      if (p && isBarLike(p)) return p;
      return null;
    }

    function fmtTooltipDate(t?: BusinessDay | number): string {
      if (!t) return "";
      if (typeof t === "object") {
        const dd = String(t.day).padStart(2, "0");
        const mm = String(t.month).padStart(2, "0");
        return `${dd}.${mm}.${t.year}`;
      }
      const d = new Date(t * 1000);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = d.getFullYear();
      return `${dd}.${mm}.${yy}`;
    }

    // English: build an ISO-like key from either BusinessDay or unix seconds
    function keyFromTime(t: BusinessDay | number): string {
      if (typeof t === "object") {
        const mm = String(t.month).padStart(2, "0");
        const dd = String(t.day).padStart(2, "0");
        return `${t.year}-${mm}-${dd}`;
      }
      const d = new Date(t * 1000);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }

    // English: fallback reader using our own candle index (independent of seriesData Map)
    function readBarByTimeKey(t?: BusinessDay | number | null) {
      if (!t) return null;
      const k = keyFromTime(t);
      return candleIndexRef.current.get(k) ?? null;
    }

    // English: clamp helper for keeping tooltip inside the container box
    function clamp(v: number, min: number, max: number) {
      return Math.max(min, Math.min(max, v));
    }

    // English: place tooltip near the cursor, but keep it inside container
    function placeTooltip(tip: HTMLDivElement, container: HTMLDivElement, x: number, y: number) {
      const offset = 12; // small offset so we don't cover the crosshair

      // ensure 'right' doesn't conflict with dynamic 'left'
      tip.style.right = "";
      tip.style.left = "";

      // container box
      const cw = container.clientWidth;
      const ch = container.clientHeight;

      // measure tooltip size (first show might be 0 → use fallback)
      const tw = tip.offsetWidth || 180;
      const th = tip.offsetHeight || 80;

      // preferred position: bottom-right of the cursor
      let left = x + offset;
      let top = y + offset;

      // flip if overflowing
      if (left + tw > cw - 4) left = x - tw - offset;
      if (top + th > ch - 4) top = y - th - offset;

      // clamp inside container
      tip.style.left = `${clamp(left, 4, Math.max(4, cw - tw - 4))}px`;
      tip.style.top = `${clamp(top, 4, Math.max(4, ch - th - 4))}px`;
    }

    // English: crosshair move → update tooltip content + position (snapshot + fallback)
    const onMove: CrosshairMoveHandler = (param) => {
      // robust against rare null snapshot timing
      const tip = tipEl ?? tooltipRef.current;
      const container = el ?? containerRef.current;
      if (!tip || !container) return;

      // lightweight-charts sends no time until data is set or cursor over plot area
      if (!param.point || !param.time) {
        tip.style.display = "none";
        return;
      }

      // English: try library map first; if missing, fall back to our time-index
      const bar = readBarAtCursor(param) ?? readBarByTimeKey(param.time);

      // show first so offsetWidth/Height are measurable
      if (tip.style.display !== "block") tip.style.display = "block";

      const dateStr = fmtTooltipDate(param.time) || "";

      if (bar) {
        tip.innerHTML = `
      <div style="opacity:.9;font-weight:600;margin-bottom:4px">${dateStr}</div>
      <div>O: ${fmtPriceUSD(bar.open)}</div>
      <div>H: ${fmtPriceUSD(bar.high)}</div>
      <div>L: ${fmtPriceUSD(bar.low)}</div>
      <div>C: ${fmtPriceUSD(bar.close)}</div>
    `;
      } else {
        tip.innerHTML = `
      <div style="opacity:.9;font-weight:600">${dateStr}</div>
      <div style="opacity:.8">no bar</div>
    `;
      }

      placeTooltip(tip, container, param.point.x, param.point.y);
    };

    chart.subscribeCrosshairMove?.(onMove);
    crosshairHandlerRef.current = onMove;

    // Resize
    const ro = new ResizeObserver(() => chart.applyOptions({ autoSize: true }));
    ro.observe(el);

    return () => {
      ro.disconnect();

      // cleanup using the same snapshot variable
      if (tipEl) {
        tipEl.style.display = "none";
      }

      if (crosshairHandlerRef.current && chart.unsubscribeCrosshairMove) {
        chart.unsubscribeCrosshairMove(crosshairHandlerRef.current);
        crosshairHandlerRef.current = null;
      }

      try {
        chart.remove?.();
      } catch {
        /* no-op */
      }

      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      areaRef.current = null;
      lineRef.current = null;
    };
  }, [fmtDateShort, fmtPriceUSD]);

  /** Daten laden (6M) */
  React.useEffect(() => {
    const aborted = { current: false };

    async function run() {
      if (!sym) {
        setHasData(false);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setErr(null);

        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - 180);

        const url = `${backendBase}/api/quotes/ohlc?symbol=${encodeURIComponent(sym)}&from=${fmtDate(
          from,
        )}&to=${fmtDate(to)}`;
        const resp = await fetch(url, { headers: { Accept: "application/json" } });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        if (aborted.current) return;

        const raw = (await resp.json()) as unknown;
        const rows: OhlcDto[] = Array.isArray(raw) ? (raw as OhlcDto[]) : [];

        const candles: CandlePoint[] = [];
        const volumes: VolumePoint[] = [];
        const area: AreaPoint[] = [];

        for (const r of rows) {
          const bd = toBusinessDayFlexible(r.date);
          if (!bd) continue;

          const hasOhlc =
            typeof r.open === "number" &&
            typeof r.high === "number" &&
            typeof r.low === "number" &&
            typeof r.close === "number";

          if (hasOhlc) {
            candles.push({ time: bd, open: r.open, high: r.high, low: r.low, close: r.close });
          }
          if (typeof r.close === "number") {
            area.push({ time: bd, value: r.close });
          }
          if (r.volume != null && hasOhlc) {
            volumes.push({ time: bd, value: Number(r.volume), up: r.close >= r.open });
          }
        }

        candles.sort((a, b) => byDay(a.time, b.time));
        volumes.sort((a, b) => byDay(a.time, b.time));
        area.sort((a, b) => byDay(a.time, b.time));

        if (aborted.current) return;

        // English: rebuild the candle index for fast crosshair lookup by day
        candleIndexRef.current = new Map(
          candles.map((c) => {
            const k = `${c.time.year}-${String(c.time.month).padStart(2, "0")}-${String(c.time.day).padStart(2, "0")}`;
            return [k, c] as const;
          }),
        );

        if (candleRef.current && candles.length > 0) {
          candleRef.current.setData(candles);
          if (volumeRef.current) volumeRef.current.setData(volumes);

          const closeLine = candles.map((c) => ({ time: c.time, value: c.close }));
          if (areaRef.current) areaRef.current.setData(closeLine);
          if (lineRef.current) lineRef.current.setData(closeLine);

          setHasData(true);
          setUseFallbackSvg(false);
          chartRef.current?.timeScale().fitContent();
        } else if ((areaRef.current || lineRef.current) && area.length > 0) {
          if (areaRef.current) areaRef.current.setData(area);
          if (lineRef.current) lineRef.current.setData(area);

          setHasData(true);
          setUseFallbackSvg(false);
          chartRef.current?.timeScale().fitContent();
        } else {
          setFallback({ candles, volumes, area });
          setHasData(candles.length > 0 || area.length > 0);
          setUseFallbackSvg(true);
        }
      } catch (e) {
        if (aborted.current) return;
        setErr(e instanceof Error ? e.message : String(e));
        setHasData(false);
      } finally {
        if (!aborted.current) setLoading(false);
      }
    }

    run();
    return () => {
      aborted.current = true;
    };
  }, [sym, backendBase]);

  if (!sym) return null;

  /** SVG-Fallback */
  function renderFallbackSvg() {
    const W = 800,
      H = 320;
    const padTop = 10,
      padBottom = 60,
      padX = 12;
    const priceH = H - padTop - padBottom;
    const volH = 40;

    const candles = fallback.candles;
    const vols = fallback.volumes;
    const closeLine = fallback.area.length
      ? fallback.area
      : candles.map<AreaPoint>((c) => ({ time: c.time, value: c.close }));

    if (candles.length === 0 && closeLine.length === 0) {
      return (
        <div style={{ height: "100%", display: "grid", placeItems: "center", opacity: 0.7 }}>
          No OHLC/close data
        </div>
      );
    }

    const n = Math.max(candles.length, closeLine.length);
    const step = n > 1 ? (W - padX * 2) / (n - 1) : W - padX * 2;
    const bodyW = Math.max(1, Math.floor(step * 0.6));

    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const minP =
      highs.length && lows.length ? Math.min(...lows) : Math.min(...closeLine.map((p) => p.value));
    const maxP =
      highs.length && lows.length ? Math.max(...highs) : Math.max(...closeLine.map((p) => p.value));
    const spanP = Math.max(1e-6, maxP - minP);

    const maxV = vols.length ? Math.max(...vols.map((v) => v.value)) : 0;

    const yPrice = (v: number) => padTop + (1 - (v - minP) / spanP) * priceH;
    const yVol = (v: number) => H - 10 - (maxV ? (v / maxV) * volH : 0);
    const xAt = (i: number) => padX + i * step;

    const candleEls = candles.map((c, i) => {
      const x = xAt(i);
      const up = c.close >= c.open;
      const color = up ? "#22c55e" : "#ef4444";

      const yHigh = yPrice(c.high);
      const yLow = yPrice(c.low);
      const yOpen = yPrice(c.open);
      const yClose = yPrice(c.close);

      const bx = Math.round(x - bodyW / 2);
      const by = Math.round(Math.min(yOpen, yClose));
      const bh = Math.max(1, Math.abs(Math.round(yClose - yOpen)));

      return (
        <g key={`c${i}`}>
          <line
            x1={Math.round(x)}
            y1={Math.round(yHigh)}
            x2={Math.round(x)}
            y2={Math.round(yLow)}
            stroke={color}
            strokeWidth={1}
          />
          <rect x={bx} y={by} width={bodyW} height={bh} fill={color} opacity={0.9} />
        </g>
      );
    });

    const volEls = vols.map((v, i) => {
      const x = xAt(i);
      const y = yVol(v.value);
      const h = H - 10 - y;
      const color = v.up ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)";
      return (
        <rect
          key={`v${i}`}
          x={Math.round(x - bodyW / 2)}
          y={Math.round(y)}
          width={bodyW}
          height={Math.max(1, Math.round(h))}
          fill={color}
        />
      );
    });

    const closePath = closeLine
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yPrice(p.value).toFixed(1)}`)
      .join(" ");

    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none">
        <rect
          x="0.5"
          y="0.5"
          width={W - 1}
          height={H - 1}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
        />
        {volEls}
        {closePath && (
          <path d={closePath} fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="1.5" />
        )}
        {candleEls}
      </svg>
    );
  }

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
      </div>

      {err && <div style={{ marginBottom: 8, fontSize: 12, color: "#f87171" }}>{err}</div>}

      <div
        ref={containerRef}
        style={{
          height: 340,
          border: "1px solid #222",
          borderRadius: 12,
          padding: 8,
          position: "relative",
          cursor: "crosshair",
        }}
        aria-busy={loading}
        onMouseLeave={() => {
          const tip = tooltipRef.current;
          if (tip) tip.style.display = "none";
        }}
      >
        {/* Tooltip */}
        <div
          ref={tooltipRef}
          style={{
            position: "absolute",
            top: 8,
            // remove 'right' to avoid conflicting with dynamic 'left'
            left: 8,
            // bring tooltip above LWC layers
            zIndex: 9999,
            pointerEvents: "none",
            fontSize: 12,
            lineHeight: 1.2,
            padding: "6px 8px",
            borderRadius: 8,
            background: "rgba(0,0,0,0.75)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.25)",
            backdropFilter: "blur(2px)",
            minWidth: 160,
            display: "none",
          }}
        />

        {!loading && !hasData && (
          <div style={{ height: "100%", display: "grid", placeItems: "center", opacity: 0.7 }}>
            No OHLC/close data
          </div>
        )}

        {useFallbackSvg && hasData && renderFallbackSvg()}
      </div>
    </section>
  );
}

// // src/components/company/CompanyCandleChart.tsx
// import * as React from "react";
// import { createChart, ColorType } from "lightweight-charts";

// /** --- Types (keine anys) --------------------------------------------------- */
// type BusinessDay = { year: number; month: number; day: number };

// type CandlePoint = { time: BusinessDay; open: number; high: number; low: number; close: number };
// type VolumePoint = { time: BusinessDay; value: number; up: boolean };
// type AreaPoint = { time: BusinessDay; value: number };

// type PriceFormat =
//   | { type: "price"; precision?: number; minMove?: number }
//   | { type: "volume" }
//   | { type: "custom"; formatter: (price: number) => string; minMove?: number };

// type SeriesCommonOpts = { priceFormat?: PriceFormat; priceScaleId?: string };

// type PriceScaleApi = {
//   applyOptions(opts: { scaleMargins?: { top: number; bottom: number } }): void;
// };
// type TimeScaleApi = { fitContent(): void };

// type CandlestickSeriesApi = {
//   setData(data: CandlePoint[]): void;
//   applyOptions(opts: SeriesCommonOpts & Record<string, unknown>): void;
// };
// type HistogramSeriesApi = {
//   setData(data: VolumePoint[]): void;
//   applyOptions(opts: SeriesCommonOpts & Record<string, unknown>): void;
// };
// type AreaSeriesApi = {
//   setData(data: AreaPoint[]): void;
//   applyOptions(opts: SeriesCommonOpts & Record<string, unknown>): void;
// };
// type LineSeriesApi = {
//   setData(data: AreaPoint[]): void;
//   applyOptions(opts: SeriesCommonOpts & Record<string, unknown>): void;
// };

// type CrosshairMoveParam = {
//   time?: BusinessDay | number;
//   point?: { x: number; y: number } | null;
//   seriesData?: Map<object, unknown>;
//   seriesPrices?: Map<object, unknown>;
// };
// type CrosshairMoveHandler = (param: CrosshairMoveParam) => void;

// type MinimalChartApi = {
//   addCandlestickSeries?: (opts?: Record<string, unknown>) => CandlestickSeriesApi;
//   addHistogramSeries?: (opts?: Record<string, unknown>) => HistogramSeriesApi;
//   addAreaSeries?: (opts?: Record<string, unknown>) => AreaSeriesApi;
//   addLineSeries?: (opts?: Record<string, unknown>) => LineSeriesApi;
//   priceScale(id?: string): PriceScaleApi;
//   timeScale(): TimeScaleApi;
//   remove(): void;
//   applyOptions(opts: Record<string, unknown>): void;
//   subscribeCrosshairMove?: (handler: CrosshairMoveHandler) => void;
//   unsubscribeCrosshairMove?: (handler: CrosshairMoveHandler) => void;
// };

// type OhlcDto = {
//   date: string; // "YYYY-MM-DD"
//   open: number;
//   high: number;
//   low: number;
//   close: number;
//   volume?: number | null;
// };

// /** --- Helfer ---------------------------------------------------------------- */
// function fmtDate(d: Date) {
//   const y = d.getFullYear();
//   const m = String(d.getMonth() + 1).padStart(2, "0");
//   const dd = String(d.getDate()).padStart(2, "0");
//   return `${y}-${m}-${dd}`;
// }

// function toBusinessDayFlexible(input: string): BusinessDay | null {
//   const m = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
//   if (m) {
//     const y = Number(m[1]),
//       mo = Number(m[2]),
//       d = Number(m[3]);
//     if (Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(d)) {
//       return { year: y, month: mo, day: d };
//     }
//   }
//   const dt = new Date(input);
//   if (!Number.isNaN(dt.getTime())) {
//     return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
//   }
//   return null;
// }

// const byDay = (a: BusinessDay, b: BusinessDay) =>
//   a.year !== b.year ? a.year - b.year : a.month !== b.month ? a.month - b.month : a.day - b.day;

// /** --- Komponente ------------------------------------------------------------ */
// export default function CompanyCandleChart({ symbol = "" }: { symbol?: string }) {
//   const sym = symbol.trim().toUpperCase();
//   const backendBase = React.useMemo(() => "http://localhost:5046", []);

//   // Chart + Series
//   const containerRef = React.useRef<HTMLDivElement | null>(null);
//   const chartRef = React.useRef<MinimalChartApi | null>(null);
//   const candleRef = React.useRef<CandlestickSeriesApi | null>(null);
//   const volumeRef = React.useRef<HistogramSeriesApi | null>(null);
//   const areaRef = React.useRef<AreaSeriesApi | null>(null);
//   const lineRef = React.useRef<LineSeriesApi | null>(null);

//   // Tooltip
//   const tooltipRef = React.useRef<HTMLDivElement | null>(null);
//   const crosshairHandlerRef = React.useRef<CrosshairMoveHandler | null>(null);

//   // State
//   const [loading, setLoading] = React.useState(true);
//   const [err, setErr] = React.useState<string | null>(null);
//   const [hasData, setHasData] = React.useState(false);
//   const [useFallbackSvg, setUseFallbackSvg] = React.useState(false);

//   // Fallback-Daten
//   const [fallback, setFallback] = React.useState<{
//     candles: CandlePoint[];
//     volumes: VolumePoint[];
//     area: AreaPoint[];
//   }>({ candles: [], volumes: [], area: [] });

//   // Formatter
//   const fmtPriceUSD = React.useMemo(
//     () =>
//       new Intl.NumberFormat("en-US", {
//         style: "currency",
//         currency: "USD",
//         minimumFractionDigits: 2,
//         maximumFractionDigits: 2,
//       }).format,
//     [],
//   );

//   const fmtDateShort = React.useCallback((time: BusinessDay | number): string => {
//     if (typeof time === "object") {
//       const dd = String(time.day).padStart(2, "0");
//       const mm = String(time.month).padStart(2, "0");
//       return `${dd}.${mm}.${time.year}`;
//     }
//     const d = new Date(time * 1000);
//     if (Number.isNaN(d.getTime())) return String(time);
//     const dd = String(d.getDate()).padStart(2, "0");
//     const mm = String(d.getMonth() + 1).padStart(2, "0");
//     const yy = d.getFullYear();
//     return `${dd}.${mm}.${yy}`;
//   }, []);

//   /** Chart aufbauen/zerstören */
//   React.useEffect(() => {
//     const el = containerRef.current;
//     if (!el) return;

//     const chart = createChart(el, {
//       layout: {
//         background: { type: ColorType.Solid, color: "transparent" },
//         textColor: "rgba(255,255,255,0.82)",
//       },
//       grid: {
//         vertLines: { color: "rgba(255,255,255,0.08)" },
//         horzLines: { color: "rgba(255,255,255,0.08)" },
//       },
//       rightPriceScale: { borderColor: "rgba(255,255,255,0.12)" },
//       timeScale: {
//         borderColor: "rgba(255,255,255,0.12)",
//         rightOffset: 8,
//         barSpacing: 8,
//         timeVisible: true,
//         tickMarkFormatter: (t: BusinessDay | number) => fmtDateShort(t),
//       },
//       crosshair: {
//         mode: 1, // Normal
//         vertLine: { color: "#00E5FF", width: 2, style: 0, visible: true, labelVisible: true },
//         horzLine: { color: "#00E5FF", width: 2, style: 0, visible: true, labelVisible: true },
//       },
//       autoSize: true,
//       localization: { locale: "en-US" },
//     }) as unknown as MinimalChartApi;

//     chartRef.current = chart;

//     const canCandles = typeof chart.addCandlestickSeries === "function";
//     const canHistogram = typeof chart.addHistogramSeries === "function";
//     const canArea = typeof chart.addAreaSeries === "function";
//     const canLine = typeof chart.addLineSeries === "function";

//     if (!canCandles && !canArea && !canLine) {
//       chart.remove();
//       chartRef.current = null;
//       setUseFallbackSvg(true);
//       return;
//     }

//     // Close-Linie unter den Candles
//     if (canArea && chart.addAreaSeries) {
//       areaRef.current = chart.addAreaSeries({
//         lineWidth: 2,
//         lineColor: "rgba(255,255,255,0.85)",
//         topColor: "rgba(0,0,0,0)",
//         bottomColor: "rgba(0,0,0,0)",
//         priceLineVisible: false,
//       });
//     } else if (canLine && chart.addLineSeries) {
//       lineRef.current = chart.addLineSeries({
//         lineWidth: 2,
//         color: "rgba(255,255,255,0.85)",
//         priceLineVisible: false,
//       });
//     }

//     // Volume (Overlay)
//     if (canHistogram && chart.addHistogramSeries) {
//       volumeRef.current = chart.addHistogramSeries({
//         priceFormat: { type: "volume" },
//         priceScaleId: "",
//         overlay: true,
//         color: "rgba(120,144,156,0.6)",
//         base: 0,
//         lastValueVisible: false,
//       });
//       chart.priceScale("").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
//     }

//     // Candles (oben)
//     if (canCandles && chart.addCandlestickSeries) {
//       candleRef.current = chart.addCandlestickSeries({
//         upColor: "#22c55e",
//         downColor: "#ef4444",
//         wickUpColor: "#22c55e",
//         wickDownColor: "#ef4444",
//         borderUpColor: "#22c55e",
//         borderDownColor: "#ef4444",
//       });
//     }

//     // USD-Formatter auf Preis-Serien
//     const usdPriceFormat: PriceFormat = {
//       type: "custom",
//       formatter: (p: number) => fmtPriceUSD(p),
//       minMove: 0.01,
//     };
//     if (areaRef.current) areaRef.current.applyOptions({ priceFormat: usdPriceFormat });
//     if (lineRef.current) lineRef.current.applyOptions({ priceFormat: usdPriceFormat });
//     if (candleRef.current) candleRef.current.applyOptions({ priceFormat: usdPriceFormat });

//     // Tooltip-Update via Crosshair
//     function isBarLike(
//       v: unknown,
//     ): v is { open: number; high: number; low: number; close: number } {
//       if (typeof v !== "object" || v === null) return false;
//       const o = v as Record<string, unknown>;
//       return (
//         typeof o.open === "number" &&
//         typeof o.high === "number" &&
//         typeof o.low === "number" &&
//         typeof o.close === "number"
//       );
//     }

//     function readBarAtCursor(param: CrosshairMoveParam) {
//       const s = candleRef.current as unknown as object | null;
//       if (!s) return null;
//       const d = param.seriesData?.get(s);
//       if (d && isBarLike(d)) return d;
//       const p = param.seriesPrices?.get(s);
//       if (typeof p === "number") return { open: p, high: p, low: p, close: p };
//       if (p && isBarLike(p)) return p;
//       return null;
//     }

//     function fmtTooltipDate(t?: BusinessDay | number): string {
//       if (!t) return "";
//       if (typeof t === "object") {
//         const dd = String(t.day).padStart(2, "0");
//         const mm = String(t.month).padStart(2, "0");
//         return `${dd}.${mm}.${t.year}`;
//       }
//       const d = new Date(t * 1000);
//       const dd = String(d.getDate()).padStart(2, "0");
//       const mm = String(d.getMonth() + 1).padStart(2, "0");
//       const yy = d.getFullYear();
//       return `${dd}.${mm}.${yy}`;
//     }

//     const onMove: CrosshairMoveHandler = (param) => {
//       const tip = tooltipRef.current;
//       if (!tip || !param.point || !param.time) {
//         if (tip) tip.style.display = "none";
//         return;
//       }

//       const dateStr = fmtTooltipDate(param.time);
//       const bar = readBarAtCursor(param);
//       if (!dateStr) {
//         tip.style.display = "none";
//         return;
//       }

//       if (bar) {
//         tip.innerHTML = `
//           <div style="opacity:.9;font-weight:600;margin-bottom:4px">${dateStr}</div>
//           <div>O: ${fmtPriceUSD(bar.open)}</div>
//           <div>H: ${fmtPriceUSD(bar.high)}</div>
//           <div>L: ${fmtPriceUSD(bar.low)}</div>
//           <div>C: ${fmtPriceUSD(bar.close)}</div>
//         `;
//       } else {
//         tip.innerHTML = `
//           <div style="opacity:.9;font-weight:600">${dateStr}</div>
//           <div style="opacity:.8">no bar</div>
//         `;
//       }
//       tip.style.display = "block";
//     };

//     chart.subscribeCrosshairMove?.(onMove);
//     crosshairHandlerRef.current = onMove;

//     // Resize
//     const ro = new ResizeObserver(() => chart.applyOptions({ autoSize: true }));
//     ro.observe(el);

//     return () => {
//       ro.disconnect();
//       if (crosshairHandlerRef.current && chart.unsubscribeCrosshairMove) {
//         chart.unsubscribeCrosshairMove(crosshairHandlerRef.current);
//         crosshairHandlerRef.current = null;
//       }
//       chart.remove();
//       chartRef.current = null;
//       candleRef.current = null;
//       volumeRef.current = null;
//       areaRef.current = null;
//       lineRef.current = null;
//     };
//   }, [fmtDateShort, fmtPriceUSD]);

//   /** Daten laden (6M) */
//   React.useEffect(() => {
//     const aborted = { current: false };

//     async function run() {
//       if (!sym) {
//         setHasData(false);
//         setLoading(false);
//         return;
//       }
//       try {
//         setLoading(true);
//         setErr(null);

//         const to = new Date();
//         const from = new Date();
//         from.setDate(to.getDate() - 180);

//         const url = `${backendBase}/api/quotes/ohlc?symbol=${encodeURIComponent(sym)}&from=${fmtDate(
//           from,
//         )}&to=${fmtDate(to)}`;
//         const resp = await fetch(url, { headers: { Accept: "application/json" } });
//         if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
//         if (aborted.current) return;

//         const raw = (await resp.json()) as unknown;
//         const rows: OhlcDto[] = Array.isArray(raw) ? (raw as OhlcDto[]) : [];

//         const candles: CandlePoint[] = [];
//         const volumes: VolumePoint[] = [];
//         const area: AreaPoint[] = [];

//         for (const r of rows) {
//           const bd = toBusinessDayFlexible(r.date);
//           if (!bd) continue;

//           const hasOhlc =
//             typeof r.open === "number" &&
//             typeof r.high === "number" &&
//             typeof r.low === "number" &&
//             typeof r.close === "number";

//           if (hasOhlc) {
//             candles.push({ time: bd, open: r.open, high: r.high, low: r.low, close: r.close });
//           }
//           if (typeof r.close === "number") {
//             area.push({ time: bd, value: r.close });
//           }
//           if (r.volume != null && hasOhlc) {
//             volumes.push({ time: bd, value: Number(r.volume), up: r.close >= r.open });
//           }
//         }

//         candles.sort((a, b) => byDay(a.time, b.time));
//         volumes.sort((a, b) => byDay(a.time, b.time));
//         area.sort((a, b) => byDay(a.time, b.time));

//         if (aborted.current) return;

//         if (candleRef.current && candles.length > 0) {
//           candleRef.current.setData(candles);
//           if (volumeRef.current) volumeRef.current.setData(volumes);

//           const closeLine = candles.map((c) => ({ time: c.time, value: c.close }));
//           if (areaRef.current) areaRef.current.setData(closeLine);
//           if (lineRef.current) lineRef.current.setData(closeLine);

//           setHasData(true);
//           setUseFallbackSvg(false);
//           chartRef.current?.timeScale().fitContent();
//         } else if ((areaRef.current || lineRef.current) && area.length > 0) {
//           if (areaRef.current) areaRef.current.setData(area);
//           if (lineRef.current) lineRef.current.setData(area);

//           setHasData(true);
//           setUseFallbackSvg(false);
//           chartRef.current?.timeScale().fitContent();
//         } else {
//           setFallback({ candles, volumes, area });
//           setHasData(candles.length > 0 || area.length > 0);
//           setUseFallbackSvg(true);
//         }
//       } catch (e) {
//         if (aborted.current) return;
//         setErr(e instanceof Error ? e.message : String(e));
//         setHasData(false);
//       } finally {
//         if (!aborted.current) setLoading(false);
//       }
//     }

//     run();
//     return () => {
//       aborted.current = true;
//     };
//   }, [sym, backendBase]);

//   if (!sym) return null;

//   /** SVG-Fallback */
//   function renderFallbackSvg() {
//     const W = 800,
//       H = 320;
//     const padTop = 10,
//       padBottom = 60,
//       padX = 12;
//     const priceH = H - padTop - padBottom;
//     const volH = 40;

//     const candles = fallback.candles;
//     const vols = fallback.volumes;
//     const closeLine = fallback.area.length
//       ? fallback.area
//       : candles.map<AreaPoint>((c) => ({ time: c.time, value: c.close }));

//     if (candles.length === 0 && closeLine.length === 0) {
//       return (
//         <div style={{ height: "100%", display: "grid", placeItems: "center", opacity: 0.7 }}>
//           No OHLC/close data
//         </div>
//       );
//     }

//     const n = Math.max(candles.length, closeLine.length);
//     const step = n > 1 ? (W - padX * 2) / (n - 1) : W - padX * 2;
//     const bodyW = Math.max(1, Math.floor(step * 0.6));

//     const highs = candles.map((c) => c.high);
//     const lows = candles.map((c) => c.low);
//     const minP =
//       highs.length && lows.length ? Math.min(...lows) : Math.min(...closeLine.map((p) => p.value));
//     const maxP =
//       highs.length && lows.length ? Math.max(...highs) : Math.max(...closeLine.map((p) => p.value));
//     const spanP = Math.max(1e-6, maxP - minP);

//     const maxV = vols.length ? Math.max(...vols.map((v) => v.value)) : 0;

//     const yPrice = (v: number) => padTop + (1 - (v - minP) / spanP) * priceH;
//     const yVol = (v: number) => H - 10 - (maxV ? (v / maxV) * volH : 0);
//     const xAt = (i: number) => padX + i * step;

//     const candleEls = candles.map((c, i) => {
//       const x = xAt(i);
//       const up = c.close >= c.open;
//       const color = up ? "#22c55e" : "#ef4444";

//       const yHigh = yPrice(c.high);
//       const yLow = yPrice(c.low);
//       const yOpen = yPrice(c.open);
//       const yClose = yPrice(c.close);

//       const bx = Math.round(x - bodyW / 2);
//       const by = Math.round(Math.min(yOpen, yClose));
//       const bh = Math.max(1, Math.abs(Math.round(yClose - yOpen)));

//       return (
//         <g key={`c${i}`}>
//           <line
//             x1={Math.round(x)}
//             y1={Math.round(yHigh)}
//             x2={Math.round(x)}
//             y2={Math.round(yLow)}
//             stroke={color}
//             strokeWidth={1}
//           />
//           <rect x={bx} y={by} width={bodyW} height={bh} fill={color} opacity={0.9} />
//         </g>
//       );
//     });

//     const volEls = vols.map((v, i) => {
//       const x = xAt(i);
//       const y = yVol(v.value);
//       const h = H - 10 - y;
//       const color = v.up ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)";
//       return (
//         <rect
//           key={`v${i}`}
//           x={Math.round(x - bodyW / 2)}
//           y={Math.round(y)}
//           width={bodyW}
//           height={Math.max(1, Math.round(h))}
//           fill={color}
//         />
//       );
//     });

//     const closePath = closeLine
//       .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yPrice(p.value).toFixed(1)}`)
//       .join(" ");

//     return (
//       <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none">
//         <rect
//           x="0.5"
//           y="0.5"
//           width={W - 1}
//           height={H - 1}
//           fill="none"
//           stroke="rgba(255,255,255,0.08)"
//         />
//         {volEls}
//         {closePath && (
//           <path d={closePath} fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="1.5" />
//         )}
//         {candleEls}
//       </svg>
//     );
//   }

//   return (
//     <section style={{ marginTop: 12 }}>
//       <div
//         style={{
//           marginBottom: 8,
//           display: "flex",
//           alignItems: "baseline",
//           justifyContent: "space-between",
//           gap: 8,
//         }}
//       >
//         <h2 style={{ margin: 0, fontSize: 16, opacity: 0.9 }}>Price (6M)</h2>
//       </div>

//       {err && <div style={{ marginBottom: 8, fontSize: 12, color: "#f87171" }}>{err}</div>}

//       <div
//         ref={containerRef}
//         style={{
//           height: 340,
//           border: "1px solid #222",
//           borderRadius: 12,
//           padding: 8,
//           position: "relative",
//           cursor: "crosshair",
//         }}
//         aria-busy={loading}
//         onMouseLeave={() => {
//           const tip = tooltipRef.current;
//           if (tip) tip.style.display = "none";
//         }}
//       >
//         {/* Tooltip (oben rechts) */}
//         <div
//           ref={tooltipRef}
//           style={{
//             position: "absolute",
//             top: 8,
//             right: 8,
//             zIndex: 6,
//             pointerEvents: "none",
//             fontSize: 12,
//             lineHeight: 1.2,
//             padding: "6px 8px",
//             borderRadius: 8,
//             background: "rgba(0,0,0,0.75)",
//             color: "#fff",
//             border: "1px solid rgba(255,255,255,0.25)",
//             backdropFilter: "blur(2px)",
//             minWidth: 160,
//             display: "none",
//           }}
//         />

//         {!loading && !hasData && (
//           <div style={{ height: "100%", display: "grid", placeItems: "center", opacity: 0.7 }}>
//             No OHLC/close data
//           </div>
//         )}

//         {useFallbackSvg && hasData && renderFallbackSvg()}
//       </div>
//     </section>
//   );
// }

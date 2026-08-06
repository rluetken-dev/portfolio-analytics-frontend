import { useContext, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CurrencyContext } from "../../context/CurrencyContextObject";
import { convertCurrency } from "../../utils/currencyUtils";

type CandlePoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

type PricePoint = {
  date: string;
  close: number;
};

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

type ChartRange = {
  start: number;
  end: number;
} | null;

type CompanyCandleChartProps = {
  symbol: string;
  range: ChartRange;
  height?: number;
};

const lookbackDays = 210;

function formatDateForApi(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDate(value: string): Date {
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? new Date(value.replace("Z", "")) : parsedDate;
}

function toIsoDate(value: unknown): string {
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    return formatDateForApi(parseDate(value));
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value > 1e12 ? value : value * 1000;
    return formatDateForApi(new Date(milliseconds));
  }

  return "";
}

function pickNumber(...candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    const value = typeof candidate === "number" ? candidate : Number(candidate);

    if (Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

async function fetchTimeseries(symbol: string): Promise<PricePoint[]> {
  const params = new URLSearchParams({ symbol });

  const response = await fetch(`/api/quotes/timeseries?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = (await response.json()) as unknown;
  const rows = Array.isArray(data) ? (data as TimeseriesApiRow[]) : [];

  return rows
    .map((row) => ({
      date: toIsoDate(row.date ?? row.time ?? row.timestamp ?? row.t),
      close: pickNumber(row.close, row.adjustedClose, row.adjClose, row.c, row.price) ?? Number.NaN,
    }))
    .filter((point) => point.date.length > 0 && Number.isFinite(point.close))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchOhlc(symbol: string, from?: string, to?: string): Promise<CandlePoint[]> {
  const params = new URLSearchParams({ symbol });

  if (from) {
    params.set("from", from);
  }

  if (to) {
    params.set("to", to);
  }

  const response = await fetch(`/api/quotes/ohlc?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as unknown;
  const rows = Array.isArray(data) ? (data as OhlcApiRow[]) : [];

  return rows
    .map((row) => ({
      date: toIsoDate(row.date ?? row.time ?? row.timestamp ?? row.t),
      open: pickNumber(row.open, row.o) ?? Number.NaN,
      high: pickNumber(row.high, row.h) ?? Number.NaN,
      low: pickNumber(row.low, row.l) ?? Number.NaN,
      close: pickNumber(row.close, row.c) ?? Number.NaN,
    }))
    .filter(
      (point) =>
        point.date.length > 0 &&
        [point.open, point.high, point.low, point.close].every(Number.isFinite),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

export default function CompanyCandleChart({
  symbol,
  range,
  height = 260,
}: CompanyCandleChartProps) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const currencyContext = useContext(CurrencyContext);

  if (!currencyContext) {
    throw new Error("CompanyCandleChart must be used inside CurrencyProvider.");
  }

  const { currency, formatMoneyFrom } = currencyContext;

  const [baseData, setBaseData] = useState<PricePoint[]>([]);
  const [baseCandles, setBaseCandles] = useState<CandlePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadChartData = async () => {
      if (!normalizedSymbol) {
        setBaseData([]);
        setBaseCandles([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const allPricePoints = await fetchTimeseries(normalizedSymbol);

        let from: string | undefined;
        let to: string | undefined;
        let visiblePricePoints = allPricePoints;

        if (allPricePoints.length > 0) {
          to = allPricePoints[allPricePoints.length - 1].date;

          const endDate = new Date(to);
          const startDate = new Date(endDate);
          startDate.setDate(endDate.getDate() - lookbackDays);

          from = formatDateForApi(startDate);
          visiblePricePoints = allPricePoints.filter((point) => point.date >= from! && point.date <= to!);
        }

        const candlePoints = await fetchOhlc(normalizedSymbol, from, to);

        if (!isMounted) {
          return;
        }

        setBaseData(visiblePricePoints);
        setBaseCandles(candlePoints);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setBaseData([]);
        setBaseCandles([]);
        setErrorMessage(error instanceof Error ? error.message : "Chart data could not be loaded.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadChartData();

    return () => {
      isMounted = false;
    };
  }, [normalizedSymbol]);

  const chartData = useMemo(
    () =>
      baseData.map((point) => ({
        ...point,
        close: convertCurrency(point.close, "USD", currency),
      })),
    [baseData, currency],
  );

  const candles = useMemo(
    () =>
      baseCandles.map((point) => ({
        ...point,
        open: convertCurrency(point.open, "USD", currency),
        high: convertCurrency(point.high, "USD", currency),
        low: convertCurrency(point.low, "USD", currency),
        close: convertCurrency(point.close, "USD", currency),
      })),
    [baseCandles, currency],
  );

  const visibleData = useMemo(() => {
    if (chartData.length === 0) {
      return [];
    }

    if (!range) {
      return chartData;
    }

    const start = Math.max(0, Math.min(range.start, chartData.length - 1));
    const end = Math.max(start, Math.min(range.end, chartData.length - 1));

    return chartData.slice(start, end + 1);
  }, [chartData, range]);

  const indexByDate = useMemo(() => {
    const map = new Map<string, number>();

    visibleData.forEach((point, index) => {
      map.set(point.date, index);
    });

    return map;
  }, [visibleData]);

  const visibleCandles = useMemo(() => {
    if (candles.length === 0 || chartData.length === 0) {
      return [];
    }

    if (!range) {
      return candles;
    }

    const startIndex = Math.max(0, Math.min(range.start, chartData.length - 1));
    const endIndex = Math.max(startIndex, Math.min(range.end, chartData.length - 1));
    const fromDate = chartData[startIndex]?.date;
    const toDate = chartData[endIndex]?.date;

    return candles.filter((point) => point.date >= fromDate && point.date <= toDate);
  }, [candles, chartData, range]);

  const yDomain = useMemo<[number | "auto", number | "auto"]>(() => {
    if (visibleCandles.length === 0) {
      return ["auto", "auto"];
    }

    const min = Math.min(...visibleCandles.map((point) => point.low));
    const max = Math.max(...visibleCandles.map((point) => point.high));

    return [min, max];
  }, [visibleCandles]);

  const candleByDate = useMemo(() => {
    const map = new Map<string, CandlePoint>();

    candles.forEach((point) => {
      map.set(point.date, point);
    });

    return map;
  }, [candles]);

  if (!normalizedSymbol) {
    return null;
  }

  return (
    <section style={{ marginTop: 12 }}>
      {errorMessage && (
        <div role="status" style={{ marginBottom: 8, color: "#f87171", fontSize: 12 }}>
          {errorMessage}
        </div>
      )}

      <div style={{ height, border: "1px solid #222", borderRadius: 12, padding: 8 }}>
        {isLoading ? (
          <div
            role="status"
            aria-label="Loading candlestick chart"
            style={{
              height: "100%",
              display: "grid",
              placeItems: "center",
              color: "#6b7280",
            }}
          >
            Loading chart data...
          </div>
        ) : chartData.length === 0 ? (
          <div style={{ height: "100%", display: "grid", placeItems: "center", opacity: 0.7 }}>
            No data
          </div>
        ) : (
          <div style={{ position: "relative", height: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={visibleData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.2} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) =>
                    parseDate(date).toLocaleDateString(undefined, {
                      month: "short",
                      year: "2-digit",
                    })
                  }
                  minTickGap={28}
                  tickMargin={8}
                />
                <YAxis
                  domain={yDomain}
                  width={70}
                  tickFormatter={(value) => formatMoneyFrom(Number(value), currency)}
                />
                <Tooltip
                  wrapperStyle={{ zIndex: 2 }}
                  content={({ active, label }) => {
                    if (!active || label == null) {
                      return null;
                    }

                    const candle = candleByDate.get(String(label));

                    if (!candle) {
                      return null;
                    }

                    const diff = candle.close - candle.open;
                    const percent = candle.open !== 0 ? (diff / candle.open) * 100 : 0;
                    const color = diff >= 0 ? "#22c55e" : "#ef4444";

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
                        <div style={{ opacity: 0.8, marginBottom: 4 }}>{String(label)}</div>
                        <div>Open: {formatMoneyFrom(candle.open, currency)}</div>
                        <div>High: {formatMoneyFrom(candle.high, currency)}</div>
                        <div>Low: {formatMoneyFrom(candle.low, currency)}</div>
                        <div>Close: {formatMoneyFrom(candle.close, currency)}</div>
                        <div style={{ color, marginTop: 4, fontWeight: 600 }}>
                          Change: {formatMoneyFrom(diff, currency)} ({percent.toFixed(2)}%)
                        </div>
                      </div>
                    );
                  }}
                />
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

            {typeof yDomain[0] === "number" && typeof yDomain[1] === "number" && (
              <MiniCandles
                candles={visibleCandles}
                indexByDate={indexByDate}
                count={visibleData.length}
                yMin={yDomain[0]}
                yMax={yDomain[1]}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function MiniCandles({
  candles,
  indexByDate,
  count,
  yMin,
  yMax,
}: {
  candles: CandlePoint[];
  indexByDate: Map<string, number>;
  count: number;
  yMin: number;
  yMax: number;
}) {
  if (count <= 1 || candles.length === 0) {
    return null;
  }

  const width = 1000;
  const height = 600;
  const step = count > 1 ? width / (count - 1) : width;
  const bodyWidth = Math.max(1, Math.min(12, Math.floor(step * 0.7)));
  const denominator = yMax - yMin || 1;
  const getY = (value: number) => (1 - (value - yMin) / denominator) * height;

  return (
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
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none">
        {candles.map((candle) => {
          const index = indexByDate.get(candle.date);

          if (index == null) {
            return null;
          }

          const x = index * step;
          const isPositive = candle.close >= candle.open;
          const color = isPositive ? "#22c55e" : "#ef4444";
          const yHigh = getY(candle.high);
          const yLow = getY(candle.low);
          const yOpen = getY(candle.open);
          const yClose = getY(candle.close);
          const xBody = x - bodyWidth / 2;
          const yBody = Math.min(yOpen, yClose);
          const bodyHeight = Math.abs(yClose - yOpen);

          return (
            <g key={candle.date}>
              <line
                x1={x}
                y1={yHigh}
                x2={x}
                y2={yLow}
                stroke={color}
                strokeWidth={bodyWidth / 6}
              />
              <rect
                x={xBody}
                y={yBody}
                width={bodyWidth}
                height={Math.max(1, bodyHeight)}
                fill={color}
                opacity={0.9}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
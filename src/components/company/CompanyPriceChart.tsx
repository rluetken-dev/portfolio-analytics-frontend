import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CurrencyContext } from "../../context/CurrencyContextObject";
import { convertCurrency } from "../../utils/currencyUtils";

type PricePoint = {
  date: string;
  close: number;
};

type TimeseriesApiRow = {
  date?: string | null;
  close?: number | null;
};

type BrushRange = {
  startIndex?: number;
  endIndex?: number;
};

type ChartRange = {
  start: number;
  end: number;
} | null;

type LatestQuote = {
  date: string;
  close: number;
};

type CompanyPriceChartProps = {
  symbol: string;
  range: ChartRange;
  onRangeChange: (range: ChartRange) => void;
};

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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

async function fetchLatestQuote(symbol: string): Promise<LatestQuote | null> {
  const params = new URLSearchParams({ symbol });

  const response = await fetch(`/api/Quotes/latest?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as unknown;

  if (typeof data !== "object" || data === null) {
    return null;
  }

  const row = data as Record<string, unknown>;
  const date = row.date ?? row.Date ?? row.tradingDate ?? row.TradingDate;
  const close = row.close ?? row.Close;

  if (!isNonEmptyString(date) || !isFiniteNumber(close)) {
    return null;
  }

  return { date, close };
}

async function fetchTimeseries(symbol: string, from?: string, to?: string): Promise<PricePoint[]> {
  const params = new URLSearchParams({ symbol });

  if (from) {
    params.set("from", from);
  }

  if (to) {
    params.set("to", to);
  }

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
      date: String(row.date ?? ""),
      close: typeof row.close === "number" ? row.close : Number.NaN,
    }))
    .filter((point) => point.date.length > 0 && Number.isFinite(point.close))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export default function CompanyPriceChart({
  symbol,
  range,
  onRangeChange,
}: CompanyPriceChartProps) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const currencyContext = useContext(CurrencyContext);

  if (!currencyContext) {
    throw new Error("CompanyPriceChart must be used inside CurrencyProvider.");
  }

  const { currency, formatMoneyFrom } = currencyContext;

  const [baseData, setBaseData] = useState<PricePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPriceData = async () => {
      if (!normalizedSymbol) {
        setBaseData([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const latestQuote = await fetchLatestQuote(normalizedSymbol);
        let pricePoints: PricePoint[];

        if (latestQuote?.date) {
          const endDate = new Date(latestQuote.date);
          const startDate = new Date(endDate);
          startDate.setDate(endDate.getDate() - 180);

          pricePoints = await fetchTimeseries(
            normalizedSymbol,
            formatDateForApi(startDate),
            formatDateForApi(endDate),
          );
        } else {
          pricePoints = await fetchTimeseries(normalizedSymbol);
        }

        if (!isMounted) {
          return;
        }

        setBaseData(pricePoints);
        onRangeChange(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setBaseData([]);
        setErrorMessage(error instanceof Error ? error.message : "Price data could not be loaded.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadPriceData();

    return () => {
      isMounted = false;
    };
  }, [normalizedSymbol, onRangeChange]);

  const chartData = useMemo(
    () =>
      baseData.map((point) => ({
        ...point,
        close: convertCurrency(point.close, "USD", currency),
      })),
    [baseData, currency],
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

  const resetView = useCallback(() => {
    onRangeChange(null);
  }, [onRangeChange]);

  const formatDateTick = useCallback((date: string) => {
    return parseDate(date).toLocaleDateString(undefined, {
      month: "short",
      year: "2-digit",
    });
  }, []);

  const formatTooltipValue = useCallback(
    (value: number | string) => {
      const numericValue = typeof value === "number" ? value : Number(value);

      if (!Number.isFinite(numericValue)) {
        return "n/a";
      }

      return formatMoneyFrom(numericValue, currency);
    },
    [currency, formatMoneyFrom],
  );

  const handleBrushChange = useCallback(
    (brushRange: BrushRange | undefined) => {
      if (
        !brushRange ||
        typeof brushRange.startIndex !== "number" ||
        typeof brushRange.endIndex !== "number"
      ) {
        return;
      }

      const maxIndex = Math.max(0, chartData.length - 1);
      const minimumRangeSize = Math.min(5, maxIndex);

      let start = Math.max(0, Math.min(brushRange.startIndex, maxIndex));
      let end = Math.max(start, Math.min(brushRange.endIndex, maxIndex));

      if (end - start < minimumRangeSize) {
        const center = Math.round((start + end) / 2);
        start = Math.max(0, center - Math.floor(minimumRangeSize / 2));
        end = Math.min(maxIndex, start + minimumRangeSize);
        start = Math.max(0, Math.min(start, end - minimumRangeSize));
      }

      onRangeChange({ start, end });
    },
    [chartData.length, onRangeChange],
  );

  if (!normalizedSymbol) {
    return null;
  }

  const maxIndex = Math.max(0, chartData.length - 1);
  const currentStart = range ? Math.max(0, Math.min(range.start, maxIndex)) : 0;
  const currentEnd = range ? Math.max(currentStart, Math.min(range.end, maxIndex)) : maxIndex;

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
            type="button"
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

      {errorMessage && (
        <div role="status" style={{ marginBottom: 8, fontSize: 12, color: "#f87171" }}>
          {errorMessage}
        </div>
      )}

      <div style={{ height: 260, border: "1px solid #222", borderRadius: 12, padding: 8 }}>
        {isLoading ? (
          <div
            role="status"
            aria-label="Loading price chart"
            style={{
              height: "100%",
              display: "grid",
              placeItems: "center",
              color: "#6b7280",
            }}
          >
            Loading price data...
          </div>
        ) : chartData.length === 0 ? (
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
                data={visibleData}
                onDoubleClick={resetView}
                margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="company-price-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="currentColor" stopOpacity={0.05} />
                  </linearGradient>
                </defs>

                <CartesianGrid vertical={false} strokeOpacity={0.2} />
                <XAxis dataKey="date" tickFormatter={formatDateTick} minTickGap={28} tickMargin={8} />
                <YAxis
                  domain={["auto", "auto"]}
                  tickCount={6}
                  allowDecimals
                  width={70}
                  tickFormatter={(value) => formatMoneyFrom(Number(value), currency)}
                />
                <Tooltip
                  formatter={formatTooltipValue}
                  labelFormatter={(date) =>
                    parseDate(String(date)).toLocaleDateString(undefined, {
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
                  fill="url(#company-price-gradient)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  name="Close"
                />
              </AreaChart>
            </ResponsiveContainer>

            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
                <XAxis dataKey="date" hide />
                <YAxis domain={["dataMin", "dataMax"]} hide />
                <Brush
                  dataKey="date"
                  height={26}
                  travellerWidth={8}
                  startIndex={currentStart}
                  endIndex={currentEnd}
                  onChange={handleBrushChange}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
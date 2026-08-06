import { useContext, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { CurrencyContext } from "../../context/CurrencyContextObject";
import { useCurrencyFade } from "../../hooks/useCurrencyFade";
import { getLatestCloseFromQuotes } from "../../services/api/quotes";
import { useFormatDisplayValue } from "../../utils/formatDisplayValue";

type Metric = {
  label: string;
  value: string;
  hint?: string;
};

interface CompanyKpisProps {
  symbol: string;
}

interface MetricResult {
  value: number | null;
  status: number;
}

const cardStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: 10,
  minHeight: 64,
  backgroundColor: "#fff",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
};

const skeletonStyle: CSSProperties = {
  marginTop: 8,
  height: 18,
  borderRadius: 6,
  background: "#e5e7eb",
};

async function fetchMetricNumber(
  path: string,
  symbol: string,
  keys: string[],
): Promise<MetricResult> {
  const response = await fetch(`${path}?symbol=${encodeURIComponent(symbol)}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return { value: null, status: response.status };
  }

  const data = (await response.json()) as unknown;

  if (typeof data === "number") {
    return { value: data, status: response.status };
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;

    for (const key of keys) {
      if (typeof record[key] === "number") {
        return { value: record[key], status: response.status };
      }
    }
  }

  return { value: null, status: response.status };
}

function formatRatio(value: number | null) {
  return value === null || Number.isNaN(value) ? "n/a" : `${value.toFixed(2)}x`;
}

function formatPercent(value: number | null) {
  return value === null || Number.isNaN(value) ? "n/a" : `${(value * 100).toFixed(1)}%`;
}

export default function CompanyKpis({ symbol }: CompanyKpisProps) {
  const normalizedSymbol = useMemo(() => symbol.trim().toUpperCase(), [symbol]);
  const { fadeClass } = useCurrencyFade();
  const currencyContext = useContext(CurrencyContext);
  const { formatDisplayValue } = useFormatDisplayValue();

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [basePrice, setBasePrice] = useState<number | null>(null);

  if (!currencyContext) {
    throw new Error("CompanyKpis must be used within a CurrencyProvider.");
  }

  const { currency } = currencyContext;

  useEffect(() => {
    let isMounted = true;

    const loadMetrics = async () => {
      if (!normalizedSymbol) {
        setMetrics([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const price = await getLatestCloseFromQuotes(normalizedSymbol);

        const [peResult, roeResult, netMarginResult, fcfYieldResult, debtToEquityResult] =
          await Promise.all([
            fetchMetricNumber("/api/analytics/pe", normalizedSymbol, ["value", "pe"]),
            fetchMetricNumber("/api/analytics/roe", normalizedSymbol, ["value", "roe"]),
            fetchMetricNumber("/api/analytics/net-margin", normalizedSymbol, [
              "value",
              "netMargin",
            ]),
            fetchMetricNumber("/api/analytics/fcf-yield", normalizedSymbol, [
              "value",
              "fcfYield",
            ]),
            fetchMetricNumber("/api/analytics/debt-to-equity", normalizedSymbol, [
              "value",
              "debtToEquity",
            ]),
          ]);

        if (!isMounted) {
          return;
        }

        if (price.value !== null && Number.isFinite(price.value)) {
          setBasePrice(price.value);
        }

        setMetrics([
          {
            label: "Price",
            value: price.value !== null ? formatDisplayValue("Price", price.value) : "n/a",
            hint:
              price.status === 200
                ? price.asOf
                  ? `as of ${price.asOf}${price.adjusted ? " (adjusted)" : ""}`
                  : undefined
                : `HTTP ${price.status}`,
          },
          { label: "P/E", value: formatRatio(peResult.value) },
          { label: "ROE", value: formatPercent(roeResult.value) },
          { label: "Net Margin", value: formatPercent(netMarginResult.value) },
          { label: "FCF Yield", value: formatPercent(fcfYieldResult.value) },
          { label: "Debt/Equity", value: formatRatio(debtToEquityResult.value) },
        ]);
      } catch {
        if (!isMounted) {
          return;
        }

        setErrorMessage("Key metrics could not be loaded.");
        setMetrics([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadMetrics();

    return () => {
      isMounted = false;
    };
  }, [normalizedSymbol, formatDisplayValue]);

  useEffect(() => {
    if (basePrice === null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMetrics((currentMetrics) =>
        currentMetrics.map((metric) =>
          metric.label === "Price"
            ? { ...metric, value: formatDisplayValue("Price", basePrice) }
            : metric,
        ),
      );
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [currency, basePrice, formatDisplayValue]);

  if (!normalizedSymbol) {
    return null;
  }

  return (
    <section style={{ marginTop: 12 }}>
      <h2 style={{ margin: "0 0 8px 0", fontSize: 16, opacity: 0.9 }}>Key Metrics</h2>

      {errorMessage && (
        <div role="status" style={{ marginBottom: 8, fontSize: 12, color: "#b91c1c" }}>
          {errorMessage}
        </div>
      )}

      <div style={gridStyle}>
        {Array.from({ length: isLoading ? 6 : metrics.length }).map((_, index) => {
          const metric = isLoading ? null : (metrics[index] ?? null);

          return (
            <div key={metric?.label ?? index} style={cardStyle} aria-busy={isLoading}>
              {isLoading ? (
                <>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>Loading...</div>
                  <div style={skeletonStyle} />
                </>
              ) : (
                <>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>{metric?.label}</div>
                  <div
                    title={metric?.hint}
                    className={metric?.label === "Price" ? fadeClass : ""}
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      marginTop: 4,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {metric?.value}
                  </div>
                  {metric?.hint && (
                    <div
                      style={{
                        fontSize: 10,
                        opacity: 0.6,
                        marginTop: 4,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {metric.hint}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
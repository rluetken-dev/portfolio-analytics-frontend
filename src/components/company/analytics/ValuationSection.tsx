import { useEffect, useMemo, useState } from "react";

import { getLatestCloseFromQuotes } from "../../../services/api/quotes";
import { MetricCard, SectionGrid, SectionHeader } from "./ui";

type MetricResult = {
  value: number | null;
  status: number;
};

interface ValuationSectionProps {
  symbol: string;
  showPrice?: boolean;
  showPE?: boolean;
}

const emptyValue = "—";

async function fetchMetricNumber(
  path: string,
  symbol: string,
  candidateKeys: string[],
): Promise<MetricResult> {
  const response = await fetch(`${path}?symbol=${encodeURIComponent(symbol)}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return { value: null, status: response.status };
  }

  const data = (await response.json()) as unknown;

  if (typeof data === "number" && Number.isFinite(data)) {
    return { value: data, status: response.status };
  }

  if (typeof data !== "object" || data === null) {
    return { value: null, status: response.status };
  }

  const row = data as Record<string, unknown>;

  for (const key of candidateKeys) {
    if (typeof row[key] === "number" && Number.isFinite(row[key])) {
      return { value: row[key], status: response.status };
    }
  }

  return { value: null, status: response.status };
}

function formatMoney(value: number, currency = "USD") {
  if (!Number.isFinite(value)) {
    return emptyValue;
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function formatRatio(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? emptyValue : `${value.toFixed(2)}x`;
}

function isValidMetric(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export default function ValuationSection({
  symbol,
  showPrice = false,
  showPE = false,
}: ValuationSectionProps) {
  const normalizedSymbol = symbol.trim().toUpperCase();

  const [price, setPrice] = useState(emptyValue);
  const [priceEarningsRatio, setPriceEarningsRatio] = useState(emptyValue);
  const [priceBookRatio, setPriceBookRatio] = useState(emptyValue);
  const [priceOwnerEarningsRatio, setPriceOwnerEarningsRatio] = useState(emptyValue);
  const [loadedCount, setLoadedCount] = useState(0);

  const totalVisibleMetrics = useMemo(
    () => (showPrice ? 1 : 0) + (showPE ? 1 : 0) + 2,
    [showPrice, showPE],
  );

  useEffect(() => {
    let isMounted = true;

    const loadMetrics = async () => {
      setPrice(emptyValue);
      setPriceEarningsRatio(emptyValue);
      setPriceBookRatio(emptyValue);
      setPriceOwnerEarningsRatio(emptyValue);
      setLoadedCount(0);

      if (!normalizedSymbol) {
        return;
      }

      try {
        const [latestPrice, priceEarningsResult, priceBookResult, priceOwnerEarningsResult] =
          await Promise.all([
            getLatestCloseFromQuotes(normalizedSymbol),
            fetchMetricNumber("/api/analytics/pe", normalizedSymbol, ["value", "pe"]),
            fetchMetricNumber("/api/analytics/pb", normalizedSymbol, ["value", "pb"]),
            fetchMetricNumber("/api/analytics/p-to-oe", normalizedSymbol, [
              "value",
              "pToOe",
              "pOverOe",
            ]),
          ]);

        if (!isMounted) {
          return;
        }

        const latestPriceValue =
          typeof latestPrice.value === "number" && Number.isFinite(latestPrice.value)
            ? latestPrice.value
            : null;

        const hasPrice = latestPriceValue !== null;
        const hasPriceEarningsRatio = isValidMetric(priceEarningsResult.value);
        const hasPriceBookRatio = isValidMetric(priceBookResult.value);
        const hasPriceOwnerEarningsRatio = isValidMetric(priceOwnerEarningsResult.value);

        if (latestPriceValue !== null) {
            setPrice(formatMoney(latestPriceValue, latestPrice.unit ?? "USD"));
        }

        if (hasPriceEarningsRatio) {
          setPriceEarningsRatio(formatRatio(priceEarningsResult.value));
        }

        if (hasPriceBookRatio) {
          setPriceBookRatio(formatRatio(priceBookResult.value));
        }

        if (hasPriceOwnerEarningsRatio) {
          setPriceOwnerEarningsRatio(formatRatio(priceOwnerEarningsResult.value));
        }

        const nextLoadedCount =
          (showPrice && hasPrice ? 1 : 0) +
          (showPE && hasPriceEarningsRatio ? 1 : 0) +
          (hasPriceBookRatio ? 1 : 0) +
          (hasPriceOwnerEarningsRatio ? 1 : 0);

        setLoadedCount(nextLoadedCount);
      } catch {
        if (isMounted) {
          setLoadedCount(0);
        }
      }
    };

    void loadMetrics();

    return () => {
      isMounted = false;
    };
  }, [normalizedSymbol, showPrice, showPE]);

  if (!normalizedSymbol) {
    return null;
  }

  return (
    <div>
      <SectionHeader title="Valuation" count={`${loadedCount}/${totalVisibleMetrics}`} />
      <SectionGrid cols={totalVisibleMetrics}>
        {showPrice && <MetricCard label="Price" value={price} />}
        {showPE && <MetricCard label="P/E" value={priceEarningsRatio} />}
        <MetricCard label="P/B" value={priceBookRatio} />
        <MetricCard label="P/OE" value={priceOwnerEarningsRatio} />
      </SectionGrid>
    </div>
  );
}
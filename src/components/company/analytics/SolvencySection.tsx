import { useEffect, useMemo, useState } from "react";

import { MetricCard, SectionGrid, SectionHeader } from "./ui";

type MetricResult = {
  value: number | null;
  status: number;
};

interface SolvencySectionProps {
  symbol: string;
  showDebtToEquity?: boolean;
}

const emptyValue = "—";

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

  if (typeof data === "number" && Number.isFinite(data)) {
    return { value: data, status: response.status };
  }

  if (typeof data !== "object" || data === null) {
    return { value: null, status: response.status };
  }

  const row = data as Record<string, unknown>;

  for (const key of keys) {
    if (typeof row[key] === "number" && Number.isFinite(row[key])) {
      return { value: row[key], status: response.status };
    }
  }

  return { value: null, status: response.status };
}

function formatPercent(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? emptyValue : `${(value * 100).toFixed(1)}%`;
}

function formatRatio(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? emptyValue : `${value.toFixed(2)}x`;
}

function isValidMetric(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export default function SolvencySection({
  symbol,
  showDebtToEquity = false,
}: SolvencySectionProps) {
  const normalizedSymbol = symbol.trim().toUpperCase();

  const [debtToEquity, setDebtToEquity] = useState(emptyValue);
  const [debtToAssets, setDebtToAssets] = useState(emptyValue);
  const [equityRatio, setEquityRatio] = useState(emptyValue);
  const [loadedCount, setLoadedCount] = useState(0);

  const totalVisibleMetrics = useMemo(
    () => (showDebtToEquity ? 1 : 0) + 1 + 1,
    [showDebtToEquity],
  );

  useEffect(() => {
    let isMounted = true;

    const loadMetrics = async () => {
      setDebtToEquity(emptyValue);
      setDebtToAssets(emptyValue);
      setEquityRatio(emptyValue);
      setLoadedCount(0);

      if (!normalizedSymbol) {
        return;
      }

      try {
        const [debtToEquityResult, debtToAssetsResult, equityRatioResult] = await Promise.all([
          fetchMetricNumber("/api/analytics/debt-to-equity", normalizedSymbol, [
            "value",
            "debtToEquity",
          ]),
          fetchMetricNumber("/api/analytics/debt-to-assets", normalizedSymbol, [
            "value",
            "debtToAssets",
          ]),
          fetchMetricNumber("/api/analytics/equity-ratio", normalizedSymbol, [
            "value",
            "equityRatio",
          ]),
        ]);

        if (!isMounted) {
          return;
        }

        const hasDebtToEquity = isValidMetric(debtToEquityResult.value);
        const hasDebtToAssets = isValidMetric(debtToAssetsResult.value);
        const hasEquityRatio = isValidMetric(equityRatioResult.value);

        if (hasDebtToEquity) {
          setDebtToEquity(formatRatio(debtToEquityResult.value));
        }

        if (hasDebtToAssets) {
          setDebtToAssets(formatPercent(debtToAssetsResult.value));
        }

        if (hasEquityRatio) {
          setEquityRatio(formatPercent(equityRatioResult.value));
        }

        const nextLoadedCount =
          (showDebtToEquity && hasDebtToEquity ? 1 : 0) +
          (hasDebtToAssets ? 1 : 0) +
          (hasEquityRatio ? 1 : 0);

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
  }, [normalizedSymbol, showDebtToEquity]);

  if (!normalizedSymbol) {
    return null;
  }

  return (
    <div>
      <SectionHeader title="Solvency / Leverage" count={`${loadedCount}/${totalVisibleMetrics}`} />
      <SectionGrid cols={totalVisibleMetrics}>
        {showDebtToEquity && <MetricCard label="Debt/Equity" value={debtToEquity} />}
        <MetricCard label="Debt/Assets" value={debtToAssets} />
        <MetricCard label="Equity Ratio" value={equityRatio} />
      </SectionGrid>
    </div>
  );
}
import { useEffect, useState } from "react";

import { MetricCard, SectionGrid, SectionHeader } from "./ui";

type MetricResult = {
  value: number | null;
  status: number;
};

interface EfficiencySectionProps {
  symbol: string;
}

const totalMetrics = 2;

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

  if (typeof data !== "object" || data === null) {
    return { value: null, status: response.status };
  }

  const row = data as Record<string, unknown>;

  for (const key of keys) {
    if (typeof row[key] === "number") {
      return { value: row[key], status: response.status };
    }
  }

  return { value: null, status: response.status };
}

function formatPercent(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(1)}%`;
}

function formatRatio(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(2)}x`;
}

export default function EfficiencySection({ symbol }: EfficiencySectionProps) {
  const normalizedSymbol = symbol.trim().toUpperCase();

  const [assetTurnover, setAssetTurnover] = useState("—");
  const [equityCagr, setEquityCagr] = useState("—");
  const [loadedCount, setLoadedCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadMetrics = async () => {
      setAssetTurnover("—");
      setEquityCagr("—");
      setLoadedCount(0);

      if (!normalizedSymbol) {
        return;
      }

      try {
        const [assetTurnoverResult, equityCagrResult] = await Promise.all([
          fetchMetricNumber("/api/analytics/asset-turnover", normalizedSymbol, [
            "value",
            "assetTurnover",
          ]),
          fetchMetricNumber("/api/analytics/equity-cagr", normalizedSymbol, [
            "value",
            "equityCagr",
            "cagr",
          ]),
        ]);

        if (!isMounted) {
          return;
        }

        let nextLoadedCount = 0;

        if (
          typeof assetTurnoverResult.value === "number" &&
          Number.isFinite(assetTurnoverResult.value)
        ) {
          setAssetTurnover(formatRatio(assetTurnoverResult.value));
          nextLoadedCount += 1;
        }

        if (typeof equityCagrResult.value === "number" && Number.isFinite(equityCagrResult.value)) {
          setEquityCagr(formatPercent(equityCagrResult.value));
          nextLoadedCount += 1;
        }

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
  }, [normalizedSymbol]);

  if (!normalizedSymbol) {
    return null;
  }

  return (
    <div>
      <SectionHeader title="Efficiency & Growth" count={`${loadedCount}/${totalMetrics}`} />
      <SectionGrid cols={2}>
        <MetricCard label="Asset Turnover" value={assetTurnover} />
        <MetricCard label="Equity CAGR" value={equityCagr} />
      </SectionGrid>
    </div>
  );
}
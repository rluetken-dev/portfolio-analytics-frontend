import { useEffect, useMemo, useState } from "react";

import { MetricCard, SectionGrid, SectionHeader } from "./ui";

type MetricResult = {
  value: number | null;
  status: number;
};

interface ProfitabilitySectionProps {
  symbol: string;
  showROE?: boolean;
  showNetMargin?: boolean;
  showFcfYield?: boolean;
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

function formatPercent(value: number | null | undefined, digits = 1) {
  return value == null || !Number.isFinite(value) ? emptyValue : `${(value * 100).toFixed(digits)}%`;
}

function isValidMetric(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export default function ProfitabilitySection({
  symbol,
  showROE = false,
  showNetMargin = false,
  showFcfYield = false,
}: ProfitabilitySectionProps) {
  const normalizedSymbol = symbol.trim().toUpperCase();

  const [returnOnEquity, setReturnOnEquity] = useState(emptyValue);
  const [returnOnAssets, setReturnOnAssets] = useState(emptyValue);
  const [netMargin, setNetMargin] = useState(emptyValue);
  const [freeCashFlowYield, setFreeCashFlowYield] = useState(emptyValue);
  const [freeCashFlowMargin, setFreeCashFlowMargin] = useState(emptyValue);
  const [ownerEarningsYield, setOwnerEarningsYield] = useState(emptyValue);
  const [loadedCount, setLoadedCount] = useState(0);

  const totalVisibleMetrics = useMemo(
    () =>
      (showROE ? 1 : 0) +
      1 +
      (showNetMargin ? 1 : 0) +
      (showFcfYield ? 1 : 0) +
      1 +
      1,
    [showROE, showNetMargin, showFcfYield],
  );

  useEffect(() => {
    let isMounted = true;

    const loadMetrics = async () => {
      setReturnOnEquity(emptyValue);
      setReturnOnAssets(emptyValue);
      setNetMargin(emptyValue);
      setFreeCashFlowYield(emptyValue);
      setFreeCashFlowMargin(emptyValue);
      setOwnerEarningsYield(emptyValue);
      setLoadedCount(0);

      if (!normalizedSymbol) {
        return;
      }

      try {
        const [
          returnOnEquityResult,
          returnOnAssetsResult,
          netMarginResult,
          freeCashFlowYieldResult,
          freeCashFlowMarginResult,
          ownerEarningsYieldResult,
        ] = await Promise.all([
          fetchMetricNumber("/api/analytics/roe", normalizedSymbol, ["value", "roe"]),
          fetchMetricNumber("/api/analytics/roa", normalizedSymbol, ["value", "roa"]),
          fetchMetricNumber("/api/analytics/net-margin", normalizedSymbol, [
            "value",
            "netMargin",
          ]),
          fetchMetricNumber("/api/analytics/fcf-yield", normalizedSymbol, ["value", "fcfYield"]),
          fetchMetricNumber("/api/analytics/fcf-margin", normalizedSymbol, [
            "value",
            "fcfMargin",
          ]),
          fetchMetricNumber("/api/analytics/owner-earnings-yield", normalizedSymbol, [
            "value",
            "ownerEarningsYield",
          ]),
        ]);

        if (!isMounted) {
          return;
        }

        const hasReturnOnEquity = isValidMetric(returnOnEquityResult.value);
        const hasReturnOnAssets = isValidMetric(returnOnAssetsResult.value);
        const hasNetMargin = isValidMetric(netMarginResult.value);
        const hasFreeCashFlowYield = isValidMetric(freeCashFlowYieldResult.value);
        const hasFreeCashFlowMargin = isValidMetric(freeCashFlowMarginResult.value);
        const hasOwnerEarningsYield = isValidMetric(ownerEarningsYieldResult.value);

        if (hasReturnOnEquity) {
          setReturnOnEquity(formatPercent(returnOnEquityResult.value));
        }

        if (hasReturnOnAssets) {
          setReturnOnAssets(formatPercent(returnOnAssetsResult.value));
        }

        if (hasNetMargin) {
          setNetMargin(formatPercent(netMarginResult.value));
        }

        if (hasFreeCashFlowYield) {
          setFreeCashFlowYield(formatPercent(freeCashFlowYieldResult.value));
        }

        if (hasFreeCashFlowMargin) {
          setFreeCashFlowMargin(formatPercent(freeCashFlowMarginResult.value));
        }

        if (hasOwnerEarningsYield) {
          setOwnerEarningsYield(formatPercent(ownerEarningsYieldResult.value));
        }

        const nextLoadedCount =
          (showROE && hasReturnOnEquity ? 1 : 0) +
          (hasReturnOnAssets ? 1 : 0) +
          (showNetMargin && hasNetMargin ? 1 : 0) +
          (showFcfYield && hasFreeCashFlowYield ? 1 : 0) +
          (hasFreeCashFlowMargin ? 1 : 0) +
          (hasOwnerEarningsYield ? 1 : 0);

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
  }, [normalizedSymbol, showROE, showNetMargin, showFcfYield]);

  if (!normalizedSymbol) {
    return null;
  }

  return (
    <div>
      <SectionHeader title="Profitability" count={`${loadedCount}/${totalVisibleMetrics}`} />
      <SectionGrid cols={totalVisibleMetrics}>
        {showROE && <MetricCard label="ROE" value={returnOnEquity} />}
        <MetricCard label="ROA" value={returnOnAssets} />
        {showNetMargin && <MetricCard label="Net Margin" value={netMargin} />}
        {showFcfYield && <MetricCard label="FCF Yield" value={freeCashFlowYield} />}
        <MetricCard label="FCF Margin" value={freeCashFlowMargin} />
        <MetricCard label="OE Yield" value={ownerEarningsYield} />
      </SectionGrid>
    </div>
  );
}
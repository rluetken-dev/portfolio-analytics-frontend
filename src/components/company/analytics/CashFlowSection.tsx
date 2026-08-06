import { useContext, useEffect, useState } from "react";

import { CurrencyContext } from "../../../context/CurrencyContextObject";
import { useCurrencyFade } from "../../../hooks/useCurrencyFade";
import { useFormatDisplayValue } from "../../../utils/formatDisplayValue";
import { MetricCard, SectionGrid, SectionHeader } from "./ui";

type MetricResult = {
  value: number | null;
  status: number;
};

interface CashFlowSectionProps {
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

export default function CashFlowSection({ symbol }: CashFlowSectionProps) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const currencyContext = useContext(CurrencyContext);
  const { formatDisplayValue } = useFormatDisplayValue();
  const { fadeClass } = useCurrencyFade();

  if (!currencyContext) {
    throw new Error("CashFlowSection must be used inside CurrencyProvider.");
  }

  const { currency } = currencyContext;

  const [freeCashFlow, setFreeCashFlow] = useState("—");
  const [ownerEarnings, setOwnerEarnings] = useState("—");
  const [baseValues, setBaseValues] = useState<{
    freeCashFlow?: number;
    ownerEarnings?: number;
  }>({});
  const [loadedCount, setLoadedCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadMetrics = async () => {
      setFreeCashFlow("—");
      setOwnerEarnings("—");
      setBaseValues({});
      setLoadedCount(0);

      if (!normalizedSymbol) {
        return;
      }

      try {
        const [freeCashFlowResult, ownerEarningsResult] = await Promise.all([
          fetchMetricNumber("/api/analytics/fcf", normalizedSymbol, ["value", "fcf"]),
          fetchMetricNumber("/api/analytics/owner-earnings", normalizedSymbol, [
            "value",
            "ownerEarnings",
          ]),
        ]);

        if (!isMounted) {
          return;
        }

        const nextBaseValues: {
          freeCashFlow?: number;
          ownerEarnings?: number;
        } = {};

        let nextLoadedCount = 0;

        if (typeof freeCashFlowResult.value === "number" && Number.isFinite(freeCashFlowResult.value)) {
          nextBaseValues.freeCashFlow = freeCashFlowResult.value;
          setFreeCashFlow(formatDisplayValue("FCF (abs)", freeCashFlowResult.value));
          nextLoadedCount += 1;
        }

        if (typeof ownerEarningsResult.value === "number" && Number.isFinite(ownerEarningsResult.value)) {
          nextBaseValues.ownerEarnings = ownerEarningsResult.value;
          setOwnerEarnings(formatDisplayValue("Owner Earnings", ownerEarningsResult.value));
          nextLoadedCount += 1;
        }

        setBaseValues(nextBaseValues);
        setLoadedCount(nextLoadedCount);
      } catch {
        if (!isMounted) {
          return;
        }

        setLoadedCount(0);
      }
    };

    void loadMetrics();

    return () => {
      isMounted = false;
    };
  }, [formatDisplayValue, normalizedSymbol]);

  useEffect(() => {
    if (baseValues.freeCashFlow != null) {
      setFreeCashFlow(formatDisplayValue("FCF (abs)", baseValues.freeCashFlow));
    }

    if (baseValues.ownerEarnings != null) {
      setOwnerEarnings(formatDisplayValue("Owner Earnings", baseValues.ownerEarnings));
    }
  }, [baseValues, currency, formatDisplayValue]);

  if (!normalizedSymbol) {
    return null;
  }

  return (
    <div>
      <SectionHeader title="Cash Flow & Owner Earnings" count={`${loadedCount}/${totalMetrics}`} />
      <SectionGrid cols={2}>
        <MetricCard label="FCF (abs)" value={<span className={fadeClass}>{freeCashFlow}</span>} />
        <MetricCard
          label="Owner Earnings"
          value={<span className={fadeClass}>{ownerEarnings}</span>}
        />
      </SectionGrid>
    </div>
  );
}
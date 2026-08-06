import { useContext, useEffect, useState } from "react";

import { CurrencyContext } from "../../../context/CurrencyContextObject";
import { useCurrencyFade } from "../../../hooks/useCurrencyFade";
import { useFormatDisplayValue } from "../../../utils/formatDisplayValue";
import { MetricCard, SectionGrid, SectionHeader } from "./ui";

type MetricResult = {
  value: number | null;
  status: number;
};

interface PerShareSectionProps {
  symbol: string;
}

const totalMetrics = 3;
const emptyValue = "—";

async function fetchMetricNumber(
  path: string,
  symbol: string,
  candidateKeys: string[],
): Promise<MetricResult> {
  try {
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
  } catch {
    return { value: null, status: 0 };
  }
}

function isValidMetric(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export default function PerShareSection({ symbol }: PerShareSectionProps) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const currencyContext = useContext(CurrencyContext);
  const { formatDisplayValue } = useFormatDisplayValue();
  const { fadeClass } = useCurrencyFade();

  if (!currencyContext) {
    throw new Error("PerShareSection must be used inside CurrencyProvider.");
  }

  const { currency } = currencyContext;

  const [eps, setEps] = useState(emptyValue);
  const [bookValuePerShare, setBookValuePerShare] = useState(emptyValue);
  const [ownerEarningsPerShare, setOwnerEarningsPerShare] = useState(emptyValue);
  const [baseValues, setBaseValues] = useState<{
    eps?: number;
    bookValuePerShare?: number;
    ownerEarningsPerShare?: number;
  }>({});
  const [loadedCount, setLoadedCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadMetrics = async () => {
      setEps(emptyValue);
      setBookValuePerShare(emptyValue);
      setOwnerEarningsPerShare(emptyValue);
      setBaseValues({});
      setLoadedCount(0);

      if (!normalizedSymbol) {
        return;
      }

      try {
        const [epsResult, bookValueResult, ownerEarningsResult] = await Promise.all([
          fetchMetricNumber("/api/analytics/eps", normalizedSymbol, ["value", "eps"]),
          fetchMetricNumber("/api/analytics/bvps", normalizedSymbol, ["value", "bvps"]),
          fetchMetricNumber("/api/analytics/oeps", normalizedSymbol, ["value", "oeps"]),
        ]);

        if (!isMounted) {
          return;
        }

        const nextBaseValues: {
          eps?: number;
          bookValuePerShare?: number;
          ownerEarningsPerShare?: number;
        } = {};

        let nextLoadedCount = 0;

        if (isValidMetric(epsResult.value)) {
          nextBaseValues.eps = epsResult.value;
          setEps(formatDisplayValue("EPS", epsResult.value));
          nextLoadedCount += 1;
        }

        if (isValidMetric(bookValueResult.value)) {
          nextBaseValues.bookValuePerShare = bookValueResult.value;
          setBookValuePerShare(formatDisplayValue("BVPS", bookValueResult.value));
          nextLoadedCount += 1;
        }

        if (isValidMetric(ownerEarningsResult.value)) {
          nextBaseValues.ownerEarningsPerShare = ownerEarningsResult.value;
          setOwnerEarningsPerShare(formatDisplayValue("OEPS", ownerEarningsResult.value));
          nextLoadedCount += 1;
        }

        setBaseValues(nextBaseValues);
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
  }, [formatDisplayValue, normalizedSymbol]);

  useEffect(() => {
    if (baseValues.eps != null) {
      setEps(formatDisplayValue("EPS", baseValues.eps));
    }

    if (baseValues.bookValuePerShare != null) {
      setBookValuePerShare(formatDisplayValue("BVPS", baseValues.bookValuePerShare));
    }

    if (baseValues.ownerEarningsPerShare != null) {
      setOwnerEarningsPerShare(formatDisplayValue("OEPS", baseValues.ownerEarningsPerShare));
    }
  }, [baseValues, currency, formatDisplayValue]);

  if (!normalizedSymbol) {
    return null;
  }

  return (
    <div>
      <SectionHeader title="Per Share" count={`${loadedCount}/${totalMetrics}`} />
      <SectionGrid cols={3}>
        <MetricCard label="EPS" value={<span className={fadeClass}>{eps}</span>} />
        <MetricCard
          label="BVPS"
          value={<span className={fadeClass}>{bookValuePerShare}</span>}
        />
        <MetricCard
          label="OEPS"
          value={<span className={fadeClass}>{ownerEarningsPerShare}</span>}
        />
      </SectionGrid>
    </div>
  );
}
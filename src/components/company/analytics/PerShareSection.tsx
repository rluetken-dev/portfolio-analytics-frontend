// src/components/company/analytics/PerShareSection.tsx
import * as React from "react";
import { SectionHeader, SectionGrid, MetricCard } from "./ui";
import { useFormatDisplayValue } from "../../../utils/formatDisplayValue";
import { CurrencyContext } from "../../../context/CurrencyContextObject";
import { useCurrencyFade } from "../../../hooks/useCurrencyFade";

/* -------------------------------------------------------
   Helper: fetch numeric metric (proxy-ready, safe)
------------------------------------------------------- */
async function fetchMetricNumber(
  path: string,
  symbol: string,
  candidateKeys: string[],
): Promise<{ value: number | null; status: number }> {
  try {
    const resp = await fetch(`${path}?symbol=${encodeURIComponent(symbol)}`, {
      headers: { Accept: "application/json" },
    });

    if (!resp.ok) {
      return { value: null, status: resp.status };
    }

    const raw = await resp.json();

    // Case 1: direct number
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return { value: raw, status: resp.status };
    }

    // Case 2: object with candidate numeric keys
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      for (const key of candidateKeys) {
        if (typeof obj[key] === "number" && Number.isFinite(obj[key] as number)) {
          return { value: obj[key] as number, status: resp.status };
        }
      }
    }

    return { value: null, status: resp.status };
  } catch (err) {
    console.error(`[fetchMetricNumber] Failed for ${path}:`, err);
    return { value: null, status: 0 };
  }
}

/* -------------------------------------------------------
   Component: PerShareSection
------------------------------------------------------- */
export default function PerShareSection({ symbol }: { symbol: string }) {
  const sym = (symbol ?? "").trim().toUpperCase();

  const { currency } = React.useContext(CurrencyContext)!;
  const { formatDisplayValue } = useFormatDisplayValue();
  const { fadeClass } = useCurrencyFade();

  const [eps, setEps] = React.useState("—");
  const [bvps, setBvps] = React.useState("—");
  const [oeps, setOeps] = React.useState("—");

  // Store raw numeric base values (for reformatting when currency changes)
  const [baseEps, setBaseEps] = React.useState<number | null>(null);
  const [baseBvps, setBaseBvps] = React.useState<number | null>(null);
  const [baseOeps, setBaseOeps] = React.useState<number | null>(null);

  const TOTAL = 3;
  const [count, setCount] = React.useState(`0/${TOTAL}`);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      setEps("—");
      setBvps("—");
      setOeps("—");
      setCount(`0/${TOTAL}`);

      if (!sym) return;

      try {
        // Fetch metrics in parallel (proxy handles base URL)
        const [epsR, bvpsR, oepsR] = await Promise.all([
          fetchMetricNumber("/api/analytics/eps", sym, ["value", "eps"]),
          fetchMetricNumber("/api/analytics/bvps", sym, ["value", "bvps"]),
          fetchMetricNumber("/api/analytics/oeps", sym, ["value", "oeps"]),
        ]);

        if (cancelled) return;

        const epsOk = Number.isFinite(epsR.value);
        const bvOk = Number.isFinite(bvpsR.value);
        const oeOk = Number.isFinite(oepsR.value);

        // Save numeric base values for later reformatting
        if (epsOk) {
          setBaseEps(epsR.value!);
          setEps(formatDisplayValue("EPS", epsR.value!));
        }
        if (bvOk) {
          setBaseBvps(bvpsR.value!);
          setBvps(formatDisplayValue("BVPS", bvpsR.value!));
        }
        if (oeOk) {
          setBaseOeps(oepsR.value!);
          setOeps(formatDisplayValue("OEPS", oepsR.value!));
        }

        setCount(`${(epsOk ? 1 : 0) + (bvOk ? 1 : 0) + (oeOk ? 1 : 0)}/${TOTAL}`);
      } catch (err) {
        console.error("[PerShareSection] load failed:", err);
        setCount(`0/${TOTAL}`);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [sym, formatDisplayValue]);

  /* -------------------------------------------------------
     Reformat values when currency changes
  ------------------------------------------------------- */
  React.useEffect(() => {
    if (baseEps != null) setEps(formatDisplayValue("EPS", baseEps));
    if (baseBvps != null) setBvps(formatDisplayValue("BVPS", baseBvps));
    if (baseOeps != null) setOeps(formatDisplayValue("OEPS", baseOeps));
  }, [currency, baseEps, baseBvps, baseOeps, formatDisplayValue]);

  if (!sym) return null;

  return (
    <div>
      <SectionHeader title="Per Share" count={count} />
      <SectionGrid cols={3}>
        <MetricCard label="EPS" value={<span className={fadeClass}>{eps}</span>} />
        <MetricCard label="BVPS" value={<span className={fadeClass}>{bvps}</span>} />
        <MetricCard label="OEPS" value={<span className={fadeClass}>{oeps}</span>} />
      </SectionGrid>
    </div>
  );
}

// src/components/company/analytics/ProfitabilitySection.tsx
import * as React from "react";
import { SectionHeader, SectionGrid, MetricCard } from "./ui";

/** -------- Small helpers (local to the section) -------- */
// English: tolerant numeric metric fetcher from /api/analytics/*
async function fetchMetricNumber(
  baseUrl: string,
  path: string,
  symbol: string,
  candidateKeys: string[],
): Promise<{ value: number | null; status: number }> {
  const resp = await fetch(`${baseUrl}${path}?symbol=${encodeURIComponent(symbol)}`, {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) return { value: null, status: resp.status };

  const raw = await resp.json();
  if (typeof raw === "number") return { value: raw, status: resp.status };

  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const k of candidateKeys) {
      if (typeof o[k] === "number") return { value: o[k] as number, status: resp.status };
    }
  }
  return { value: null, status: resp.status };
}

// English: percent formatter like '12.3%'
function fmtPercent(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

/** -------- Component -------- */
export default function ProfitabilitySection({
  symbol,
  showROE = false, // English: avoid duplicates with Key Metrics by default
  showNetMargin = false, // English: avoid duplicates with Key Metrics by default
  showFcfYield = false, // English: avoid duplicates with Key Metrics by default
}: {
  symbol: string;
  showROE?: boolean;
  showNetMargin?: boolean;
  showFcfYield?: boolean;
}) {
  const sym = (symbol ?? "").trim().toUpperCase();

  // English: keep base stable (do not depend on sym)
  const backendBase = React.useMemo(() => "http://localhost:5046", []);

  // English: display-ready strings for each metric
  const [roeStr, setRoeStr] = React.useState("—");
  const [roaStr, setRoaStr] = React.useState("—");
  const [netMarginStr, setNetMarginStr] = React.useState("—");
  const [fcfYieldStr, setFcfYieldStr] = React.useState("—");
  const [fcfMarginStr, setFcfMarginStr] = React.useState("—");
  const [oeYieldStr, setOeYieldStr] = React.useState("—");

  // English: availability counter "available/total" (computed after fetch)
  const [count, setCount] = React.useState("0/0");

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      // English: reset placeholders before (re)loading
      setRoeStr("—");
      setRoaStr("—");
      setNetMarginStr("—");
      setFcfYieldStr("—");
      setFcfMarginStr("—");
      setOeYieldStr("—");
      setCount("0/0");

      if (!sym) return;

      try {
        // English: fetch all profitability metrics in parallel
        const [roeRes, roaRes, netMarginRes, fcfYieldRes, fcfMarginRes, oeYieldRes] =
          await Promise.all([
            fetchMetricNumber(backendBase, "/api/analytics/roe", sym, ["value", "roe"]),
            fetchMetricNumber(backendBase, "/api/analytics/roa", sym, ["value", "roa"]),
            fetchMetricNumber(backendBase, "/api/analytics/net-margin", sym, [
              "value",
              "netMargin",
            ]),
            fetchMetricNumber(backendBase, "/api/analytics/fcf-yield", sym, ["value", "fcfYield"]),
            fetchMetricNumber(backendBase, "/api/analytics/fcf-margin", sym, [
              "value",
              "fcfMargin",
            ]),
            fetchMetricNumber(backendBase, "/api/analytics/owner-earnings-yield", sym, [
              "value",
              "ownerEarningsYield",
            ]),
          ]);

        if (cancelled) return;

        // English: normalize presence flags
        const roeOk = Number.isFinite(roeRes.value as number);
        const roaOk = Number.isFinite(roaRes.value as number);
        const nmOk = Number.isFinite(netMarginRes.value as number);
        const fcfyOk = Number.isFinite(fcfYieldRes.value as number);
        const fcfmOk = Number.isFinite(fcfMarginRes.value as number);
        const oeyOk = Number.isFinite(oeYieldRes.value as number);

        // English: set formatted strings (only when present)
        if (roeOk) setRoeStr(fmtPercent(roeRes.value!));
        if (roaOk) setRoaStr(fmtPercent(roaRes.value!));
        if (nmOk) setNetMarginStr(fmtPercent(netMarginRes.value!));
        if (fcfyOk) setFcfYieldStr(fmtPercent(fcfYieldRes.value!));
        if (fcfmOk) setFcfMarginStr(fmtPercent(fcfMarginRes.value!));
        if (oeyOk) setOeYieldStr(fmtPercent(oeYieldRes.value!));

        // English: compute availability for VISIBLE metrics only
        const totalVisible =
          (showROE ? 1 : 0) + // ROE (toggle)
          1 + // ROA (always visible here)
          (showNetMargin ? 1 : 0) + // Net Margin (toggle)
          (showFcfYield ? 1 : 0) + // FCF Yield (toggle)
          1 + // FCF Margin (always visible)
          1; // OE Yield (always visible)

        const available =
          (showROE && roeOk ? 1 : 0) +
          (roaOk ? 1 : 0) +
          (showNetMargin && nmOk ? 1 : 0) +
          (showFcfYield && fcfyOk ? 1 : 0) +
          (fcfmOk ? 1 : 0) +
          (oeyOk ? 1 : 0);

        setCount(`${available}/${totalVisible}`);
      } catch {
        // English: keep placeholders on error, count remains "0/0" (or you could set to visible total)
        const totalVisible =
          (showROE ? 1 : 0) + 1 + (showNetMargin ? 1 : 0) + (showFcfYield ? 1 : 0) + 1 + 1;
        setCount(`0/${totalVisible}`);
      }
    }

    run();
    return () => {
      cancelled = true; // English: avoid setState after unmount
    };
    // English: include toggles so count and visible columns react to props
  }, [sym, backendBase, showROE, showNetMargin, showFcfYield]);

  if (!sym) return null;

  // English: number of visible columns based on toggles
  const cols =
    (showROE ? 1 : 0) +
    1 + // ROA
    (showNetMargin ? 1 : 0) +
    (showFcfYield ? 1 : 0) +
    1 + // FCF Margin
    1; // OE Yield

  return (
    <div>
      <SectionHeader title="Profitability" count={count} />
      <SectionGrid cols={cols}>
        {showROE && <MetricCard label="ROE" value={roeStr} />}
        <MetricCard label="ROA" value={roaStr} />
        {showNetMargin && <MetricCard label="Net Margin" value={netMarginStr} />}
        {showFcfYield && <MetricCard label="FCF Yield" value={fcfYieldStr} />}
        <MetricCard label="FCF Margin" value={fcfMarginStr} />
        <MetricCard label="OE Yield" value={oeYieldStr} />
      </SectionGrid>
    </div>
  );
}

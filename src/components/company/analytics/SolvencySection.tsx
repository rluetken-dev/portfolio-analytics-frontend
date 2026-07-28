// src/components/company/analytics/SolvencySection.tsx
import * as React from "react";
import { SectionHeader, SectionGrid, MetricCard } from "./ui";

/** ---------- Helpers ---------- */
// English: tolerant numeric fetcher from /api/analytics/*
async function fetchMetricNumber(
  baseUrl: string,
  path: string,
  symbol: string,
  keys: string[],
): Promise<{ value: number | null; status: number }> {
  const resp = await fetch(`${baseUrl}${path}?symbol=${encodeURIComponent(symbol)}`, {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) return { value: null, status: resp.status };

  const raw = await resp.json();
  if (typeof raw === "number") return { value: raw, status: resp.status };

  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const k of keys)
      if (typeof o[k] === "number") return { value: o[k] as number, status: resp.status };
  }
  return { value: null, status: resp.status };
}

// English: formatters
const fmtPercent = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(1)}%`;

const fmtRatio = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(2)}x`;

/** ---------- Component ---------- */
export default function SolvencySection({
  symbol,
  showDebtToEquity = false, // English: avoid duplicate with Key Metrics by default
}: {
  symbol: string;
  showDebtToEquity?: boolean;
}) {
  const sym = (symbol ?? "").trim().toUpperCase();
  const backendBase = "";

  // English: display strings
  const [dte, setDte] = React.useState("—");
  const [dta, setDta] = React.useState("—");
  const [eqr, setEqr] = React.useState("—");

  // English: availability counter reflects only visible metrics
  const [count, setCount] = React.useState("0/0");

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      // English: reset placeholders and counter
      setDte("—");
      setDta("—");
      setEqr("—");
      setCount("0/0");

      if (!sym) return;

      try {
        const [dteR, dtaR, eqrR] = await Promise.all([
          fetchMetricNumber(backendBase, "/api/analytics/debt-to-equity", sym, [
            "value",
            "debtToEquity",
          ]),
          fetchMetricNumber(backendBase, "/api/analytics/debt-to-assets", sym, [
            "value",
            "debtToAssets",
          ]),
          fetchMetricNumber(backendBase, "/api/analytics/equity-ratio", sym, [
            "value",
            "equityRatio",
          ]),
        ]);
        if (cancelled) return;

        const dteOk = Number.isFinite(dteR.value as number);
        const dtaOk = Number.isFinite(dtaR.value as number);
        const eqrOk = Number.isFinite(eqrR.value as number);

        if (dteOk) setDte(fmtRatio(dteR.value!));
        if (dtaOk) setDta(fmtPercent(dtaR.value!));
        if (eqrOk) setEqr(fmtPercent(eqrR.value!));

        // English: visible metrics only (D/E is toggle)
        const totalVisible = (showDebtToEquity ? 1 : 0) + 1 + 1; // D/E?, D/A, Eq Ratio
        const available = (showDebtToEquity && dteOk ? 1 : 0) + (dtaOk ? 1 : 0) + (eqrOk ? 1 : 0);

        setCount(`${available}/${totalVisible}`);
      } catch {
        // English: show 0 over visible total on error
        const totalVisible = (showDebtToEquity ? 1 : 0) + 1 + 1;
        setCount(`0/${totalVisible}`);
      }
    }

    run();
    return () => {
      cancelled = true; // English: avoid setState after unmount
    };
  }, [sym, backendBase, showDebtToEquity]);

  if (!sym) return null;

  // English: columns based on what is visible
  const cols = (showDebtToEquity ? 1 : 0) + 1 + 1;

  return (
    <div>
      <SectionHeader title="Solvency / Leverage" count={count} />
      <SectionGrid cols={cols}>
        {showDebtToEquity && <MetricCard label="Debt/Equity" value={dte} />}
        <MetricCard label="Debt/Assets" value={dta} />
        <MetricCard label="Equity Ratio" value={eqr} />
      </SectionGrid>
    </div>
  );
}

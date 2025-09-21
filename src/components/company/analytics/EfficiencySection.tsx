// src/components/company/analytics/EfficiencySection.tsx
import * as React from "react";
import { SectionHeader, SectionGrid, MetricCard } from "./ui";

async function fetchMetricNumber(baseUrl: string, path: string, symbol: string, keys: string[]) {
  const resp = await fetch(`${baseUrl}${path}?symbol=${encodeURIComponent(symbol)}`, {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) return { value: null as number | null, status: resp.status };
  const raw = await resp.json();
  if (typeof raw === "number") return { value: raw, status: resp.status };
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const k of keys)
      if (typeof o[k] === "number") return { value: o[k] as number, status: resp.status };
  }
  return { value: null as number | null, status: resp.status };
}

const fmtPercent = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(1)}%`;
const fmtRatio = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(2)}x`;

export default function EfficiencySection({ symbol }: { symbol: string }) {
  const sym = (symbol ?? "").trim().toUpperCase();
  const backendBase = React.useMemo(() => "http://localhost:5046", []);

  const [at, setAt] = React.useState("—");
  const [cagr, setCagr] = React.useState("—");
  const TOTAL = 2;
  const [count, setCount] = React.useState(`0/${TOTAL}`);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      setAt("—");
      setCagr("—");
      setCount(`0/${TOTAL}`);
      if (!sym) return;
      try {
        const [atR, cgR] = await Promise.all([
          fetchMetricNumber(backendBase, "/api/analytics/asset-turnover", sym, [
            "value",
            "assetTurnover",
          ]),
          fetchMetricNumber(backendBase, "/api/analytics/equity-cagr", sym, [
            "value",
            "equityCagr",
            "cagr",
          ]),
        ]);
        if (cancelled) return;
        const atOk = Number.isFinite(atR.value as number);
        const cgOk = Number.isFinite(cgR.value as number);
        if (atOk) setAt(fmtRatio(atR.value!));
        if (cgOk) setCagr(fmtPercent(cgR.value!));
        setCount(`${(atOk ? 1 : 0) + (cgOk ? 1 : 0)}/${TOTAL}`);
      } catch {
        setCount(`0/${TOTAL}`);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [sym, backendBase]);

  if (!sym) return null;
  return (
    <div>
      <SectionHeader title="Efficiency & Growth" count={count} />
      <SectionGrid cols={2}>
        <MetricCard label="Asset Turnover" value={at} />
        <MetricCard label="Equity CAGR" value={cagr} />
      </SectionGrid>
    </div>
  );
}

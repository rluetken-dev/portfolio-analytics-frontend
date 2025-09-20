// src/components/company/analytics/PerShareSection.tsx
import * as React from "react";
import { SectionHeader, SectionGrid, MetricCard } from "./ui";

// English: fetch numeric metric
async function fetchMetricNumber(baseUrl: string, path: string, symbol: string, keys: string[]) {
  const resp = await fetch(`${baseUrl}${path}?symbol=${encodeURIComponent(symbol)}`, { headers: { Accept: "application/json" } });
  if (!resp.ok) return { value: null as number | null, status: resp.status };
  const raw = await resp.json();
  if (typeof raw === "number") return { value: raw, status: resp.status };
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const k of keys) if (typeof o[k] === "number") return { value: o[k] as number, status: resp.status };
  }
  return { value: null as number | null, status: resp.status };
}

// English: latest price endpoint to get currency unit (if needed)
async function getLatestClose(sym: string) {
  const resp = await fetch(`http://localhost:5046/api/quotes/latest?symbol=${encodeURIComponent(sym)}&take=1`, { headers: { Accept: "application/json" } });
  if (!resp.ok) return { unit: "USD" };
  const j = await resp.json();
  return { unit: typeof j?.unit === "string" ? j.unit : "USD" };
}

// English: per-share formatter (2 decimals + unit)
const fmtPerShare = (v: number | null | undefined, unit: string) =>
  v == null || !Number.isFinite(v) ? "—" : `${(v as number).toFixed(2)} ${unit}`;

export default function PerShareSection({ symbol }: { symbol: string }) {
  const sym = (symbol ?? "").trim().toUpperCase();
  const backendBase = React.useMemo(() => "http://localhost:5046", []);

  const [eps, setEps] = React.useState("—");
  const [bvps, setBvps] = React.useState("—");
  const [oeps, setOeps] = React.useState("—");
  const TOTAL = 3;
  const [count, setCount] = React.useState(`0/${TOTAL}`);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      setEps("—"); setBvps("—"); setOeps("—"); setCount(`0/${TOTAL}`);
      if (!sym) return;
      try {
        // English: get unit once (USD/EUR…) to print per-share correctly
        const { unit } = await getLatestClose(sym);
        const [epsR, bvpsR, oepsR] = await Promise.all([
          fetchMetricNumber(backendBase, "/api/analytics/eps", sym, ["value","eps"]),
          fetchMetricNumber(backendBase, "/api/analytics/bvps", sym, ["value","bvps"]),
          fetchMetricNumber(backendBase, "/api/analytics/oeps", sym, ["value","oeps"]),
        ]);
        if (cancelled) return;

        const epsOk = Number.isFinite(epsR.value as number);
        const bvOk  = Number.isFinite(bvpsR.value as number);
        const oeOk  = Number.isFinite(oepsR.value as number);

        if (epsOk) setEps(fmtPerShare(epsR.value!, unit));
        if (bvOk)  setBvps(fmtPerShare(bvpsR.value!, unit));
        if (oeOk)  setOeps(fmtPerShare(oepsR.value!, unit));

        setCount(`${(epsOk?1:0)+(bvOk?1:0)+(oeOk?1:0)}/${TOTAL}`);
      } catch { setCount(`0/${TOTAL}`); }
    }
    run();
    return () => { cancelled = true; };
  }, [sym, backendBase]);

  if (!sym) return null;
  return (
    <div>
      <SectionHeader title="Per Share" count={count} />
      <SectionGrid cols={3}>
        <MetricCard label="EPS" value={eps} />
        <MetricCard label="BVPS" value={bvps} />
        <MetricCard label="OEPS" value={oeps} />
      </SectionGrid>
    </div>
  );
}

// src/components/company/analytics/CashFlowSection.tsx
import * as React from "react";
import { SectionHeader, SectionGrid, MetricCard } from "./ui";

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

async function getUnit(sym: string) {
  const resp = await fetch(`http://localhost:5046/api/quotes/latest?symbol=${encodeURIComponent(sym)}&take=1`, { headers: { Accept: "application/json" } });
  if (!resp.ok) return "USD";
  const j = await resp.json();
  return typeof j?.unit === "string" ? j.unit : "USD";
}

// English: compact big number (K/M/B/T)
function formatCompactNumber(n: number): string {
  const abs = Math.abs(n);
  const fmt = (v: number, s: string) => `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)}${s}`;
  if (abs >= 1e12) return fmt(n / 1e12, "T");
  if (abs >= 1e9)  return fmt(n / 1e9, "B");
  if (abs >= 1e6)  return fmt(n / 1e6, "M");
  if (abs >= 1e3)  return fmt(n / 1e3, "K");
  return abs >= 100 ? n.toFixed(0) : abs >= 10 ? n.toFixed(1) : n.toFixed(2);
}

export default function CashFlowSection({ symbol }: { symbol: string }) {
  const sym = (symbol ?? "").trim().toUpperCase();
  const backendBase = React.useMemo(() => "http://localhost:5046", []);

  const [fcf, setFcf] = React.useState("—");
  const [oe, setOe] = React.useState("—");
  const TOTAL = 2;
  const [count, setCount] = React.useState(`0/${TOTAL}`);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      setFcf("—"); setOe("—"); setCount(`0/${TOTAL}`);
      if (!sym) return;
      try {
        const unit = await getUnit(sym);
        const [fcfR, oeR] = await Promise.all([
          fetchMetricNumber(backendBase, "/api/analytics/fcf", sym, ["value","fcf"]),
          fetchMetricNumber(backendBase, "/api/analytics/owner-earnings", sym, ["value","ownerEarnings"]),
        ]);
        if (cancelled) return;

        const fOk = Number.isFinite(fcfR.value as number);
        const oOk = Number.isFinite(oeR.value as number);

        if (fOk) setFcf(`${formatCompactNumber(fcfR.value!)} ${unit}`);
        if (oOk) setOe(`${formatCompactNumber(oeR.value!)} ${unit}`);

        setCount(`${(fOk?1:0)+(oOk?1:0)}/${TOTAL}`);
      } catch { setCount(`0/${TOTAL}`); }
    }
    run();
    return () => { cancelled = true; };
  }, [sym, backendBase]);

  if (!sym) return null;
  return (
    <div>
      <SectionHeader title="Cash Flow & Owner Earnings" count={count} />
      <SectionGrid cols={2}>
        <MetricCard label="FCF (abs)" value={fcf} />
        <MetricCard label="Owner Earnings" value={oe} />
      </SectionGrid>
    </div>
  );
}

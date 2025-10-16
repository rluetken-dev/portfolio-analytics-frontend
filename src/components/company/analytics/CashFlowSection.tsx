// src/components/company/analytics/CashFlowSection.tsx
import * as React from "react";
import { SectionHeader, SectionGrid, MetricCard } from "./ui";
import { useFormatDisplayValue } from "../../../utils/formatDisplayValue";
import { CurrencyContext } from "../../../context/CurrencyContextObject";

async function fetchMetricNumber(path: string, symbol: string, keys: string[]) {
  const resp = await fetch(`${path}?symbol=${encodeURIComponent(symbol)}`, {
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

export default function CashFlowSection({ symbol }: { symbol: string }) {
  const sym = (symbol ?? "").trim().toUpperCase();
  const { formatDisplayValue } = useFormatDisplayValue();

  const [fcf, setFcf] = React.useState("—");
  const [oe, setOe] = React.useState("—");
  const [baseValues, setBaseValues] = React.useState<{ fcf?: number; oe?: number }>({});
  const TOTAL = 2;
  const [count, setCount] = React.useState(`0/${TOTAL}`);
  const { currency } = React.useContext(CurrencyContext)!;

  // 🧩 Initial load
  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      setFcf("—");
      setOe("—");
      setCount(`0/${TOTAL}`);
      if (!sym) return;

      try {
        const [fcfR, oeR] = await Promise.all([
          fetchMetricNumber("/api/analytics/fcf", sym, ["value", "fcf"]),
          fetchMetricNumber("/api/analytics/owner-earnings", sym, ["value", "ownerEarnings"]),
        ]);

        if (cancelled) return;

        const fOk = Number.isFinite(fcfR.value as number);
        const oOk = Number.isFinite(oeR.value as number);

        if (fOk) {
          setBaseValues((p) => ({ ...p, fcf: fcfR.value! }));
          setFcf(formatDisplayValue("FCF (abs)", fcfR.value!));
        }
        if (oOk) {
          setBaseValues((p) => ({ ...p, oe: oeR.value! }));
          setOe(formatDisplayValue("Owner Earnings", oeR.value!));
        }

        setCount(`${(fOk ? 1 : 0) + (oOk ? 1 : 0)}/${TOTAL}`);
      } catch {
        setCount(`0/${TOTAL}`);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [sym]);

  // 💱 Reformat when currency changes
  React.useEffect(() => {
    console.log(`[CashFlowSection] Reformat due to currency change → ${currency}`);
    if (baseValues.fcf != null) setFcf(formatDisplayValue("FCF (abs)", baseValues.fcf));
    if (baseValues.oe != null) setOe(formatDisplayValue("Owner Earnings", baseValues.oe));
  }, [currency, baseValues, formatDisplayValue]);

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

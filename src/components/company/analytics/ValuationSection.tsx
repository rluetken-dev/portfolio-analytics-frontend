// src/components/company/analytics/ValuationSection.tsx
import * as React from "react";
import { SectionHeader, SectionGrid, MetricCard } from "./ui";

// English: reuse your existing service for latest price
import { getLatestCloseFromQuotes } from "../../../services/api/quotes";

/** ---------- Local helpers (small, self-contained) ---------- */

// English: fetch a numeric metric from analytics endpoints with tolerant keys
async function fetchMetricNumber(
  path: string,
  symbol: string,
  candidateKeys: string[],
): Promise<{ value: number | null; status: number }> {
  const resp = await fetch(`${path}?symbol=${encodeURIComponent(symbol)}`, {
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

// English: locale-aware money formatter
function fmtMoney(v: number, currency = "USD") {
  if (!Number.isFinite(v)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${v.toFixed(2)} ${currency}`;
  }
}

// English: ratio formatter like '12.34x'
function fmtRatio(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v.toFixed(2)}x`;
}

/** ---------- Props ---------- */
export default function ValuationSection({
  symbol,
  showPrice = false, // English: avoid duplicates with Key Metrics by default
  showPE = false, // English: ditto; we focus on PB and P/OE here
}: {
  symbol: string;
  showPrice?: boolean;
  showPE?: boolean;
}) {
  const sym = (symbol ?? "").trim().toUpperCase();

  // English: display strings (render-ready)
  const [priceStr, setPriceStr] = React.useState("—");
  const [peStr, setPeStr] = React.useState("—");
  const [pbStr, setPbStr] = React.useState("—");
  const [pOverOeStr, setPOverOeStr] = React.useState("—");

  // English: availability counter (visible metrics only)
  const [count, setCount] = React.useState("0/0");

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      // English: reset placeholders
      setPriceStr("—");
      setPeStr("—");
      setPbStr("—");
      setPOverOeStr("—");
      setCount("0/0");

      if (!sym) return;

      try {
        // English: fetch valuation metrics in parallel
        const [price, peRes, pbRes, poeRes] = await Promise.all([
          getLatestCloseFromQuotes(sym),
          fetchMetricNumber("/api/analytics/pe", sym, ["value", "pe"]),
          fetchMetricNumber("/api/analytics/pb", sym, ["value", "pb"]),
          fetchMetricNumber("/api/analytics/p-to-oe", sym, ["value", "pToOe", "pOverOe"]),
        ]);
        if (cancelled) return;

        // --- Normalize ---
        const cur = price.unit ?? "USD";
        const priceOk = typeof price.value === "number" && Number.isFinite(price.value);
        const peOk = typeof peRes.value === "number" && Number.isFinite(peRes.value!);
        const pbOk = typeof pbRes.value === "number" && Number.isFinite(pbRes.value!);
        const poeOk = typeof poeRes.value === "number" && Number.isFinite(poeRes.value!);

        if (priceOk) setPriceStr(fmtMoney(price.value!, cur));
        if (peOk) setPeStr(fmtRatio(peRes.value!));
        if (pbOk) setPbStr(fmtRatio(pbRes.value!));
        if (poeOk) setPOverOeStr(fmtRatio(poeRes.value!));

        // --- Visible fields & counter ---
        const visible = [
          showPrice ? (priceOk ? 1 : 0) : null,
          showPE ? (peOk ? 1 : 0) : null,
          pbOk ? 1 : 0, // PB always visible in this section
          poeOk ? 1 : 0, // P/OE always visible in this section
        ].filter((x) => x !== null) as number[];

        const totalVisible = (showPrice ? 1 : 0) + (showPE ? 1 : 0) + 1 /* PB */ + 1; /* P/OE */
        const available = visible.reduce((a, b) => a + b, 0);

        setCount(`${available}/${totalVisible}`);
      } catch {
        // English: keep placeholders
        setCount(
          `${(showPrice ? 0 : 0) + (showPE ? 0 : 0) + 0 + 0}/${(showPrice ? 1 : 0) + (showPE ? 1 : 0) + 2}`,
        );
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym]);

  if (!sym) return null;

  return (
    <div>
      <SectionHeader title="Valuation" count={count} />
      <SectionGrid cols={(showPrice ? 1 : 0) + (showPE ? 1 : 0) + 2 /* PB, P/OE */}>
        {showPrice && <MetricCard label="Price" value={priceStr} />}
        {showPE && <MetricCard label="P/E" value={peStr} />}
        <MetricCard label="P/B" value={pbStr} />
        <MetricCard label="P/OE" value={pOverOeStr} />
      </SectionGrid>
    </div>
  );
}

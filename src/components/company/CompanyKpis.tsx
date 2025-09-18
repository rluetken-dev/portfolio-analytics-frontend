// src/components/company/CompanyKpis.tsx
import * as React from "react";
import { getLatestCloseFromQuotes } from "../../services/api/quotes";

type Metric = { label: string; value: string; hint?: string };

// Small helper to fetch a numeric value from /api/analytics/*
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
  const json = (await resp.json()) as unknown;
  if (typeof json === "number") return { value: json, status: resp.status };
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    for (const k of keys)
      if (typeof o[k] === "number") return { value: o[k] as number, status: resp.status };
  }
  return { value: null, status: resp.status };
}

// Formatters
const asRatio = (v: number | null) => (v == null || Number.isNaN(v) ? "n/a" : `${v.toFixed(2)}x`);
const asPct = (v: number | null) =>
  v == null || Number.isNaN(v) ? "n/a" : `${(v * 100).toFixed(1)}%`;
const asMoney = (v: number | null, unit?: string) =>
  v == null || Number.isNaN(v) ? "n/a" : `${v.toFixed(2)}${unit ? ` ${unit}` : ""}`;

// Simple card UI
const card: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 10,
  padding: 10,
  minHeight: 64,
};
const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
};

export default function CompanyKpis({ symbol }: { symbol: string }) {
  const sym = (symbol ?? "").trim().toUpperCase();
  const backendBase = React.useMemo(() => "http://localhost:5046", []);

  const [loading, setLoading] = React.useState<boolean>(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [metrics, setMetrics] = React.useState<Metric[]>([]);

  React.useEffect(() => {
    let aborted = false;

    async function run() {
      if (!sym) {
        setMetrics([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setErr(null);

        // Fetch price first (provides currency unit and as-of hint)
        const price = await getLatestCloseFromQuotes(sym);

        // Fetch analytics in parallel
        const [peRes, roeRes, nmRes, fcfyRes, dteRes] = await Promise.all([
          fetchMetricNumber(backendBase, "/api/analytics/pe", sym, ["value", "pe"]),
          fetchMetricNumber(backendBase, "/api/analytics/roe", sym, ["value", "roe"]),
          fetchMetricNumber(backendBase, "/api/analytics/net-margin", sym, ["value", "netMargin"]),
          fetchMetricNumber(backendBase, "/api/analytics/fcf-yield", sym, ["value", "fcfYield"]),
          fetchMetricNumber(backendBase, "/api/analytics/debt-to-equity", sym, [
            "value",
            "debtToEquity",
          ]),
        ]);

        if (aborted) return;

        const kpis: Metric[] = [
          {
            label: "Price",
            value: asMoney(price.value ?? null, price.unit),
            hint:
              price.status === 200
                ? price.asOf
                  ? `as of ${price.asOf}${price.adjusted ? " (adjusted)" : ""}`
                  : undefined
                : `HTTP ${price.status}`,
          },
          {
            label: "P/E",
            value: asRatio(peRes.value),
            hint: peRes.status === 200 ? undefined : `HTTP ${peRes.status}`,
          },
          {
            label: "ROE",
            value: asPct(roeRes.value),
            hint: roeRes.status === 200 ? undefined : `HTTP ${roeRes.status}`,
          },
          {
            label: "Net Margin",
            value: asPct(nmRes.value),
            hint: nmRes.status === 200 ? undefined : `HTTP ${nmRes.status}`,
          },
          {
            label: "FCF Yield",
            value: asPct(fcfyRes.value),
            hint: fcfyRes.status === 200 ? undefined : `HTTP ${fcfyRes.status}`,
          },
          {
            label: "Debt/Equity",
            value: asRatio(dteRes.value),
            hint: dteRes.status === 200 ? undefined : `HTTP ${dteRes.status}`,
          },
        ];

        setMetrics(kpis);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
        setMetrics([]);
      } finally {
        if (!aborted) setLoading(false);
      }
    }

    run();
    return () => {
      aborted = true;
    };
  }, [sym, backendBase]);

  if (!sym) return null;

  return (
    <section style={{ marginTop: 12 }}>
      <h2 style={{ margin: "0 0 8px 0", fontSize: 16, opacity: 0.9 }}>Key Metrics</h2>
      {err && <div style={{ marginBottom: 8, fontSize: 12, color: "#f87171" }}>{err}</div>}

      <div style={grid}>
        {(loading ? Array.from({ length: 6 }) : metrics).map((m, i) => (
          <div key={i} style={card} aria-busy={loading}>
            {loading ? (
              <>
                <div style={{ fontSize: 11, opacity: 0.6 }}>Loading…</div>
                <div
                  style={{
                    marginTop: 8,
                    height: 18,
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.12)",
                  }}
                />
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{m.label}</div>
                <div
                  title={m.hint}
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    marginTop: 4,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {m.value}
                </div>
                {m.hint && (
                  <div
                    style={{
                      fontSize: 10,
                      opacity: 0.6,
                      marginTop: 4,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {m.hint}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

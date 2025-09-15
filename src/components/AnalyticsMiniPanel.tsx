// src/components/AnalyticsMiniPanel.tsx
import { useCallback, useMemo, useState, useEffect } from "react";
import { getLatestCloseFromQuotes } from "../services/api/quotes";

/**
 * Very small self-contained panel to show two metrics for a symbol:
 * - Latest price (via QuotesController: /api/quotes/latest?take=1)
 * - Latest P/E (via AnalyticsController: /api/analytics/pe?symbol=...)
 *
 * Notes:
 * - We call the backend directly with a full URL for P/E to avoid dev-proxy issues.
 * - All UI strings are minimal; comments in English for clarity.
 */
type Metric = {
  label: string;
  value: string;
  hint?: string;
};

// Price timeseries point
type TimeseriesPoint = { date: string; close: number };

// persist the last used symbol (dev-friendly)
const STORAGE_KEY = "analytics:lastSymbol";

// Simple skeleton card for loading state (no extra deps)
function SkeletonCard({ label }: { label: string }) {
  return (
    <div
      style={{
        border: "1px solid #333",
        borderRadius: 12,
        padding: 10,
        minHeight: 72,
      }}
      aria-busy="true"
      aria-live="polite"
    >
      <div style={{ fontSize: 12, opacity: 0.6 }}>{label}</div>
      <div
        style={{
          marginTop: 6,
          height: 22,
          borderRadius: 6,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.08) 25%, rgba(255,255,255,0.18) 37%, rgba(255,255,255,0.08) 63%)",
          backgroundSize: "400% 100%",
          animation: "shine 1.2s ease-in-out infinite",
        }}
      />
      <style>
        {`@keyframes shine {
            0% { background-position: 100% 0; }
            100% { background-position: 0 0; }
          }`}
      </style>
    </div>
  );
}

// Format Date -> "YYYY-MM-DD"
function fmt(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Build SVG polyline points string from timeseries
function buildPolyline(pts: TimeseriesPoint[], w: number, h: number): string {
  if (pts.length === 0) return "";
  const ys = pts.map((p) => p.close);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanY = maxY - minY || 1;
  const stepX = pts.length > 1 ? w / (pts.length - 1) : 0;

  return pts
    .map((p, i) => {
      const x = Math.round(i * stepX);
      // invert y for SVG (0 at top)
      const y = Math.round(h - ((p.close - minY) / spanY) * h);
      return `${x},${y}`;
    })
    .join(" ");
}

/**
 * Tiny helper to fetch a numeric metric from /api/analytics/*.
 * Accepts multiple candidate keys (e.g., ["value","roe"]) for flexible mapping.
 */
async function fetchMetricNumber(
  baseUrl: string,
  path: string,
  symbol: string,
  candidateKeys: string[],
): Promise<{ value: number | null; status: number }> {
  const resp = await fetch(`${baseUrl}${path}?symbol=${encodeURIComponent(symbol)}`, {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) {
    return { value: null, status: resp.status };
  }
  const raw = (await resp.json()) as unknown;
  if (typeof raw === "number") return { value: raw, status: resp.status };
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const k of candidateKeys) {
      if (typeof o[k] === "number") return { value: o[k] as number, status: resp.status };
    }
  }
  return { value: null, status: resp.status };
}

export default function AnalyticsMiniPanel() {
  const [symbol, setSymbol] = useState("AAPL");
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [spark, setSpark] = useState<TimeseriesPoint[]>([]);

  // load last symbol from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && typeof saved === "string") {
      setSymbol(saved.toUpperCase());
    }
  }, []);

  // Centralized backend base (adjust if your backend port changes)
  const backendBase = useMemo(() => "http://localhost:5046", []);

  const load = useCallback(async () => {
    const sym = symbol.trim().toUpperCase();
    localStorage.setItem(STORAGE_KEY, sym);
    if (!sym) return;

    setLoading(true);
    setErr(null);

    try {
      // 1) Latest price (already) …
      const price = await getLatestCloseFromQuotes(sym);

      // 1b) Load timeseries (last 180 days) for sparkline
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - 180);

      try {
        const tsResp = await fetch(
          `${backendBase}/api/quotes/timeseries?symbol=${encodeURIComponent(sym)}&from=${fmt(
            from,
          )}&to=${fmt(to)}`,
          { headers: { Accept: "application/json" } },
        );

        if (tsResp.ok) {
          const raw = (await tsResp.json()) as unknown;
          const arr = Array.isArray(raw) ? raw : [];
          // Defensive parse
          const pts: TimeseriesPoint[] = arr
            .map((r: unknown) => {
              if (typeof r === "object" && r !== null) {
                const obj = r as Record<string, unknown>;
                return {
                  date: String(obj.date ?? ""),
                  close: typeof obj.close === "number" ? obj.close : NaN,
                };
              }
              return { date: "", close: NaN };
            })
            .filter((p) => Number.isFinite(p.close));

          // Ensure chronological
          pts.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
          setSpark(pts);
        } else {
          setSpark([]);
        }
      } catch {
        setSpark([]);
      }

      // 2) Fetch all other analytics metrics in parallel
      const [
        peRes,
        roeRes,
        fcfYieldRes,
        netMarginRes,
        dteRes,
        eqRatioRes,
        roaRes,
        dtaRes,
        epsRes,
        bvpsRes,
        pbRes,
        atRes,
        cagrRes,
        fcfAbsRes,
        oeRes,
        oeYieldRes,
        oepsRes,
        pToOeRes,
        fcfMarginRes,
      ] = await Promise.all([
        fetchMetricNumber(backendBase, "/api/analytics/pe", sym, ["value", "pe"]),
        fetchMetricNumber(backendBase, "/api/analytics/roe", sym, ["value", "roe"]),
        fetchMetricNumber(backendBase, "/api/analytics/fcf-yield", sym, ["value", "fcfYield"]),
        fetchMetricNumber(backendBase, "/api/analytics/net-margin", sym, ["value", "netMargin"]),
        fetchMetricNumber(backendBase, "/api/analytics/debt-to-equity", sym, [
          "value",
          "debtToEquity",
        ]),
        fetchMetricNumber(backendBase, "/api/analytics/equity-ratio", sym, [
          "value",
          "equityRatio",
        ]),
        fetchMetricNumber(backendBase, "/api/analytics/roa", sym, ["value", "roa"]),
        fetchMetricNumber(backendBase, "/api/analytics/debt-to-assets", sym, [
          "value",
          "debtToAssets",
        ]),
        fetchMetricNumber(backendBase, "/api/analytics/eps", sym, ["value", "eps"]),
        fetchMetricNumber(backendBase, "/api/analytics/bvps", sym, ["value", "bvps"]),
        fetchMetricNumber(backendBase, "/api/analytics/pb", sym, ["value", "pb"]),
        fetchMetricNumber(backendBase, "/api/analytics/asset-turnover", sym, [
          "value",
          "assetTurnover",
        ]),
        fetchMetricNumber(backendBase, "/api/analytics/equity-cagr", sym, [
          "value",
          "cagr",
          "equityCagr",
        ]),
        fetchMetricNumber(backendBase, "/api/analytics/fcf", sym, ["value", "fcf"]),
        fetchMetricNumber(backendBase, "/api/analytics/owner-earnings", sym, [
          "value",
          "ownerEarnings",
        ]),
        fetchMetricNumber(backendBase, "/api/analytics/owner-earnings-yield", sym, [
          "value",
          "ownerEarningsYield",
        ]),
        fetchMetricNumber(backendBase, "/api/analytics/oeps", sym, ["value", "oeps"]),
        fetchMetricNumber(backendBase, "/api/analytics/p-to-oe", sym, [
          "value",
          "pToOe",
          "pOverOe",
        ]),
        fetchMetricNumber(backendBase, "/api/analytics/fcf-margin", sym, ["value", "fcfMargin"]),
      ]);

      // Normalize UI metrics
      const list: Metric[] = [
        // --- Price (special case, from quotes service) ---
        {
          label: "Price",
          value:
            price.value != null ? `${price.value.toFixed(2)} ${price.unit ?? ""}`.trim() : "n/a",
          hint: price.asOf
            ? `as of ${price.asOf}${price.adjusted ? " (adjusted)" : ""}`
            : undefined,
        },

        // --- Valuation ---
        {
          label: "P/E",
          value: peRes.value != null ? peRes.value.toFixed(2) : "n/a",
          hint: peRes.status === 200 ? undefined : `HTTP ${peRes.status}`,
        },
        {
          label: "P/B",
          value: pbRes.value != null ? pbRes.value.toFixed(2) : "n/a",
          hint: pbRes.status === 200 ? undefined : `HTTP ${pbRes.status}`,
        },
        {
          label: "P/OE",
          value: pToOeRes.value != null ? pToOeRes.value.toFixed(2) : "n/a",
          hint: pToOeRes.status === 200 ? undefined : `HTTP ${pToOeRes.status}`,
        },

        // --- Profitability ---
        {
          label: "ROE",
          value: roeRes.value != null ? `${(roeRes.value * 100).toFixed(1)}%` : "n/a",
          hint: roeRes.status === 200 ? undefined : `HTTP ${roeRes.status}`,
        },
        {
          label: "ROA",
          value: roaRes.value != null ? `${(roaRes.value * 100).toFixed(1)}%` : "n/a",
          hint: roaRes.status === 200 ? undefined : `HTTP ${roaRes.status}`,
        },
        {
          label: "Net Margin",
          value: netMarginRes.value != null ? `${(netMarginRes.value * 100).toFixed(1)}%` : "n/a",
          hint: netMarginRes.status === 200 ? undefined : `HTTP ${netMarginRes.status}`,
        },
        {
          label: "FCF Yield",
          value: fcfYieldRes.value != null ? `${(fcfYieldRes.value * 100).toFixed(1)}%` : "n/a",
          hint: fcfYieldRes.status === 200 ? undefined : `HTTP ${fcfYieldRes.status}`,
        },
        {
          label: "OE Yield",
          value: oeYieldRes.value != null ? `${(oeYieldRes.value * 100).toFixed(1)}%` : "n/a",
          hint: oeYieldRes.status === 200 ? undefined : `HTTP ${oeYieldRes.status}`,
        },
        {
          label: "FCF Margin",
          // English: assume backend returns decimal (e.g., 0.18 -> 18.0%)
          value: fcfMarginRes.value != null ? `${(fcfMarginRes.value * 100).toFixed(1)}%` : "n/a",
          hint: fcfMarginRes.status === 200 ? undefined : `HTTP ${fcfMarginRes.status}`,
        },

        // --- Efficiency / Growth ---
        {
          label: "Asset Turnover",
          value: atRes.value != null ? atRes.value.toFixed(2) : "n/a",
          hint: atRes.status === 200 ? undefined : `HTTP ${atRes.status}`,
        },
        {
          label: "Equity CAGR",
          value: cagrRes.value != null ? `${(cagrRes.value * 100).toFixed(1)}%` : "n/a",
          hint: cagrRes.status === 200 ? undefined : `HTTP ${cagrRes.status}`,
        },

        // --- Solvency / Leverage ---
        {
          label: "Debt/Equity",
          value: dteRes.value != null ? dteRes.value.toFixed(2) : "n/a",
          hint: dteRes.status === 200 ? undefined : `HTTP ${dteRes.status}`,
        },
        {
          label: "Equity Ratio",
          value: eqRatioRes.value != null ? `${(eqRatioRes.value * 100).toFixed(1)}%` : "n/a",
          hint: eqRatioRes.status === 200 ? undefined : `HTTP ${eqRatioRes.status}`,
        },
        {
          label: "Debt/Assets",
          value: dtaRes.value != null ? `${(dtaRes.value * 100).toFixed(1)}%` : "n/a",
          hint: dtaRes.status === 200 ? undefined : `HTTP ${dtaRes.status}`,
        },

        // --- Per-Share Metrics ---
        {
          label: "EPS",
          value: epsRes.value != null ? epsRes.value.toFixed(2) : "n/a",
          hint: epsRes.status === 200 ? undefined : `HTTP ${epsRes.status}`,
        },
        {
          label: "BVPS",
          value: bvpsRes.value != null ? bvpsRes.value.toFixed(2) : "n/a",
          hint: bvpsRes.status === 200 ? undefined : `HTTP ${bvpsRes.status}`,
        },
        {
          label: "OEPS",
          value: oepsRes.value != null ? oepsRes.value.toFixed(2) : "n/a",
          hint: oepsRes.status === 200 ? undefined : `HTTP ${oepsRes.status}`,
        },

        // --- Cash Flow / Owner Earnings ---
        {
          label: "FCF (abs)",
          value: fcfAbsRes.value != null ? `${fcfAbsRes.value.toFixed(0)}` : "n/a",
          hint: fcfAbsRes.status === 200 ? undefined : `HTTP ${fcfAbsRes.status}`,
        },
        {
          label: "Owner Earnings",
          value: oeRes.value != null ? `${oeRes.value.toFixed(0)}` : "n/a",
          hint: oeRes.status === 200 ? undefined : `HTTP ${oeRes.status}`,
        },
      ];
      setMetrics(list);
    } catch (e: unknown) {
      console.error("[panel] load failed:", e);
      setErr("Fehler beim Laden der Kennzahlen.");
      setMetrics([]);
    } finally {
      setLoading(false);
    }
  }, [symbol, backendBase]);

  return (
    <div
      style={{
        border: "1px solid #222",
        borderRadius: 14,
        padding: 12,
        display: "grid",
        gap: 10,
        width: "100%",
        boxSizing: "border-box",
        marginTop: 16,
      }}
    >
      <div style={{ fontWeight: 600 }}>Analytics (mini)</div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={symbol}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) {
              e.preventDefault();
              load();
            }
          }}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="Symbol (e.g., AAPL)"
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid #333",
            background: "transparent",
            color: "inherit",
          }}
        />
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #333",
            background: loading ? "#111" : "transparent",
            cursor: loading ? "default" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "Loading..." : "Load"}
        </button>
      </div>

      {err && <div style={{ fontSize: 12, color: "#f87171", marginBottom: 8 }}>{err}</div>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 8,
        }}
      >
        {loading ? (
          <>
            <SkeletonCard label="Price" />
            <SkeletonCard label="P/E" />
            <SkeletonCard label="ROE" />
            <SkeletonCard label="FCF Yield" />
            <SkeletonCard label="Net Margin" />
          </>
        ) : (
          metrics.map((m) => (
            <div
              key={m.label}
              style={{
                border: "1px solid #333",
                borderRadius: 12,
                padding: 10,
                minHeight: 72,
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.8 }}>{m.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{m.value}</div>
              {m.hint && <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{m.hint}</div>}
            </div>
          ))
        )}
      </div>

      {/* Price trend (sparkline) */}
      {spark.length > 0 && (
        <div
          style={{
            border: "1px solid #333",
            borderRadius: 12,
            padding: 10,
            marginTop: 8,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Price trend (180d)</div>
          <div style={{ width: "100%", height: 60 }}>
            {/* English: pure SVG sparkline, no deps */}
            <svg viewBox="0 0 600 60" preserveAspectRatio="none" width="100%" height="100%">
              <polyline
                points={buildPolyline(spark, 600, 50)}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

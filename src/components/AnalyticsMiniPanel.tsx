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

export default function AnalyticsMiniPanel() {
  const [symbol, setSymbol] = useState("AAPL");
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [err, setErr] = useState<string | null>(null);

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
      // 1) Latest price via our quotes service (already bypasses proxy)
      const price = await getLatestCloseFromQuotes(sym);

      // 2) Latest P/E via analytics endpoint (direct native fetch, no proxy)
      //    Expected shape: number OR { value?: number } OR { pe?: number }
      const peResp = await fetch(
        `${backendBase}/api/analytics/pe?symbol=${encodeURIComponent(sym)}`,
        { headers: { Accept: "application/json" } },
      );

      let peValue: number | null = null;
      if (peResp.ok) {
        const raw = (await peResp.json()) as unknown;
        if (typeof raw === "number") peValue = raw;
        else if (raw && typeof raw === "object") {
          const o = raw as Record<string, unknown>;
          // Accept common shapes
          if (typeof o.value === "number") peValue = o.value;
          else if (typeof o.pe === "number") peValue = o.pe;
          // (add more keys if your backend uses a different naming)
        }
      }

      // 3) Latest ROE via analytics endpoint (direct native fetch, no proxy)
      //    Expected shapes: number OR { value?: number } OR { roe?: number }
      const roeResp = await fetch(
        `${backendBase}/api/analytics/roe?symbol=${encodeURIComponent(sym)}`,
        { headers: { Accept: "application/json" } },
      );

      let roeValue: number | null = null;
      if (roeResp.ok) {
        const raw = (await roeResp.json()) as unknown;
        if (typeof raw === "number") roeValue = raw;
        else if (raw && typeof raw === "object") {
          const o = raw as Record<string, unknown>;
          if (typeof o.value === "number") roeValue = o.value;
          else if (typeof o.roe === "number") roeValue = o.roe;
        }
      }

      // 4) Latest FCF Yield via analytics endpoint (direct native fetch)
      //    Expected shapes: number OR { value?: number } OR { fcfYield?: number }
      const fcfYieldResp = await fetch(
        `${backendBase}/api/analytics/fcf-yield?symbol=${encodeURIComponent(sym)}`,
        { headers: { Accept: "application/json" } },
      );

      let fcfYieldValue: number | null = null;
      if (fcfYieldResp.ok) {
        const raw = (await fcfYieldResp.json()) as unknown;
        if (typeof raw === "number") fcfYieldValue = raw;
        else if (raw && typeof raw === "object") {
          const o = raw as Record<string, unknown>;
          if (typeof o.value === "number") fcfYieldValue = o.value;
          else if (typeof o.fcfYield === "number") fcfYieldValue = o.fcfYield;
        }
      }

      // 5) Latest Net Margin via analytics endpoint (direct native fetch)
      //    Expected shapes: number OR { value?: number } OR { netMargin?: number }
      const netMarginResp = await fetch(
        `${backendBase}/api/analytics/net-margin?symbol=${encodeURIComponent(sym)}`,
        { headers: { Accept: "application/json" } },
      );

      let netMarginValue: number | null = null;
      if (netMarginResp.ok) {
        const raw = (await netMarginResp.json()) as unknown;
        if (typeof raw === "number") netMarginValue = raw;
        else if (raw && typeof raw === "object") {
          const o = raw as Record<string, unknown>;
          if (typeof o.value === "number") netMarginValue = o.value;
          else if (typeof o.netMargin === "number") netMarginValue = o.netMargin;
        }
      }

      // Normalize UI metrics
      const list: Metric[] = [
        {
          label: "Price",
          value:
            price.value != null ? `${price.value.toFixed(2)} ${price.unit ?? ""}`.trim() : "n/a",
          hint: price.asOf
            ? `as of ${price.asOf}${price.adjusted ? " (adjusted)" : ""}`
            : undefined,
        },
        {
          label: "P/E",
          value: peValue != null ? peValue.toFixed(2) : "n/a",
          hint: peResp.ok ? undefined : `HTTP ${peResp.status}`,
        },
        {
          label: "ROE",
          // English: assume backend returns decimals (e.g., 0.23 for 23%).
          value: roeValue != null ? `${(roeValue * 100).toFixed(1)}%` : "n/a",
          hint: roeResp.ok ? undefined : `HTTP ${roeResp.status}`,
        },
        {
          label: "FCF Yield",
          // English: assume backend returns decimals (e.g., 0.052 for 5.2%).
          value: fcfYieldValue != null ? `${(fcfYieldValue * 100).toFixed(1)}%` : "n/a",
          hint: fcfYieldResp.ok ? undefined : `HTTP ${fcfYieldResp.status}`,
        },
        {
          label: "Net Margin",
          // English: assume backend returns decimals (e.g., 0.18 for 18%).
          value: netMarginValue != null ? `${(netMarginValue * 100).toFixed(1)}%` : "n/a",
          hint: netMarginResp.ok ? undefined : `HTTP ${netMarginResp.status}`,
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
        maxWidth: 420,
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
    </div>
  );
}

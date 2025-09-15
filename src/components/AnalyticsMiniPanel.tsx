// src/components/AnalyticsMiniPanel.tsx
import { useCallback, useMemo, useState, useEffect } from "react";
import { getLatestCloseFromQuotes } from "../services/api/quotes";
import { refreshQuotes } from "../services/api/quotes";

// English: live price (non-persistent) fetcher
import { getCurrentPrice, type CurrentQuote } from "../services/api/quotes";

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

type MetricSection = {
  title: string;
  items: Metric[];
};

// Price timeseries point
type TimeseriesPoint = { date: string; close: number };

// persist the last used symbol (dev-friendly)
const STORAGE_KEY = "analytics:lastSymbol";

// English: shared grid style so all sections render with identical column sizing
const GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(0, 1fr))", // consistent width
  gap: 6, // tighter spacing
  justifyItems: "stretch",
  //outline: "1px dashed #555",
};

const CARD: React.CSSProperties = {
  // English: allow shrink inside grid track; prevent content from stretching columns
  border: "1px solid #333",
  borderRadius: 8,
  padding: 6,
  minHeight: 54,
  minWidth: 0, // <-- critical: let the card shrink within the grid column
  overflow: "hidden", // <-- avoid layout push; long text won't expand the column
  width: "100%",
};

const HINT: React.CSSProperties = {
  fontSize: 10,
  opacity: 0.7,
  marginTop: 2,
  whiteSpace: "nowrap", // keep hint on a single line
  overflow: "hidden", // clip if too long
  textOverflow: "ellipsis",
};

// Compact skeleton card used while loading
function SkeletonCard({ label }: { label: string }) {
  return (
    <div
      style={{
        border: "1px solid #333",
        borderRadius: 8, // tighter corners
        padding: 6, // smaller padding
        minHeight: 54, // shorter card
      }}
      aria-busy="true"
      aria-live="polite"
    >
      <div style={{ fontSize: 10, opacity: 0.6 }}>{label}</div>
      <div
        style={{
          marginTop: 6,
          height: 18, // slimmer shimmer bar
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

// English: compact number formatter for big absolutes (K/M/B/T)
function formatCompactNumber(n: number): string {
  const abs = Math.abs(n);
  const fmt = (v: number, s: string) =>
    // fewer decimals for bigger magnitudes
    `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)}${s}`;

  if (abs >= 1e12) return fmt(n / 1e12, "T");
  if (abs >= 1e9) return fmt(n / 1e9, "B");
  if (abs >= 1e6) return fmt(n / 1e6, "M");
  if (abs >= 1e3) return fmt(n / 1e3, "K");
  return abs >= 100 ? n.toFixed(0) : abs >= 10 ? n.toFixed(1) : n.toFixed(2);
}

// English: unified format helpers
function formatPercent(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "n/a";
  return `${(v * 100).toFixed(1)}%`;
}

function formatRatio(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "n/a";
  return `${v.toFixed(2)}x`;
}

function formatPerShare(v: number | null | undefined, unit?: string): string {
  if (v == null || Number.isNaN(v)) return "n/a";
  // Keep 2 decimals and append unit (USD/EUR) if provided
  return `${v.toFixed(2)}${unit ? ` ${unit}` : ""}`;
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

// English: build a per-section row grid that spans the full width
const makeRowGrid = (cols: number): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: `repeat(${Math.max(cols, 1)}, minmax(0, 1fr))`,
  gap: 6,
});

export default function AnalyticsMiniPanel() {
  const [symbol, setSymbol] = useState("AAPL");
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<MetricSection[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [spark, setSpark] = useState<TimeseriesPoint[]>([]);
  const [live, setLive] = useState<CurrentQuote | null>(null);
  const [baseClose, setBaseClose] = useState<number | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);

  // English: normalized symbol for comparisons (prevents stale mismatches)
  const currentSym = useMemo(() => symbol.trim().toUpperCase(), [symbol]);

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

    // English: reset live delta when starting a fresh load
    setLive(null);
    setBaseClose(null);

    try {
      // 1) Latest price (already) …
      const price = await getLatestCloseFromQuotes(sym);

      // English: store base close for later live delta calculation
      setBaseClose(price.value ?? null);

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

      // Normalize UI sections (grouped)
      const sectionsData: MetricSection[] = [
        {
          title: "Valuation",
          items: [
            {
              label: "Price",
              value:
                price.value != null
                  ? `${price.value.toFixed(2)} ${price.unit ?? ""}`.trim()
                  : "n/a",
              hint:
                price.status === 200
                  ? price.asOf
                    ? `as of ${price.asOf}${price.adjusted ? " (adjusted)" : ""}`
                    : undefined
                  : `HTTP ${price.status}`,
            },
            {
              label: "P/E",
              value: peRes.value != null ? formatRatio(peRes.value) : "n/a",
              hint: peRes.status === 200 ? undefined : `HTTP ${peRes.status}`,
            },
            {
              label: "P/B",
              value: pbRes.value != null ? formatRatio(pbRes.value) : "n/a",
              hint: pbRes.status === 200 ? undefined : `HTTP ${pbRes.status}`,
            },
            {
              label: "P/OE",
              value: pToOeRes.value != null ? formatRatio(pToOeRes.value) : "n/a",
              hint: pToOeRes.status === 200 ? undefined : `HTTP ${pToOeRes.status}`,
            },
          ],
        },
        {
          title: "Profitability",
          items: [
            {
              label: "ROE",
              value: formatPercent(roeRes.value),
              hint: roeRes.status === 200 ? undefined : `HTTP ${roeRes.status}`,
            },
            {
              label: "ROA",
              value: formatPercent(roaRes.value),
              hint: roaRes.status === 200 ? undefined : `HTTP ${roaRes.status}`,
            },
            {
              label: "Net Margin",
              value: formatPercent(netMarginRes.value),
              hint: netMarginRes.status === 200 ? undefined : `HTTP ${netMarginRes.status}`,
            },
            {
              label: "FCF Yield",
              value: formatPercent(fcfYieldRes.value),
              hint: fcfYieldRes.status === 200 ? undefined : `HTTP ${fcfYieldRes.status}`,
            },
            {
              label: "FCF Margin",
              value: formatPercent(fcfMarginRes.value),
              hint: fcfMarginRes.status === 200 ? undefined : `HTTP ${fcfMarginRes.status}`,
            },
            {
              label: "OE Yield",
              value: formatPercent(oeYieldRes.value),
              hint: oeYieldRes.status === 200 ? undefined : `HTTP ${oeYieldRes.status}`,
            },
          ],
        },
        {
          title: "Solvency / Leverage",
          items: [
            {
              label: "Debt/Equity",
              value: dteRes.value != null ? formatRatio(dteRes.value) : "n/a",
              hint: dteRes.status === 200 ? undefined : `HTTP ${dteRes.status}`,
            },
            {
              label: "Debt/Assets",
              value: formatPercent(dtaRes.value),
              hint: dtaRes.status === 200 ? undefined : `HTTP ${dtaRes.status}`,
            },
            {
              label: "Equity Ratio",
              value: formatPercent(eqRatioRes.value),
              hint: eqRatioRes.status === 200 ? undefined : `HTTP ${eqRatioRes.status}`,
            },
          ],
        },
        {
          title: "Efficiency & Growth",
          items: [
            {
              label: "Asset Turnover",
              value: atRes.value != null ? formatRatio(atRes.value) : "n/a",
              hint: atRes.status === 200 ? undefined : `HTTP ${atRes.status}`,
            },
            {
              label: "Equity CAGR",
              value: formatPercent(cagrRes.value),
              hint: cagrRes.status === 200 ? undefined : `HTTP ${cagrRes.status}`,
            },
          ],
        },
        {
          title: "Per Share",
          items: [
            {
              label: "EPS",
              value: epsRes.value != null ? formatPerShare(epsRes.value, price.unit) : "n/a",
              hint: epsRes.status === 200 ? undefined : `HTTP ${epsRes.status}`,
            },
            {
              label: "BVPS",
              value: bvpsRes.value != null ? formatPerShare(bvpsRes.value, price.unit) : "n/a",
              hint: bvpsRes.status === 200 ? undefined : `HTTP ${bvpsRes.status}`,
            },
            {
              label: "OEPS",
              value: oepsRes.value != null ? formatPerShare(oepsRes.value, price.unit) : "n/a",
              hint: oepsRes.status === 200 ? undefined : `HTTP ${oepsRes.status}`,
            },
          ],
        },
        {
          title: "Cash Flow & Owner Earnings",
          items: [
            {
              label: "FCF (abs)",
              // English: show billions/millions for readability; reuse price.unit as fallback
              value:
                fcfAbsRes.value != null
                  ? `${formatCompactNumber(fcfAbsRes.value)} ${price.unit ?? "USD"}`
                  : "n/a",
              hint: fcfAbsRes.status === 200 ? undefined : `HTTP ${fcfAbsRes.status}`,
            },
            {
              label: "Owner Earnings",
              value:
                oeRes.value != null
                  ? `${formatCompactNumber(oeRes.value)} ${price.unit ?? "USD"}`
                  : "n/a",
              hint: oeRes.status === 200 ? undefined : `HTTP ${oeRes.status}`,
            },
          ],
        },
      ];

      setSections(sectionsData);
    } catch (e: unknown) {
      console.error("[panel] load failed:", e);
      setErr("Fehler beim Laden der Kennzahlen.");
      setSections([]); // clear sections on error
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

      {/* Input + Button */}
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

      {/* Show a fetch button when no cached Price is available */}
      {!loading &&
        sections.some(
          (sec) =>
            sec.title === "Valuation" &&
            sec.items.some((i) => i.label === "Price" && i.value === "n/a"),
        ) && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={async () => {
                try {
                  setLoading(true);
                  setErr(null);
                  // English: fetch ~2 years of quotes; backend upserts; then reload the panel
                  await refreshQuotes(symbol, "24m");
                  await load();
                } catch (e) {
                  console.error("[panel] refresh quotes failed:", e);
                  setErr("Could not load price data (refresh).");
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #333",
                background: "transparent",
                cursor: loading ? "default" : "pointer",
                fontSize: 12,
              }}
            >
              Get price data
            </button>

            <span style={{ fontSize: 12, opacity: 0.7 }}>
              No local price data found. Get and save now.
            </span>
          </div>
        )}

      {/* English: show live button when a section is rendered; keep it visible during fetch */}
      {sections.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={async () => {
              try {
                setLiveBusy(true); // start local busy (no global loading)
                setErr(null);
                const startSym = currentSym; // English: capture symbol at click time
                const q = await getCurrentPrice(startSym);
                // English: apply only if user didn't change symbol mid-flight
                if (startSym === currentSym) setLive(q);
              } catch (e) {
                console.error("[panel] live price failed:", e);
                setErr("Could not fetch live price.");
              } finally {
                setLiveBusy(false); // end local busy
              }
            }}
            disabled={loading || liveBusy}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #333",
              background: "transparent",
              cursor: loading || liveBusy ? "default" : "pointer",
              fontSize: 12,
              opacity: loading || liveBusy ? 0.7 : 1, // English: subtle disabled look
            }}
            title={`Fetch live price for ${currentSym}`}
          >
            {liveBusy ? "Fetching…" : "Get live price"}
          </button>

          {/* English: show live price with currency and its date appended */}
          {live && live.symbol?.toUpperCase() === currentSym && (
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              live ({live.symbol}): {live.price != null ? `${live.price.toFixed(2)} USD` : "n/a"}
              {live.latestTradingDay ? ` — ${live.latestTradingDay}` : ""}
              {` (HTTP ${live.status})`}
            </span>
          )}
        </div>
      )}

      {err && <div style={{ fontSize: 12, color: "#f87171", marginBottom: 8 }}>{err}</div>}

      {/* One grid for the whole panel; each section spans all columns */}
      <div style={GRID}>
        {sections.map((sec) => (
          <div key={sec.title} style={{ gridColumn: "1 / -1" }}>
            {/* Section header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 10,
                opacity: 0.8,
                margin: "6px 2px 2px",
              }}
            >
              <span>{sec.title}</span>
              <span
                title="Available metrics in this section"
                style={{
                  border: "1px solid #333",
                  borderRadius: 6,
                  padding: "1px 6px",
                  fontSize: 10,
                  opacity: 0.75,
                }}
              >
                {
                  // English: count metrics that are not "n/a"
                  (() => {
                    const available = sec.items.filter((i) => i.value !== "n/a").length;
                    return `${available}/${sec.items.length}`;
                  })()
                }
              </span>
            </div>

            {/* Full-width row with as many columns as items */}
            {/* Full-width row with as many columns as items */}
            <div style={makeRowGrid(sec.items.length)}>
              {loading
                ? sec.items.map((m) => (
                    <SkeletonCard key={`sk-${sec.title}-${m.label}`} label={m.label} />
                  ))
                : sec.items.map((m) => (
                    <div key={`${sec.title}-${m.label}`} style={CARD}>
                      <div style={{ fontSize: 10, opacity: 0.8 }}>{m.label}</div>

                      {/* Value + optional live delta badge (only for Price) */}
                      <div
                        // English: keep value and delta on one line, align baselines
                        style={{
                          fontSize: 16,
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "baseline",
                          gap: 6,
                        }}
                        title={m.hint ?? undefined}
                      >
                        <span>{m.value}</span>

                        {m.label === "Price" &&
                          live?.status === 200 &&
                          typeof live.price === "number" &&
                          typeof baseClose === "number" &&
                          baseClose > 0 && (
                            <span
                              // English: delta vs last cached close (color up/down)
                              title={`Live vs last close: ${live.price - baseClose >= 0 ? "+" : ""}${(live.price - baseClose).toFixed(2)}`}
                              style={{
                                fontSize: 12,
                                border: "1px solid #333",
                                borderRadius: 6,
                                padding: "0 6px",
                                color: live.price - baseClose >= 0 ? "#22c55e" : "#f87171",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {(((live.price - baseClose) / baseClose) * 100).toFixed(2)}%
                            </span>
                          )}
                      </div>

                      {/* Hint row (keeps rows uniform; shows date or HTTP status) */}
                      {m.hint && (
                        <div style={HINT} title={m.hint}>
                          {m.hint}
                        </div>
                      )}
                    </div>
                  ))}
            </div>
          </div>
        ))}
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

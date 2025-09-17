// src/components/AnalyticsMiniPanel.tsx
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { getLatestCloseFromQuotes } from "../services/api/quotes";
import { refreshQuotes } from "../services/api/quotes";
import { fetchFundamentalsSnapshot, type SnapshotResult } from "../services/api/fundamentals";
import { refreshFundamentals } from "../services/api/fundamentals";

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

// Tiny inline status pill (reusable)
function StatusPill({
  kind,
  children,
}: {
  kind: "ok" | "err" | "info";
  children: React.ReactNode;
}) {
  // English: minimal visual feedback capsule
  const base: React.CSSProperties = {
    fontSize: 12,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid",
    display: "inline-block",
  };
  const theme =
    kind === "ok"
      ? { borderColor: "#cce5cc", background: "#f6fff6" }
      : kind === "err"
        ? { borderColor: "#f5c2c7", background: "#fff6f6" }
        : { borderColor: "#ddd", background: "#f7f7f7" };
  return <span style={{ ...base, ...theme }}>{children}</span>;
}

// English: turn raw error (stack/JSON) into a short, user-friendly message
function toUserMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "Unknown error");
  const low = raw.toLowerCase();

  // English: identify common upstream cases (FMP free tier / rate limit)
  if (
    low.includes("402 payment required") ||
    low.includes("premium query parameter") ||
    low.includes("not available under your current subscription") ||
    low.includes("subscription page")
  ) {
    return "Upstream free-tier limit for this symbol (FMP). Nothing saved.";
  }

  if (low.includes("429 too many requests") || low.includes("limit reach")) {
    return "Upstream rate limit reached (FMP). Please try again later.";
  }

  // English: generic gateway error
  if (low.includes("502 bad gateway") || low.includes("bad gateway")) {
    return "Backend temporarily unavailable. Please retry.";
  }

  // English: final fallback — trim very long texts
  return raw.length > 140 ? raw.slice(0, 140) + "…" : raw;
}

// English: optional initial symbol + notify parent when active symbol changes
export default function AnalyticsMiniPanel({
  initialSymbol,
  onSymbolChange,
}: {
  initialSymbol?: string;
  onSymbolChange?: (s: string) => void;
}) {
  // --- Core query & global UI state ---
  const [symbol, setSymbol] = useState<string>("");

  // English: normalized symbol (must be declared early so helpers can use it)
  const currentSym = useMemo(() => symbol.trim().toUpperCase(), [symbol]);

  const [loading, setLoading] = useState(false); // English: global page loading (metrics reload)
  const [err, setErr] = useState<string | null>(null); // English: global banner error (rare)

  // --- Data caches shown in the panel ---
  const [sections, setSections] = useState<MetricSection[]>([]); // English: normalized metrics groups
  const [spark, setSpark] = useState<TimeseriesPoint[]>([]); // English: 180d sparkline points
  const [live, setLive] = useState<CurrentQuote | null>(null); // English: latest live quote payload
  const [baseClose, setBaseClose] = useState<number | null>(null); // English: last cached close for delta badge

  // --- Per-action busy flags (disable individual buttons) ---
  const [priceBusy, setPriceBusy] = useState(false); // English: "Get price data" request in flight
  const [liveBusy, setLiveBusy] = useState(false); // English: "Get live price" request in flight
  const [fundBusy, setFundBusy] = useState(false); // English: fundamentals fetch/save in flight

  // --- Fundamentals raw snapshot (debug/preview; not persisted) ---
  const [fundRes, setFundRes] = useState<SnapshotResult | null>(null); // English: result of snapshot call

  // --- Persistent status text per action (left of each button) ---
  const [priceFetchStatus, setPriceFetchStatus] = useState<string | null>(null); // English: Get price data
  const [liveStatus, setLiveStatus] = useState<string | null>(null); // English: Get live price
  const [fundSnapStatus, setFundSnapStatus] = useState<string | null>(null); // English: Get fundamentals (snapshot)
  const [fundSaveStatus, setFundSaveStatus] = useState<string | null>(null); // English: Save fundamentals (refresh)

  // --- Transient error pills per action (auto-hidden after 5s) ---
  const [priceFetchErr, setPriceFetchErr] = useState<string | null>(null); // English: Get price data error
  const [liveErr, setLiveErr] = useState<string | null>(null); // English: Get live price error
  const [fundSnapErr, setFundSnapErr] = useState<string | null>(null); // English: Get fundamentals error
  const [fundErr, setFundErr] = useState<string | null>(null); // English: Save fundamentals error

  // --- Pinned symbols (quick switch) ---
  const [pinned, setPinned] = useState<string[]>(() => {
    // English: read pinned list from localStorage (uppercase, cap length)
    try {
      const raw = localStorage.getItem("analytics:pinned");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          return arr.map((s: unknown) => String(s).toUpperCase()).slice(0, 12);
        }
      }
    } catch (e) {
      console.warn("[pinned] read failed:", e); // English: ignore storage read errors
    }
    return ["AAPL", "AMD"];
  });

  const [confirmedSym, setConfirmedSym] = useState<string>("");

  const typingRef = useRef(false); // English: blocks auto-load while user is editing

  const searchRef = useRef<HTMLInputElement | null>(null); // English: track input element to detect focus

  const lastAnnouncedRef = useRef<string | null>(null);

  const lastInitialSymRef = useRef<string | null>(null); // English: remember last adopted initialSymbol to avoid duplicates

  // English: persist pinned list on change
  useEffect(() => {
    try {
      localStorage.setItem("analytics:pinned", JSON.stringify(pinned));
    } catch (e) {
      console.warn("[pinned] write failed:", e); // English: ignore quota errors; best-effort
    }
  }, [pinned]);

  // English: remove a symbol from pinned
  const pinRemove = useCallback(
    (s: string): void => {
      setPinned((prev) => prev.filter((x) => x !== s));
    },
    [setPinned],
  );

  // Centralized backend base (adjust if your backend port changes)
  const backendBase = useMemo(() => "http://localhost:5046", []);

  // English: always resolve user input (name or symbol-ish) to a TICKER via backend search
  const resolveToTicker = useCallback(
    async (input: string): Promise<string | null> => {
      const q = (input ?? "").trim();
      if (!q) return null;

      try {
        const resp = await fetch(
          `${backendBase}/api/companies?q=${encodeURIComponent(q)}&limit=1`,
          { headers: { Accept: "application/json" } },
        );
        if (!resp.ok) return null;

        const arr = (await resp.json()) as Array<{ symbol?: string }>;
        const sym = Array.isArray(arr) && arr.length > 0 ? arr[0]?.symbol : undefined;
        return sym ? String(sym).toUpperCase() : null;
      } catch {
        return null; // English: best-effort; no fallback guess here
      }
    },
    [backendBase],
  );

  // English: add current selection to pinned, always as a TICKER symbol
  const pinAddCurrent = useCallback(async (): Promise<void> => {
    // English: try resolving from current input; if that fails, fall back to currentSym
    const resolved = (await resolveToTicker(symbol)) ?? currentSym;
    if (!resolved) return;

    setPinned((prev) => (prev.includes(resolved) ? prev : [...prev, resolved]));
  }, [symbol, currentSym, resolveToTicker, setPinned]);

  // English: auto-hide all error pills after 5s (status lines stay)
  useEffect(() => {
    if (!liveErr && !fundSnapErr && !fundErr && !priceFetchErr) return;
    const t = setTimeout(() => {
      setLiveErr(null);
      setFundSnapErr(null);
      setFundErr(null);
      setPriceFetchErr(null);
    }, 5000);
    return () => clearTimeout(t);
  }, [liveErr, fundSnapErr, fundErr, priceFetchErr]);

  // English: does the CTA apply? (only when no local price present)
  const needsPriceCta = useMemo(() => {
    return sections.some(
      (sec) =>
        sec.title === "Valuation" &&
        sec.items.some((i) => i.label === "Price" && i.value === "n/a"),
    );
  }, [sections]);

  // English: clear per-action status/errors/busy flags when switching company
  const resetActionUi = useCallback((): void => {
    // status lines
    setPriceFetchStatus(null);
    setLiveStatus(null);
    setFundSnapStatus(null);
    setFundSaveStatus(null);
    // error pills
    setPriceFetchErr(null);
    setLiveErr(null);
    setFundSnapErr(null);
    setFundErr(null);
    // busy flags
    setPriceBusy(false);
    setLiveBusy(false);
    setFundBusy(false);
    // snapshot/debug + live baseline
    setFundRes(null);
    setLive(null);
    setBaseClose(null);
  }, []);

  // English: whenever the symbol changes, wipe action UI to avoid stale statuses
  useEffect(() => {
    resetActionUi();
    // Also clear sparkline/sections until next load
    setSpark([]);
    setSections([]);
  }, [resetActionUi, currentSym]);

  // English: clear input + UI state and tell parent to deselect
  const handleClear = useCallback((): void => {
    typingRef.current = true; // English: block any auto-load
    setSymbol(""); // English: empty the search field
    setConfirmedSym(""); // English: no confirmed selection
    resetActionUi(); // English: clear per-action UI
    setSections([]); // English: hide analytics panels
    setSpark([]); // English: hide sparkline
    onSymbolChange?.(""); // English: tell parent to clear list/pin highlight
    // optional: focus back to input for quick typing
    searchRef.current?.focus();
  }, [resetActionUi, onSymbolChange]);

  // English: show fundamentals CTAs only when many metrics are missing
  const manyNa =
    sections.reduce((sum, sec) => sum + sec.items.filter((i) => i.value === "n/a").length, 0) >= 6;

  // --- Main load routine (your existing body kept intact) ---
  const load = useCallback(
    async (symOverride?: string) => {
      const sym = (symOverride ?? symbol).trim().toUpperCase(); // English: prefer explicit symbol if provided
      localStorage.setItem(STORAGE_KEY, sym);
      if (!sym) return;

      // English: Do not load if user is currently typing in the search box
      if (typingRef.current) return;

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
            `${backendBase}/api/quotes/timeseries?symbol=${encodeURIComponent(sym)}&from=${fmt(from)}&to=${fmt(to)}`,
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

        // English: fallback via stable snapshot if analytics endpoints had no data
        let peValue = peRes.value;
        let peHint = peRes.status === 200 ? undefined : `HTTP ${peRes.status}`;

        let netMarginValue = netMarginRes.value;
        let netMarginHint = netMarginRes.status === 200 ? undefined : `HTTP ${netMarginRes.status}`;

        if (peRes.status !== 200 || netMarginRes.status !== 200) {
          // English: prefer already-fetched snapshot from state to avoid extra call
          let snapshot = fundRes?.status === 200 ? fundRes.data : null;

          // If not present, fetch minimal snapshot (limit=1) with robust routing
          if (!snapshot) {
            const snap = await fetchFundamentalsSnapshot(sym, "annual", 1);
            if (snap.status !== 200) {
              setErr(
                (prev) => prev ?? `Fundamentals snapshot fallback failed (HTTP ${snap.status})`,
              );
            }
            snapshot = snap.data ?? null;
          }

          if (snapshot?.metrics) {
            const m = snapshot.metrics as Record<string, unknown>;
            const num = (k: string): number | null => {
              const v = m[k];
              return typeof v === "number" && Number.isFinite(v) ? v : null;
            };

            if (peRes.status !== 200) {
              const peTtm = num("peRatioTTM") ?? num("peTTM") ?? num("pe");
              if (peTtm != null) {
                peValue = peTtm;
                peHint = "from TTM (snapshot)";
              }
            }

            if (netMarginRes.status !== 200) {
              const nmTtm = num("netProfitMarginTTM") ?? num("netMarginTTM") ?? num("netMargin");
              if (nmTtm != null) {
                netMarginValue = nmTtm;
                netMarginHint = "from TTM (snapshot)";
              }
            }
          }
        }

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
              { label: "P/E", value: peValue != null ? formatRatio(peValue) : "n/a", hint: peHint },
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
                value: netMarginValue != null ? `${(netMarginValue * 100).toFixed(1)}%` : "n/a",
                hint: netMarginHint,
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
    },
    [backendBase, symbol, fundRes],
  );

  // English: switch to a pinned symbol and trigger an immediate analytics load
  const pinSwitch = useCallback(
    (s: string): void => {
      const sym = (s ?? "").trim();
      if (!sym) return;

      typingRef.current = false; // English: allow immediate load from pin

      setSymbol(sym);
      setConfirmedSym(sym);
      resetActionUi(); // English: clear per-action UI for a fresh symbol view
      setTimeout(() => {
        load(sym).catch((err) => console.warn("[pinned] load failed:", err));
      }, 0);
    },
    [load, resetActionUi, setSymbol],
  );

  // English: keep latest functions in refs so effects don't depend on them
  const loadFnRef = useRef(load);
  useEffect(() => {
    loadFnRef.current = load;
  }, [load]);

  const resetFnRef = useRef(resetActionUi);
  useEffect(() => {
    resetFnRef.current = resetActionUi;
  }, [resetActionUi]);

  // English: Skip the very first non-empty initialSymbol from parent (no preselection on startup)
  const skipFirstAdoptionRef = useRef(false);
  useEffect(() => {
    const up = (initialSymbol ?? "").trim().toUpperCase();
    if (!up) return;

    if (up === confirmedRef.current) return; // English: ignore parent echo of the already confirmed pin

    if (skipFirstAdoptionRef.current) {
      skipFirstAdoptionRef.current = false; // English: ignore the very first non-empty
      lastInitialSymRef.current = up; // English: mark as seen so repeats won't adopt
      return; // do not adopt/search-field-fill on initial startup
    }

    const inputFocused = searchRef.current != null && document.activeElement === searchRef.current;

    if (!inputFocused) {
      setSymbol(up); // English: reflect list click in the search field
    }

    resetFnRef.current?.(); // English: clear per-action UI
    typingRef.current = true; // English: wait for explicit Load
    setSections([]); // English: hide analytics panels
    setSpark([]); // English: hide sparkline
    setConfirmedSym(""); // English: not confirmed yet

    // English: do NOT auto-load here; user must confirm with Load
  }, [initialSymbol]);

  // English: resolve query to a UNIQUE ticker; returns null if 0 or >1 matches
  const resolveUniqueTicker = useCallback(
    async (query: string): Promise<string | null> => {
      const q = (query ?? "").trim();
      if (!q) return null;

      try {
        // Ask backend for up to 2 hits; only accept when we get exactly 1
        const resp = await fetch(
          `${backendBase}/api/companies?q=${encodeURIComponent(q)}&limit=2`,
          { headers: { Accept: "application/json" } },
        );
        if (!resp.ok) return null;

        const arr = (await resp.json()) as Array<{ symbol?: string }>;
        if (!Array.isArray(arr)) return null;

        if (arr.length === 1 && arr[0]?.symbol) {
          return String(arr[0].symbol).toUpperCase();
        }
        return null; // ambiguous or not found
      } catch {
        return null; // best-effort
      }
    },
    [backendBase],
  );

  // English: try to resolve input to a unique ticker; load it, or clear selection if ambiguous
  const handleResolveAndLoad = useCallback(async (): Promise<void> => {
    const sym = await resolveUniqueTicker(symbol);
    if (sym) {
      setSymbol(sym); // show resolved ticker in the input
      resetActionUi(); // clear previous per-action UI
      //onSymbolChange?.(sym); // reflect selection in parent (highlight/scroll)
      typingRef.current = false; // English: explicit submit -> allow loading now
      await load(sym); // load analytics for the resolved ticker
      setConfirmedSym(sym);
    } else {
      // No unique match: act as if nothing is selected
      resetActionUi();
      setSections([]);
      setSpark([]);
      onSymbolChange?.(""); // tell parent to clear selection (hides panel highlight)
    }
  }, [
    symbol,
    resolveUniqueTicker,
    resetActionUi,
    load,
    onSymbolChange,
    setSections,
    setSpark,
    setSymbol,
  ]);

  useEffect(() => {
    typingRef.current = true; // block any auto-load until user confirms
    setSections([]); // hide analytics panels
    setSpark([]); // hide sparkline
  }, []);

  useEffect(() => {
    const s = confirmedSym;
    if (!s || lastAnnouncedRef.current === s) return;
    lastAnnouncedRef.current = s;

    const id = requestAnimationFrame(() => {
      onSymbolChange?.(s); // Parent sync happens AFTER the highlight was painted
    });

    return () => cancelAnimationFrame(id);
  }, [confirmedSym, onSymbolChange]);

  const confirmedRef = useRef<string>(""); // English: mirror of confirmedSym for effects that must not re-run
  useEffect(() => {
    confirmedRef.current = confirmedSym; // English: keep ref in sync with state
  }, [confirmedSym]);

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
      <div style={{ fontWeight: 600 }}>Analytics</div>

      {/* English: render pinned buttons */}
      <div
        style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}
      >
        {pinned.map((s) => (
          <div
            key={s}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid #333",
              borderRadius: 999,
              padding: "2px 6px",
              background: s === confirmedSym ? "#111" : "transparent",
            }}
            title={`Switch to ${s}`}
          >
            <button
              onClick={() => pinSwitch(s)}
              style={{
                padding: "2px 6px",
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {s}
            </button>
            <button
              onClick={() => pinRemove(s)}
              title="Remove"
              aria-label={`Remove ${s}`}
              style={{
                padding: "0 6px",
                borderRadius: 6,
                border: "1px solid #333",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontSize: 12,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        ))}

        <button
          onClick={pinAddCurrent}
          title={`Pin ${currentSym}`}
          style={{
            padding: "2px 8px",
            borderRadius: 999,
            border: "1px solid #333",
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          + Pin current
        </button>
      </div>

      {/* English: Search bar + button */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          ref={searchRef} // English: needed to know if input is focused
          value={symbol}
          onKeyDown={async (e) => {
            if (e.key === "Enter" && !loading) {
              e.preventDefault();
              await handleResolveAndLoad(); // English: resolve unique + load or clear
            }
          }}
          onChange={(e) => {
            const v = e.target.value;
            setSymbol(v); // English: keep raw typing in state (no normalization)
            typingRef.current = true; // English: user started typing -> block auto-loads
            setConfirmedSym("");
            resetActionUi();
            setSections([]);
            setSpark([]);
          }}
          placeholder="Symbol or name (e.g., AMZN or Amazon)"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid #333",
            background: "transparent",
            color: "inherit",
            textTransform: "none", // English: ensure input preserves typed casing
            fontVariantCaps: "normal", // English: avoid small-caps or other cap variants
          }}
        />
        {/* English: clear current query and UI */}
        <button
          onClick={handleClear}
          title="Clear search"
          aria-label="Clear search"
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid #333",
            background: "transparent",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          ×
        </button>

        <button
          onClick={async () => {
            if (loading) return;
            await handleResolveAndLoad(); // English: same logic as Enter key
          }}
          disabled={loading}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #333",
            background: loading ? "#111" : "transparent",
            cursor: loading ? "default" : "pointer",
            whiteSpace: "nowrap",
          }}
          title={`Load analytics for ${currentSym}`}
        >
          {loading ? "Loading..." : "Load"}
        </button>
      </div>

      {/* English: Get price data button */}
      {(needsPriceCta || priceBusy || priceFetchStatus || priceFetchErr) && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {needsPriceCta && (
            <button
              onClick={async () => {
                try {
                  setPriceBusy(true);
                  setErr(null);
                  setPriceFetchErr(null);
                  setPriceFetchStatus(null);

                  // English: trigger backend refresh (fetch & persist recent closes)
                  await refreshQuotes(currentSym, "24m");

                  // English: verify persistence by asking the cache directly
                  const after = await getLatestCloseFromQuotes(currentSym);

                  if (after.status === 200 && typeof after.value === "number") {
                    // English: success only if a numeric price is now present
                    setPriceFetchStatus(
                      `Price data (${currentSym}): loaded & saved (HTTP ${after.status}).`,
                    );
                    // English: optionally refresh the whole panel (kept here)
                    await load();
                  } else {
                    // English: refresh returned but no cached price is available
                    setPriceFetchStatus(
                      `Price data (${currentSym}): still unavailable (HTTP ${after.status}).`,
                    );
                    setPriceFetchErr(
                      toUserMessage(
                        new Error(`HTTP ${after.status}: no cached price after refresh`),
                      ),
                    );
                  }
                } catch (e) {
                  setPriceFetchErr(toUserMessage(e));
                  setPriceFetchStatus(`Price data (${currentSym}): failed.`);
                } finally {
                  setPriceBusy(false);
                }
              }}
              disabled={priceBusy}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #333",
                background: "transparent",
                cursor: priceBusy ? "default" : "pointer",
                fontSize: 12,
                opacity: priceBusy ? 0.7 : 1,
              }}
              title={`Fetch and store recent price data for ${currentSym}`}
            >
              {priceBusy ? "Loading…" : "Get price data"}
            </button>
          )}

          {/* English: persistent status (left) + transient error pill (right) */}
          {priceFetchStatus && (
            <span style={{ fontSize: 12, opacity: 0.7 }}>{priceFetchStatus}</span>
          )}
          {priceFetchErr && <StatusPill kind="err">{priceFetchErr}</StatusPill>}
        </div>
      )}

      {/* English: Get live price button */}
      {sections.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={async () => {
              try {
                setLiveBusy(true); // English: start local busy (no global loading)
                setErr(null);
                setLiveErr(null);
                setLiveStatus(null);

                const startSym = currentSym; // English: capture symbol at click time
                const q = await getCurrentPrice(startSym);

                // English: keep original 'live' for your delta badge in Price card
                if (startSym === currentSym) setLive(q);

                // English: persistent status line (always set after click)
                const status =
                  `Live price (${q.symbol ?? startSym}): ` +
                  `${typeof q.price === "number" ? q.price.toFixed(2) + " USD" : "n/a"}` +
                  `${q.latestTradingDay ? ` — ${q.latestTradingDay}` : ""}` +
                  ` (HTTP ${q.status})`;
                setLiveStatus(status);
                if (q.status !== 200 || typeof q.price !== "number") {
                  setLiveErr(toUserMessage(new Error(`HTTP ${q.status}: live price unavailable`)));
                }
              } catch (e) {
                setLiveErr(toUserMessage(e));
                setLiveStatus(`live (${currentSym}): n/a (HTTP 500)`);
              } finally {
                setLiveBusy(false);
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
              opacity: loading || liveBusy ? 0.7 : 1,
            }}
            title={`Fetch live price for ${currentSym}`}
          >
            {liveBusy ? "Fetching…" : "Get live price"}
          </button>

          {/* English: transient error pill + persistent status line */}
          {liveStatus && <span style={{ fontSize: 12, opacity: 0.7 }}>{liveStatus}</span>}
          {liveErr && <StatusPill kind="err">{liveErr}</StatusPill>}
        </div>
      )}

      {/* English: Get fundamentals button */}
      {(manyNa || fundSnapErr || fundSnapStatus) && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {manyNa && (
            <button
              onClick={async () => {
                try {
                  setFundBusy(true);
                  setErr(null);
                  setFundSnapErr(null);
                  setFundSnapStatus(null);
                  setFundRes(null);

                  const res = await fetchFundamentalsSnapshot(currentSym, "annual", 5);
                  setFundRes(res);

                  if (res.status === 200 && res.data) {
                    setFundSnapStatus(
                      `Fundamentals (${currentSym}): snapshot received (HTTP ${res.status})`,
                    );
                  } else {
                    setFundSnapStatus(
                      `Fundamentals (${currentSym}): ${res.status === 200 ? "no data" : "unavailable"} (HTTP ${res.status})`,
                    );
                    if (res.status !== 200) {
                      setFundSnapErr(
                        toUserMessage(
                          new Error(`HTTP ${res.status}: fundamentals snapshot unavailable`),
                        ),
                      );
                    }
                  }
                } catch (e) {
                  // English: concise pill + short status
                  setFundSnapErr(toUserMessage(e));
                  setFundSnapStatus("Fundamentals: failed.");
                } finally {
                  setFundBusy(false);
                }
              }}
              disabled={loading || fundBusy}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #333",
                background: "transparent",
                cursor: loading || fundBusy ? "default" : "pointer",
                fontSize: 12,
                opacity: loading || fundBusy ? 0.7 : 1,
              }}
              title={`Fetch fundamentals snapshot (not persisted) for ${currentSym}`}
            >
              {fundBusy ? "Fetching…" : "Get fundamentals (5y)"}
            </button>
          )}

          {/* English: transient error pill + persistent status line */}
          {fundSnapStatus && <span style={{ fontSize: 12, opacity: 0.7 }}>{fundSnapStatus}</span>}
          {fundSnapErr && <StatusPill kind="err">{fundSnapErr}</StatusPill>}
        </div>
      )}

      {/* English: Save fundamentals button */}
      {(manyNa || fundErr || fundSaveStatus) && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {manyNa && (
            <button
              onClick={async () => {
                try {
                  setFundBusy(true);
                  setErr(null);
                  setFundErr(null);
                  setFundSaveStatus(null);

                  const res = await refreshFundamentals(currentSym, "annual", 5);

                  // English: build persistent status line (no success pill, only errors show a pill)
                  const allZero =
                    (res.inserted?.income ?? 0) === 0 &&
                    (res.inserted?.balance ?? 0) === 0 &&
                    (res.inserted?.cash ?? 0) === 0 &&
                    (res.skipped?.income ?? 0) === 0 &&
                    (res.skipped?.balance ?? 0) === 0 &&
                    (res.skipped?.cash ?? 0) === 0;

                  setFundSaveStatus(
                    allZero
                      ? `Save fundamentals (${res.symbol}): no changes (up-to-date or free tier).`
                      : `Save fundamentals (${res.symbol}): income +${res.inserted?.income ?? 0}/${res.skipped?.income ?? 0}, ` +
                          `balance +${res.inserted?.balance ?? 0}/${res.skipped?.balance ?? 0}, ` +
                          `cash +${res.inserted?.cash ?? 0}/${res.skipped?.cash ?? 0}`,
                  );

                  setFundSaveStatus(status);

                  // English: reload so analytics can pick up newly persisted data
                  await load();
                } catch (e) {
                  setFundSaveStatus(`Save fundamentals (${currentSym}): failed.`);
                  setFundErr(toUserMessage(e));
                  console.warn("[panel] fundamentals refresh failed:", e);
                } finally {
                  setFundBusy(false);
                }
              }}
              disabled={loading || fundBusy}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #333",
                background: "transparent",
                cursor: loading || fundBusy ? "default" : "pointer",
                fontSize: 12,
                opacity: loading || fundBusy ? 0.7 : 1,
              }}
              title={`Persist fundamentals (annual, 5y) for ${currentSym}`}
            >
              {fundBusy ? "Persisting…" : "Save fundamentals (5y annual)"}
            </button>
          )}

          {/* English: transient error pill + persistent status line */}
          {fundSaveStatus && <span style={{ fontSize: 12, opacity: 0.7 }}>{fundSaveStatus}</span>}
          {fundErr && <StatusPill kind="err">{fundErr}</StatusPill>}
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

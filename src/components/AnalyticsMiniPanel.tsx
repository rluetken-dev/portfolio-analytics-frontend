import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";

import { getLatestCloseFromQuotes } from "../services/api/quotes";
import { fetchFundamentalsSnapshot } from "../services/api/fundamentals";
import { fetchJson } from "../services/api/client";
import { fetchLatestDateISO } from "../utils/dateUtils";
import { useCurrencyFade } from "../hooks/useCurrencyFade";
import { useFormatDisplayValue } from "../utils/formatDisplayValue";

type Metric = {
  label: string;
  value: number | null;
  hint?: string;
};

type MetricSection = {
  title: string;
  items: Metric[];
};

type MetricResult = {
  value: number | null;
  status: number;
};

type TimeseriesPoint = {
  date: string;
  close: number;
};

type CompanyLookupResult = {
  symbol?: string;
};

type LatestQuoteRow = {
  date?: string;
  tradingDate?: string;
};

type FundamentalsRefreshResponse = {
  inserted?: {
    income?: number;
    balance?: number;
    cash?: number;
  };
};

type AnalyticsMiniPanelProps = {
  initialSymbol?: string;
  onSymbolChange?: (symbol: string) => void;
};

const STORAGE_KEY = "analytics:lastSymbol";
const PINNED_STORAGE_KEY = "analytics:pinned";
const MAX_PINNED_SYMBOLS = 12;
const PRICE_STALE_AFTER_MS = 1000 * 60 * 60 * 24;

const PANEL_STYLE: CSSProperties = {
  border: "1px solid #222",
  borderRadius: 14,
  padding: 12,
  display: "grid",
  gap: 10,
  width: "100%",
  boxSizing: "border-box",
  marginTop: 16,
};

const GRID_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
  gap: 6,
  justifyItems: "stretch",
};

const CARD_STYLE: CSSProperties = {
  border: "1px solid #333",
  borderRadius: 8,
  padding: 6,
  minHeight: 54,
  minWidth: 0,
  overflow: "hidden",
  width: "100%",
};

const HINT_STYLE: CSSProperties = {
  fontSize: 10,
  opacity: 0.7,
  marginTop: 2,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

function normalizeSymbol(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function makeRowGrid(columns: number): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: `repeat(${Math.max(columns, 1)}, minmax(0, 1fr))`,
    gap: 6,
  };
}

function buildPolyline(points: TimeseriesPoint[], width: number, height: number): string {
  if (points.length === 0) return "";

  const closes = points.map((point) => point.close);
  const minY = Math.min(...closes);
  const maxY = Math.max(...closes);
  const spanY = maxY - minY || 1;
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;

  return points
    .map((point, index) => {
      const x = Math.round(index * stepX);
      const y = Math.round(height - ((point.close - minY) / spanY) * height);
      return `${x},${y}`;
    })
    .join(" ");
}

function metricHint(status: number): string | undefined {
  return status === 200 ? undefined : `HTTP ${status}`;
}

function isValidNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readMetricValue(raw: unknown, candidateKeys: string[]): number | null {
  if (isValidNumber(raw)) return raw;

  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const obj = raw as Record<string, unknown>;

  for (const key of candidateKeys) {
    if (isValidNumber(obj[key])) {
      return obj[key];
    }
  }

  return null;
}

async function fetchMetricNumber(
  path: string,
  symbol: string,
  candidateKeys: string[],
): Promise<MetricResult> {
  const response = await fetch(`${path}?symbol=${encodeURIComponent(symbol)}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return { value: null, status: response.status };
  }

  const raw = (await response.json()) as unknown;

  return {
    value: readMetricValue(raw, candidateKeys),
    status: response.status,
  };
}

function readCompanyResults(raw: unknown): CompanyLookupResult[] {
  if (Array.isArray(raw)) {
    return raw as CompanyLookupResult[];
  }

  if (typeof raw !== "object" || raw === null) {
    return [];
  }

  const obj = raw as Record<string, unknown>;
  const results = obj.results ?? obj.Results;

  return Array.isArray(results) ? (results as CompanyLookupResult[]) : [];
}

async function searchCompanies(query: string, limit: number): Promise<CompanyLookupResult[]> {
  const encodedQuery = encodeURIComponent(query);

  const urls = [
    `/api/companies/search?q=${encodedQuery}&limit=${limit}`,
    `/api/companies?q=${encodedQuery}&limit=${limit}`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        continue;
      }

      const raw = (await response.json()) as unknown;
      const results = readCompanyResults(raw);

      if (results.length > 0) {
        return results;
      }
    } catch {
      continue;
    }
  }

  return [];
}

async function resolveTicker(query: string): Promise<string | null> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return null;

  const results = await searchCompanies(normalizedQuery, 2);
  const firstSymbol = results[0]?.symbol;

  return firstSymbol ? normalizeSymbol(firstSymbol) : null;
}

async function fetchTimeseries(symbol: string, anchorDate?: string | null): Promise<TimeseriesPoint[]> {
  const query = new URLSearchParams({ symbol });

  if (anchorDate) {
    const to = new Date(anchorDate);
    const from = new Date(to);
    from.setDate(to.getDate() - 180);

    query.set("from", formatDate(from));
    query.set("to", formatDate(to));
  }

  const response = await fetch(`/api/quotes/timeseries?${query.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return [];
  }

  const raw = (await response.json()) as unknown;
  const rows = Array.isArray(raw) ? raw : [];

  return rows
    .map((row) => {
      const item = row as Record<string, unknown>;

      return {
        date: typeof item.date === "string" ? item.date : String(item.date ?? ""),
        close: isValidNumber(item.close) ? item.close : Number.NaN,
      };
    })
    .filter((point) => point.date && Number.isFinite(point.close))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getLatestQuoteDate(rows: unknown): string | null {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const latest = rows[0] as LatestQuoteRow;
  const date = latest.date ?? latest.tradingDate;

  return typeof date === "string" && date.length >= 10 ? date.slice(0, 10) : null;
}

async function refreshQuotes(symbol: string): Promise<void> {
  await fetchJson({
    path: `/api/quotes/refresh?symbols=${encodeURIComponent(symbol)}&range=30d`,
    method: "POST",
    timeoutMs: 45_000,
  });
}

async function refreshFundamentals(symbol: string): Promise<FundamentalsRefreshResponse | null> {
  const response = await fetch(`/api/fundamentals/refresh?symbol=${encodeURIComponent(symbol)}`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as FundamentalsRefreshResponse;
}

async function fetchSnapshotMetricFallback(symbol: string): Promise<{
  pe?: number;
  netMargin?: number;
}> {
  const snapshot = await fetchFundamentalsSnapshot(symbol, "annual", 1);

  if (snapshot.status !== 200 || !snapshot.data?.metrics) {
    return {};
  }

  const metrics = snapshot.data.metrics as Record<string, unknown>;
  const read = (...keys: string[]): number | undefined => {
    for (const key of keys) {
      if (isValidNumber(metrics[key])) {
        return metrics[key];
      }
    }

    return undefined;
  };

  return {
    pe: read("peRatioTTM", "peTTM", "pe"),
    netMargin: read("netProfitMarginTTM", "netMarginTTM", "netMargin"),
  };
}

function SkeletonCard({ label }: { label: string }) {
  return (
    <div style={CARD_STYLE} aria-busy="true" aria-live="polite">
      <div style={{ fontSize: 10, opacity: 0.6 }}>{label}</div>
      <div
        style={{
          marginTop: 6,
          height: 18,
          borderRadius: 6,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.08) 25%, rgba(255,255,255,0.18) 37%, rgba(255,255,255,0.08) 63%)",
          backgroundSize: "400% 100%",
          animation: "analyticsShine 1.2s ease-in-out infinite",
        }}
      />
    </div>
  );
}

function SectionHeader({ section }: { section: MetricSection }) {
  const available = section.items.filter((item) => item.value !== null).length;

  return (
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
      <span>{section.title}</span>
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
        {available}/{section.items.length}
      </span>
    </div>
  );
}

function AnalyticsStyles() {
  return (
    <style>
      {`
        @keyframes analyticsShine {
          0% { background-position: 100% 0; }
          100% { background-position: 0 0; }
        }

        @keyframes analyticsFadeSlideIn {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes analyticsFadeSlideOut {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-8px);
          }
        }
      `}
    </style>
  );
}

export default function AnalyticsMiniPanel({
  initialSymbol,
  onSymbolChange,
}: AnalyticsMiniPanelProps) {
  const [symbol, setSymbol] = useState("");
  const [confirmedSymbol, setConfirmedSymbol] = useState("");
  const [sections, setSections] = useState<MetricSection[]>([]);
  const [sparkline, setSparkline] = useState<TimeseriesPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [baseClose, setBaseClose] = useState<number | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);

  const [autoStatus, setAutoStatus] = useState<string | null>(null);
  const [isStatusExiting, setIsStatusExiting] = useState(false);

  const [pinned, setPinned] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(PINNED_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;

      return Array.isArray(parsed)
        ? parsed.map((item) => normalizeSymbol(String(item))).filter(Boolean).slice(0, MAX_PINNED_SYMBOLS)
        : [];
    } catch {
      return [];
    }
  });

  const inputRef = useRef<HTMLInputElement | null>(null);
  const isTypingRef = useRef(true);
  const lastFreshnessCheckRef = useRef<string | null>(null);

  const currentSymbol = useMemo(() => normalizeSymbol(symbol), [symbol]);
  const { fadeClass } = useCurrencyFade();
  const { formatDisplayValue } = useFormatDisplayValue();

  useEffect(() => {
    try {
      if (pinned.length === 0) {
        localStorage.removeItem(PINNED_STORAGE_KEY);
      } else {
        localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(pinned));
      }
    } catch {
      // localStorage is best-effort only.
    }
  }, [pinned]);

  useEffect(() => {
    const nextSymbol = normalizeSymbol(initialSymbol);

    if (!nextSymbol || nextSymbol === confirmedSymbol) {
      return;
    }

    if (document.activeElement !== inputRef.current) {
      setSymbol(nextSymbol);
    }

    isTypingRef.current = true;
    setConfirmedSymbol("");
    setSections([]);
    setSparkline([]);
    setError(null);
    setBaseClose(null);
    setLivePrice(null);
  }, [initialSymbol, confirmedSymbol]);

  useEffect(() => {
    if (!autoStatus) {
      setIsStatusExiting(false);
      return;
    }

    const hideTimer = window.setTimeout(() => {
      setIsStatusExiting(true);
    }, 7000);

    const removeTimer = window.setTimeout(() => {
      setAutoStatus(null);
      setIsStatusExiting(false);
    }, 7300);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(removeTimer);
    };
  }, [autoStatus]);

  const clearPanel = useCallback(() => {
    isTypingRef.current = true;
    setSymbol("");
    setConfirmedSymbol("");
    setSections([]);
    setSparkline([]);
    setError(null);
    setBaseClose(null);
    setLivePrice(null);
    setAutoStatus(null);
    onSymbolChange?.("");
    inputRef.current?.focus();
  }, [onSymbolChange]);

  const buildSections = useCallback(async (targetSymbol: string): Promise<MetricSection[]> => {
    const price = await getLatestCloseFromQuotes(targetSymbol);
    setBaseClose(price.value ?? null);

    const anchorDate = price.asOf?.slice(0, 10) ?? (await fetchLatestDateISO(targetSymbol));
    setSparkline(await fetchTimeseries(targetSymbol, anchorDate));

    const [
      peResult,
      roeResult,
      fcfYieldResult,
      netMarginResult,
      debtToEquityResult,
      equityRatioResult,
      roaResult,
      debtToAssetsResult,
      epsResult,
      bvpsResult,
      pbResult,
      assetTurnoverResult,
      equityCagrResult,
      freeCashFlowResult,
      ownerEarningsResult,
      ownerEarningsYieldResult,
      oepsResult,
      priceToOwnerEarningsResult,
      fcfMarginResult,
    ] = await Promise.all([
      fetchMetricNumber("/api/analytics/pe", targetSymbol, ["value", "pe"]),
      fetchMetricNumber("/api/analytics/roe", targetSymbol, ["value", "roe"]),
      fetchMetricNumber("/api/analytics/fcf-yield", targetSymbol, ["value", "fcfYield"]),
      fetchMetricNumber("/api/analytics/net-margin", targetSymbol, ["value", "netMargin"]),
      fetchMetricNumber("/api/analytics/debt-to-equity", targetSymbol, ["value", "debtToEquity"]),
      fetchMetricNumber("/api/analytics/equity-ratio", targetSymbol, ["value", "equityRatio"]),
      fetchMetricNumber("/api/analytics/roa", targetSymbol, ["value", "roa"]),
      fetchMetricNumber("/api/analytics/debt-to-assets", targetSymbol, ["value", "debtToAssets"]),
      fetchMetricNumber("/api/analytics/eps", targetSymbol, ["value", "eps"]),
      fetchMetricNumber("/api/analytics/bvps", targetSymbol, ["value", "bvps"]),
      fetchMetricNumber("/api/analytics/pb", targetSymbol, ["value", "pb"]),
      fetchMetricNumber("/api/analytics/asset-turnover", targetSymbol, ["value", "assetTurnover"]),
      fetchMetricNumber("/api/analytics/equity-cagr", targetSymbol, [
        "value",
        "cagr",
        "equityCagr",
      ]),
      fetchMetricNumber("/api/analytics/fcf", targetSymbol, ["value", "fcf"]),
      fetchMetricNumber("/api/analytics/owner-earnings", targetSymbol, [
        "value",
        "ownerEarnings",
      ]),
      fetchMetricNumber("/api/analytics/owner-earnings-yield", targetSymbol, [
        "value",
        "ownerEarningsYield",
      ]),
      fetchMetricNumber("/api/analytics/oeps", targetSymbol, ["value", "oeps"]),
      fetchMetricNumber("/api/analytics/p-to-oe", targetSymbol, ["value", "pToOe", "pOverOe"]),
      fetchMetricNumber("/api/analytics/fcf-margin", targetSymbol, ["value", "fcfMargin"]),
    ]);

    let peValue = peResult.value;
    let peHint = metricHint(peResult.status);
    let netMarginValue = netMarginResult.value;
    let netMarginHint = metricHint(netMarginResult.status);

    if (peValue === null || netMarginValue === null) {
      const fallback = await fetchSnapshotMetricFallback(targetSymbol);

      if (peValue === null && fallback.pe !== undefined) {
        peValue = fallback.pe;
        peHint = "from fundamentals snapshot";
      }

      if (netMarginValue === null && fallback.netMargin !== undefined) {
        netMarginValue = fallback.netMargin;
        netMarginHint = "from fundamentals snapshot";
      }
    }

    return [
      {
        title: "Valuation",
        items: [
          {
            label: "Price",
            value: price.value ?? null,
            hint:
              price.status === 200
                ? price.asOf
                  ? `as of ${price.asOf}${price.adjusted ? " (adjusted)" : ""}`
                  : undefined
                : `HTTP ${price.status}`,
          },
          { label: "P/E", value: peValue ?? null, hint: peHint },
          { label: "P/B", value: pbResult.value, hint: metricHint(pbResult.status) },
          {
            label: "P/OE",
            value: priceToOwnerEarningsResult.value,
            hint: metricHint(priceToOwnerEarningsResult.status),
          },
        ],
      },
      {
        title: "Profitability",
        items: [
          { label: "ROE", value: roeResult.value, hint: metricHint(roeResult.status) },
          { label: "ROA", value: roaResult.value, hint: metricHint(roaResult.status) },
          { label: "Net Margin", value: netMarginValue ?? null, hint: netMarginHint },
          {
            label: "FCF Yield",
            value: fcfYieldResult.value,
            hint: metricHint(fcfYieldResult.status),
          },
          {
            label: "FCF Margin",
            value: fcfMarginResult.value,
            hint: metricHint(fcfMarginResult.status),
          },
          {
            label: "OE Yield",
            value: ownerEarningsYieldResult.value,
            hint: metricHint(ownerEarningsYieldResult.status),
          },
        ],
      },
      {
        title: "Solvency / Leverage",
        items: [
          {
            label: "Debt/Equity",
            value: debtToEquityResult.value,
            hint: metricHint(debtToEquityResult.status),
          },
          {
            label: "Debt/Assets",
            value: debtToAssetsResult.value,
            hint: metricHint(debtToAssetsResult.status),
          },
          {
            label: "Equity Ratio",
            value: equityRatioResult.value,
            hint: metricHint(equityRatioResult.status),
          },
        ],
      },
      {
        title: "Efficiency & Growth",
        items: [
          {
            label: "Asset Turnover",
            value: assetTurnoverResult.value,
            hint: metricHint(assetTurnoverResult.status),
          },
          {
            label: "Equity CAGR",
            value: equityCagrResult.value,
            hint: metricHint(equityCagrResult.status),
          },
        ],
      },
      {
        title: "Per Share",
        items: [
          { label: "EPS", value: epsResult.value, hint: metricHint(epsResult.status) },
          { label: "BVPS", value: bvpsResult.value, hint: metricHint(bvpsResult.status) },
          { label: "OEPS", value: oepsResult.value, hint: metricHint(oepsResult.status) },
        ],
      },
      {
        title: "Cash Flow & Owner Earnings",
        items: [
          {
            label: "FCF (abs)",
            value: freeCashFlowResult.value,
            hint: metricHint(freeCashFlowResult.status),
          },
          {
            label: "Owner Earnings",
            value: ownerEarningsResult.value,
            hint: metricHint(ownerEarningsResult.status),
          },
        ],
      },
    ];
  }, []);

  const load = useCallback(
    async (targetSymbol: string) => {
      const normalizedTarget = normalizeSymbol(targetSymbol);
      if (!normalizedTarget || isTypingRef.current) return;

      setLoading(true);
      setError(null);
      setLivePrice(null);

      try {
        localStorage.setItem(STORAGE_KEY, normalizedTarget);
        const nextSections = await buildSections(normalizedTarget);
        setSections(nextSections);
      } catch (loadError) {
        console.error("[AnalyticsMiniPanel] Failed to load analytics:", loadError);
        setError("Failed to load analytics data.");
        setSections([]);
        setSparkline([]);
      } finally {
        setLoading(false);
      }
    },
    [buildSections],
  );

  const checkDataFreshness = useCallback(
    async (targetSymbol: string) => {
      const normalizedTarget = normalizeSymbol(targetSymbol);
      if (!normalizedTarget) return;

      setAutoStatus("Checking data freshness...");
      setIsStatusExiting(false);

      let priceLine = "";
      let fundamentalsLine = "";
      let reloadLine = "";
      let shouldReload = false;

      try {
        const response = await fetch(
          `/api/quotes/latest?symbol=${encodeURIComponent(normalizedTarget)}&take=1`,
          { headers: { Accept: "application/json" } },
        );

        if (response.status === 404) {
          await refreshQuotes(normalizedTarget);
          priceLine = "Price data fetched successfully";
          shouldReload = true;
        } else if (response.ok) {
          const latestDate = getLatestQuoteDate(await response.json());
          const lastUpdate = latestDate ? new Date(latestDate) : null;
          const stale =
            !lastUpdate || Date.now() - lastUpdate.getTime() > PRICE_STALE_AFTER_MS;

          if (stale) {
            await refreshQuotes(normalizedTarget);
            priceLine = "Price data refreshed successfully";
            shouldReload = true;
          } else {
            priceLine = `Price data up to date (${latestDate ?? "unknown date"})`;
          }
        } else {
          priceLine = `Could not check price freshness (HTTP ${response.status})`;
        }
      } catch {
        priceLine = "Could not refresh price data. Backend or provider may be unavailable.";
      }

      try {
        const fundamentals = await refreshFundamentals(normalizedTarget);

        if (!fundamentals) {
          fundamentalsLine = "Fundamentals refresh skipped or unavailable";
        } else {
          const inserted =
            (fundamentals.inserted?.income ?? 0) +
            (fundamentals.inserted?.balance ?? 0) +
            (fundamentals.inserted?.cash ?? 0);

          if (inserted > 0) {
            fundamentalsLine = "Fundamentals updated successfully";
            shouldReload = true;
          } else {
            fundamentalsLine = "Fundamentals already up to date";
          }
        }
      } catch {
        fundamentalsLine = "Could not refresh fundamentals.";
      }

      if (shouldReload) {
        try {
          await load(normalizedTarget);
          reloadLine = "Analytics reloaded";
        } catch {
          reloadLine = "Analytics reload failed. Please retry manually.";
        }
      } else {
        reloadLine = "Analytics already up to date";
      }

      setAutoStatus(`${priceLine}\n${fundamentalsLine}\n${reloadLine}`);
    },
    [load],
  );

  useEffect(() => {
    if (!confirmedSymbol) return;
    if (lastFreshnessCheckRef.current === confirmedSymbol) return;

    lastFreshnessCheckRef.current = confirmedSymbol;
    onSymbolChange?.(confirmedSymbol);

    void checkDataFreshness(confirmedSymbol);
  }, [confirmedSymbol, checkDataFreshness, onSymbolChange]);

  const handleResolveAndLoad = useCallback(async () => {
    const resolvedSymbol = await resolveTicker(symbol);

    if (!resolvedSymbol) {
      setError("No matching company found.");
      setSections([]);
      setSparkline([]);
      onSymbolChange?.("");
      return;
    }

    isTypingRef.current = false;
    setSymbol(resolvedSymbol);
    setConfirmedSymbol(resolvedSymbol);
    setError(null);

    await load(resolvedSymbol);
  }, [symbol, load, onSymbolChange]);

  const handleInputKeyDown = useCallback(
    async (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter" || loading) {
        return;
      }

      event.preventDefault();
      await handleResolveAndLoad();
    },
    [handleResolveAndLoad, loading],
  );

  const handleInputChange = useCallback((value: string) => {
    isTypingRef.current = true;
    setSymbol(value);
    setConfirmedSymbol("");
    setSections([]);
    setSparkline([]);
    setError(null);
    setBaseClose(null);
    setLivePrice(null);
  }, []);

  const pinCurrent = useCallback(async () => {
    const resolvedSymbol = (await resolveTicker(symbol)) ?? currentSymbol;
    if (!resolvedSymbol) return;

    setPinned((previous) => {
      if (previous.includes(resolvedSymbol)) {
        return previous;
      }

      return [...previous, resolvedSymbol].slice(0, MAX_PINNED_SYMBOLS);
    });
  }, [symbol, currentSymbol]);

  const removePinned = useCallback((targetSymbol: string) => {
    setPinned((previous) => previous.filter((item) => item !== targetSymbol));
  }, []);

  const switchPinned = useCallback(
    async (targetSymbol: string) => {
      const normalizedTarget = normalizeSymbol(targetSymbol);
      if (!normalizedTarget) return;

      isTypingRef.current = false;
      setSymbol(normalizedTarget);
      setConfirmedSymbol(normalizedTarget);
      setError(null);

      await load(normalizedTarget);
    },
    [load],
  );

  return (
    <div style={PANEL_STYLE}>
      <AnalyticsStyles />

      <div style={{ fontWeight: 600 }}>Analytics</div>

      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        {pinned.map((pinnedSymbol) => (
          <div
            key={pinnedSymbol}
            title={`Switch to ${pinnedSymbol}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid #333",
              borderRadius: 999,
              padding: "2px 6px",
              background: pinnedSymbol === confirmedSymbol ? "#111" : "transparent",
            }}
          >
            <button
              type="button"
              onClick={() => void switchPinned(pinnedSymbol)}
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
              {pinnedSymbol}
            </button>

            <button
              type="button"
              onClick={() => removePinned(pinnedSymbol)}
              title="Remove"
              aria-label={`Remove ${pinnedSymbol}`}
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
              x
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => void pinCurrent()}
          title={currentSymbol ? `Pin ${currentSymbol}` : "Pin current symbol"}
          disabled={!currentSymbol}
          style={{
            padding: "2px 8px",
            borderRadius: 999,
            border: "1px solid #333",
            background: "transparent",
            color: "inherit",
            cursor: currentSymbol ? "pointer" : "not-allowed",
            fontSize: 12,
            opacity: currentSymbol ? 1 : 0.5,
          }}
        >
          + Pin current
        </button>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          ref={inputRef}
          value={symbol}
          onKeyDown={(event) => void handleInputKeyDown(event)}
          onChange={(event) => handleInputChange(event.target.value)}
          placeholder="Symbol or name (e.g. AMZN or Amazon)"
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
          }}
        />

        <button
          type="button"
          onClick={clearPanel}
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
          x
        </button>

        <button
          type="button"
          onClick={() => void handleResolveAndLoad()}
          disabled={loading}
          title={currentSymbol ? `Load analytics for ${currentSymbol}` : "Load analytics"}
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

      {autoStatus && (
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            marginTop: 8,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255, 255, 255, 0.1)",
            background:
              "linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
            animation: isStatusExiting
              ? "analyticsFadeSlideOut 0.3s cubic-bezier(0.4, 0, 1, 1) forwards"
              : "analyticsFadeSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            whiteSpace: "pre-line",
            opacity: 0,
            transform: "translateY(-8px)",
          }}
        >
          {autoStatus}
        </div>
      )}

      {error && (
        <div role="alert" style={{ fontSize: 12, color: "#f87171", marginBottom: 8 }}>
          {error}
        </div>
      )}

      <div style={GRID_STYLE}>
        {sections.map((section) => (
          <div key={section.title} style={{ gridColumn: "1 / -1" }}>
            <SectionHeader section={section} />

            <div style={makeRowGrid(section.items.length)}>
              {loading
                ? section.items.map((metric) => (
                    <SkeletonCard key={`skeleton-${section.title}-${metric.label}`} label={metric.label} />
                  ))
                : section.items.map((metric) => (
                    <div key={`${section.title}-${metric.label}`} style={CARD_STYLE}>
                      <div style={{ fontSize: 10, opacity: 0.8 }}>{metric.label}</div>

                      <div
                        title={metric.hint}
                        style={{
                          fontSize: 16,
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "baseline",
                          gap: 6,
                        }}
                      >
                        <span className={fadeClass}>
                          {formatDisplayValue(metric.label, metric.value)}
                        </span>

                        {metric.label === "Price" &&
                          typeof livePrice === "number" &&
                          typeof baseClose === "number" &&
                          baseClose > 0 && (
                            <span
                              title={`Live vs last close: ${livePrice - baseClose >= 0 ? "+" : ""}${(
                                livePrice - baseClose
                              ).toFixed(2)}`}
                              style={{
                                fontSize: 12,
                                border: "1px solid #333",
                                borderRadius: 6,
                                padding: "0 6px",
                                color: livePrice - baseClose >= 0 ? "#22c55e" : "#f87171",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {(((livePrice - baseClose) / baseClose) * 100).toFixed(2)}%
                            </span>
                          )}
                      </div>

                      {metric.hint && (
                        <div style={HINT_STYLE} title={metric.hint}>
                          {metric.hint}
                        </div>
                      )}
                    </div>
                  ))}
            </div>
          </div>
        ))}
      </div>

      {sparkline.length > 0 && (
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
            <svg viewBox="0 0 600 60" preserveAspectRatio="none" width="100%" height="100%">
              <polyline
                points={buildPolyline(sparkline, 600, 50)}
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
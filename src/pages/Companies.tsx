import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import AnalyticsMiniPanel from "../components/AnalyticsMiniPanel";
import CompanyDiscovery from "../components/CompanyDiscovery";
import ConfirmDialog from "../components/ConfirmDialog";
import EditCompanyDialog from "../components/EditCompanyDialog";
import Notification from "../components/Notification";
import { useUserBalance } from "../hooks/useUserBalance";
import { fetchJson } from "../services/api/client";

type ToastType = "success" | "error" | "info";
type SortKey = "symbol" | "name" | "sector";
type SortDir = "asc" | "desc" | "none";

type CompanySummary = {
  id?: string | number;
  tickerId?: number;
  symbol?: string;
  name?: string | null;
  sector?: string | null;
  shares?: number | null;
  purchasePrice?: number | null;
  notes?: string | null;
  lastPriceUpdate?: string | null;
};

type SelectedCompany = {
  symbol: string;
  name: string;
  shares: number;
};

type DeleteTarget = {
  id: string | number;
  symbol: string;
};

type TransactionDto = {
  createdAt: string;
  shares: number;
  price: number | null;
  notes: string | null;
};

const styles = {
  page: {
    maxWidth: 1024,
    margin: "0 auto",
    padding: "16px",
  } satisfies CSSProperties,
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 8,
  } satisfies CSSProperties,
  title: {
    fontSize: 22,
    fontWeight: 600,
    margin: 0,
  } satisfies CSSProperties,
  toolbar: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    padding: "6px 0",
  } satisfies CSSProperties,
  control: {
    height: 36,
    lineHeight: "36px",
    minHeight: 0,
    boxSizing: "border-box",
    fontSize: 13,
    borderRadius: 10,
    padding: "0 10px",
  } satisfies CSSProperties,
  input: {
    minWidth: 220,
    background: "#fff",
    border: "1px solid #d4d4d8",
  } satisfies CSSProperties,
  select: {
    border: "1px solid #d4d4d8",
    background: "#fff",
  } satisfies CSSProperties,
  button: {
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid #d4d4d8",
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  disabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  } satisfies CSSProperties,
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 12,
    background: "#fff",
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  } satisfies CSSProperties,
  tableWrap: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    overflow: "auto",
    maxHeight: 420,
  } satisfies CSSProperties,
  table: {
    borderCollapse: "separate",
    borderSpacing: 0,
    width: "100%",
    tableLayout: "fixed",
  } satisfies CSSProperties,
  tableHead: {
    position: "sticky",
    top: 0,
    zIndex: 1,
    background: "#f8fafc",
  } satisfies CSSProperties,
  th: {
    textAlign: "left",
    padding: "8px 10px",
    fontSize: 13,
    borderBottom: "1px solid #e5e7eb",
    position: "sticky",
    top: 0,
    background: "#f8fafc",
    userSelect: "none",
  } satisfies CSSProperties,
  td: {
    padding: "8px 10px",
    fontSize: 13,
    borderBottom: "1px solid #f1f5f9",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  tdRight: {
    padding: "8px 10px",
    fontSize: 13,
    borderBottom: "1px solid #f1f5f9",
    whiteSpace: "nowrap",
    textAlign: "right",
  } satisfies CSSProperties,
  mono: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  } satisfies CSSProperties,
  chartCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 10,
    height: 280,
    background: "#fff",
  } satisfies CSSProperties,
  subTitle: {
    margin: "10px 0 6px 0",
    fontWeight: 600,
  } satisfies CSSProperties,
  footnote: {
    fontSize: 12,
    color: "#666",
    marginTop: 6,
  } satisfies CSSProperties,
  legendWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  } satisfies CSSProperties,
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    padding: "2px 8px",
    borderRadius: 9999,
    border: "1px solid #e5e7eb",
  } satisfies CSSProperties,
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    display: "inline-block",
  } satisfies CSSProperties,
};

const CHART_PALETTE = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#06b6d4",
  "#a855f7",
  "#f97316",
  "#0ea5e9",
  "#10b981",
  "#f43f5e",
  "#84cc16",
  "#6366f1",
];

function normalizeSymbol(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function getCompanyName(company: CompanySummary): string {
  const symbol = normalizeSymbol(company.symbol);
  const name = company.name?.trim();

  return name && name !== symbol ? name : "-";
}

function getSector(company: CompanySummary): string {
  return company.sector?.trim() || "Unknown";
}

function colorByIndex(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

function createActionButtonStyle(color: string): CSSProperties {
  return {
    padding: "2px 6px",
    borderRadius: 8,
    fontSize: 11,
    lineHeight: 1.2,
    cursor: "pointer",
    border: `1px solid ${color}`,
    background: `${color}1f`,
    color,
  };
}

function parseErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

export default function Companies() {
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const autoRefreshCheckedRef = useRef(false);

  const { cashBalance, deposit, withdraw, refreshBalance } = useUserBalance();

  const [items, setItems] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(25);
  const [sectorFilter, setSectorFilter] = useState("All");

  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortDir, setSortDir] = useState<SortDir>("none");

  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [removedSymbol, setRemovedSymbol] = useState<string | null>(null);

  const [notification, setNotification] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [removeBlockedSymbol, setRemoveBlockedSymbol] = useState<string | null>(null);
  const [tradeTarget, setTradeTarget] = useState<SelectedCompany | null>(null);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    setNotification({ message, type });
  }, []);

  const showNotification = useCallback((message: string, type: ToastType) => {
    setNotification({ message, type });
  }, []);

  const loadCompanies = useCallback(
    async (options?: { q?: string; limit?: number }) => {
      const activeQuery = options?.q ?? query;
      const activeLimit = options?.limit ?? limit;

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();

        if (activeQuery.trim()) {
          params.set("q", activeQuery.trim());
        }

        if (activeLimit > 0) {
          params.set("limit", String(activeLimit));
        }

        const path = `/api/UserCompany${params.toString() ? `?${params.toString()}` : ""}`;
        const data = await fetchJson<CompanySummary[]>({ path });

        setItems(Array.isArray(data) ? data : []);
      } catch (loadError) {
        setError(parseErrorMessage(loadError, "Failed to load companies."));
      } finally {
        setLoading(false);
      }
    },
    [limit, query],
  );

  const refreshAllProfiles = useCallback(async () => {
    const batchSize = 10;
    let rounds = 0;
    let totalUpdated = 0;
    let lastRemaining = 0;

    try {
      while (rounds < 50) {
        const result = await fetchJson<{ count: number; remaining?: number }>({
          path: `/api/companies/refresh-profiles?limit=${batchSize}`,
          method: "POST",
          timeoutMs: 45_000,
        });

        const updatedNow = result.count ?? 0;
        totalUpdated += updatedNow;
        lastRemaining = result.remaining ?? 0;

        if (updatedNow === 0) {
          break;
        }

        rounds += 1;
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }

      await loadCompanies({ q: query });

      return { totalUpdated, lastRemaining };
    } catch {
      return { totalUpdated, lastRemaining };
    }
  }, [loadCompanies, query]);

  const autoRefreshProfiles = useCallback(async () => {
    if (query.trim()) return;

    const missingProfiles = items.filter(
      (company) => !company.name?.trim() || !company.sector?.trim(),
    );

    if (missingProfiles.length === 0) return;

    showToast(`Updating ${missingProfiles.length} company profiles...`, "info");

    const { totalUpdated, lastRemaining } = await refreshAllProfiles();

    await new Promise((resolve) => window.setTimeout(resolve, 400));
    await loadCompanies({ q: query || undefined });

    if (lastRemaining > 0) {
      showToast(
        `Updated ${totalUpdated} company profiles, but ${lastRemaining} could not be refreshed due to provider limits.`,
        "info",
      );
    } else if (totalUpdated > 0) {
      showToast(`Updated ${totalUpdated} company profiles successfully.`, "success");
    }
  }, [items, loadCompanies, query, refreshAllProfiles, showToast]);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    if (loading || items.length === 0 || autoRefreshCheckedRef.current) {
      return;
    }

    autoRefreshCheckedRef.current = true;
    void autoRefreshProfiles();
  }, [autoRefreshProfiles, items.length, loading]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadCompanies({ q: query });
    }, 300);

    return () => window.clearTimeout(handle);
  }, [query, loadCompanies]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");

      if ((isMac ? event.metaKey : event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (event.key === "Escape" && document.activeElement === searchRef.current) {
        event.preventDefault();
        setQuery("");
        void loadCompanies({ q: "" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loadCompanies]);

  useEffect(() => {
    if (loading) return;

    const validSymbols = new Set(
      items.map((company) => normalizeSymbol(company.symbol)).filter(Boolean),
    );

    try {
      const rawPins = localStorage.getItem("analytics:pinned");
      const pins = rawPins ? (JSON.parse(rawPins) as unknown) : [];
      const normalizedPins = Array.isArray(pins)
        ? pins.map((item) => normalizeSymbol(String(item))).filter(Boolean)
        : [];

      const prunedPins = normalizedPins.filter((symbol) => validSymbols.has(symbol));

      if (prunedPins.length === 0) {
        localStorage.removeItem("analytics:pinned");
      } else if (JSON.stringify(prunedPins) !== JSON.stringify(normalizedPins)) {
        localStorage.setItem("analytics:pinned", JSON.stringify(prunedPins));
      }

      const lastSymbol = normalizeSymbol(localStorage.getItem("analytics:lastSymbol"));
      if (lastSymbol && !validSymbols.has(lastSymbol)) {
        localStorage.removeItem("analytics:lastSymbol");
      }
    } catch {
      localStorage.removeItem("analytics:pinned");
    }
  }, [items, loading]);

  const sectors = useMemo(() => {
    const uniqueSectors = new Set(items.map(getSector));
    return ["All", ...Array.from(uniqueSectors).sort()];
  }, [items]);

  const filteredItems = useMemo(() => {
    if (sectorFilter === "All") {
      return items;
    }

    return items.filter((company) => getSector(company) === sectorFilter);
  }, [items, sectorFilter]);

  const collator = useMemo(
    () => new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }),
    [],
  );

  const sortedItems = useMemo(() => {
    if (sortDir === "none") {
      return filteredItems;
    }

    const direction = sortDir === "asc" ? 1 : -1;
    const sorted = [...filteredItems];

    sorted.sort((a, b) => {
      const aValue = String(a[sortKey] ?? "").trim();
      const bValue = String(b[sortKey] ?? "").trim();

      if (!aValue && bValue) return 1;
      if (aValue && !bValue) return -1;
      if (!aValue && !bValue) return 0;

      return collator.compare(aValue, bValue) * direction;
    });

    return sorted;
  }, [collator, filteredItems, sortDir, sortKey]);

  const sectorData = useMemo(() => {
    const counts = new Map<string, number>();

    for (const company of filteredItems) {
      const sector = getSector(company);
      counts.set(sector, (counts.get(sector) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([sector, count]) => ({ sector, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredItems]);

  const toggleSort = useCallback(
    (key: SortKey) => {
      setSortKey(key);
      setSortDir((previous) => {
        if (sortKey !== key) return "asc";
        if (previous === "none") return "asc";
        if (previous === "asc") return "desc";
        return "none";
      });
    },
    [sortKey],
  );

  const sortIndicator = useCallback(
    (key: SortKey) => {
      if (sortKey !== key) return "";
      if (sortDir === "asc") return " ^";
      if (sortDir === "desc") return " v";
      return "";
    },
    [sortDir, sortKey],
  );

  const ariaSort = useCallback(
    (key: SortKey): "ascending" | "descending" | "none" => {
      if (sortKey !== key) return "none";
      if (sortDir === "asc") return "ascending";
      if (sortDir === "desc") return "descending";
      return "none";
    },
    [sortDir, sortKey],
  );

  const openAnalytics = useCallback((symbol: string) => {
    const normalizedSymbol = normalizeSymbol(symbol);
    if (normalizedSymbol) {
      setSelectedSymbol(normalizedSymbol);
    }
  }, []);

  const removeCompany = useCallback(
    async (target: DeleteTarget) => {
      try {
        setRemovedSymbol(target.symbol);
        window.setTimeout(() => setRemovedSymbol(null), 500);

        await fetchJson({
          path: `/api/UserCompany/${target.id}`,
          method: "DELETE",
        });

        await loadCompanies({ q: query });

        if (selectedSymbol === target.symbol) {
          setSelectedSymbol("");
        }

        setDeleteTarget(null);
        showNotification(`Company ${target.symbol} removed from your portfolio`, "success");
      } catch (removeError) {
        const message = parseErrorMessage(removeError, "Failed to remove company.");
        showNotification(message.includes("not found") ? `${target.symbol} not found` : message, "error");
      }
    },
    [loadCompanies, query, selectedSymbol, showNotification],
  );

  const handleCompanyAdded = useCallback(() => {
    void loadCompanies();
  }, [loadCompanies]);

  const handleTrade = useCallback(
    async (data: { shares: number; purchasePrice?: number | null; notes: string }) => {
      if (!tradeTarget) return;

      try {
        const finalPrice =
          typeof data.purchasePrice === "number" && data.purchasePrice > 0
            ? data.purchasePrice
            : null;

        const totalValue = Math.abs(data.shares) * (finalPrice ?? 0);

        if (data.shares > 0 && cashBalance != null && totalValue > cashBalance + 0.0001) {
          showToast("Insufficient funds.", "error");
          return;
        }

        const transaction = await fetchJson<
          TransactionDto,
          { symbol: string; shares: number; price: number | null; notes: string }
        >({
          path: "/api/UserCompanyTransactions",
          method: "POST",
          body: {
            symbol: tradeTarget.symbol,
            shares: data.shares,
            price: finalPrice,
            notes: data.notes,
          },
        });

        if (data.shares > 0) {
          await withdraw(totalValue);
        } else if (data.shares < 0) {
          await deposit(totalValue);
        }

        await refreshBalance();
        await loadCompanies({ q: query });

        const action = data.shares > 0 ? "Bought" : "Sold";
        const shareCount = Math.abs(data.shares);
        const priceText = transaction.price ? `$${transaction.price.toFixed(2)}` : "unknown price";

        showToast(`${action} ${shareCount} x ${tradeTarget.symbol} @ ${priceText}`, "success");
      } catch (tradeError) {
        showToast(parseErrorMessage(tradeError, "Transaction failed."), "error");
      } finally {
        setTradeTarget(null);
      }
    },
    [
      cashBalance,
      deposit,
      loadCompanies,
      query,
      refreshBalance,
      showToast,
      tradeTarget,
      withdraw,
    ],
  );

  const handleSortableHeaderKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTableCellElement>, key: SortKey) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleSort(key);
      }
    },
    [toggleSort],
  );

  if (error) {
    return (
      <div style={styles.page}>
        <p style={{ color: "red" }}>Error: {error}</p>
        <button type="button" style={styles.button} onClick={() => void loadCompanies({ q: query })}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <CompanyDiscovery
        onCompanyAdded={handleCompanyAdded}
        onNotification={showNotification}
        removedSymbol={removedSymbol}
      />

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      <div style={styles.headerRow}>
        <h2 style={styles.title}>Companies</h2>

        <div style={styles.toolbar}>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search by symbol or name..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{ ...styles.control, ...styles.input }}
            aria-label="Search companies"
          />

          <span style={{ minWidth: 120, fontSize: 12, color: "#666" }} aria-live="polite">
            {loading
              ? "Searching..."
              : `${sortedItems.length} result${sortedItems.length === 1 ? "" : "s"}`}
          </span>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            Rows
            <select
              value={limit}
              onChange={(event) => {
                const nextLimit = Number(event.target.value);
                setLimit(nextLimit);
                void loadCompanies({ q: query, limit: nextLimit });
              }}
              style={{ ...styles.control, ...styles.select }}
              aria-label="Rows per request"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            Sector
            <select
              value={sectorFilter}
              onChange={(event) => setSectorFilter(event.target.value)}
              style={{ ...styles.control, ...styles.select }}
              aria-label="Filter by sector"
            >
              {sectors.map((sector) => (
                <option key={sector} value={sector}>
                  {sector}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {items.length > 0 ? (
        <div style={{ ...styles.card, padding: 0, marginTop: 6 }}>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <colgroup>
                <col style={{ width: "12%" }} />
                <col style={{ width: "24%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "18%" }} />
              </colgroup>

              <thead style={styles.tableHead}>
                <tr>
                  <th
                    style={styles.th}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSort("symbol")}
                    onKeyDown={(event) => handleSortableHeaderKeyDown(event, "symbol")}
                    aria-sort={ariaSort("symbol")}
                    title="Sort by symbol"
                  >
                    Symbol{sortIndicator("symbol")}
                  </th>
                  <th
                    style={styles.th}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSort("name")}
                    onKeyDown={(event) => handleSortableHeaderKeyDown(event, "name")}
                    aria-sort={ariaSort("name")}
                    title="Sort by name"
                  >
                    Name{sortIndicator("name")}
                  </th>
                  <th
                    style={styles.th}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSort("sector")}
                    onKeyDown={(event) => handleSortableHeaderKeyDown(event, "sector")}
                    aria-sort={ariaSort("sector")}
                    title="Sort by sector"
                  >
                    Sector{sortIndicator("sector")}
                  </th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Shares</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Avg Price</th>
                  <th style={{ ...styles.th, textAlign: "right" }} aria-label="Row actions" />
                </tr>
              </thead>

              <tbody>
                {sortedItems.map((company, index) => {
                  const symbol = normalizeSymbol(company.symbol);
                  const isSelected = selectedSymbol === symbol;
                  const rowKey = company.id ?? `${symbol}-${index}`;
                  const companyName = getCompanyName(company);

                  return (
                    <tr
                      key={rowKey}
                      data-symbol={symbol}
                      onClick={() => openAnalytics(symbol)}
                      aria-selected={isSelected || undefined}
                      style={{
                        cursor: symbol ? "pointer" : "default",
                        ...(isSelected ? { background: "rgba(59, 130, 246, 0.08)" } : {}),
                      }}
                    >
                      <td style={{ ...styles.td, ...styles.mono }}>
                        {symbol ? <strong>{symbol}</strong> : "-"}
                      </td>
                      <td style={styles.td}>{companyName}</td>
                      <td style={styles.td}>{getSector(company)}</td>
                      <td style={styles.tdRight}>{company.shares ?? 0}</td>

                      <td style={styles.tdRight}>
                        {(company.shares ?? 0) > 0 && typeof company.purchasePrice === "number" && company.purchasePrice > 0
                          ? `$${company.purchasePrice.toFixed(2)}`
                          : "-"}
                      </td>

                      <td
                        style={{
                          ...styles.tdRight,
                          minWidth: 170,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            alignItems: "center",
                            justifyContent: "flex-end",
                            minHeight: 20,
                          }}
                        >
                          {isSelected && (
                            <>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setTradeTarget({
                                    symbol,
                                    name: companyName === "-" ? symbol : companyName,
                                    shares: company.shares ?? 0,
                                  });
                                }}
                                title={`Trade ${symbol}`}
                                aria-label={`Trade ${symbol}`}
                                style={createActionButtonStyle("#2563eb")}
                              >
                                Trade
                              </button>

                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  navigate(`/company/${symbol}`);
                                }}
                                title={`Open details for ${symbol}`}
                                aria-label={`Open details for ${symbol}`}
                                style={createActionButtonStyle("#16a34a")}
                              >
                                Details
                              </button>

                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();

                                  if ((company.shares ?? 0) > 0) {
                                  setRemoveBlockedSymbol(symbol);
                                  return;
                                }

                                  if (company.id != null) {
                                    setDeleteTarget({ id: company.id, symbol });
                                  }
                                }}
                                disabled={company.id == null}
                                title={
                                  (company.shares ?? 0) > 0
                                    ? "Sell all shares before removing this company"
                                    : `Remove ${symbol} from your portfolio`
                                }
                                aria-label={`Remove ${symbol} from your portfolio`}
                                style={{
                                  ...createActionButtonStyle("#dc2626"),
                                  ...(company.id == null ? styles.disabled : {}),
                                }}
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ ...styles.card, marginTop: 6 }}>
          <p style={{ margin: 0, marginBottom: 8 }}>No companies found.</p>
          <button
            type="button"
            style={styles.button}
            onClick={() => void loadCompanies({ q: "" })}
            title="Reload full list"
          >
            Reload list
          </button>
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        <AnalyticsMiniPanel initialSymbol={selectedSymbol} onSymbolChange={setSelectedSymbol} />
      </div>

      {sectorData.length >= 2 && (
        <div style={{ ...styles.card, marginTop: 14 }}>
          <h3 style={styles.subTitle}>Companies per Sector</h3>

          <div style={styles.chartCard}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sectorData}
                  dataKey="count"
                  nameKey="sector"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  stroke="#ffffff"
                  strokeWidth={1}
                  label={({ name }) => String(name)}
                  labelLine
                >
                  {sectorData.map((entry, index) => (
                    <Cell key={`cell-${entry.sector}-${index}`} fill={colorByIndex(index)} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={styles.legendWrap} aria-label="Sector legend">
            {sectorData.map((entry, index) => (
              <div key={entry.sector} style={styles.legendItem} title={entry.sector}>
                <span
                  style={{ ...styles.legendSwatch, background: colorByIndex(index) }}
                  aria-hidden="true"
                />
                <span>{entry.sector}</span>
              </div>
            ))}
          </div>

          <p style={styles.footnote}>
            Counts are derived from the current table data. Empty or missing sectors are grouped as{" "}
            <em>Unknown</em>.
          </p>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          isOpen
          title="Confirm Delete"
          message={`Are you sure you want to remove ${deleteTarget.symbol} from your portfolio?`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
          onConfirm={() => void removeCompany(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {removeBlockedSymbol && (
        <ConfirmDialog
          isOpen
          title="Cannot Remove Position"
          message={`Sell all shares of ${removeBlockedSymbol} before removing it from your portfolio.`}
          confirmText="OK"
          cancelText="Cancel"
          variant="warning"
          onConfirm={() => setRemoveBlockedSymbol(null)}
          onCancel={() => setRemoveBlockedSymbol(null)}
        />
      )}

      {tradeTarget && (
        <EditCompanyDialog
          symbol={tradeTarget.symbol}
          name={tradeTarget.name}
          currentShares={tradeTarget.shares}
          onCancel={() => setTradeTarget(null)}
          onConfirm={(data) => void handleTrade(data)}
        />
      )}
    </div>
  );
}
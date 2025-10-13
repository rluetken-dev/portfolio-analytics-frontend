// src/pages/Companies.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { CSSProperties } from "react";
import { fetchJson } from "../services/api/client";
import { Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { useNavigate } from "react-router-dom";
import CompanyDiscovery from "../components/CompanyDiscovery";
import Notification from "../components/Notification";
import ConfirmDialog from "../components/ConfirmDialog";
import EditCompanyDialog from "../components/EditCompanyDialog";
import InlineToast from "../components/InlineToast";

//import { getCurrentPrice } from "../services/api/quotes";

// English comment: add the small analytics panel component
import AnalyticsMiniPanel from "../components/AnalyticsMiniPanel";

/** ---------------------------------------------------------------
 * Local UI styles (compact, card-like, no extra dependencies)
 * --------------------------------------------------------------- */
const styles = {
  page: { maxWidth: 1024, margin: "0 auto", padding: "16px" },
  headerRow: {
    display: "flex",
    alignItems: "wrap",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: 600, margin: 0 },
  toolbar: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    padding: "6px 0", // EN: more breathing room
  },

  control: {
    height: 36,
    lineHeight: "36px",
    minHeight: 0,
    boxSizing: "border-box",
    fontSize: 13,
    borderRadius: 10,
    padding: "0 10px",
  } as CSSProperties,

  input: {
    padding: "0 10px",
    background: "#fff",
    border: "1px solid #d4d4d8",
  } as CSSProperties,

  select: {
    padding: "0 8px",
    border: "1px solid #d4d4d8",
    WebkitAppearance: "none",
    MozAppearance: "none",
    appearance: "none",
  } as CSSProperties,

  btn: {
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
  } as CSSProperties,
  btnDisabled: { opacity: 0.55, cursor: "not-allowed" } as CSSProperties,
  btnSoft: { background: "#fafafa" } as CSSProperties,

  // Card wrapper for table and chart
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 12,
    background: "#fff",
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  } as CSSProperties,

  // Scrollable table container with sticky header
  tableWrap: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
    maxHeight: 420,
    overflowY: "auto",
  } as CSSProperties,
  table: {
    borderCollapse: "separate" as const,
    borderSpacing: 0,
    width: "100%",
  } as CSSProperties,
  thead: { position: "sticky", top: 0, zIndex: 1, background: "#f8fafc" } as CSSProperties,
  th: {
    textAlign: "left",
    padding: "8px 10px",
    fontSize: 13,
    borderBottom: "1px solid #e5e7eb",
    position: "sticky",
    top: 0,
    background: "#f8fafc",
  } as CSSProperties,
  td: {
    padding: "8px 10px",
    fontSize: 13,
    borderBottom: "1px solid #f1f5f9",
    whiteSpace: "nowrap",
  } as CSSProperties,
  tdRight: {
    padding: "8px 10px",
    fontSize: 13,
    borderBottom: "1px solid #f1f5f9",
    whiteSpace: "nowrap",
    textAlign: "right",
  } as CSSProperties,
  mono: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  } as CSSProperties,

  chartCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 10,
    height: 280,
    background: "#fff",
  } as CSSProperties,
  subTitle: { margin: "10px 0 6px 0", fontWeight: 600 } as CSSProperties,
  footnote: { fontSize: 12, color: "#666", marginTop: 6 } as CSSProperties,

  legendWrap: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 } as CSSProperties,
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    padding: "2px 8px",
    borderRadius: 9999,
    border: "1px solid #e5e7eb",
  } as CSSProperties,
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    display: "inline-block",
  } as CSSProperties,

  clearSlot: { width: 76, display: "inline-flex", justifyContent: "center" } as CSSProperties,
  statusSlot: { minWidth: 80, fontSize: 12, color: "#666" } as CSSProperties,
} as const;

/** EN: Simple categorical palette (wraps via modulo). */
const CHART_PALETTE = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#f7e19fff",
  "#06b6d4",
  "#a855f7",
  "#f97316",
  "#0ea5e9",
  "#10b981",
  "#f43f5e",
  "#84cc16",
  "#6366f1",
];

/** EN: Deterministic color by slice index (stable via order). */
const colorByIndex = (i: number): string => CHART_PALETTE[i % CHART_PALETTE.length];

/** ------------------------------------------------------------------
 * Shape returned by backend /api/companies (+ refresh-profile)
 * ------------------------------------------------------------------ */
type CompanySummary = {
  id?: string;
  symbol?: string;
  name?: string;
  sector?: string;
  shares: number;
  lastPriceUpdate?: string | null;
};

export default function Companies() {
  // Local state: list, loading, error, row-level refreshing, and batch state
  const [items, setItems] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState<string>("");
  const [limit, setLimit] = useState<number>(25); // EN: adjustable server page size
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error" | "info">("success");

  const [sectorFilter, setSectorFilter] = useState<string>("All"); // EN: Sector filter (All = no filter)

  interface SelectedCompany {
    symbol: string;
    name: string;
    shares: number;
  }

  const [buyDialogCompany, setBuyDialogCompany] = useState<SelectedCompany | null>(null);

  // English: selected symbol to show in the analytics panel
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");

  // Signal for child component (CompanyDiscovery) when something was deleted
  const [removedSymbol, setRemovedSymbol] = useState<string | null>(null);

  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // State for delete confirmation dialog
  // Store both the open state and the specific company being deleted (with ID)
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    symbol: string;
    id: string | number; // ✅ Include UserCompany ID for correct deletion
  } | null>(null);

  // English: anchor to scroll the analytics panel into view (optional)
  const analyticsRef = useRef<HTMLDivElement | null>(null);

  // English: set clicked symbol; scrolling will be handled by an effect
  const openAnalytics = (sym: string): void => {
    const up = (sym ?? "").trim().toUpperCase();
    if (!up) return;
    setSelectedSymbol(up);
  };

  // Ref for focusing the search input via keyboard shortcut
  const searchRef = useRef<HTMLInputElement>(null);

  /** Helper to refetch the list (centralizes side-effects).
   *  Pure server-side search via ?q=... (symbol OR name, case-insensitive) */
  const load = useCallback(
    async (opts?: { q?: string; limit?: number }) => {
      setLoading(true);
      setError(null);
      try {
        const raw = opts?.q?.trim() ?? query.trim(); // ✅ fallback to current query
        const lim = opts?.limit ?? limit;

        const params = new URLSearchParams();
        if (raw) params.set("q", raw);
        if (lim) params.set("limit", String(lim));

        const basePath = "/api/UserCompany";
        const path = params.toString() ? `${basePath}?${params.toString()}` : basePath;

        const data = await fetchJson<CompanySummary[]>({ path });
        setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [limit, query], // ✅ query added
  );

  // English: Refresh all missing company profiles (server-driven batch, polite pacing)
  const refreshAllProfiles = useCallback(async () => {
    try {
      const batchSize = 10; // small polite batch to avoid API overload
      let rounds = 0;
      let totalUpdated = 0;
      let lastRemaining = 0;

      while (rounds < 50) {
        const res = await fetchJson<{ count: number; remaining?: number }>({
          path: `/api/companies/refresh-profiles?limit=${batchSize}`,
          method: "POST",
          timeoutMs: 45_000,
        });

        const updatedNow = res?.count ?? 0;
        totalUpdated += updatedNow;
        lastRemaining = res?.remaining ?? 0;

        console.log(
          `[refreshAllProfiles] round ${rounds + 1}: updated=${updatedNow}, remaining=${lastRemaining}`,
        );

        if (updatedNow === 0) break; // nothing more to refresh

        rounds += 1;
        await new Promise((r) => setTimeout(r, 250)); // polite delay between batches
      }

      await load({ q: query }); // reload current list after refresh

      console.log(
        `[refreshAllProfiles] finished: totalUpdated=${totalUpdated}, remaining=${lastRemaining}`,
      );

      // return these values for autoRefreshProfiles (future step)
      return { totalUpdated, lastRemaining };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Batch refresh failed: ${msg}`);
      return { totalUpdated: 0, lastRemaining: 0 };
    }
  }, [load, query]);

  // Automatically detect missing company metadata and trigger a background refresh
  const autoRefreshProfiles = useCallback(async () => {
    try {
      if (query.trim().length > 0) return; // don't auto-refresh during active search

      // English: Find companies without name or sector
      const missing = items.filter((c) => !c.name?.trim() || !c.sector?.trim());

      if (missing.length === 0) return; // nothing to update

      // English: Notify user that background update starts
      setToastType("info");
      setToastMsg(`Updating ${missing.length} company profiles...`);

      // English: Trigger background batch refresh
      const { totalUpdated, lastRemaining } = (await refreshAllProfiles()) ?? {
        totalUpdated: 0,
        lastRemaining: 0,
      };

      // 🧠 Ensure backend updates are committed before reload (small delay)
      await new Promise((r) => setTimeout(r, 400));

      // English: Now reload list with fresh data
      await load({ q: query || undefined });

      // English: Decide final message based on remaining count
      if (lastRemaining > 0) {
        // ⚠️ Inform user that API limit was reached
        setToastType("info");
        setToastMsg(
          `Updated ${totalUpdated} company profiles, but ${lastRemaining} could not be refreshed due to API limits. Please try again later.`,
        );
      } else if (totalUpdated > 0) {
        // ✅ Normal success case
        setToastType("success");
        setToastMsg(`Updated ${totalUpdated} company profiles successfully ✅`);
      } else {
        // ℹ️ Nothing needed update
        setToastType("info");
        setToastMsg("All company profiles are already up to date.");
      }
    } catch (err) {
      console.error("Auto refresh failed:", err);
      setToastType("error");
      setToastMsg("Profile auto-update failed.");
    }
  }, [items, load, query, refreshAllProfiles]);

  const showNotification = useCallback((message: string, type: "success" | "error" | "info") => {
    setNotification({ message, type });
  }, []);

  const hideNotification = useCallback(() => {
    setNotification(null);
  }, []);

  const handleCompanyAdded = useCallback(() => {
    void load(); // reload companies list
  }, [load]);

  // Initial load on mount
  useEffect(() => {
    void load();
  }, [load]);

  // After initial load, check if some profiles need auto-refresh
  useEffect(() => {
    // Run auto refresh only once after initial successful load
    if (!loading && items.length > 0) {
      const alreadyChecked = sessionStorage.getItem("autoRefreshDone");
      if (!alreadyChecked) {
        sessionStorage.setItem("autoRefreshDone", "1");
        void autoRefreshProfiles();
      }
    }
  }, [loading, items, autoRefreshProfiles]);

  /** EN: Debounced search-as-you-type (skip initial render). */
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return; // skip initial run
    }
    const handle = setTimeout(() => {
      void load({ q: query }); // EN: load reads current limit internally
    }, 300);
    return () => clearTimeout(handle);
  }, [query, load]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");

      // Ctrl/⌘ + K → Focus on search field
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      // Esc in the search field → clear + immediately load full list
      if (e.key === "Escape" && document.activeElement === searchRef.current) {
        e.preventDefault();
        setQuery("");
        void load({}); // EN: immediate return to the complete list
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [load]);

  /** Quick index to find/update rows by their symbol. */
  const indexBySymbol = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((c, i) => {
      if (c.symbol) map.set(c.symbol, i);
    });
    return map;
  }, [items]);

  /** Refresh a single profile (name + sector) by symbol. */
  const refreshProfile = async (symbol: string) => {
    if (!symbol) return;

    setRefreshing((m) => ({ ...m, [symbol]: true }));
    try {
      const updated = await fetchJson<CompanySummary>({
        path: `/api/companies/${encodeURIComponent(symbol)}/refresh-profile`,
        method: "POST",
      });
      if (updated?.symbol) {
        const idx = indexBySymbol.get(updated.symbol);
        if (idx !== undefined) {
          setItems((prev) => {
            const next = [...prev];
            next[idx] = { ...prev[idx], ...updated };
            return next;
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Failed to refresh ${symbol}: ${msg}`);
    } finally {
      setRefreshing((m) => ({ ...m, [symbol]: false }));
    }
  };

  // Remove a UserCompany safely after confirmation
  const removeCompany = useCallback(
    async (id: string | number, symbol: string) => {
      if (!id) return;

      try {
        // ✅ Trigger update signal for discovery component
        setRemovedSymbol(symbol.toUpperCase());
        setTimeout(() => setRemovedSymbol(null), 500);

        // ✅ Call correct endpoint to remove only the UserCompany relationship
        await fetchJson({
          path: `/api/UserCompany/${id}`,
          method: "DELETE",
        });

        // Refresh the companies list (optional — keeps state in sync)
        await load({ q: query });

        // Show success notification
        showNotification(`Company ${symbol} removed from your portfolio`, "success");

        // Clear selection if the removed company was selected
        if (selectedSymbol === symbol) {
          setSelectedSymbol("");
        }

        // Close the confirm dialog
        setConfirmDelete(null);
      } catch (error) {
        console.error("Remove failed:", error);

        // Show error notification
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("not found")) {
          showNotification(`Company ${symbol} not found in your portfolio`, "error");
        } else {
          showNotification(`Failed to remove ${symbol}`, "error");
        }
      }
    },
    [load, query, selectedSymbol, showNotification],
  );

  // EN: Unique sectors from current data (sorted, with "All" first)
  const sectors = useMemo(() => {
    const set = new Set<string>();
    for (const c of items) set.add(c.sector?.trim() || "Unknown");
    return ["All", ...Array.from(set).sort()];
  }, [items]);

  // EN: Apply sector filter before sorting
  const filteredItems = useMemo(() => {
    if (sectorFilter === "All") return items;
    return items.filter((c) => (c.sector?.trim() || "Unknown") === sectorFilter);
  }, [items, sectorFilter]);

  // EN: Sort state (column + direction)
  type SortKey = "symbol" | "name" | "sector";
  type SortDir = "asc" | "desc" | "none";

  // EN: Locale-aware, case-insensitive, natural sorting (e.g., A2 < A10)
  const collator = useMemo(
    () => new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }),
    [],
  );

  const [sortKey, setSortKey] = useState<SortKey>("symbol"); // EN: default
  const [sortDir, setSortDir] = useState<SortDir>("none"); // EN: none = as-loaded

  // EN: Toggle sort direction in a cycle: none -> asc -> desc -> none
  const toggleSort = (key: SortKey) => {
    setSortKey(key);
    setSortDir((prev) => {
      if (sortKey !== key) return "asc"; // EN: new column starts asc
      if (prev === "none") return "asc";
      if (prev === "asc") return "desc";
      return "none";
    });
  };

  // EN: Memoized sorted list (pure client-side)
  const sortedItems = useMemo(() => {
    const get = (c: CompanySummary, k: SortKey) => (c[k] ?? "").toString().trim();
    if (sortDir === "none") return filteredItems;

    const dir = sortDir === "asc" ? 1 : -1;
    const out = [...filteredItems];

    out.sort((a, b) => {
      const av = get(a, sortKey);
      const bv = get(b, sortKey);

      const aEmpty = av.length === 0;
      const bEmpty = bv.length === 0;
      if (aEmpty && !bEmpty) return 1; // EN: nulls/empties last
      if (!aEmpty && bEmpty) return -1;
      if (aEmpty && bEmpty) return 0;

      return collator.compare(av, bv) * dir; // EN: natural, locale-aware
    });

    return out;
  }, [filteredItems, sortKey, sortDir, collator]);

  // EN: sector aggregation should reflect current filter
  const sectorData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of filteredItems) {
      const key = c.sector?.trim() || "Unknown";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([sector, count]) => ({ sector, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredItems]);

  const navigate = useNavigate(); // imperative navigation handler

  // English: keep localStorage pins aligned with the current companies list
  useEffect(() => {
    if (loading) return; // wait until first load has finished

    // English: valid symbols from current table
    const valid = new Set(items.map((c) => (c.symbol ?? "").toUpperCase().trim()).filter(Boolean));

    // English: read & normalize current pins
    let pins: string[] = [];
    try {
      const raw = localStorage.getItem("analytics:pinned");
      pins = raw ? JSON.parse(raw) : [];
    } catch {
      // English: treat invalid JSON as no pins
      pins = [];
    }

    const norm = pins.map((s) => String(s).toUpperCase().trim()).filter(Boolean);
    const pruned = norm.filter((sym) => valid.has(sym));

    // English: write back only when needed
    if (pruned.length === 0) {
      localStorage.removeItem("analytics:pinned");
    } else if (JSON.stringify(pruned) !== JSON.stringify(norm)) {
      localStorage.setItem("analytics:pinned", JSON.stringify(pruned));
    }

    // English: clear lastSymbol if it is not present anymore
    const last = (localStorage.getItem("analytics:lastSymbol") ?? "").toUpperCase().trim();
    if (last && !valid.has(last)) {
      localStorage.removeItem("analytics:lastSymbol");
    }
  }, [items, loading]);

  // --- Render states ---
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;

  return (
    <div style={styles.page}>
      <CompanyDiscovery
        onCompanyAdded={handleCompanyAdded}
        onNotification={showNotification}
        removedSymbol={removedSymbol}
      />
      {/* Always show notification (if any), independent of charts */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={hideNotification}
        />
      )}
      {/* Header + actions */}
      <div style={styles.headerRow}>
        <h2 style={styles.title}>🏢 Companies</h2>
        <div style={styles.toolbar}>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search by symbol or name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              ...styles.control,
              ...styles.input,
              //minWidth: 50,
            }}
            aria-label="Search companies"
          />

          {/* EN: Status shows filtered+sorted count */}
          <span style={{ minWidth: 120, fontSize: 12, color: "#666" }} aria-live="polite">
            {loading
              ? "Searching…"
              : `${sortedItems.length} result${sortedItems.length === 1 ? "" : "s"}`}
          </span>

          {/* Rows selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label htmlFor="rows" style={{ fontSize: 12, color: "#666" }}>
              Rows
            </label>
            <select
              id="rows"
              value={limit}
              onChange={(e) => {
                const next = Number(e.target.value);
                setLimit(next);
                void load({ q: query, limit: next }); // EN: fetch immediately with new limit
              }}
              style={{
                ...styles.control,
                ...styles.select,
              }}
              aria-label="Rows per request"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>

          {/* EN: Sector filter dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label htmlFor="sector" style={{ fontSize: 12, color: "#666" }}>
              Sector
            </label>
            <select
              id="sector"
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              style={{
                ...styles.control,
                ...styles.select,
              }}
              aria-label="Filter by sector"
            >
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table card with scroll and sticky header */}
      {items.length > 0 ? (
        // ✅ Normal table
        <div style={{ ...styles.card, padding: 0, marginTop: 6 }}>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead style={styles.thead}>
                <tr>
                  <th
                    style={styles.th}
                    role="button"
                    tabIndex={0} // EN: focusable for keyboard
                    onClick={() => toggleSort("symbol")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") toggleSort("symbol");
                    }}
                    aria-sort={
                      sortKey === "symbol"
                        ? sortDir === "asc"
                          ? "ascending"
                          : sortDir === "desc"
                            ? "descending"
                            : "none"
                        : "none"
                    }
                    title="Sort by symbol"
                  >
                    Symbol{" "}
                    {sortKey === "symbol" &&
                      (sortDir === "asc" ? "▲" : sortDir === "desc" ? "▼" : "")}
                  </th>

                  <th
                    style={styles.th}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSort("name")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") toggleSort("name");
                    }}
                    aria-sort={
                      sortKey === "name"
                        ? sortDir === "asc"
                          ? "ascending"
                          : sortDir === "desc"
                            ? "descending"
                            : "none"
                        : "none"
                    }
                    title="Sort by name"
                  >
                    Name{" "}
                    {sortKey === "name" &&
                      (sortDir === "asc" ? "▲" : sortDir === "desc" ? "▼" : "")}
                  </th>

                  <th
                    style={styles.th}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSort("sector")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") toggleSort("sector");
                    }}
                    aria-sort={
                      sortKey === "sector"
                        ? sortDir === "asc"
                          ? "ascending"
                          : sortDir === "desc"
                            ? "descending"
                            : "none"
                        : "none"
                    }
                    title="Sort by sector"
                  >
                    Sector{" "}
                    {sortKey === "sector" &&
                      (sortDir === "asc" ? "▲" : sortDir === "desc" ? "▼" : "")}
                  </th>

                  {/* EN: Actions column header (align right) */}
                  <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((c, idx) => {
                  // Avoid duplicate symbol/name → show em dash if identical or empty
                  const safeName = c.name && c.name !== c.symbol ? c.name : "—";
                  const sym = String(c.symbol ?? "").toUpperCase(); // normalize once for stable comparisons
                  const isBusy = !!refreshing[sym];

                  // Show the refresh button only if profile data is incomplete.
                  const needsRefresh = !(c.name && c.name.trim()) || !(c.sector && c.sector.trim());

                  const isSelected = selectedSymbol?.toUpperCase() === sym; // selected row in the list

                  return (
                    <tr
                      key={c.id ?? `${c.symbol}-${idx}`}
                      data-sym={sym}
                      role="button"
                      tabIndex={0}
                      onClick={() => sym && openAnalytics(sym)}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && sym) openAnalytics(sym);
                      }}
                      aria-selected={isSelected || undefined}
                      style={{
                        cursor: sym ? "pointer" : "default",
                        ...(isSelected
                          ? { outline: "1px solid #555", background: "rgba(255,255,255,0.03)" }
                          : {}),
                      }}
                    >
                      <td style={{ ...styles.td, ...styles.mono }}>
                        {sym ? (
                          <button
                            type="button"
                            onClick={() => openAnalytics(sym)}
                            onKeyDown={(e) => {
                              // keyboard accessible (Enter/Space)
                              if (e.key === "Enter" || e.key === " ") openAnalytics(sym);
                            }}
                            title={`Open ${sym} analytics below`}
                            // make button look like plain text
                            style={{ all: "unset", cursor: "pointer", color: "inherit" }}
                            aria-label={`Open ${sym} analytics`}
                          >
                            <strong>{sym}</strong>
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td style={styles.td}>{safeName}</td>
                      <td style={styles.td}>{c.sector ?? "—"}</td>

                      {/* Actions: show buttons only when the row is currently selected */}
                      <td
                        style={{
                          ...styles.tdRight,
                          display: "flex", // lay out multiple actions nicely
                          gap: 6,
                          alignItems: "center",
                          justifyContent: "flex-end",
                        }}
                      >
                        {isSelected && (
                          <>
                            {/* Trade Button (Buy/Sell) */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // prevent triggering parent row click
                                setBuyDialogCompany({
                                  symbol: sym,
                                  name: c.name && c.name.trim() ? c.name : sym, // fallback if name missing
                                  shares: c.shares ?? 0,
                                });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.stopPropagation();
                                  setBuyDialogCompany({
                                    symbol: sym,
                                    name: c.name && c.name.trim() ? c.name : sym, // fallback if name missing
                                    shares: c.shares ?? 0,
                                  });
                                }
                              }}
                              title={`Trade ${sym}`}
                              aria-label={`Trade ${sym}`}
                              style={{
                                // neutral pill style
                                padding: "2px 6px",
                                borderRadius: 8,
                                fontSize: 11,
                                lineHeight: 1.2,
                                cursor: "pointer",

                                // neutral theme (blue-gray accent)
                                border: "1px solid #3b82f6",
                                background: "rgba(59, 130, 246, 0.12)",
                                color: "#e0f2fe",

                                // subtle animation
                                boxShadow: "0 0 0 0 rgba(59,130,246,0)",
                                transition: "box-shadow 120ms ease, transform 60ms ease",
                              }}
                              onMouseDown={(e) => {
                                e.currentTarget.style.transform = "translateY(1px)";
                                e.currentTarget.style.boxShadow = "0 0 0 2px rgba(59,130,246,0.25)";
                              }}
                              onMouseUp={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "0 0 0 0 rgba(59,130,246,0)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "0 0 0 0 rgba(59,130,246,0)";
                              }}
                            >
                              Trade
                            </button>

                            {/* Details Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // keep current row selection
                                navigate(`/company/${sym}`); // go to detail route /company/:symbol
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.stopPropagation();
                                  navigate(`/company/${sym}`);
                                }
                              }}
                              title={`Open details for ${sym}`}
                              aria-label={`Open details for ${sym}`}
                              style={{
                                // compact, unobtrusive action pill
                                padding: "2px 6px",
                                borderRadius: 8,
                                fontSize: 11,
                                lineHeight: 1.2,
                                cursor: "pointer",

                                // green accent to indicate buy action
                                border: "1px solid #22c55e",
                                background: "rgba(34, 197, 94, 0.12)",
                                color: "#dcfce7",

                                // small visual polish
                                boxShadow: "0 0 0 0 rgba(34,197,94,0)",
                                transition: "box-shadow 120ms ease, transform 60ms ease",
                              }}
                              onMouseDown={(e) => {
                                // quick press feedback without layout shift
                                e.currentTarget.style.transform = "translateY(1px)";
                                e.currentTarget.style.boxShadow = "0 0 0 2px rgba(34,197,94,0.25)";
                              }}
                              onMouseUp={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "0 0 0 0 rgba(34,197,94,0)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "0 0 0 0 rgba(34,197,94,0)";
                              }}
                            >
                              Details
                            </button>
                            {/* Remove Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDelete({ isOpen: true, id: c.id ?? 0, symbol: sym }); // ✅ fallback if id is undefined
                              }}
                              title={`Remove ${sym} from your portfolio`}
                              aria-label={`Remove ${sym} from your portfolio`}
                              style={{
                                padding: "2px 6px",
                                borderRadius: 8,
                                fontSize: 11,
                                lineHeight: 1.2,
                                cursor: "pointer",
                                border: "1px solid #ef4444",
                                background: "rgba(239, 68, 68, 0.12)",
                                color: "#fecaca",
                                boxShadow: "0 0 0 0 rgba(239,68,68,0)",
                                transition: "box-shadow 120ms ease, transform 60ms ease",
                              }}
                              onMouseDown={(e) => {
                                e.currentTarget.style.transform = "translateY(1px)";
                                e.currentTarget.style.boxShadow = "0 0 0 2px rgba(239,68,68,0.25)";
                              }}
                              onMouseUp={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "0 0 0 0 rgba(239,68,68,0)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "0 0 0 0 rgba(239,68,68,0)";
                              }}
                            >
                              Remove
                            </button>
                          </>
                        )}

                        {needsRefresh ? (
                          <button
                            disabled={!sym || isBusy}
                            onClick={(e) => {
                              e.stopPropagation(); // prevent row click
                              refreshProfile(sym);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") e.stopPropagation();
                            }}
                            title="Fetch name & sector from FMP and store in the database"
                            style={{
                              ...styles.btn,
                              ...(isBusy || !sym ? styles.btnDisabled : {}),
                            }}
                          >
                            {isBusy ? "Refreshing…" : "Refresh profile"}
                          </button>
                        ) : (
                          <span title="Profile up to date">✓</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // 🚫 Empty state Reload
        <div style={{ ...styles.card, marginTop: 6 }}>
          <p style={{ margin: 0, marginBottom: 8 }}>No companies found.</p>
          <button
            type="button"
            style={{ ...styles.btn }}
            onClick={() => void load({})}
            title="Reload full list"
          >
            Reload list
          </button>
        </div>
      )}

      {/* English: in-page analytics anchor (always present) */}
      <div ref={analyticsRef} style={{ marginTop: 12 }} />

      {/* English: render the panel only when a symbol is selected */}
      <div style={{ marginTop: 8 }}>
        <AnalyticsMiniPanel initialSymbol={selectedSymbol} onSymbolChange={setSelectedSymbol} />
      </div>

      {/* Chart card: Companies per Sector (only if we have at least 2 sectors) */}
      {sectorData.length >= 2 && (
        <div style={{ ...styles.card, marginTop: 14 }}>
          <h3 style={styles.subTitle}>📊 Companies per Sector</h3>
          <div style={styles.chartCard}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sectorData}
                  dataKey="count"
                  nameKey="sector"
                  innerRadius={60} // EN: donut style for readability
                  outerRadius={100}
                  paddingAngle={2} // EN: small gap between slices
                  stroke="#ffffff"
                  strokeWidth={1}
                  label={({ name }) => String(name)} // EN: show sector name on slices
                  labelLine
                >
                  {sectorData.map((d, i) => (
                    <Cell key={`cell-${d.sector}-${i}`} fill={colorByIndex(i)} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Simple legend */}
          {sectorData.length > 0 && (
            <div style={styles.legendWrap} aria-label="Sector legend">
              {sectorData.map((d, i) => (
                <div key={d.sector} style={styles.legendItem} title={d.sector}>
                  <span
                    style={{ ...styles.legendSwatch, background: colorByIndex(i) }}
                    aria-hidden="true"
                  />
                  <span>{d.sector}</span>
                </div>
              ))}
            </div>
          )}

          <p style={styles.footnote}>
            *Counts are derived from the current table data. Empty/missing sectors are grouped as{" "}
            <em>Unknown</em>.
          </p>
        </div>
      )}
      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <ConfirmDialog
          isOpen={confirmDelete.isOpen}
          title="Confirm Delete"
          message={`Are you sure you want to remove ${confirmDelete.symbol} from the database? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
          onConfirm={() => {
            removeCompany(confirmDelete.id, confirmDelete.symbol);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {/* Trade Dialog (Buy/Sell) */}
      {buyDialogCompany && (
        <EditCompanyDialog
          symbol={buyDialogCompany.symbol}
          name={buyDialogCompany.name}
          currentShares={buyDialogCompany.shares ?? 0}
          onCancel={() => setBuyDialogCompany(null)}
          onConfirm={async (data) => {
            // 🧱 Define DTO for response typing
            interface TransactionDto {
              createdAt: string;
              shares: number;
              price: number | null;
              notes: string | null;
            }

            try {
              const finalPrice =
                data.purchasePrice && data.purchasePrice > 0 ? data.purchasePrice : null;

              // ✅ Use typed fetchJson<TResponse, TBody>
              const result = await fetchJson<
                TransactionDto,
                {
                  symbol: string;
                  shares: number;
                  price: number | null;
                  notes: string;
                }
              >({
                path: "/api/UserCompanyTransactions",
                method: "POST",
                body: {
                  symbol: buyDialogCompany.symbol,
                  shares: data.shares,
                  price: finalPrice,
                  notes: data.notes,
                },
              });

              // ✅ Success feedback
              const action = data.shares > 0 ? "Bought" : "Sold";
              const shareCount = Math.abs(data.shares);
              const priceText = result.price ? `$${result.price.toFixed(2)}` : "unknown price";
              const message = `${action} ${shareCount} × ${buyDialogCompany.symbol} @ ${priceText}`;

              setToastType("success");
              setToastMsg(message);
            } catch (error: unknown) {
              console.error("🔥 API Transaction Error:", error);

              // Default fallback message
              let message = "Transaction failed.";

              // 🧩 Type-safe extraction of message
              if (typeof error === "string") {
                message = error;
              } else if (error instanceof Error) {
                message = error.message;
              } else if (
                error !== null &&
                typeof error === "object" &&
                "message" in error &&
                typeof (error as Record<string, unknown>).message === "string"
              ) {
                message = (error as Record<string, unknown>).message as string;
              }

              // 🧠 Map backend messages to user-friendly texts
              if (message.includes("Insufficient shares")) {
                message = "You cannot sell more shares than you currently own.";
              } else if (message.includes("Unauthorized")) {
                message = "Your session has expired. Please log in again.";
              } else if (message.includes("not found")) {
                message = "The requested company could not be found.";
              }

              // 🔴 Show styled error toast
              setToastType("error");
              setToastMsg(message);
            } finally {
              setBuyDialogCompany(null);
            }
          }}
        />
      )}
      {toastMsg && (
        <InlineToast message={toastMsg} type={toastType} onClose={() => setToastMsg(null)} />
      )}
    </div>
  );
}

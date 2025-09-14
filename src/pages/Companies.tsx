// src/pages/Companies.tsx
import React, { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "../services/api/client";

// Recharts for charts
import { Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";

/** ---------------------------------------------------------------
 * Local UI styles (compact, card-like, no extra dependencies)
 * --------------------------------------------------------------- */
const styles = {
  page: { maxWidth: 1024, margin: "0 auto", padding: "16px" },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: 600, margin: 0 },
  toolbar: { display: "flex", gap: 8 },

  // Button styles (compact)
  btn: {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid #d4d4d8",
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
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
    maxHeight: 420, // <- scroll inside after ~15-18 rows
    overflowY: "auto",
  } as CSSProperties,

  table: {
    borderCollapse: "separate" as const, // TS: needs literal type
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

  // Chart
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

/** EN: Deterministic sector → color mapping (add your live sectors). */
const SECTOR_COLORS: Record<string, string> = {
  Technology: "#3b82f6",
  "Consumer Cyclical": "#f59e0b",
  "Consumer Defensive": "#22c55e",
  Healthcare: "#ef4444",
  Financial: "#8b5cf6",
  "Financial Services": "#8b5cf6",
  Industrials: "#14b8a6",
  Energy: "#eab308",
  Utilities: "#06b6d4",
  Materials: "#a855f7",
  "Real Estate": "#f97316",
  Communication: "#0ea5e9",
  "Communication Services": "#0ea5e9",
  Unknown: "#6b7280",
};

/** EN: Normalize and pick a color; fallback to gray. */
function colorForSector(name?: string): string {
  const key = (name || "Unknown").trim();
  return SECTOR_COLORS[key] ?? SECTOR_COLORS[key.replace(/\s+/g, " ")] ?? "#6b7280";
}

/** ------------------------------------------------------------------
 * Shape returned by backend /api/companies (+ refresh-profile)
 * ------------------------------------------------------------------ */
type CompanySummary = {
  id?: string;
  symbol?: string;
  name?: string;
  sector?: string;
};

export default function Companies() {
  // Local state: list, loading, error, row-level refreshing, and batch state
  const [items, setItems] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const [batchBusy, setBatchBusy] = useState(false);
  const [query, setQuery] = useState<string>("");

  /** Helper to refetch the list (centralizes side-effects).
   *  EN: Pure server-side search via ?q=... (symbol OR name, case-insensitive) */
  const load = async (opts?: { q?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const raw = opts?.q?.trim() ?? "";
      const params = new URLSearchParams();
      if (raw) params.set("q", raw);

      const path = params.toString() ? `/api/companies?${params.toString()}` : `/api/companies`;
      const data = await fetchJson<CompanySummary[]>({ path });

      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Initial load on mount
  useEffect(() => {
    void load();
  }, []);

  /** EN: Debounced search-as-you-type (skip initial render). */
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return; // initial load already happened above
    }
    const handle = setTimeout(() => {
      void load({ q: query });
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

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

  /** Batch: refresh multiple profiles (server decides which; limit is a hint). */
  const refreshAllProfiles = async () => {
    setBatchBusy(true);
    try {
      await fetchJson<{ count: number; items?: CompanySummary[] }>({
        path: `/api/companies/refresh-profiles?limit=100`,
        method: "POST",
      });
      await load({ q: query }); // reload with current filter
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Batch refresh failed: ${msg}`);
    } finally {
      setBatchBusy(false);
    }
  };

  /** Compute sector aggregation for visualization (desc by count). */
  const sectorData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of items) {
      const key = c.sector?.trim() || "Unknown";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([sector, count]) => ({ sector, count }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  // --- Render states ---
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;

  return (
    <div style={styles.page}>
      {/* Header + actions */}
      <div style={styles.headerRow}>
        <h2 style={styles.title}>🏢 Companies</h2>
        <div style={styles.toolbar}>
          <input
            type="text"
            placeholder="Search by symbol or name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid #d4d4d8",
              fontSize: 13,
              minWidth: 260,
            }}
            aria-label="Search companies"
          />

          {/* Fixed status width so that nothing jumps around */}
          <span style={{ minWidth: 80, fontSize: 12, color: "#666" }} aria-live="polite">
            {loading ? "Searching…" : " "}
          </span>

          <button
            onClick={() => void load({ q: query })}
            disabled={batchBusy}
            style={{ ...styles.btn, ...(batchBusy ? styles.btnDisabled : {}), ...styles.btnSoft }}
            title="Reload list from server"
          >
            Reload list
          </button>

          <button
            onClick={refreshAllProfiles}
            disabled={batchBusy}
            style={{ ...styles.btn, ...(batchBusy ? styles.btnDisabled : {}) }}
            title="Fetch Name & Sector for missing entries (server-driven batch)"
          >
            {batchBusy ? "Refreshing all…" : "Refresh all profiles"}
          </button>
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
                  <th style={styles.th}>Symbol</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Sector</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c, idx) => {
                  // EN: Avoid duplicate symbol/name → show em dash if identical or empty
                  const safeName = c.name && c.name !== c.symbol ? c.name : "—";
                  const sym = c.symbol ?? "";
                  const isBusy = !!refreshing[sym];

                  // EN: Show the refresh button only if profile data is incomplete.
                  const needsRefresh = !(c.name && c.name.trim()) || !(c.sector && c.sector.trim());

                  return (
                    <tr key={c.id ?? `${c.symbol}-${idx}`}>
                      <td style={{ ...styles.td, ...styles.mono }}>{c.symbol ?? "—"}</td>
                      <td style={styles.td}>{safeName}</td>
                      <td style={styles.td}>{c.sector ?? "—"}</td>
                      <td style={styles.tdRight}>
                        {needsRefresh ? (
                          <button
                            disabled={!sym || isBusy}
                            onClick={() => refreshProfile(sym)}
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
                  labelLine={{ length: 8 }}
                >
                  {sectorData.map((d, i) => (
                    <Cell key={`cell-${i}`} fill={colorForSector(d.sector)} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Simple legend */}
          {sectorData.length > 0 && (
            <div style={styles.legendWrap} aria-label="Sector legend">
              {sectorData.map((d) => (
                <div key={d.sector} style={styles.legendItem} title={d.sector}>
                  <span
                    style={{ ...styles.legendSwatch, background: colorForSector(d.sector) }}
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
    </div>
  );
}

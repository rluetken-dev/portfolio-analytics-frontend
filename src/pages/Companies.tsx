// src/pages/Companies.tsx
import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "../services/api/client";

// Shape returned by backend /api/companies (+ refresh-profile)
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

  // Helper to refetch the list (so we can reuse it after batch updates)
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<CompanySummary[]>({ path: "/api/companies" });
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

  // A quick index to find/update rows by their symbol
  const indexBySymbol = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((c, i) => {
      if (c.symbol) map.set(c.symbol, i);
    });
    return map;
  }, [items]);

  // Call backend to refresh a single row (name + sector) for a symbol
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
      alert(`Failed to refresh ${symbol}: ${msg}`); // keep it simple for now
    } finally {
      setRefreshing((m) => ({ ...m, [symbol]: false }));
    }
  };

  // Batch: refresh multiple profiles (server decides which; we pass a limit)
  const refreshAllProfiles = async () => {
    setBatchBusy(true);
    try {
      // POST /api/companies/refresh-profiles?limit=100
      await fetchJson<{ count: number; items?: CompanySummary[] }>({
        path: `/api/companies/refresh-profiles?limit=100`,
        method: "POST",
      });

      // Reload the list so we see fresh Name/Sector everywhere
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Batch refresh failed: ${msg}`);
    } finally {
      setBatchBusy(false);
    }
  };

  // --- Render states ---
  if (loading) return <p>Loading companies…</p>;
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;
  if (!items.length) return <p>No companies found.</p>;

  return (
    <div>
      <h2>🏢 Companies</h2>

      {/* Batch action: refresh multiple profiles (server-driven) */}
      <div style={{ margin: "0.5rem 0 0.75rem 0" }}>
        <button
          title="Fetch Name & Sector for missing entries (server-driven batch)"
          onClick={refreshAllProfiles}
          disabled={batchBusy}
        >
          {batchBusy ? "Refreshing all…" : "Refresh all profiles"}
        </button>
      </div>

      {/* Basic table; later we can switch to a UI lib */}
      <table style={{ borderCollapse: "collapse", marginTop: "0.5rem" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "0.25rem 0.5rem", borderBottom: "1px solid #ccc" }}>
              Symbol
            </th>
            <th style={{ textAlign: "left", padding: "0.25rem 0.5rem", borderBottom: "1px solid #ccc" }}>
              Name
            </th>
            <th style={{ textAlign: "left", padding: "0.25rem 0.5rem", borderBottom: "1px solid #ccc" }}>
              Sector
            </th>
            <th style={{ textAlign: "left", padding: "0.25rem 0.5rem", borderBottom: "1px solid #ccc" }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((c, idx) => {
            // Avoid duplicate symbol/name → show em dash if identical or empty
            const safeName = c.name && c.name !== c.symbol ? c.name : "—";
            const sym = c.symbol ?? "";
            const isBusy = !!refreshing[sym];

            return (
              <tr key={c.id ?? `${c.symbol}-${idx}`}>
                <td style={{ padding: "0.25rem 0.5rem", borderBottom: "1px solid #eee" }}>
                  {c.symbol ?? "—"}
                </td>
                <td style={{ padding: "0.25rem 0.5rem", borderBottom: "1px solid #eee" }}>
                  {safeName}
                </td>
                <td style={{ padding: "0.25rem 0.5rem", borderBottom: "1px solid #eee" }}>
                  {c.sector ?? "—"}
                </td>
                <td style={{ padding: "0.25rem 0.5rem", borderBottom: "1px solid #eee" }}>
                  <button
                    disabled={!sym || isBusy}
                    onClick={() => refreshProfile(sym)}
                    title="Fetch name & sector from FMP and store in the database"
                  >
                    {isBusy ? "Refreshing…" : "Refresh profile"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

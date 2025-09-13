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
  // Local state: list, loading, error, and a small map to track row-level loading
  const [items, setItems] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});

  // A quick index to find/update rows by their symbol
  const indexBySymbol = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((c, i) => {
      if (c.symbol) map.set(c.symbol, i);
    });
    return map;
  }, [items]);

  // Initial load of companies
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const data = await fetchJson<CompanySummary[]>({ path: "/api/companies" });
        if (!isMounted) return;
        setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Call backend to refresh a single row (name + sector) for a symbol
  const refreshProfile = async (symbol: string) => {
    // Guard: symbol must exist
    if (!symbol) return;

    // Set row-level spinner/disabled state
    setRefreshing((m) => ({ ...m, [symbol]: true }));
    try {
      // POST /api/companies/{symbol}/refresh-profile
      const updated = await fetchJson<CompanySummary>({
        path: `/api/companies/${encodeURIComponent(symbol)}/refresh-profile`,
        method: "POST",
      });

      // Optimistically update the row in-place if we still have it in the list
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
      // Surface error in a simple way; for production you might show a toast
      alert(`Failed to refresh ${symbol}: ${msg}`);
    } finally {
      setRefreshing((m) => ({ ...m, [symbol]: false }));
    }
  };

  // --- Render states ---
  if (loading) return <p>Loading companies…</p>;
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;
  if (!items.length) return <p>No companies found.</p>;

  return (
    <div>
      <h2>🏢 Companies</h2>

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
                    // Keep it simple: disable while request in-flight
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

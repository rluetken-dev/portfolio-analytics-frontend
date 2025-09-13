// src/pages/Companies.tsx
import { useEffect, useState } from "react";
import { fetchJson } from "../services/api/client";

/**
 * Minimal type for listing companies.
 * Adjust fields later to match your backend DTO (e.g., ticker, name, sector, marketCap).
 */
type CompanySummary = {
  id?: string;       // optional until your backend DTO is defined
  symbol?: string;   // e.g., "AAPL"
  name?: string;     // e.g., "Apple Inc."
  sector?: string;   // e.g., "Technology"
};

export default function Companies() {
  // Local UI state
  const [items, setItems] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true; // guard to avoid state updates after unmount

    (async () => {
      try {
        // 🔗 Adjust path to your backend route once it's available.
        // Common choices: "/companies" or "/api/companies"
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

  // --- Render states (loading / error / empty / list) ---
  if (loading) return <p>Loading companies…</p>;

  if (error)
    return (
      <div>
        <h2>🏢 Companies</h2>
        <p style={{ color: "red" }}>Error: {error}</p>
        <p style={{ color: "gray" }}>
          If your backend route differs (e.g., <code>/api/companies</code>) or isn’t implemented yet,
          we’ll adjust the path or add a mock next.
        </p>
      </div>
    );

  if (!items.length)
    return (
      <div>
        <h2>🏢 Companies</h2>
        <p>No companies found.</p>
        <p style={{ color: "gray" }}>
          Once the backend endpoint is ready, this list will populate automatically.
        </p>
      </div>
    );

  return (
    <div>
      <h2>🏢 Companies</h2>

      {/* Very basic table; we’ll swap to a nicer UI later */}
      <table style={{ borderCollapse: "collapse", marginTop: "0.5rem" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "0.25rem 0.5rem", borderBottom: "1px solid #ccc" }}>Symbol</th>
            <th style={{ textAlign: "left", padding: "0.25rem 0.5rem", borderBottom: "1px solid #ccc" }}>Name</th>
            <th style={{ textAlign: "left", padding: "0.25rem 0.5rem", borderBottom: "1px solid #ccc" }}>Sector</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c, idx) => (
            <tr key={c.id ?? `${c.symbol}-${idx}`}>
              <td style={{ padding: "0.25rem 0.5rem", borderBottom: "1px solid #eee" }}>{c.symbol ?? "—"}</td>
              <td style={{ padding: "0.25rem 0.5rem", borderBottom: "1px solid #eee" }}>{c.name ?? "—"}</td>
              <td style={{ padding: "0.25rem 0.5rem", borderBottom: "1px solid #eee" }}>{c.sector ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

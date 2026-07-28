// src/components/company/CompanyHeader.tsx
import * as React from "react";

type CompanyRow = { symbol?: string; name?: string; sector?: string };

export default function CompanyHeader({ symbol }: { symbol: string }) {
  const sym = (symbol ?? "").trim().toUpperCase();

  const [name, setName] = React.useState<string | null>(null);
  const [sector, setSector] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [err, setErr] = React.useState<string | null>(null);

  const backendBase = "";

  React.useEffect(() => {
    let aborted = false;

    async function fetchMeta() {
      if (!sym) {
        setLoading(false);
        setName(null);
        setSector(null);
        return;
      }
      try {
        setLoading(true);
        setErr(null);

        // Fetch best match for this symbol (prefer exact, else first)
        const resp = await fetch(
          `${backendBase}/api/companies?q=${encodeURIComponent(sym)}&limit=5`,
          { headers: { Accept: "application/json" } },
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const raw = (await resp.json()) as unknown;
        const rows = Array.isArray(raw) ? (raw as CompanyRow[]) : [];

        const exact = rows.find((r) => String(r.symbol ?? "").toUpperCase() === sym);
        const pick = exact ?? rows[0];

        if (!aborted) {
          const nm = (pick?.name ?? "").trim();
          const sc = (pick?.sector ?? "").trim();
          setName(nm || sym); // fallback to symbol if no name
          setSector(sc || null);
        }
      } catch (e) {
        if (!aborted) {
          setErr(e instanceof Error ? e.message : String(e));
          setName(sym); // graceful fallback: still show the symbol
          setSector(null);
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    }

    fetchMeta();
    return () => {
      aborted = true;
    };
  }, [sym, backendBase]);

  // Reusable badge style
  const badge: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #333",
    background: "rgba(255,255,255,0.04)",
    fontSize: 12,
    whiteSpace: "nowrap",
  };

  return (
    <header>
      {/* Title with optional loading state */}
      <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.2 }}>
        {loading ? "Loading…" : name}{" "}
        {!loading && sym && <span style={{ opacity: 0.6, fontSize: 16 }}>({sym})</span>}
      </h1>

      {/* Meta badges under title */}
      <div
        style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
      >
        {sector && (
          <span title="Company sector" style={badge}>
            {sector}
          </span>
        )}
        {/* Future: currency chip (USD/EUR), exchange tag, freshness indicator */}
      </div>

      {/* Non-blocking error hint */}
      {err && <div style={{ marginTop: 6, fontSize: 12, color: "#f87171" }}>{err}</div>}
    </header>
  );
}

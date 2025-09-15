// src/services/api/quotes.ts

export async function getLatestCloseFromQuotes(symbol: string): Promise<{
  symbol: string;
  value: number | null;
  asOf?: string;
  adjusted?: boolean;
  source?: string;
  unit?: string;
}> {
  // English comments below:
  const sym = (symbol ?? "").trim().toUpperCase();
  if (!sym) return { symbol: sym, value: null };

  try {
    // Call backend directly (bypass Vite proxy during dev)
    const url = `http://localhost:5046/api/quotes/latest?symbol=${encodeURIComponent(sym)}&take=1`;

    const resp = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!resp.ok) {
      // Non-200: return null value (UI stays stable)
      return { symbol: sym, value: null };
    }

    const rows = (await resp.json()) as unknown;

    if (!Array.isArray(rows) || rows.length === 0) {
      return { symbol: sym, value: null };
    }

    const r = rows[0] as {
      date?: string;
      close?: number;
      adjustedClose?: number;
      source?: string;
    };

    const hasAdj = typeof r.adjustedClose === "number";
    const val = hasAdj
      ? (r.adjustedClose as number)
      : typeof r.close === "number"
        ? (r.close as number)
        : null;

    return {
      symbol: sym,
      value: val,
      asOf: r.date,
      adjusted: hasAdj,
      source: r.source,
      unit: "USD",
    };
  } catch (err) {
    console.error("[quotes] getLatestCloseFromQuotes failed:", err);
    return { symbol: sym, value: null };
  }
}

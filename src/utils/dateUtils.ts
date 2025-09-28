// English: read DB-latest date for anchoring the 180d window
export async function fetchLatestDateISO(baseUrl: string, symbol: string): Promise<string | null> {
  const qs = new URLSearchParams({ symbol });
  const resp = await fetch(`${baseUrl}/api/Quotes/latest?${qs.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) return null;

  const raw: unknown = await resp.json();
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    const d = o["date"] ?? o["Date"] ?? o["tradingDate"] ?? o["TradingDate"] ?? o["asOf"] ?? null;

    if (typeof d === "string" && d.length >= 10) {
      return d.slice(0, 10);
    }
  }
  return null;
}

export async function fetchLatestDateISO(symbol: string): Promise<string | null> {
  const normalizedSymbol = symbol.trim().toUpperCase();

  if (!normalizedSymbol) {
    return null;
  }

  const params = new URLSearchParams({ symbol: normalizedSymbol });

  const response = await fetch(`/api/Quotes/latest?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as unknown;

  if (typeof data !== "object" || data === null) {
    return null;
  }

  const row = data as Record<string, unknown>;
  const date = row.date ?? row.Date ?? row.tradingDate ?? row.TradingDate ?? row.asOf;

  return typeof date === "string" && date.length >= 10 ? date.slice(0, 10) : null;
}
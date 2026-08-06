export type FundamentalsPeriod = "annual" | "quarter";

export type StableSnapshot = {
  income?: unknown[];
  balance?: unknown[];
  cash?: unknown[];
  metrics?: Record<string, unknown> | null;
};

export type SnapshotResult = {
  status: number;
  data: StableSnapshot | null;
};

export type FundamentalsRefreshResponse = {
  ok: boolean;
  symbol: string;
  period: FundamentalsPeriod;
  years: number;
  inserted: {
    income: number;
    balance: number;
    cash: number;
  };
  skipped: {
    income: number;
    balance: number;
    cash: number;
  };
};

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

async function fetchSnapshot(url: string): Promise<SnapshotResult> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return { status: response.status, data: null };
  }

  const data = (await response.json()) as StableSnapshot;
  return { status: response.status, data: data ?? null };
}

export async function fetchFundamentalsSnapshot(
  symbol: string,
  period: FundamentalsPeriod = "annual",
  limit = 5,
): Promise<SnapshotResult> {
  const normalizedSymbol = normalizeSymbol(symbol);

  if (!normalizedSymbol) {
    return { status: 400, data: null };
  }

  const pathUrl = `/api/fundamentals/${encodeURIComponent(
    normalizedSymbol,
  )}/snapshot/stable?period=${encodeURIComponent(period)}&limit=${encodeURIComponent(String(limit))}`;

  try {
    const pathResult = await fetchSnapshot(pathUrl);

    if (pathResult.status !== 404) {
      return pathResult;
    }

    const queryUrl = `/api/fundamentals/snapshot/stable?symbol=${encodeURIComponent(
      normalizedSymbol,
    )}&period=${encodeURIComponent(period)}&limit=${encodeURIComponent(String(limit))}`;

    return fetchSnapshot(queryUrl);
  } catch {
    return { status: 500, data: null };
  }
}

export async function refreshFundamentals(
  symbol: string,
  period: FundamentalsPeriod = "annual",
  years = 5,
): Promise<FundamentalsRefreshResponse> {
  const normalizedSymbol = normalizeSymbol(symbol);

  if (!normalizedSymbol) {
    throw new Error("Symbol is required.");
  }

  const url = `/api/fundamentals/refresh?symbol=${encodeURIComponent(
    normalizedSymbol,
  )}&period=${encodeURIComponent(period)}&years=${encodeURIComponent(String(years))}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const text = await response
      .text()
      .catch(() => "")
      .then((value) => value.trim());

    throw new Error(`HTTP ${response.status}${text ? `: ${text}` : ""}`);
  }

  return (await response.json()) as FundamentalsRefreshResponse;
}
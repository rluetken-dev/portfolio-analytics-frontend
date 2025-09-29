/**
 * Normalize raw error text (possibly JSON) into a short, user-friendly message.
 */
function normalizeError(error?: string): string {
  if (!error) return "";

  // Falls der String JSON enthält → extrahieren
  const idx = error.indexOf("{");
  const maybeJson = idx >= 0 ? error.slice(idx) : error;

  try {
    const parsed = JSON.parse(maybeJson);
    if (typeof parsed === "object" && parsed !== null) {
      const o = parsed as Record<string, unknown>;
      let msg = "";

      if (typeof o.title === "string" && o.title.trim()) {
        msg = o.title;
      } else if (typeof o.detail === "string" && o.detail.trim()) {
        msg = o.detail;
      }

      // ✨ Anwenderfreundliche Mappings für ingest-Fehler
      if (/ingest failed/i.test(msg)) {
        if (/income/i.test(msg)) return "Income data unavailable";
        if (/balance/i.test(msg)) return "Balance sheet data unavailable";
        if (/cash/i.test(msg)) return "Cash flow data unavailable";
        return "Fundamentals data unavailable";
      }

      return msg;
    }
  } catch {
    // kein JSON → weiter unten kürzen
  }

  // Fallback: nur die erste Zeile / ersten Satz nehmen und kürzen
  const trimmed = error.split("\n")[0].split(".")[0].trim();
  return trimmed.length > 80 ? trimmed.slice(0, 77) + "…" : trimmed;
}

/**
 * Full status message for the persistent status line.
 * English: Detailed text with symbol + HTTP context.
 */
export function toApiMessage(symbol: string, status: number, error?: string): string {
  const normalized = normalizeError(error);
  const nice = normalized.toLowerCase();
  const rawLow = (error ?? "").toLowerCase(); // English: preserve raw hints (e.g., "HTTP 402", "subscription")

  if (status === 200) return `✔️ Request successful for ${symbol}`;
  if (status === 404) return `❌ No data found for ${symbol}`;

  // English: Upstream free-tier may be wrapped in 5xx with detail=402 or subscription wording
  if (
    status === 402 ||
    nice.includes("subscription") ||
    rawLow.includes("subscription") ||
    rawLow.includes("payment required") ||
    rawLow.includes('"status":402') ||
    rawLow.includes("http 402") ||
    nice.includes("402") ||
    rawLow.includes("402")
  ) {
    return `⛔ Free-tier limit for ${symbol}`;
  }

  // English: Upstream rate limit may be wrapped in 5xx with detail=429
  if (
    status === 429 ||
    nice.includes("too many requests") ||
    rawLow.includes("too many requests") ||
    rawLow.includes('"status":429') ||
    rawLow.includes("http 429") ||
    nice.includes("429") ||
    rawLow.includes("429")
  ) {
    return `⏳ Rate limit reached for ${symbol}`;
  }

  if (status === 400) return `⚠️ Bad request for ${symbol}`;

  // English: treat classic 5xx as server-side issues
  if (status === 500 || status === 502 || status === 503) {
    return error
      ? `⚠️ Server issue for ${symbol}: ${normalized}`
      : `⚠️ Server issue for ${symbol}`;
  }

  // English: fallback with normalized text
  return normalized ? `⚠️ ${normalized}` : `⚠️ Request failed for ${symbol} (HTTP ${status})`;
}

/**
 * Short status message for the transient error pill.
 * English: Compact text for quick user hint.
 */
export function toErrorPillMessage(
  status: number,
  error?: string,
  retryAfterSec?: number
): string {
  const low = (error ?? "").toLowerCase();

  // English: explicit success
  if (status === 200) return "OK";

  // English: prefer upstream free-tier hint even if wrapped by 5xx
  if (
    status === 402 ||
    /subscription|payment required|"status"\s*:\s*402|http\s*402/i.test(low)
  ) {
    return "Free-tier limit";
  }

  // English: prefer upstream rate-limit hint even if wrapped by 5xx
  if (
    status === 429 ||
    /too many requests|"status"\s*:\s*429|http\s*429/i.test(low)
  ) {
    if (/daily limit/i.test(low)) return "Daily limit";
    if (typeof retryAfterSec === "number" && retryAfterSec > 0) {
      return `Rate limit (${retryAfterSec}s)`;
    }
    return "Rate limit";
  }

  // English: common client errors
  if (status === 404) return "Not found";
  if (status === 400) return "Bad request";

  // English: server-side fallback (no upstream hints detected)
  if (status >= 500 && status < 600) return "Server error";

  // English: generic fallback
  return "Error";
}

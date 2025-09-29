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
  const nice = normalizeError(error).toLowerCase();

  if (status === 200) return `✔️ Request successful for ${symbol}`;
  if (status === 404) return `❌ No data found for ${symbol}`;

  // Upstream free-tier limit (may be wrapped in 500/502 with detail=402)
  if (status === 402 || nice.includes("402") || nice.includes("subscription")) {
    return `⛔ Free-tier limit for ${symbol}`;
  }

  // Upstream rate limit (may be wrapped in 500/502 with detail=429)
  if (status === 429 || nice.includes("429") || nice.includes("too many requests")) {
    return `⏳ Rate limit reached for ${symbol}`;
  }

  if (status === 400) return `⚠️ Bad request for ${symbol}`;
  if (status === 500 || status === 502 || status === 503) {
    return error
      ? `⚠️ Server issue for ${symbol}: ${normalizeError(error)}`
      : `⚠️ Server issue for ${symbol}`;
  }

  const msg = normalizeError(error);
  return msg ? `⚠️ ${msg}` : `⚠️ Request failed for ${symbol} (HTTP ${status})`;
  return error || `⚠️ Request failed for ${symbol} (HTTP ${status})`;
}

/**
 * Short status message for the transient error pill.
 * English: Compact text for quick user hint.
 */
export function toErrorPillMessage(status: number, error?: string, retryAfterSec?: number): string {
  const low = (error ?? "").toLowerCase();

  // ✅ explicit success
  if (status === 200) return "OK";

  // ✅ prefer HTTP status over text inference
  if (status === 429) {
    if (low.includes("daily limit")) return "Daily limit";
    if (typeof retryAfterSec === "number" && retryAfterSec > 0)
      return `Rate limit (${retryAfterSec}s)`;
    return "Rate limit";
  }

  // Optional: only infer 429 from text if status is not a server error
  if (
    (status < 500 || status >= 600) &&
    (low.includes("429") || low.includes("too many requests"))
  ) {
    return "Rate limit";
  }

  if (status === 402 || low.includes("subscription") || low.includes("payment required")) {
    return "Free-tier limit";
  }

  if (status === 404) return "Not found";
  if (status === 400) return "Bad request";
  if (status === 500 || status === 502 || status === 503) return "Server error";

  return "Error";
}

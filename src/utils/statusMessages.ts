// English: detect free-tier hints (via 402 or obvious text markers)
function hasFreeTierHint(status: number, error?: string): boolean {
  const low = (error ?? "").toLowerCase();
  return status === 402 || /subscription|payment required|"status"\s*:\s*402|http\s*402/.test(low);
}

// English: detect rate-limit hints (via 429 or obvious text markers)
function hasRateLimitHint(status: number, error?: string): boolean {
  const low = (error ?? "").toLowerCase();
  return status === 429 || /too many requests|"status"\s*:\s*429|http\s*429|rate limit/.test(low);
}

/** Full status message for persistent status line (simple categories). */
export function toApiMessage(symbol: string, status: number, error?: string): string {
  if (status === 200) return `✔️ Request successful for ${symbol}`;
  if (status === 404) return `❌ No data found for ${symbol}`;
  if (status === 400) return `⚠️ Bad request for ${symbol}`;

  // English: cause-first, even if wrapped by 5xx
  if (hasFreeTierHint(status, error)) return `⛔ Free-tier limit for ${symbol}`;
  if (hasRateLimitHint(status, error)) return `⏳ Rate limit reached for ${symbol}`;

  if (status >= 500 && status < 600) return `⚠️ Server issue for ${symbol}`;

  return `⚠️ Request failed for ${symbol} (HTTP ${status})`;
}

/** Short pill text for quick hint (ultra-compact). */
export function toErrorPillMessage(status: number, error?: string, retryAfterSec?: number): string {
  if (status === 200) return "OK";

  if (hasFreeTierHint(status, error)) return "Free-tier limit";

  if (hasRateLimitHint(status, error)) {
    if (/daily limit/i.test(error ?? "")) return "Daily limit";
    if (typeof retryAfterSec === "number" && retryAfterSec > 0) {
      return `Rate limit (${retryAfterSec}s)`;
    }
    return "Rate limit";
  }

  if (status === 404) return "Not found";
  if (status === 400) return "Bad request";

  if (status >= 500 && status < 600) return "Server error";

  return "Error";
}

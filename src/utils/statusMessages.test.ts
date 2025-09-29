import { toApiMessage, toErrorPillMessage } from "./statusMessages";

// Define test cases: [symbol, status, error, retryAfterSec?]
const cases: Array<[string, number, string?, number?]> = [
  ["AAPL", 200],
  ["AMZN", 404],
  ["AMD", 429, "AlphaVantageNote: Too many requests per minute", 10],
  ["MSFT", 429, "AlphaVantageInfo: Daily limit reached"],
  ["MBGYY", 402, "Premium Query Parameter: not available under your current subscription"],
  ["TSLA", 500, "Income ingest failed (after retry)"],
  [
    "NFLX",
    502,
    '{"title":"Balance ingest failed","status":502,"detail":"HTTP 429 Too Many Requests"}',
  ],
  ["GOOG", 400, "Symbol required"],
  ["ORCL", 503, "Service Unavailable"],
  ["MBGYY_SAVE", 502, "{\"title\":\"Income ingest failed (after retry)\",\"status\":502,\"detail\":\"HTTP 429 Too Many Requests on /api/ingest/income/MBGYY?period=annual&limit=5: {\\\"title\\\":\\\"Rate limit reached\\\",\\\"detail\\\":\\\"Please retry after 00:00:11.1477972\\\",\\\"status\\\":429}\"}"],
  ["MBG_FT_WRAP", 502, "{\"title\":\"Balance ingest failed\",\"status\":502,\"detail\":\"HTTP 402 Payment Required: Premium Query Parameter: not available under your current subscription\"}"],
  ["AAPL_SAVE", 502, "{\"title\":\"Some upstream problem\",\"status\":502,\"detail\":\"HTTP 429 Too Many Requests: {\\\"title\\\":\\\"Rate limit reached\\\",\\\"status\\\":429}\"}"],
];

for (const [symbol, status, error, retry] of cases) {
  const statusMsg = toApiMessage(symbol, status, error);
  const pillMsg = toErrorPillMessage(status, error, retry);

  console.log(`\n=== ${symbol} (HTTP ${status}) ===`);
  console.log("Status line:", statusMsg);
  console.log("Error pill :", pillMsg);
}
console.log("");

// --- Tiny asserts (no framework) ---
// English: super-light assertion helper for console-based checks
function assertEq(actual: string, expected: string, label: string) {
  const ok = actual === expected;
  console.log(
    ok ? `PASS ${label}` : `FAIL ${label}\n  expected: ${expected}\n  actual  : ${actual}`,
  );
}

// Re-run a few key cases programmatically (mirrors the table above)
{
  // English: AMD 429 with retry
  const pill = toErrorPillMessage(429, "AlphaVantageNote: Too many requests per minute", 10);
  assertEq(pill, "Rate limit (10s)", "Pill 429 with retry shows seconds");

  // English: 5xx with embedded 429 should show 'Rate limit' in the pill
  const pill2 = toErrorPillMessage(
    502,
    '{"title":"Balance ingest failed","status":502,"detail":"HTTP 429 Too Many Requests"}'
  );
  assertEq(pill2, "Rate limit", "Pill 5xx with embedded 429 shows 'Rate limit'");


  // English: AAPL 200 should be OK
  const pill3 = toErrorPillMessage(200);
  assertEq(pill3, "OK", "Pill 200 is OK");
}

// English: 502 with embedded 429 should classify as "Rate limit" via toApiMessage
{
  const e = "{\"title\":\"Income ingest failed (after retry)\",\"status\":502,\"detail\":\"HTTP 429 Too Many Requests on /api/ingest/income/MBGYY?period=annual&limit=5: {\\\"title\\\":\\\"Rate limit reached\\\",\\\"detail\\\":\\\"Please retry after 00:00:11.1477972\\\",\\\"status\\\":429}\"}";
  const msg = toApiMessage("MBGYY_SAVE", 502, e);
  assertEq(msg, "⏳ Rate limit reached for MBGYY_SAVE", "502 + embedded 429 maps to 'Rate limit'");
}

{
  const e402 = "{\"title\":\"Balance ingest failed\",\"status\":502,\"detail\":\"HTTP 402 Payment Required: Premium Query Parameter: not available under your current subscription\"}";
  const msg = toApiMessage("MBG_FT_WRAP", 502, e402);
  assertEq(msg, "⛔ Free-tier limit for MBG_FT_WRAP", "502 + embedded 402 maps to 'Free-tier limit'");

  const pill = toErrorPillMessage(502, e402);
  assertEq(pill, "Free-tier limit", "Pill 5xx with embedded 402 shows 'Free-tier limit'");
}

{
  const e = "{\"title\":\"Some upstream problem\",\"status\":502,\"detail\":\"HTTP 429 Too Many Requests: {\\\"title\\\":\\\"Rate limit reached\\\",\\\"status\\\":429}\"}";
  const msg = toApiMessage("AAPL_SAVE", 502, e);
  assertEq(msg, "⏳ Rate limit reached for AAPL_SAVE", "free-tier symbol under embedded 429 maps to 'Rate limit'");
  const pill = toErrorPillMessage(502, e);
  assertEq(pill, "Rate limit", "Pill for 5xx with embedded 429 shows 'Rate limit' for free-tier symbol");
}


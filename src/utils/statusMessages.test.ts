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
];

for (const [symbol, status, error, retry] of cases) {
  const statusMsg = toApiMessage(symbol, status, error);
  const pillMsg = toErrorPillMessage(status, error, retry);

  console.log(`\n=== ${symbol} (HTTP ${status}) ===`);
  console.log("Status line:", statusMsg);
  console.log("Error pill :", pillMsg);
}

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

  // English: NFLX 502 should be server error (not 'Rate limit' inferred from text)
  const pill2 = toErrorPillMessage(
    502,
    '{"title":"Balance ingest failed","status":502,"detail":"HTTP 429 Too Many Requests"}',
  );
  assertEq(pill2, "Server error", "Pill 5xx stays 'Server error'");

  // English: AAPL 200 should be OK
  const pill3 = toErrorPillMessage(200);
  assertEq(pill3, "OK", "Pill 200 is OK");
}

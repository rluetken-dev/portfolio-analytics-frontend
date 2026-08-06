import { toApiMessage, toErrorPillMessage } from "./statusMessages";

type TestCase = [symbol: string, status: number, error?: string, retryAfterSec?: number];

const cases: TestCase[] = [
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
  [
    "MBGYY_SAVE",
    502,
    '{"title":"Income ingest failed (after retry)","status":502,"detail":"HTTP 429 Too Many Requests on /api/ingest/income/MBGYY?period=annual&limit=5: {\\"title\\":\\"Rate limit reached\\",\\"detail\\":\\"Please retry after 00:00:11.1477972\\",\\"status\\":429}"}',
  ],
  [
    "MBG_FT_WRAP",
    502,
    '{"title":"Balance ingest failed","status":502,"detail":"HTTP 402 Payment Required: Premium Query Parameter: not available under your current subscription"}',
  ],
  [
    "AAPL_SAVE",
    502,
    '{"title":"Some upstream problem","status":502,"detail":"HTTP 429 Too Many Requests: {\\"title\\":\\"Rate limit reached\\",\\"status\\":429}"}',
  ],
];

function assertEq(actual: string, expected: string, label: string) {
  const passed = actual === expected;

  console.log(
    passed ? `PASS ${label}` : `FAIL ${label}\n  expected: ${expected}\n  actual  : ${actual}`,
  );
}

for (const [symbol, status, error, retryAfterSec] of cases) {
  const statusMessage = toApiMessage(symbol, status, error);
  const pillMessage = toErrorPillMessage(status, error, retryAfterSec);

  console.log(`\n=== ${symbol} (HTTP ${status}) ===`);
  console.log("Status line:", statusMessage);
  console.log("Error pill :", pillMessage);
}

console.log("");

assertEq(
  toErrorPillMessage(429, "AlphaVantageNote: Too many requests per minute", 10),
  "Rate limit (10s)",
  "Pill 429 with retry shows seconds",
);

assertEq(
  toErrorPillMessage(
    502,
    '{"title":"Balance ingest failed","status":502,"detail":"HTTP 429 Too Many Requests"}',
  ),
  "Rate limit",
  "Pill 5xx with embedded 429 shows 'Rate limit'",
);

assertEq(toErrorPillMessage(200), "OK", "Pill 200 is OK");

const embeddedRateLimitError =
  '{"title":"Income ingest failed (after retry)","status":502,"detail":"HTTP 429 Too Many Requests on /api/ingest/income/MBGYY?period=annual&limit=5: {\\"title\\":\\"Rate limit reached\\",\\"detail\\":\\"Please retry after 00:00:11.1477972\\",\\"status\\":429}"}';

assertEq(
  toApiMessage("MBGYY_SAVE", 502, embeddedRateLimitError),
  "⏳ Rate limit reached for MBGYY_SAVE",
  "502 + embedded 429 maps to 'Rate limit'",
);

const embeddedFreeTierError =
  '{"title":"Balance ingest failed","status":502,"detail":"HTTP 402 Payment Required: Premium Query Parameter: not available under your current subscription"}';

assertEq(
  toApiMessage("MBG_FT_WRAP", 502, embeddedFreeTierError),
  "⛔ Free-tier limit for MBG_FT_WRAP",
  "502 + embedded 402 maps to 'Free-tier limit'",
);

assertEq(
  toErrorPillMessage(502, embeddedFreeTierError),
  "Free-tier limit",
  "Pill 5xx with embedded 402 shows 'Free-tier limit'",
);

const wrappedRateLimitError =
  '{"title":"Some upstream problem","status":502,"detail":"HTTP 429 Too Many Requests: {\\"title\\":\\"Rate limit reached\\",\\"status\\":429}"}';

assertEq(
  toApiMessage("AAPL_SAVE", 502, wrappedRateLimitError),
  "⏳ Rate limit reached for AAPL_SAVE",
  "free-tier symbol under embedded 429 maps to 'Rate limit'",
);

assertEq(
  toErrorPillMessage(502, wrappedRateLimitError),
  "Rate limit",
  "Pill for 5xx with embedded 429 shows 'Rate limit' for free-tier symbol",
);
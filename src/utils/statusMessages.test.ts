import { toApiMessage, toErrorPillMessage } from "./statusMessages";

// Define test cases: [symbol, status, error, retryAfterSec?]
const cases: Array<[string, number, string?, number?]> = [
  ["AAPL", 200],
  ["AMZN", 404],
  ["AMD", 429, "AlphaVantageNote: Too many requests per minute", 10],
  ["MSFT", 429, "AlphaVantageInfo: Daily limit reached"],
  ["MBGYY", 402, "Premium Query Parameter: not available under your current subscription"],
  ["TSLA", 500, "Income ingest failed (after retry)"],
  ["NFLX", 502, '{"title":"Balance ingest failed","status":502,"detail":"HTTP 429 Too Many Requests"}'],
  ["GOOG", 400, "Symbol required"],
];

for (const [symbol, status, error, retry] of cases) {
  const statusMsg = toApiMessage(symbol, status, error);
  const pillMsg = toErrorPillMessage(status, error, retry);

  console.log(`\n=== ${symbol} (HTTP ${status}) ===`);
  console.log("Status line:", statusMsg);
  console.log("Error pill :", pillMsg);
}

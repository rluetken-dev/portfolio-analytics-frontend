import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import CompanyAnalyticsPanel from "../components/company/CompanyAnalyticsPanel";
import CompanyCandleChart from "../components/company/CompanyCandleChart";
import CompanyHeader from "../components/company/CompanyHeader";
import CompanyKpis from "../components/company/CompanyKpis";
import CompanyPriceChart from "../components/company/CompanyPriceChart";

type ChartRange = {
  start: number;
  end: number;
} | null;

const seededDemoSymbols = new Set([
  "AAPL",
  "AMZN",
  "DIS",
  "GOOGL",
  "JNJ",
  "JPM",
  "KO",
  "LIN",
  "LMT",
  "MSFT",
  "NEE",
  "NVDA",
  "PLD",
  "TSLA",
  "XOM",
]);

export default function CompanyPage() {
  const { symbol } = useParams<{ symbol?: string }>();
  const normalizedSymbol = symbol?.trim().toUpperCase() ?? "";
  const [range, setRange] = useState<ChartRange>(null);

  if (!normalizedSymbol) {
    return (
      <main style={{ padding: 16 }}>
        <BackLink />
        <p style={{ opacity: 0.8 }}>
          No company symbol was provided. Open a company from the{" "}
          <Link to="/companies">Companies</Link> list.
        </p>
      </main>
    );
  }

  const hasSeededDemoData = seededDemoSymbols.has(normalizedSymbol);

  return (
    <main style={{ padding: 16 }}>
      <BackLink />

      <CompanyHeader symbol={normalizedSymbol} />

      {!hasSeededDemoData && (
        <div
          role="status"
          style={{
            margin: "12px 0",
            padding: "10px 12px",
            border: "1px solid #3f3f46",
            borderRadius: 8,
            background: "rgba(59, 130, 246, 0.08)",
            color: "#d4d4d8",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          No cached demo data is available for {normalizedSymbol}. Add provider API keys or use one
          of the seeded demo symbols for charts and fundamentals.
        </div>
      )}

      <CompanyKpis symbol={normalizedSymbol} />
      <CompanyPriceChart symbol={normalizedSymbol} range={range} onRangeChange={setRange} />
      <CompanyCandleChart symbol={normalizedSymbol} range={range} height={320} />

      <div style={{ marginTop: 32 }}>
        <CompanyAnalyticsPanel symbol={normalizedSymbol} />
      </div>
    </main>
  );
}

function BackLink() {
  return (
    <div style={{ marginBottom: 8, fontSize: 12 }}>
      <Link to="/companies" style={{ textDecoration: "none" }}>
        Back to Companies
      </Link>
    </div>
  );
}
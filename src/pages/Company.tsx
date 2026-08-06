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

  return (
    <main style={{ padding: 16 }}>
      <BackLink />

      <CompanyHeader symbol={normalizedSymbol} />
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
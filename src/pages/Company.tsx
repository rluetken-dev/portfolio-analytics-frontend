// src/pages/Company.tsx
import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import CompanyHeader from "../components/company/CompanyHeader";
import CompanyKpis from "../components/company/CompanyKpis";
import CompanyPriceChart from "../components/company/CompanyPriceChart";
import CompanyCandleChart from "../components/company/CompanyCandleChart";

export default function CompanyPage() {
  const { symbol } = useParams<{ symbol?: string }>();
  const sym = (symbol ?? "").trim().toUpperCase(); // Normalize once
  // English: single source of truth for the visible window (indices in FULL price-series)
  const [range, setRange] = useState<{ start: number; end: number } | null>(null);

  // Guard: if URL has no symbol, show a friendly hint instead of rendering children
  if (!sym) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 8, fontSize: 12 }}>
          <Link to="/companies" style={{ textDecoration: "none" }}>
            ← Back to Companies
          </Link>
        </div>
        <div style={{ opacity: 0.8 }}>
          Kein Symbol in der URL. Bitte eine Firma über die <Link to="/companies">Companies</Link>
          -Liste öffnen.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 8, fontSize: 12 }}>
        <Link to="/companies" style={{ textDecoration: "none" }}>
          ← Back to Companies
        </Link>
      </div>
      <CompanyHeader symbol={sym} />
      <CompanyKpis symbol={sym} />

      {/* Price = Controller (has brush) */}
      <CompanyPriceChart symbol={sym} range={range} onRangeChange={setRange} />

      {/* Candle = Follower (no own brush) */}
      <CompanyCandleChart symbol={sym} range={range} height={320} />
    </div>
  );
}

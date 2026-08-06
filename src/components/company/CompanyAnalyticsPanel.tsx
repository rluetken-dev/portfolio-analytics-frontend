import CashFlowSection from "./analytics/CashFlowSection";
import EfficiencySection from "./analytics/EfficiencySection";
import PerShareSection from "./analytics/PerShareSection";
import ProfitabilitySection from "./analytics/ProfitabilitySection";
import SolvencySection from "./analytics/SolvencySection";
import ValuationSection from "./analytics/ValuationSection";

interface CompanyAnalyticsPanelProps {
  symbol?: string;
}

export default function CompanyAnalyticsPanel({ symbol }: CompanyAnalyticsPanelProps) {
  const normalizedSymbol = symbol?.trim().toUpperCase() ?? "";

  if (!normalizedSymbol) {
    return null;
  }

  return (
    <section
      style={{
        border: "1px solid #222",
        borderRadius: 14,
        padding: 12,
        display: "grid",
        gap: 12,
        width: "100%",
        boxSizing: "border-box",
        marginTop: 16,
      }}
    >
      <div style={{ fontWeight: 600, opacity: 0.95 }}>Analytics</div>

      <ValuationSection symbol={normalizedSymbol} showPrice={false} showPE={false} />
      <ProfitabilitySection symbol={normalizedSymbol} />
      <SolvencySection symbol={normalizedSymbol} />
      <EfficiencySection symbol={normalizedSymbol} />
      <PerShareSection symbol={normalizedSymbol} />
      <CashFlowSection symbol={normalizedSymbol} />
    </section>
  );
}
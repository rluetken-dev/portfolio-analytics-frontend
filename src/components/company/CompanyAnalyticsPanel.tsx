import ValuationSection from "./analytics/ValuationSection";
import ProfitabilitySection from "./analytics/ProfitabilitySection";
import SolvencySection from "./analytics/SolvencySection";
import EfficiencySection from "./analytics/EfficiencySection";
import PerShareSection from "./analytics/PerShareSection";
import CashFlowSection from "./analytics/CashFlowSection";

export default function CompanyAnalyticsPanel({ symbol }: { symbol?: string }) {
  const sym = (symbol ?? "").trim().toUpperCase();
  if (!sym) return null;

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

      {/* English: sections are data-aware; UI-only blocks removed */}
      <ValuationSection symbol={sym} showPrice={false} showPE={false} />
      <ProfitabilitySection symbol={sym} />
      <SolvencySection symbol={sym} />
      <EfficiencySection symbol={sym} />
      <PerShareSection symbol={sym} />
      <CashFlowSection symbol={sym} />
    </section>
  );
}

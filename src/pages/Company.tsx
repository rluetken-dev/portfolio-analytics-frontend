// src/pages/Company.tsx
import { Link, useParams } from "react-router-dom";
import CompanyHeader from "../components/company/CompanyHeader";
import CompanyKpis from "../components/company/CompanyKpis";
import CompanyPriceChart from "../components/company/CompanyPriceChart";
import CompanyCandleChart from "../components/company/CompanyCandleChart";

// // Small, focused error boundary so a crashing child doesn't blank the whole page
// class SectionBoundary extends React.Component<
//   { label: string; children: React.ReactNode },
//   { error: Error | null }
// > {
//   constructor(props: { label: string; children: React.ReactNode }) {
//     super(props);
//     this.state = { error: null };
//   }
//   static getDerivedStateFromError(error: Error) {
//     // Convert runtime error into local state → render fallback UI
//     return { error };
//   }
//   componentDidCatch(error: unknown, info: unknown) {
//     // Log with context label to quickly pinpoint which section failed
//     console.error(`[CompanyPage:${this.props.label}] crashed:`, error, info);
//   }
//   render() {
//     if (this.state.error) {
//       return (
//         <div
//           style={{
//             border: "1px solid #f87171",
//             borderRadius: 8,
//             padding: 8,
//             color: "#f87171",
//             background: "rgba(248,113,113,0.06)",
//             marginTop: 8,
//           }}
//         >
//           Section “{this.props.label}” failed: {this.state.error.message}
//         </div>
//       );
//     }
//     return this.props.children as React.ReactElement;
//   }
// }

export default function CompanyPage() {
  const { symbol } = useParams<{ symbol?: string }>();
  const sym = (symbol ?? "").trim().toUpperCase(); // Normalize once

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

      {/* Pass a guaranteed, normalized symbol to all children */}
      <CompanyHeader symbol={sym} />
      <CompanyKpis symbol={sym} />
      <CompanyPriceChart symbol={sym} />

      {/* Wrap the candle chart to isolate runtime errors from blanking the whole page */}
      {/* <SectionBoundary label="CandleChart"> */}
      <CompanyCandleChart symbol={sym} />
      {/* </SectionBoundary> */}

      {/* Next: interpretation section */}
    </div>
  );
}

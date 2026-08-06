import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

type CompanyRow = {
  symbol?: string;
  name?: string;
  sector?: string;
};

interface CompanyHeaderProps {
  symbol: string;
}

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid #d1d5db",
  background: "#f9fafb",
  color: "#374151",
  fontSize: 12,
  whiteSpace: "nowrap",
};

export default function CompanyHeader({ symbol }: CompanyHeaderProps) {
  const normalizedSymbol = useMemo(() => symbol.trim().toUpperCase(), [symbol]);
  const [name, setName] = useState<string | null>(null);
  const [sector, setSector] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchCompanyMetadata = async () => {
      if (!normalizedSymbol) {
        setName(null);
        setSector(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(
          `/api/companies?q=${encodeURIComponent(normalizedSymbol)}&limit=5`,
          { headers: { Accept: "application/json" } },
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as unknown;
        const companies = Array.isArray(data) ? (data as CompanyRow[]) : [];

        const exactMatch = companies.find(
          (company) => company.symbol?.toUpperCase() === normalizedSymbol,
        );
        const selectedCompany = exactMatch ?? companies[0];

        if (!isMounted) {
          return;
        }

        setName(selectedCompany?.name?.trim() || normalizedSymbol);
        setSector(selectedCompany?.sector?.trim() || null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setName(normalizedSymbol);
        setSector(null);
        setErrorMessage(error instanceof Error ? error.message : "Company metadata unavailable.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void fetchCompanyMetadata();

    return () => {
      isMounted = false;
    };
  }, [normalizedSymbol]);

  return (
    <header>
      <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.2 }}>
        {isLoading ? "Loading..." : name}{" "}
        {!isLoading && normalizedSymbol && (
          <span style={{ opacity: 0.6, fontSize: 16 }}>({normalizedSymbol})</span>
        )}
      </h1>

      {sector && (
        <div
          style={{
            marginTop: 8,
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span title="Company sector" style={badgeStyle}>
            {sector}
          </span>
        </div>
      )}

      {errorMessage && (
        <div role="status" style={{ marginTop: 6, fontSize: 12, color: "#b91c1c" }}>
          Company metadata could not be loaded.
        </div>
      )}
    </header>
  );
}
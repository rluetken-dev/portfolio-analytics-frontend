import React, { useState, useCallback, useEffect } from "react";
import { fetchJson } from "../services/api/client";

// response type for bulk add
interface BulkAddResponse {
  added: Array<{
    symbol: string;
    name: string;
    sector?: string;
  }>;
  errors: string[];
  totalAdded: number;
}

// search result types
interface CompanySearchResult {
  id: number;
  symbol: string;
  name: string;
  exchange?: string;
  sector?: string;
  isInDatabase: boolean;
  isInUserPortfolio: boolean;
}

interface CompanySearchResponse {
  query: string;
  results: CompanySearchResult[];
  totalFound: number;
}

interface CompanyDiscoveryProps {
  onCompanyAdded?: () => void;
  onNotification?: (message: string, type: "success" | "error" | "info") => void;
  removedSymbol?: string | null;
}

const CompanyDiscovery = ({
  onCompanyAdded,
  onNotification,
  removedSymbol,
}: CompanyDiscoveryProps) => {
  const [showDiscovery, setShowDiscovery] = useState(false);

  // search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CompanySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState<Record<string, boolean>>({});

  // 🧩 React to company removal signal from parent (Companies.tsx)
  useEffect(() => {
    if (!removedSymbol) return;

    setSearchResults((prev: CompanySearchResult[]) =>
      prev.map((c) =>
        c.symbol.toUpperCase() === removedSymbol.toUpperCase()
          ? { ...c, isInUserPortfolio: false }
          : c,
      ),
    );
  }, [removedSymbol]);

  // bulk add popular companies
  const addPopularCompanies = useCallback(
    async (category: string) => {
      try {
        const response = await fetchJson<BulkAddResponse>({
          path: "/api/companies/add-popular",
          method: "POST",
          body: { category, limit: 10 },
        });

        console.log("Added companies:", response);
        onNotification?.(`Added ${response.totalAdded} companies!`, "success");
        onCompanyAdded?.();
      } catch (error) {
        console.error("Failed to add companies:", error);
        onNotification?.("Failed to add companies", "error");
      }
    },
    [onCompanyAdded, onNotification],
  );

  // search companies
  const searchCompanies = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Fetch search results directly from backend (already includes user portfolio info)
      const response = await fetchJson<CompanySearchResponse>({
        path: `/api/companies/search?q=${encodeURIComponent(query)}&limit=10`,
      });

      // ✅ Just use what the backend gives us — no manual merging needed
      setSearchResults(response.results || []);
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Adds a company to the user's portfolio (auto-creates global ticker if missing)
  const addSingleCompany = useCallback(
    async (symbol: string) => {
      setIsAdding((prev) => ({ ...prev, [symbol]: true }));

      try {
        // 1️⃣ Try to find the ticker in the global list first
        const tickerResponse = await fetchJson<Array<{ id: number; symbol: string }>>({
          path: `/api/companies?q=${encodeURIComponent(symbol)}`,
          method: "GET",
        });

        const tickerId = tickerResponse?.[0]?.id ?? null;

        // 2️⃣ Send both tickerId (if known) and symbol — backend handles missing tickers automatically
        await fetchJson({
          path: "/api/UserCompany",
          method: "POST",
          body: {
            tickerId, // may be null — backend will create ticker if needed
            symbol, // always provide symbol for safety
            shares: 0,
            purchasePrice: 0,
            notes: "",
          },
        });

        // ✅ Success notification
        onNotification?.(`Company ${symbol} added to your portfolio!`, "success");

        // ✅ Immediately update UI: mark this company as 'inPortfolio'
        setSearchResults((prev) =>
          prev.map((c) =>
            c.symbol.toUpperCase() === symbol.toUpperCase() ? { ...c, isInUserPortfolio: true } : c,
          ),
        );

        onCompanyAdded?.();
      } catch (error) {
        // 3️⃣ Handle typed errors safely
        console.error("Add failed:", error);

        let message = "Failed to add company.";

        if (error instanceof Error) {
          const errMsg = error.message.toLowerCase();

          if (errMsg.includes("409")) {
            message = `Company ${symbol} is already in your portfolio.`;
          } else if (errMsg.includes("400")) {
            message = `Invalid symbol: ${symbol}`;
          } else {
            message = `Failed to add ${symbol}`;
          }
        }

        onNotification?.(message, "error");
      } finally {
        // 4️⃣ Always clear loading state
        setIsAdding((prev) => ({ ...prev, [symbol]: false }));
      }
    },
    [onCompanyAdded, onNotification],
  );

  // debounced search effect
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchCompanies(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchCompanies]);

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "16px",
        marginBottom: "16px",
        backgroundColor: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h3 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>🔍 Discover Companies</h3>
        <button
          onClick={() => setShowDiscovery(!showDiscovery)}
          style={{
            padding: "8px 16px",
            backgroundColor: "#f3f4f6",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          {showDiscovery ? "Hide" : "Show"}
        </button>
      </div>

      {showDiscovery && (
        <div>
          <p>Quick Add Popular Companies:</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
            <button
              onClick={() => addPopularCompanies("megacap")}
              style={{
                padding: "8px 12px",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Mega-Cap Stocks
            </button>
            <button
              onClick={() => addPopularCompanies("tech")}
              style={{
                padding: "8px 12px",
                backgroundColor: "#f43838ff",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Tech Giants
            </button>
            <button
              onClick={() => addPopularCompanies("dow30")}
              style={{
                padding: "8px 12px",
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Dow 30
            </button>
            <button
              onClick={() => addPopularCompanies("buffett")}
              style={{
                padding: "8px 12px",
                backgroundColor: "#f59e0b",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Buffett Holdings
            </button>
            <button
              onClick={() => addPopularCompanies("etf")}
              style={{
                padding: "8px 12px",
                backgroundColor: "#8b5cf6",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Popular ETFs
            </button>
          </div>

          {/* Search Section */}
          <div style={{ marginTop: "20px" }}>
            <p>Or search for specific companies:</p>
            <input
              type="text"
              placeholder="Search by company name or ticker (e.g., Apple, AAPL)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "14px",
                marginBottom: "12px",
              }}
            />

            {/* Search Results */}
            {searchQuery.length >= 2 && (
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  maxHeight: "200px",
                  overflowY: "auto",
                }}
              >
                {isSearching ? (
                  <div style={{ padding: "20px", textAlign: "center", color: "#6b7280" }}>
                    Searching...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding: "20px", textAlign: "center", color: "#6b7280" }}>
                    No companies found for "{searchQuery}"
                  </div>
                ) : (
                  searchResults.map((result) => (
                    <div
                      key={result.symbol}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "14px", fontFamily: "monospace" }}>
                          {result.symbol}
                        </div>
                        <div style={{ fontSize: "12px", color: "#6b7280" }}>
                          {result.name} {result.sector && `• ${result.sector}`}
                        </div>
                      </div>
                      <div>
                        {result.isInUserPortfolio ? (
                          <span
                            style={{
                              padding: "4px 8px",
                              backgroundColor: "#f3f4f6",
                              color: "#6b7280",
                              border: "1px solid #d1d5db",
                              borderRadius: "4px",
                              fontSize: "12px",
                            }}
                          >
                            ✓ In Portfolio
                          </span>
                        ) : (
                          <button
                            onClick={() => addSingleCompany(result.symbol)}
                            disabled={isAdding[result.symbol]}
                            style={{
                              padding: "6px 12px",
                              backgroundColor: isAdding[result.symbol] ? "#94a3b8" : "#10b981",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: isAdding[result.symbol] ? "not-allowed" : "pointer",
                              fontSize: "12px",
                            }}
                          >
                            {isAdding[result.symbol] ? "Adding..." : "+ Add"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {searchQuery.length > 0 && searchQuery.length < 2 && (
              <div
                style={{ padding: "12px", textAlign: "center", color: "#6b7280", fontSize: "14px" }}
              >
                Type at least 2 characters to search
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyDiscovery;

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchJson } from "../services/api/client";

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

interface PopularCompany {
  id: number;
  symbol: string;
}

interface AddPopularResponse {
  added: PopularCompany[];
  existing: PopularCompany[];
  errors: string[];
}

interface CompanyDiscoveryProps {
  onCompanyAdded?: () => void;
  onNotification?: (message: string, type: "success" | "error" | "info") => void;
  removedSymbol?: string | null;
}

const popularCategories = [
  { category: "megacap", label: "Mega-Cap Stocks", color: "#3b82f6" },
  { category: "tech", label: "Tech Giants", color: "#f43838" },
  { category: "dow30", label: "Dow 30", color: "#10b981" },
  { category: "buffett", label: "Buffett Holdings", color: "#f59e0b" },
  { category: "etf", label: "Popular ETFs", color: "#8b5cf6" },
] as const;

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }

  return typeof error.status === "number" ? error.status : undefined;
}

export default function CompanyDiscovery({
  onCompanyAdded,
  onNotification,
  removedSymbol,
}: CompanyDiscoveryProps) {
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CompanySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState<Record<string, boolean>>({});
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const searchRequestId = useRef(0);

  useEffect(() => {
    if (!removedSymbol) {
      return;
    }

    setSearchResults((previous) =>
      previous.map((company) =>
        company.symbol.toUpperCase() === removedSymbol.toUpperCase()
          ? { ...company, isInUserPortfolio: false }
          : company,
      ),
    );
  }, [removedSymbol]);

  const addPopularCompanies = useCallback(
    async (category: string) => {
      setAddingCategory(category);

      try {
        const response = await fetchJson<AddPopularResponse>({
          path: "/api/companies/add-popular",
          method: "POST",
          body: { category, limit: 10 },
        });

        const companies = [...(response.added ?? []), ...(response.existing ?? [])];

        if (companies.length === 0) {
          onNotification?.("No companies were added or found.", "info");
          return;
        }

        let addedCount = 0;

        for (const company of companies) {
          try {
            await fetchJson({
              path: "/api/UserCompany",
              method: "POST",
              body: {
                tickerId: company.id,
                symbol: company.symbol,
                shares: 0,
                purchasePrice: 0,
                notes: "",
              },
            });

            addedCount += 1;
          } catch (error) {
            if (getErrorStatus(error) !== 409) {
              throw error;
            }
          }
        }

        if (addedCount === 0) {
          onNotification?.("All selected companies are already in your portfolio.", "info");
          return;
        }

        onNotification?.(
          `${addedCount} ${addedCount === 1 ? "company" : "companies"} added to your portfolio.`,
          "success",
        );
        onCompanyAdded?.();
      } catch {
        onNotification?.("Failed to add companies.", "error");
      } finally {
        setAddingCategory(null);
      }
    },
    [onCompanyAdded, onNotification],
  );

  const searchCompanies = useCallback(async (query: string) => {
    const normalizedQuery = query.trim();
    const requestId = ++searchRequestId.current;

    if (normalizedQuery.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetchJson<CompanySearchResponse>({
        path: `/api/companies/search?q=${encodeURIComponent(normalizedQuery)}&limit=10`,
      });

      if (requestId === searchRequestId.current) {
        setSearchResults(response.results ?? []);
      }
    } catch {
      if (requestId === searchRequestId.current) {
        setSearchResults([]);
      }
    } finally {
      if (requestId === searchRequestId.current) {
        setIsSearching(false);
      }
    }
  }, []);

  const addSingleCompany = useCallback(
    async (symbol: string) => {
      setIsAdding((previous) => ({ ...previous, [symbol]: true }));

      try {
        const tickers = await fetchJson<Array<{ id: number; symbol: string }>>({
          path: `/api/companies?q=${encodeURIComponent(symbol)}`,
        });

        await fetchJson({
          path: "/api/UserCompany",
          method: "POST",
          body: {
            tickerId: tickers[0]?.id ?? null,
            symbol,
            shares: 0,
            purchasePrice: 0,
            notes: "",
          },
        });

        setSearchResults((previous) =>
          previous.map((company) =>
            company.symbol.toUpperCase() === symbol.toUpperCase()
              ? { ...company, isInUserPortfolio: true }
              : company,
          ),
        );

        onNotification?.(`Company ${symbol} added to your portfolio.`, "success");
        onCompanyAdded?.();
      } catch (error) {
        const status = getErrorStatus(error);
        const message =
          status === 409
            ? `Company ${symbol} is already in your portfolio.`
            : status === 400
              ? `Invalid symbol: ${symbol}.`
              : `Failed to add ${symbol}.`;

        onNotification?.(message, "error");
      } finally {
        setIsAdding((previous) => ({ ...previous, [symbol]: false }));
      }
    },
    [onCompanyAdded, onNotification],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void searchCompanies(searchQuery);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery, searchCompanies]);

  const trimmedQuery = searchQuery.trim();

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        backgroundColor: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: showDiscovery ? 16 : 0,
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Discover Companies</h3>

        <button
          type="button"
          onClick={() => setShowDiscovery((visible) => !visible)}
          aria-expanded={showDiscovery}
          style={{
            padding: "8px 16px",
            backgroundColor: "#f3f4f6",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {showDiscovery ? "Hide" : "Show"}
        </button>
      </div>

      {showDiscovery && (
        <div>
          <p>Quick Add Popular Companies:</p>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            {popularCategories.map(({ category, label, color }) => {
              const isCurrentCategory = addingCategory === category;

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => void addPopularCompanies(category)}
                  disabled={addingCategory !== null}
                  style={{
                    padding: "8px 12px",
                    backgroundColor: color,
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: addingCategory === null ? "pointer" : "not-allowed",
                    fontSize: 12,
                    opacity: addingCategory !== null && !isCurrentCategory ? 0.6 : 1,
                  }}
                >
                  {isCurrentCategory ? "Adding..." : label}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 20 }}>
            <label htmlFor="company-search">Or search for specific companies:</label>

            <input
              id="company-search"
              type="search"
              placeholder="Search by company name or ticker, for example Apple or AAPL"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              autoComplete="off"
              style={{
                width: "100%",
                padding: 12,
                border: "1px solid #d1d5db",
                borderRadius: 8,
                fontSize: 14,
                marginTop: 12,
                marginBottom: 12,
                boxSizing: "border-box",
              }}
            />

            {trimmedQuery.length >= 2 && (
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  maxHeight: 200,
                  overflowY: "auto",
                }}
              >
                {isSearching ? (
                  <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>
                    Searching...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>
                    No companies found for &quot;{trimmedQuery}&quot;
                  </div>
                ) : (
                  searchResults.map((result) => (
                    <div
                      key={result.id || result.symbol}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        padding: 12,
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 14,
                            fontFamily: "monospace",
                          }}
                        >
                          {result.symbol}
                        </div>

                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          {result.name}
                          {result.sector && ` - ${result.sector}`}
                        </div>
                      </div>

                      {result.isInUserPortfolio ? (
                        <span
                          style={{
                            padding: "4px 8px",
                            backgroundColor: "#f3f4f6",
                            color: "#6b7280",
                            border: "1px solid #d1d5db",
                            borderRadius: 4,
                            fontSize: 12,
                          }}
                        >
                          In Portfolio
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void addSingleCompany(result.symbol)}
                          disabled={Boolean(isAdding[result.symbol])}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: isAdding[result.symbol] ? "#94a3b8" : "#10b981",
                            color: "white",
                            border: "none",
                            borderRadius: 4,
                            cursor: isAdding[result.symbol] ? "not-allowed" : "pointer",
                            fontSize: 12,
                          }}
                        >
                          {isAdding[result.symbol] ? "Adding..." : "+ Add"}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {trimmedQuery.length > 0 && trimmedQuery.length < 2 && (
              <div
                style={{
                  padding: 12,
                  textAlign: "center",
                  color: "#6b7280",
                  fontSize: 14,
                }}
              >
                Type at least 2 characters to search
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
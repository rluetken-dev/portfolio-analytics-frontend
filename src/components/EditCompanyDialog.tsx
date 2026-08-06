import { useEffect, useId, useState } from "react";

import { getCurrentPrice } from "../services/api/quotes";

interface EditCompanyDialogProps {
  symbol: string;
  name: string;
  currentShares: number;
  onCancel: () => void;
  onConfirm: (data: { shares: number; purchasePrice: number | null; notes: string }) => void;
}

interface QuoteResponse {
  status: number;
  price: number | null;
  error?: string;
}

type SharesInputValue = number | "";

const currencySymbol = "$";

export default function EditCompanyDialog({
  symbol,
  name,
  currentShares,
  onConfirm,
  onCancel,
}: EditCompanyDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [shares, setShares] = useState<SharesInputValue>(1);
  const [purchasePrice, setPurchasePrice] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [priceMessage, setPriceMessage] = useState<string | null>(null);

  const numericShares = typeof shares === "number" ? shares : 0;
  const isSell = numericShares < 0;
  const actionLabel = isSell ? "Sell" : "Buy";
  const actionColor = isSell ? "#ef4444" : "#10b981";

  const isValid = numericShares !== 0 && purchasePrice !== null && purchasePrice > 0;

  useEffect(() => {
    let isMounted = true;

    const fetchPrice = async () => {
      setIsLoadingPrice(true);
      setPriceMessage(null);

      try {
        const quote: QuoteResponse = await getCurrentPrice(symbol);

        if (!isMounted) {
          return;
        }

        if (quote.status === 200 && quote.price !== null && quote.price > 0) {
          setCurrentPrice(quote.price);
          setPurchasePrice(quote.price);
          return;
        }

        setCurrentPrice(null);
        setPriceMessage("Current price is unavailable. Enter a price manually.");
      } catch {
        if (!isMounted) {
          return;
        }

        setCurrentPrice(null);
        setPriceMessage("Current price is unavailable. Enter a price manually.");
      } finally {
        if (isMounted) {
          setIsLoadingPrice(false);
        }
      }
    };

    void fetchPrice();

    return () => {
      isMounted = false;
    };
  }, [symbol]);

  const updateShares = (rawValue: string) => {
    if (rawValue === "" || rawValue === "-") {
      setShares("");
      return;
    }

    const value = Number(rawValue);

    if (!Number.isFinite(value)) {
      return;
    }

    if (value === 0) {
      setShares("");
      return;
    }

    if (currentShares === 0 && value < 0) {
      return;
    }

    if (value < -currentShares) {
      setShares(-currentShares);
      return;
    }

    setShares(value);
  };

  const updatePurchasePrice = (rawValue: string) => {
    if (rawValue === "") {
      setPurchasePrice(null);
      return;
    }

    const value = Number(rawValue);

    if (!Number.isFinite(value) || value <= 0) {
      setPurchasePrice(null);
      return;
    }

    setPurchasePrice(value);
  };

  const handleConfirm = () => {
    if (!isValid) {
      return;
    }

    onConfirm({
      shares: numericShares,
      purchasePrice,
      notes: notes.trim(),
    });
  };

  return (
    <div
      role="presentation"
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
        style={{
          backgroundColor: "white",
          borderRadius: 12,
          padding: 24,
          maxWidth: 420,
          width: "100%",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
        }}
      >
        <h3
          id={titleId}
          style={{
            margin: "0 0 4px 0",
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          {actionLabel}{" "}
          <span
            style={{
              fontWeight: 700,
              color: isSell ? "#dc2626" : "#16a34a",
              backgroundColor: isSell ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
              borderRadius: 6,
              padding: "2px 6px",
            }}
          >
            {symbol}
          </span>
        </h3>

        <p
          id={descriptionId}
          style={{
            margin: "0 0 16px 0",
            fontSize: 14,
            color: "#6b7280",
          }}
        >
          {name}
        </p>

        {isLoadingPrice && <p>Loading current price...</p>}

        {!isLoadingPrice && (
          <>
            {currentPrice !== null && (
              <p style={{ fontSize: 14, color: "#4b5563", marginBottom: 8 }}>
                <strong>Current price:</strong> {currencySymbol}
                {currentPrice.toFixed(2)}
              </p>
            )}

            {priceMessage && (
              <p
                role="status"
                style={{
                  color: "#92400e",
                  fontSize: 13,
                  marginBottom: 8,
                  backgroundColor: "#fef3c7",
                  borderRadius: 6,
                  padding: "6px 8px",
                }}
              >
                {priceMessage}
              </p>
            )}

            <div style={{ marginBottom: 12 }}>
              <label
                htmlFor="trade-shares"
                style={{
                  display: "block",
                  marginBottom: 4,
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Shares
              </label>
              <input
                id="trade-shares"
                type="number"
                value={shares}
                min={-currentShares}
                max={999999}
                step={1}
                placeholder="e.g. 10 or -5"
                onChange={(event) => updateShares(event.target.value)}
                onBlur={() => {
                  if (shares === "") {
                    setShares(1);
                  }
                }}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: 14,
                }}
              />
              <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                Positive values buy shares. Negative values sell shares.
              </p>
            </div>

            <div style={{ position: "relative", width: "100%", marginBottom: 12 }}>
              <label
                htmlFor="trade-price"
                style={{
                  display: "block",
                  marginBottom: 4,
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Price
              </label>
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 10,
                  top: 34,
                  color: "#6b7280",
                  fontSize: 14,
                }}
              >
                {currencySymbol}
              </span>

              <input
                id="trade-price"
                type="number"
                value={purchasePrice ?? ""}
                min={0}
                step={0.01}
                placeholder="Enter price"
                onChange={(event) => updatePurchasePrice(event.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 8px 8px 22px",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: 14,
                  color: purchasePrice ? "#111827" : "#6b7280",
                  backgroundColor: "#f9fafb",
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="trade-notes"
                style={{
                  display: "block",
                  marginBottom: 4,
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Notes
              </label>
              <textarea
                id="trade-notes"
                value={notes}
                rows={3}
                placeholder="Optional notes..."
                onChange={(event) => setNotes(event.target.value)}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: 14,
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={onCancel}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#f3f4f6",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={!isValid}
                style={{
                  padding: "8px 16px",
                  backgroundColor: !isValid ? "#9ca3af" : actionColor,
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: !isValid ? "not-allowed" : "pointer",
                }}
              >
                {actionLabel}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
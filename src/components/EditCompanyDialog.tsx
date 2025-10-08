import React, { useEffect, useState } from "react";
import { getCurrentPrice } from "../services/api/quotes";

interface EditCompanyDialogProps {
  symbol: string;
  name: string;
  onCancel: () => void;
  onConfirm: (data: { shares: number; purchasePrice: number | null; notes: string }) => void;
}

const EditCompanyDialog: React.FC<EditCompanyDialogProps> = ({
  symbol,
  name,
  onConfirm,
  onCancel,
}) => {
  const [shares, setShares] = useState<number>(1);
  const [purchasePrice, setPurchasePrice] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currencySymbol = "$";

  // ✅ Validation: allow positive (Buy) or negative (Sell), but not 0
  const isValid = (): boolean => {
    if (shares === 0) return false;
    if (purchasePrice !== null && purchasePrice < 0) return false;
    return true;
  };

  // 🔹 Fetch current market price when dialog opens
  useEffect(() => {
    const fetchPrice = async () => {
      setLoading(true);
      const quote = await getCurrentPrice(symbol);
      if (quote.status === 200 && quote.price !== null) {
        setCurrentPrice(quote.price);
      } else {
        setError(quote.error ?? "Failed to fetch current price");
      }
      setLoading(false);
    };
    fetchPrice();
  }, [symbol]);

  const handleConfirm = () => {
    // Use explicit price if provided, otherwise fallback to current price
    const finalPrice =
      purchasePrice && purchasePrice > 0
        ? purchasePrice
        : currentPrice && currentPrice > 0
          ? currentPrice
          : null;

    onConfirm({
      shares,
      purchasePrice: finalPrice,
      notes,
    });
  };

  // 💡 Determine action type & styles based on share value
  const isSell = shares < 0;
  const actionLabel = isSell ? "Sell" : "Buy";
  const actionColor = isSell ? "#ef4444" : "#10b981"; // red or green

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "420px",
          width: "90%",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 🧠 Dialog Header with symbol + company name */}
        <h3
          style={{
            margin: "0 0 4px 0",
            fontSize: "18px",
            fontWeight: 600,
          }}
        >
          {actionLabel}{" "}
          <span
            style={{
              fontWeight: 700,
              color: isSell ? "#dc2626" : "#16a34a",
              backgroundColor: isSell ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
              borderRadius: "6px",
              padding: "2px 6px",
            }}
          >
            {symbol}
          </span>
        </h3>

        {/* Secondary name line */}
        <p
          style={{
            margin: "0 0 16px 0",
            fontSize: "14px",
            color: "#6b7280",
          }}
        >
          {name}
        </p>

        {loading && <p>Loading current price...</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}

        {!loading && (
          <>
            {currentPrice && (
              <p style={{ fontSize: "14px", color: "#4b5563", marginBottom: "16px" }}>
                <strong>Current price:</strong> ${currentPrice.toFixed(2)}
              </p>
            )}

            {/* Shares input */}
            <div style={{ marginBottom: "12px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "4px",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                Shares:
              </label>
              <input
                type="number"
                value={shares}
                onChange={(e) => setShares(parseFloat(e.target.value) || 0)}
                step={1}
                placeholder="e.g. 10 or -5"
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "14px",
                }}
              />
              <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                Positive = Buy, Negative = Sell
              </p>
            </div>

            {/* Purchase Price input */}
            <div style={{ position: "relative", width: "100%", marginBottom: "12px" }}>
              <span
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#6b7280",
                  fontSize: "14px",
                }}
              >
                {currencySymbol}
              </span>

              <input
                type="number"
                value={purchasePrice ?? ""}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  if (isNaN(value) || value < 0) {
                    setPurchasePrice(0);
                  } else {
                    setPurchasePrice(value);
                  }
                }}
                min={0}
                step={0.01}
                placeholder="Current price"
                style={{
                  width: "100%",
                  padding: "8px 8px 8px 22px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "14px",
                  color: purchasePrice ? "#111827" : "#6b7280",
                  backgroundColor: "#f9fafb",
                }}
              />
            </div>

            {/* Notes input */}
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "4px",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                Notes:
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Optional notes..."
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "14px",
                  resize: "vertical",
                }}
              />
            </div>

            {/* Buttons */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              {/* Cancel */}
              <button
                onClick={onCancel}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#f3f4f6",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e5e7eb")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f3f4f6")}
              >
                Cancel
              </button>

              {/* Confirm */}
              <button
                onClick={handleConfirm}
                disabled={!isValid()}
                style={{
                  padding: "8px 16px",
                  backgroundColor: !isValid() ? "#9ca3af" : actionColor,
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: !isValid() ? "not-allowed" : "pointer",
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (isValid()) e.currentTarget.style.opacity = "0.9";
                }}
                onMouseLeave={(e) => {
                  if (isValid()) e.currentTarget.style.opacity = "1";
                }}
              >
                {actionLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EditCompanyDialog;

import React, { useEffect, useState } from "react";
import { getCurrentPrice } from "../services/api/quotes";

interface EditCompanyDialogProps {
  symbol: string;
  onCancel: () => void;
  onConfirm: (data: { shares: number; purchasePrice: number | null; notes: string }) => void;
}

const EditCompanyDialog: React.FC<EditCompanyDialogProps> = ({ symbol, onConfirm, onCancel }) => {
  const [shares, setShares] = useState<number>(1);
  const [purchasePrice, setPurchasePrice] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // const [currencySymbol, setCurrencySymbol] = useState("$");

  // currency symbol - easy to change or replace later
  const currencySymbol = "$";

  // 🧩 validation allowing default "Current price" (null) as valid
  const isValid = (): boolean => {
    // must have at least 1 share
    if (shares <= 0) return false;

    // purchasePrice can be undefined/null (means use current price)
    if (purchasePrice !== null && purchasePrice !== undefined && purchasePrice < 0) return false;

    // notes are always valid (optional)
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
    // Use explicit price if provided, otherwise use current price, otherwise send null
    const finalPrice =
      purchasePrice && purchasePrice > 0
        ? purchasePrice
        : currentPrice && currentPrice > 0
          ? currentPrice
          : null; // 👈 null means "no price specified — backend should use current price"

    onConfirm({
      shares,
      purchasePrice: finalPrice,
      notes,
    });
  };

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
      onClick={onCancel} // click outside to cancel
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
        onClick={(e) => e.stopPropagation()} // prevent accidental close
      >
        <h3
          style={{
            margin: "0 0 12px 0",
            fontSize: "18px",
            fontWeight: 600,
          }}
        >
          Add {symbol} to your portfolio
        </h3>

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
                onChange={(e) =>
                  setShares(Math.max(0, Math.floor(parseFloat(e.target.value)) || 0))
                }
                min={0}
                step={1} // ⬅️ erlaubt nur ganze Zahlen
                placeholder="e.g. 10"
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "14px",
                }}
              />
            </div>

            {/* Purchase Price input */}
            <div style={{ position: "relative", width: "100%", marginBottom: "12px" }}>
              {/* currency symbol, dynamically set */}
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
                  // allow manual input but only positive numbers
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
                  padding: "8px 8px 8px 22px", // padding for currency symbol
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
                  backgroundColor: !isValid() ? "#9ca3af" : "#10b981",
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
                Confirm
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EditCompanyDialog;

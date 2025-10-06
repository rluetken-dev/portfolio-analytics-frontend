import React, { useEffect, useState } from "react";
import { getCurrentPrice } from "../services/api/quotes";

interface AddCompanyDialogProps {
  symbol: string;
  onConfirm: (data: { shares: number; purchasePrice: number; notes: string }) => void;
  onCancel: () => void;
}

const AddCompanyDialog: React.FC<AddCompanyDialogProps> = ({ symbol, onConfirm, onCancel }) => {
  const [shares, setShares] = useState<number>(0);
  const [purchasePrice, setPurchasePrice] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = (): boolean => {
    if (shares <= 0) return false;
    if (!purchasePrice || purchasePrice <= 0) return false;
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
    if (!isValid()) {
      setError("Please enter valid numbers for shares and price.");
      return;
    }
    onConfirm({ shares, purchasePrice: purchasePrice!, notes });
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
            <div style={{ marginBottom: "12px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "4px",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                Purchase Price:
              </label>
              <input
                type="number"
                value={purchasePrice ?? ""}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  // Nur positive Zahlen zulassen
                  if (isNaN(value) || value <= 0) {
                    setPurchasePrice(0);
                    setError("Purchase price must be greater than 0.");
                  } else {
                    setPurchasePrice(value);
                    setError(null);
                  }
                }}
                min={0.01}
                step={0.01}
                placeholder="e.g. 150.00"
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "14px",
                }}
              />
              {purchasePrice === 0 && (
                <p style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>
                  Please enter a valid positive price.
                </p>
              )}
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
                disabled={!isValid()} // ⬅️ Button nur aktiv, wenn gültige Werte
                style={{
                  padding: "8px 16px",
                  backgroundColor: !isValid() ? "#9ca3af" : "#10b981", // grau wenn disabled
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

export default AddCompanyDialog;

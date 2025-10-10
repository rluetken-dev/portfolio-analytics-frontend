import React, { useEffect } from "react";

export interface InlineToastProps {
  message: string;
  type?: "success" | "error" | "info";
  durationMs?: number;
  onClose?: () => void;
}

/**
 * InlineToast – a clean, minimal toast message styled for the Portfolio UI.
 * Appears bottom-right and auto-hides after a short duration.
 */
const InlineToast: React.FC<InlineToastProps> = ({
  message,
  type = "success",
  durationMs = 2500,
  onClose,
}) => {
  const color = type === "success" ? "#10b981" : "#ef4444";

  useEffect(() => {
    const t = setTimeout(() => onClose?.(), durationMs);
    return () => clearTimeout(t);
  }, [onClose, durationMs]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        background: "#fff",
        border: `1px solid ${color}`,
        color,
        padding: "10px 14px",
        borderRadius: 10,
        fontSize: 13,
        boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        zIndex: 2000,
        transition: "opacity 0.3s ease",
      }}
    >
      {message}
    </div>
  );
};

export default InlineToast;

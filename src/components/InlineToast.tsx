import { useEffect } from "react";

export type InlineToastType = "success" | "error" | "info";

export interface InlineToastProps {
  message: string;
  type?: InlineToastType;
  durationMs?: number;
  onClose?: () => void;
}

const colorByType = {
  success: "#10b981",
  error: "#ef4444",
  info: "#2563eb",
} satisfies Record<InlineToastType, string>;

export default function InlineToast({
  message,
  type = "success",
  durationMs = 2500,
  onClose,
}: InlineToastProps) {
  const color = colorByType[type];

  useEffect(() => {
    const timeoutId = window.setTimeout(() => onClose?.(), durationMs);
    return () => window.clearTimeout(timeoutId);
  }, [onClose, durationMs]);

  return (
    <div
      role={type === "error" ? "alert" : "status"}
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
}
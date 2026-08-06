import { useEffect, useState } from "react";

export type NotificationType = "success" | "error" | "info";

interface NotificationProps {
  message: string;
  type: NotificationType;
  durationMs?: number;
  onClose: () => void;
}

const backgroundColorByType = {
  success: "#10b981",
  error: "#ef4444",
  info: "#2563eb",
} satisfies Record<NotificationType, string>;

export default function Notification({
  message,
  type,
  durationMs = 3000,
  onClose,
}: NotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const hideTimeoutId = window.setTimeout(() => {
      setIsVisible(false);
    }, durationMs);

    const closeTimeoutId = window.setTimeout(() => {
      onClose();
    }, durationMs + 300);

    return () => {
      window.clearTimeout(hideTimeoutId);
      window.clearTimeout(closeTimeoutId);
    };
  }, [durationMs, onClose]);

  const close = () => {
    setIsVisible(false);
    window.setTimeout(onClose, 300);
  };

  return (
    <button
      type="button"
      role={type === "error" ? "alert" : "status"}
      onClick={close}
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        padding: "12px 16px",
        border: 0,
        borderRadius: 8,
        backgroundColor: backgroundColorByType[type],
        color: "white",
        fontSize: 14,
        fontWeight: 500,
        zIndex: 1000,
        transform: isVisible ? "translateX(0)" : "translateX(100%)",
        opacity: isVisible ? 1 : 0,
        transition: "transform 0.3s ease, opacity 0.3s ease",
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      }}
    >
      {message}
    </button>
  );
}
import React, { useState, useEffect } from "react";

interface NotificationProps {
  message: string;
  type: "success" | "error" | "info";
  duration?: number; // ms
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, type, duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  // auto-close after duration
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // wait for fade out
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getStyles = () => {
    const baseStyles = {
      position: "fixed" as const,
      bottom: "20px",
      right: "20px",
      padding: "12px 16px",
      borderRadius: "8px",
      color: "white",
      fontSize: "14px",
      fontWeight: 500,
      zIndex: 1000,
      transform: isVisible ? "translateX(0)" : "translateX(100%)",
      opacity: isVisible ? 1 : 0,
      transition: "all 0.3s ease",
      cursor: "pointer",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    };

    const typeStyles = {
      success: { backgroundColor: "#10b981" },
      error: { backgroundColor: "#ef4444" },
      info: { backgroundColor: "#3b82f6" },
    };

    return { ...baseStyles, ...typeStyles[type] };
  };

  return (
    <div
      style={getStyles()}
      onClick={() => {
        setIsVisible(false);
        setTimeout(onClose, 300);
      }}
    >
      {message}
    </div>
  );
};

export default Notification;

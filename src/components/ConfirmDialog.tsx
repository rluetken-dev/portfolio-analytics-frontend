import React from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "danger" | "warning" | "info";
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  variant = "warning",
}) => {
  if (!isOpen) return null;

  // Determine button color based on variant
  const getConfirmButtonColor = () => {
    switch (variant) {
      case "danger":
        return "#ef4444"; // red for destructive actions
      case "warning":
        return "#f59e0b"; // orange for warnings
      case "info":
        return "#3b82f6"; // blue for neutral info
      default:
        return "#f59e0b";
    }
  };

  return (
    <>
      {/* Backdrop overlay */}
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
        onClick={onCancel} // Click outside to cancel
      >
        {/* Dialog box */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "400px",
            width: "90%",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            position: "relative",
          }}
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
        >
          {/* Title */}
          <h3
            style={{
              margin: "0 0 12px 0",
              fontSize: "18px",
              fontWeight: 600,
            }}
          >
            {title}
          </h3>

          {/* Message */}
          <p
            style={{
              margin: "0 0 24px 0",
              fontSize: "14px",
              color: "#4b5563",
              lineHeight: 1.5,
            }}
          >
            {message}
          </p>

          {/* Buttons */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "flex-end",
            }}
          >
            {/* Cancel button */}
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
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#e5e7eb";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#f3f4f6";
              }}
            >
              {cancelText}
            </button>

            {/* Confirm button */}
            <button
              onClick={onConfirm}
              style={{
                padding: "8px 16px",
                backgroundColor: getConfirmButtonColor(),
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConfirmDialog;

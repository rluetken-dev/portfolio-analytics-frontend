import { useId } from "react";

export type ConfirmDialogVariant = "danger" | "warning" | "info";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: ConfirmDialogVariant;
}

const confirmColorByVariant = {
  danger: "#ef4444",
  warning: "#f59e0b",
  info: "#2563eb",
} satisfies Record<ConfirmDialogVariant, string>;

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  variant = "warning",
}: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();

  if (!isOpen) {
    return null;
  }

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
        aria-describedby={messageId}
        onClick={(event) => event.stopPropagation()}
        style={{
          backgroundColor: "white",
          borderRadius: 12,
          padding: 24,
          maxWidth: 400,
          width: "100%",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
        }}
      >
        <h3
          id={titleId}
          style={{
            margin: "0 0 12px 0",
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          {title}
        </h3>

        <p
          id={messageId}
          style={{
            margin: "0 0 24px 0",
            fontSize: 14,
            color: "#4b5563",
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "flex-end",
          }}
        >
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
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: "8px 16px",
              backgroundColor: confirmColorByVariant[variant],
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {confirmText}
          </button>
        </div>
      </section>
    </div>
  );
}
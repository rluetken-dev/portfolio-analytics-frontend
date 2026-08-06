type SpinnerProps = {
  size?: number;
  color?: string;
  label?: string;
};

export function Spinner({ size = 16, color = "currentColor", label = "Loading" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `2px solid ${color}`,
        borderTopColor: "transparent",
        borderRadius: "50%",
        animation: "spin 0.6s linear infinite",
      }}
    />
  );
}
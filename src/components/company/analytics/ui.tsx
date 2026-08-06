import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  count?: string;
}

interface SectionGridProps {
  cols: number;
  children: ReactNode;
}

interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
}

export function SectionHeader({ title, count }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        opacity: 0.9,
        margin: "8px 2px 4px",
      }}
    >
      <span style={{ fontWeight: 600 }}>{title}</span>

      {count && (
        <span
          title="Available metrics in this section"
          style={{
            border: "1px solid #333",
            borderRadius: 6,
            padding: "1px 6px",
            fontSize: 10,
            opacity: 0.75,
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

export function SectionGrid({ cols, children }: SectionGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.max(cols, 1)}, minmax(0, 1fr))`,
        gap: 8,
      }}
    >
      {children}
    </div>
  );
}

export function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <div
      style={{
        border: "1px solid #333",
        borderRadius: 10,
        padding: 8,
        minHeight: 60,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <div style={{ fontSize: 11, opacity: 0.8 }}>{label}</div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          display: "flex",
          alignItems: "baseline",
          gap: 6,
        }}
      >
        {value}
      </div>

      {hint && (
        <div
          title={hint}
          style={{
            fontSize: 10,
            opacity: 0.7,
            marginTop: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
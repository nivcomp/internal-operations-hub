type StatusBadgeProps = {
  label: string;
  tone?: "neutral" | "warning" | "success" | "danger" | "info";
};

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return <span className={`status-badge ${tone}`}>{label}</span>;
}

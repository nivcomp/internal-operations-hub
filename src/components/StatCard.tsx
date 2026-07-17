type StatCardProps = {
  label: string;
  value: string | number;
  note?: string;
  tone?: "default" | "warning" | "success";
};

export function StatCard({ label, value, note, tone = "default" }: StatCardProps) {
  return (
    <article className={`stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </article>
  );
}

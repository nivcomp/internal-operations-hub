type PageHeaderProps = {
  title: string;
  subtitle: string;
};

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">Internal foundation</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="control-note">
        Yaniv controls pricing, scope, supplier assignment, and client-facing commitments.
      </div>
    </header>
  );
}

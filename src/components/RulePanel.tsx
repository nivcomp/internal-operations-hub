export function RulePanel() {
  return (
    <section className="rule-panel">
      <strong>Operating rules visible in this MVP</strong>
      <ul>
        <li>Client price and supplier cost stay separate.</li>
        <li>Suppliers never see client price or agency margin.</li>
        <li>Work starts only after payment is received or paid hours are available.</li>
        <li>Change requests must be priced and client-approved before becoming work.</li>
        <li>Supplier time must be approved before it becomes payable.</li>
      </ul>
    </section>
  );
}

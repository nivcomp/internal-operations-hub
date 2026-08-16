import { useState, type FormEvent } from "react";
import {
  ACCOUNTING_SYSTEM_OPTIONS,
  submitCashFlowLead,
  type CashFlowLeadSubmission,
} from "../services/cashFlowLeadsApi";

const EMPTY_FORM: CashFlowLeadSubmission = {
  firstName: "",
  lastName: "",
  companyName: "",
  phone: "",
  mobilePhone: "",
  email: "",
  physicalAddress: "",
  reasonForCashFlowSoftware: "",
  accountingSystem: "",
  accountingSystemOther: "",
  notes: "",
};

type FieldName = keyof CashFlowLeadSubmission;
type FormErrors = Partial<Record<FieldName | "consent", string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimSubmission(input: CashFlowLeadSubmission): CashFlowLeadSubmission {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value.trim()]),
  ) as CashFlowLeadSubmission;
}

function validate(input: CashFlowLeadSubmission, consent: boolean): FormErrors {
  const errors: FormErrors = {};
  const required: Array<[FieldName, string]> = [
    ["firstName", "׳™׳© ׳׳”׳–׳™׳ ׳©׳ ׳₪׳¨׳˜׳™."],
    ["lastName", "׳™׳© ׳׳”׳–׳™׳ ׳©׳ ׳׳©׳₪׳—׳”."],
    ["companyName", "׳™׳© ׳׳”׳–׳™׳ ׳©׳ ׳—׳‘׳¨׳”."],
    ["mobilePhone", "׳™׳© ׳׳”׳–׳™׳ ׳˜׳׳₪׳•׳ ׳¡׳׳•׳׳¨׳™."],
    ["email", "׳™׳© ׳׳”׳–׳™׳ ׳׳™׳׳™׳™׳."],
    ["reasonForCashFlowSoftware", "׳™׳© ׳׳”׳¡׳‘׳™׳¨ ׳‘׳§׳¦׳¨׳” ׳׳׳” ׳׳×׳ ׳׳—׳₪׳©׳™׳ ׳×׳•׳›׳ ׳”."],
    ["accountingSystem", "׳™׳© ׳׳‘׳—׳•׳¨ ׳׳¢׳¨׳›׳× ׳”׳ ׳”׳׳× ׳—׳©׳‘׳•׳ ׳•׳×."],
  ];

  required.forEach(([field, message]) => {
    if (!input[field]) errors[field] = message;
  });
  if (input.email && !EMAIL_PATTERN.test(input.email)) errors.email = "׳™׳© ׳׳”׳–׳™׳ ׳›׳×׳•׳‘׳× ׳׳™׳׳™׳™׳ ׳×׳§׳™׳ ׳”.";
  if (input.accountingSystem === "׳׳—׳¨" && !input.accountingSystemOther) {
    errors.accountingSystemOther = "׳™׳© ׳׳¦׳™׳™׳ ׳׳™׳–׳• ׳׳¢׳¨׳›׳× ׳”׳ ׳”׳׳× ׳—׳©׳‘׳•׳ ׳•׳× ׳™׳© ׳׳›׳.";
  }
  if (!consent) errors.consent = "׳™׳© ׳׳׳©׳¨ ׳׳× ׳©׳׳™׳¨׳× ׳”׳₪׳¨׳˜׳™׳ ׳•׳™׳¦׳™׳¨׳× ׳”׳§׳©׳¨.";
  return errors;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <span id={id} className="cashflow-field-error">{message}</span> : null;
}

export function AmirCashFlowPage() {
  const [form, setForm] = useState<CashFlowLeadSubmission>(EMPTY_FORM);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function update(field: FieldName, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const trimmed = trimSubmission(form);
    const nextErrors = validate(trimmed, consent);
    setForm(trimmed);
    setErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await submitCashFlowLead(trimmed);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSubmitError("׳׳ ׳”׳¦׳׳—׳ ׳• ׳׳©׳׳•׳¨ ׳׳× ׳”׳₪׳¨׳˜׳™׳ ׳›׳¨׳’׳¢. ׳ ׳¡׳• ׳©׳•׳‘ ׳‘׳¢׳•׳“ ׳¨׳’׳¢.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="cashflow-public-page" dir="rtl" lang="he">
      <div className="cashflow-public-shell">
        <header className="cashflow-brand-area">
          <div className="cashflow-brand-mark" aria-hidden>׳ </div>
          <div>
            <strong>׳ ׳™׳‘ ׳׳—׳©׳‘׳™׳</strong>
            <span>׳₪׳×׳¨׳•׳ ׳•׳× ׳׳¢׳©׳™׳™׳ ׳׳¢׳¡׳§׳™׳</span>
          </div>
        </header>

        <section className="cashflow-intro">
          <p className="eyebrow">׳ ׳™׳‘ ׳׳—׳©׳‘׳™׳</p>
          <h1>׳׳׳™׳¨ ׳×׳–׳¨׳™׳ ׳׳–׳•׳׳ ׳™׳</h1>
          <p>׳‘׳“׳™׳§׳× ׳”׳×׳׳׳” ׳׳×׳•׳›׳ ׳× ׳×׳–׳¨׳™׳ ׳׳–׳•׳׳ ׳™׳ ׳׳¢׳¡׳§</p>
        </section>

        {submitted ? (
          <section className="cashflow-success" role="status" aria-live="polite">
            <span aria-hidden>ג“</span>
            <h2>׳”׳₪׳¨׳˜׳™׳ ׳ ׳§׳׳˜׳• ׳‘׳”׳¦׳׳—׳”. ׳ ׳—׳–׳•׳¨ ׳׳׳™׳›׳ ׳‘׳”׳§׳“׳.</h2>
            <p>׳×׳•׳“׳” ׳©׳₪׳ ׳™׳×׳ ׳׳ ׳™׳‘ ׳׳—׳©׳‘׳™׳.</p>
          </section>
        ) : (
          <form className="cashflow-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
            <div className="cashflow-form-heading">
              <div>
                <h2>׳₪׳¨׳˜׳™ ׳”׳¢׳¡׳§ ׳•׳”׳¦׳•׳¨׳</h2>
                <p>׳׳׳׳• ׳׳× ׳”׳₪׳¨׳˜׳™׳ ׳•׳ ׳™׳¦׳•׳¨ ׳׳™׳×׳›׳ ׳§׳©׳¨ ׳׳‘׳“׳™׳§׳× ׳”׳×׳׳׳”.</p>
              </div>
              <span><b aria-hidden>*</b> ׳©׳“׳” ׳—׳•׳‘׳”</span>
            </div>

            <div className="cashflow-form-grid">
              <label>
                ׳©׳ ׳₪׳¨׳˜׳™ <b aria-hidden>*</b>
                <input
                  value={form.firstName}
                  onChange={(event) => update("firstName", event.target.value)}
                  autoComplete="given-name"
                  maxLength={120}
                  required
                  aria-invalid={Boolean(errors.firstName)}
                  aria-describedby={errors.firstName ? "first-name-error" : undefined}
                />
                <FieldError id="first-name-error" message={errors.firstName} />
              </label>

              <label>
                ׳©׳ ׳׳©׳₪׳—׳” <b aria-hidden>*</b>
                <input
                  value={form.lastName}
                  onChange={(event) => update("lastName", event.target.value)}
                  autoComplete="family-name"
                  maxLength={120}
                  required
                  aria-invalid={Boolean(errors.lastName)}
                  aria-describedby={errors.lastName ? "last-name-error" : undefined}
                />
                <FieldError id="last-name-error" message={errors.lastName} />
              </label>

              <label className="span-2">
                ׳©׳ ׳—׳‘׳¨׳” <b aria-hidden>*</b>
                <input
                  value={form.companyName}
                  onChange={(event) => update("companyName", event.target.value)}
                  autoComplete="organization"
                  maxLength={180}
                  required
                  aria-invalid={Boolean(errors.companyName)}
                  aria-describedby={errors.companyName ? "company-name-error" : undefined}
                />
                <FieldError id="company-name-error" message={errors.companyName} />
              </label>

              <label>
                ׳˜׳׳₪׳•׳
                <input
                  type="tel"
                  dir="ltr"
                  value={form.phone}
                  onChange={(event) => update("phone", event.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={40}
                />
              </label>

              <label>
                ׳˜׳׳₪׳•׳ ׳¡׳׳•׳׳¨׳™ <b aria-hidden>*</b>
                <input
                  type="tel"
                  dir="ltr"
                  value={form.mobilePhone}
                  onChange={(event) => update("mobilePhone", event.target.value)}
                  autoComplete="tel-national"
                  inputMode="tel"
                  maxLength={40}
                  required
                  aria-invalid={Boolean(errors.mobilePhone)}
                  aria-describedby={errors.mobilePhone ? "mobile-phone-error" : undefined}
                />
                <FieldError id="mobile-phone-error" message={errors.mobilePhone} />
              </label>

              <label>
                ׳׳™׳׳™׳™׳ <b aria-hidden>*</b>
                <input
                  type="email"
                  dir="ltr"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  maxLength={254}
                  required
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
                <FieldError id="email-error" message={errors.email} />
              </label>

              <label>
                ׳›׳×׳•׳‘׳× ׳₪׳™׳–׳™׳×
                <input
                  value={form.physicalAddress}
                  onChange={(event) => update("physicalAddress", event.target.value)}
                  autoComplete="street-address"
                  maxLength={300}
                />
              </label>

              <label className="span-2">
                ׳׳׳” ׳׳×׳ ׳׳—׳₪׳©׳™׳ ׳×׳•׳›׳ ׳” ׳׳×׳–׳¨׳™׳ ׳׳–׳•׳׳ ׳™׳? <b aria-hidden>*</b>
                <textarea
                  rows={5}
                  value={form.reasonForCashFlowSoftware}
                  onChange={(event) => update("reasonForCashFlowSoftware", event.target.value)}
                  maxLength={4000}
                  required
                  aria-invalid={Boolean(errors.reasonForCashFlowSoftware)}
                  aria-describedby={errors.reasonForCashFlowSoftware ? "reason-error" : undefined}
                />
                <FieldError id="reason-error" message={errors.reasonForCashFlowSoftware} />
              </label>

              <label className="span-2">
                ׳׳™׳–׳• ׳׳¢׳¨׳›׳× ׳”׳ ׳”׳׳× ׳—׳©׳‘׳•׳ ׳•׳× ׳™׳© ׳׳›׳? <b aria-hidden>*</b>
                <select
                  value={form.accountingSystem}
                  onChange={(event) => {
                    update("accountingSystem", event.target.value);
                    if (event.target.value !== "׳׳—׳¨") update("accountingSystemOther", "");
                  }}
                  required
                  aria-invalid={Boolean(errors.accountingSystem)}
                  aria-describedby={errors.accountingSystem ? "accounting-system-error" : undefined}
                >
                  <option value="">׳‘׳—׳¨׳• ׳׳¢׳¨׳›׳×</option>
                  {ACCOUNTING_SYSTEM_OPTIONS.map((system) => <option key={system} value={system}>{system}</option>)}
                </select>
                <FieldError id="accounting-system-error" message={errors.accountingSystem} />
              </label>

              {form.accountingSystem === "׳׳—׳¨" ? (
                <label className="span-2">
                  ׳׳™׳–׳• ׳׳¢׳¨׳›׳×? <b aria-hidden>*</b>
                  <input
                    value={form.accountingSystemOther}
                    onChange={(event) => update("accountingSystemOther", event.target.value)}
                    maxLength={180}
                    required
                    aria-invalid={Boolean(errors.accountingSystemOther)}
                    aria-describedby={errors.accountingSystemOther ? "accounting-system-other-error" : undefined}
                  />
                  <FieldError id="accounting-system-other-error" message={errors.accountingSystemOther} />
                </label>
              ) : null}

              <label className="span-2">
                ׳”׳¢׳¨׳•׳× ׳ ׳•׳¡׳₪׳•׳×
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) => update("notes", event.target.value)}
                  maxLength={4000}
                />
              </label>
            </div>

            <label className="cashflow-consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => {
                  setConsent(event.target.checked);
                  setErrors((current) => ({ ...current, consent: undefined }));
                }}
                required
                aria-invalid={Boolean(errors.consent)}
                aria-describedby={errors.consent ? "consent-error" : undefined}
              />
              <span>׳׳ ׳™ ׳׳׳©׳¨/׳× ׳׳ ׳™׳‘ ׳׳—׳©׳‘׳™׳ ׳׳©׳׳•׳¨ ׳׳× ׳”׳₪׳¨׳˜׳™׳ ׳•׳׳™׳¦׳•׳¨ ׳׳™׳×׳™ ׳§׳©׳¨ ׳׳’׳‘׳™ ׳×׳•׳›׳ ׳× ׳×׳–׳¨׳™׳ ׳׳–׳•׳׳ ׳™׳.</span>
            </label>
            <FieldError id="consent-error" message={errors.consent} />

            {submitError ? <p className="cashflow-submit-error" role="alert">{submitError}</p> : null}

            <button className="primary-button cashflow-submit" type="submit" disabled={submitting || !consent}>
              {submitting ? "׳©׳•׳׳—׳™׳ ׳׳× ׳”׳₪׳¨׳˜׳™׳ג€¦" : "׳©׳׳™׳—׳× ׳₪׳¨׳˜׳™׳"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}


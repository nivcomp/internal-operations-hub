import { supabase } from "../integrations/supabase/client";
import type { Tables } from "../integrations/supabase/types";

export const CASH_FLOW_LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "not_relevant",
  "converted",
] as const;

export type CashFlowLeadStatus = (typeof CASH_FLOW_LEAD_STATUSES)[number];
export type CashFlowLead = Tables<"cash_flow_leads">;

export const ACCOUNTING_SYSTEM_OPTIONS = [
  "רווחית",
  "חשבשבת",
  "פריוריטי",
  "חשבונית ירוקה",
  "Excel",
  "כספית",
  "iCount",
  "SAP Business One",
  "Odoo",
  "Zoho Books",
  "QuickBooks",
  "אחר",
] as const;

export type CashFlowLeadSubmission = {
  firstName: string;
  lastName: string;
  companyName: string;
  phone: string;
  mobilePhone: string;
  email: string;
  physicalAddress: string;
  reasonForCashFlowSoftware: string;
  accountingSystem: string;
  accountingSystemOther: string;
  notes: string;
};

function trimmedOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

export async function submitCashFlowLead(input: CashFlowLeadSubmission): Promise<void> {
  const { error } = await supabase.from("cash_flow_leads").insert({
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    company_name: input.companyName.trim(),
    phone: trimmedOrNull(input.phone),
    mobile_phone: input.mobilePhone.trim(),
    email: input.email.trim().toLocaleLowerCase("en"),
    physical_address: trimmedOrNull(input.physicalAddress),
    reason_for_cash_flow_software: input.reasonForCashFlowSoftware.trim(),
    accounting_system: input.accountingSystem.trim(),
    accounting_system_other: input.accountingSystem === "אחר"
      ? trimmedOrNull(input.accountingSystemOther)
      : null,
    notes: trimmedOrNull(input.notes),
    source: "amir_cashflow_form",
    status: "new",
  });

  if (error) throw new Error(error.message);
}

export async function listCashFlowLeads(): Promise<CashFlowLead[]> {
  const { data, error } = await supabase
    .from("cash_flow_leads")
    .select("id, created_at, first_name, last_name, company_name, phone, mobile_phone, email, physical_address, reason_for_cash_flow_software, accounting_system, accounting_system_other, notes, source, status")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateCashFlowLeadStatus(
  leadId: string,
  status: CashFlowLeadStatus,
): Promise<CashFlowLead> {
  const { data, error } = await supabase
    .from("cash_flow_leads")
    .update({ status })
    .eq("id", leadId)
    .select("id, created_at, first_name, last_name, company_name, phone, mobile_phone, email, physical_address, reason_for_cash_flow_software, accounting_system, accounting_system_other, notes, source, status")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

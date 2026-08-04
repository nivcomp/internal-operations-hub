/** CRM layer: leads, notes and historical projects imported from spreadsheets. */

export type LeadStage =
  | "new"
  | "contacted"
  | "qualified"
  | "meeting"
  | "proposal_sent"
  | "negotiation"
  | "won"
  | "lost"
  | "on_hold";

export const LEAD_STAGES: LeadStage[] = [
  "new", "contacted", "qualified", "meeting", "proposal_sent", "negotiation", "won", "lost", "on_hold",
];

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  stage: LeadStage;
  status: string;
  serviceInterest: string | null;
  estimatedValue: number | null;
  currency: string;
  notes: string;
  tags: string[];
  nextFollowUpAt: string | null;
  lastContactAt: string | null;
  convertedClientId: string | null;
  convertedAt: string | null;
  archivedAt: string | null;
  importBatchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactNote {
  id: string;
  leadId: string | null;
  clientId: string | null;
  projectId: string | null;
  body: string;
  noteType: string;
  originalSource: string | null;
  createdAt: string;
}

export interface PastProjectRecord {
  id: string;
  clientId: string | null;
  leadId: string | null;
  projectName: string;
  description: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  value: number | null;
  currency: string;
  technologies: string[];
  outcome: string;
  notes: string;
  createdAt: string;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  fileType: string;
  importedAt: string;
  totalRows: number;
  successfulRows: number;
  skippedRows: number;
  failedRows: number;
  status: string;
}

/** Where a source column ends up. `note` appends the value to the record notes. */
export type TargetField =
  | "ignore"
  | "note"
  | "name"
  | "company"
  | "email"
  | "phone"
  | "source"
  | "stage"
  | "status"
  | "service_interest"
  | "estimated_value"
  | "currency"
  | "notes"
  | "tags"
  | "next_follow_up_at"
  | "last_contact_at"
  | "project_name"
  | "description"
  | "start_date"
  | "end_date"
  | "value"
  | "technologies"
  | "outcome";

export type SheetType = "leads" | "clients" | "contacts" | "past_projects" | "notes" | "unknown";

export type ColumnMapping = {
  column: string;
  target: TargetField;
  confidence: "high" | "medium" | "low";
  samples: string[];
};

export type SheetPlan = {
  sheetName: string;
  sheetType: SheetType;
  headers: string[];
  rowCount: number;
  rows: Record<string, string>[];
  mapping: ColumnMapping[];
  warnings: string[];
  include: boolean;
};

export type DuplicateMatch = {
  rowIndex: number;
  reason: "email" | "phone" | "company" | "name";
  matchType: "client" | "lead";
  matchId: string;
  matchLabel: string;
};

export type PreviewResult = {
  sheetName: string;
  sheetType: SheetType;
  toCreate: number;
  toUpdate: number;
  duplicates: DuplicateMatch[];
  invalidEmails: number[];
  invalidPhones: number[];
  missingRequired: number[];
  ignoredColumns: string[];
  notesToAppend: number;
};

export type RowResolution = "create" | "skip" | "merge" | "update" | "review_later";

export type ImportRunResult = {
  batchId: string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: { rowIndex: number; message: string }[];
};

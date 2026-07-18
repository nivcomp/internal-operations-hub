import type { Agency, User } from "../types/domain";

// Static agency configuration (not persisted yet — first-user MVP).
export const agency: Agency = {
  id: "agency-1",
  name: "Yaniv Studio",
  defaultCurrency: "GBP",
  marginTargetPercent: 35,
  settings: {
    requiresPaymentBeforeWork: true,
    requiresAgencyApprovalForChanges: true,
  },
};

// Static internal user configuration (auth is out of scope for this task).
export const users: User[] = [
  { id: "user-yaniv", name: "Yaniv", email: "yaniv@example.com", role: "agency_admin" },
];

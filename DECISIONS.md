# Decisions

This file records product and architecture decisions that future automation runs should not reopen without new evidence.

## Decision format

### YYYY-MM-DD — Decision title

**Decision**  
What was decided.

**Reason**  
Why this direction was selected.

**Alternatives considered**  
Other relevant options.

**Consequences**  
Expected impact, constraints, and follow-up work.

---

### 2026-07-11 — Internal operating system first

**Decision**  
The first product is an internal operating system for Yaniv's own agency workflow, not a public self-serve SaaS application.

**Reason**  
The immediate value comes from solving a real workflow involving clients, suppliers, pricing, approvals, payments, hours, and change control.

**Alternatives considered**  
Starting with multi-tenant SaaS onboarding and generalized agency features.

**Consequences**  
Prefer practical internal screens and workflow rules. Do not add generalized SaaS complexity unless required by the internal MVP.

### 2026-07-11 — Agency retains final authority

**Decision**  
AI may assist with drafts, structure, summaries, and recommendations, but it cannot make final scope, pricing, supplier, payment, or work-start decisions.

**Reason**  
These decisions affect commitments, cost, margin, and delivery risk.

**Alternatives considered**  
Allowing AI to approve scopes, assign suppliers, or start work automatically.

**Consequences**  
Important AI outputs must remain reviewable and require an explicit human action before changing business status.

### 2026-07-11 — Approval and payment gate work start

**Decision**  
Supplier work must not begin until the required client approval and payment or paid-hours conditions are satisfied.

**Reason**  
This protects cash flow, margin, and scope control.

**Alternatives considered**  
Allowing work to begin on verbal agreement or pending payment.

**Consequences**  
Readiness and blocked reasons must be explicit domain state and visible in the interface.

### 2026-07-11 — Preserve the current React/Vite foundation

**Decision**  
Continue with the existing React, TypeScript, and Vite application foundation unless a documented requirement proves it unsuitable.

**Reason**  
The repository already contains useful screens, domain types, mock data, and workflows. Rewriting would delay validation of the product workflow.

**Alternatives considered**  
Immediate framework replacement or a full rebuild.

**Consequences**  
Improve incrementally. Introduce persistence and integrations in stages rather than replacing the whole application.

### 2026-07-14 - Supplier assignment does not unlock work start

**Decision**  
Local supplier assignment can happen as project planning, but it does not make a project ready to start.

**Reason**  
Yaniv may need to plan supplier coverage before final approval or payment, while the business rule still requires approved scope and payment or available paid hours before work begins.

**Alternatives considered**  
Only allowing assignment after all start gates are open, or treating assignment as the ready-to-start trigger.

**Consequences**  
Ready-to-start views must use the shared start rule instead of checking only assignment or payment status.

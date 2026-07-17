# AI Agents Plan

AI should support the workflow without taking control away from Yaniv.

No real AI integrations should be built in the documentation foundation. The first app should create placeholder sections and data structures that can support AI later.

## Client Guide Agent

Purpose:

- Help clients explain what they need.
- Turn unclear requests into structured answers.
- Suggest missing discovery questions.

Outputs:

- Draft intake summary
- Follow-up questions
- Client-friendly project summary

## Agency Control Agent

Purpose:

- Help Yaniv review briefs, scope, pricing, and delivery risk.
- Highlight missing assumptions, exclusions, or approval gaps.

Outputs:

- Scope risk notes
- Pricing review prompts
- Approval checklist

## Supplier Work Agent

Purpose:

- Help suppliers understand assigned work.
- Summarize instructions and open questions.
- Draft progress updates.

Outputs:

- Supplier task summary
- Update draft
- Blocker summary

## Architect Agent

Purpose:

- Convert project goals into technical or delivery plans.
- Suggest phases, dependencies, and implementation notes.

Outputs:

- Draft project architecture
- Phase breakdown
- Delivery assumptions

## Change Control Agent

Purpose:

- Help classify change requests.
- Compare requests against approved scope.
- Suggest pricing and delivery impact areas for Yaniv to review.

Outputs:

- Change summary
- Scope impact
- Pricing review notes

## AI Safety Rules

- AI does not send final client commitments.
- AI does not approve scope.
- AI does not set final pricing.
- AI does not assign suppliers.
- AI does not mark payment as received.
- AI suggestions should be editable before use.

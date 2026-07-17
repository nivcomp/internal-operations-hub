# Pricing and Margin

Pricing is controlled by Yaniv. The system must keep client price and supplier cost separate.

## Core Pricing Concepts

- Client price is what the client is charged.
- Supplier cost is what the agency expects to pay suppliers.
- Margin is the difference between client price and supplier cost.
- Client-facing pricing should not reveal supplier costs.
- Supplier-facing work should not reveal client price or margin.

## Margin Calculation

Basic margin:

`client price - supplier cost = gross margin`

Margin percentage:

`gross margin / client price * 100`

The UI should make low-margin projects visible before approval.

## Pricing Workflow

1. Project enters pricing review.
2. Yaniv estimates supplier work and cost.
3. Yaniv sets client price.
4. System shows estimated margin.
5. Yaniv adjusts scope, pricing, or supplier plan if margin is too low.
6. Only approved pricing is shared with the client.

## Change Request Pricing

Client change requests are not free work by default.

Every change request should move through:

- Submitted
- Agency review
- Priced
- Client approval
- Ready for work

Supplier work should not begin until the change is priced and approved.

## Hour-Based Work

For hour bank projects:

- Client must have paid hours available.
- Supplier time should reduce available hours only after approval.
- Yaniv should be able to see used, remaining, and pending hours.

## Future Integrations

Payment provider and accounting integrations can come later. The MVP only needs manual payment status and clear records.

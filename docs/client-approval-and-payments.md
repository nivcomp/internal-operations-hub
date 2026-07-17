# Client Approval and Payments

Client approval and payment status are key gates before work starts.

## Client Approval Flow

1. Yaniv prepares scope and price.
2. Client receives client-facing scope.
3. Client can approve, reject, or request changes.
4. Approval is recorded with date and notes.
5. Approved scope becomes the delivery baseline.

## Payment Gate

Work should not begin until one of these is true:

- Required payment is marked as received.
- Enough paid hours are available in the client's hour bank.

This should be visible on the project detail page.

## Payment Records

The MVP can use manual payment tracking.

Fields:

- Project
- Amount
- Currency
- Status
- Due date
- Received date
- Notes

## Client-Facing Payment Status

Client can see simple payment state:

- Not due
- Payment requested
- Received
- More hours needed

Client should not see supplier cost, supplier payment, or margin.

## Change Requests After Approval

After scope approval, new client requests should become change requests. They should not silently change the approved scope.

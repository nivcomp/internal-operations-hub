# Fix: client registration fails with "supabaseUrl is required"

## What is happening

On the live domain, a client fills the registration form, presses the button, and gets a red error
box saying `supabaseUrl is required.` No account is created.

The registration screen itself loads because it uses its own hard-coded fallback connection values.
But the moment it needs to create the actual account, it loads the shared backend client, which
reads its address only from build-time environment variables. In the published bundle those values
are missing, so the client throws before any request is sent.

## The fix

Make the public registration path independent of the shared client, exactly the way the rest of
that file already is.

1. In `src/services/publicRegistrationApi.ts`, stop importing the shared client inside
   `createAccount`, `claimAccount`, and `resendVerification`.
2. Create one small dedicated auth client (or plain `fetch` calls to the auth endpoints) built from
   the same `PROJECT_ID` / `PUBLISHABLE_KEY` constants already defined at the top of that file,
   which include working fallbacks.
3. Keep the session behaviour identical: sign-up stores the session so the person lands in their
   workspace immediately, and `claimAccount` still sends the access token.
4. Show a clearer Hebrew error if the backend genuinely rejects the sign-up, instead of a raw
   internal message.

No changes to business logic, database schema, RLS, edge functions, or UI layout.

## Verification

- `pnpm run build`
- Load `/join/client?c=<code>` locally, register a test address, confirm the account is created and
  the AI intake workspace opens.
- Repeat for `/join/supplier`.
- Then republish so the live domain gets the fixed bundle.

## Note

Even after this fix, the published site should be republished — the current live bundle is stale.

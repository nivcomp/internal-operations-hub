# Roles and Permissions

The first version should keep permissions simple and explicit.

## Agency Admin

Agency Admin is Yaniv.

Can:

- Create and edit clients.
- Create and edit projects.
- Create briefs and scopes.
- Set client price.
- Set supplier cost estimates.
- View margin.
- Assign suppliers.
- Approve supplier skill suggestions.
- Review and approve supplier time entries.
- Mark client payments as received.
- Manage hour banks.
- Review and price change requests.
- Control what is visible to clients and suppliers.

## Client

Client users should only see their own client-facing information.

Can:

- Submit intake information.
- Continue an open pre-project lead conversation and read agency messages in it.
- Submit a pre-project brief for agency review.
- View project status.
- View client-facing brief and scope.
- Approve or reject scope.
- Withdraw an accidental MVP approval and return the exact version for corrections.
- Request changes.
- Upload or share files and links.
- View payment status and paid-hour balance.
- Send project messages.

Cannot:

- Create a project or request an MVP while still a lead.
- Resume a paused or closed lead conversation.
- See supplier cost.
- See agency margin.
- See supplier payment details.
- Assign suppliers.
- Change project scope without agency review.

## Supplier

Supplier users should only see assigned work and supplier-relevant information.

Can:

- Complete onboarding profile.
- View assigned projects or tasks.
- View supplier-facing scope items and instructions.
- Submit updates.
- Log time.
- See approved time and amount owed.
- Suggest additional skills during onboarding.

Cannot:

- See client price.
- See agency margin.
- See unrelated client projects.
- Make client-facing commitments.
- Start work before the project is marked ready.
- Convert client change requests into work without agency approval.

## Permission Rule

When in doubt, show less. Yaniv can expose more manually later.

Pre-project lead conversations follow the same rule: client-visible messages and agency-only notes are stored separately, and only an active agency admin can promote the lead into a project.

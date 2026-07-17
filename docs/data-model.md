# Data Model

This is the practical planning model for the first build. Names can become database tables or TypeScript types later.

## Core Records

### Agency

- id
- name
- default currency
- margin target
- settings

### User

- id
- name
- email
- role
- linked client id
- linked supplier id

### Client

- id
- name
- company
- email
- phone
- notes
- status

### Project

- id
- client id
- name
- status
- summary
- budget signal
- payment gate status
- assigned supplier ids
- created date
- updated date

### Project Brief

- id
- project id
- problem statement
- goals
- assumptions
- constraints
- exclusions
- discovery notes
- AI draft notes
- final agency notes

### Scope

- id
- project id
- version
- status
- client-facing summary
- internal delivery notes
- approved date

### Scope Item

- id
- scope id
- title
- description
- phase
- client visible
- supplier visible
- acceptance notes

### Project Pricing

- id
- project id
- currency
- client price
- supplier cost estimate
- target margin
- actual margin
- pricing notes

### Phase Pricing

- id
- pricing id
- phase name
- client price
- supplier cost
- notes

### Approval

- id
- project id
- scope id
- approver role
- status
- approved date
- notes

### Client Payment

- id
- project id
- amount
- currency
- status
- due date
- received date
- notes

### Hour Bank

- id
- client id
- project id
- hours purchased
- hours used
- hours remaining
- expiry date

### Supplier

- id
- name
- email
- phone
- country
- timezone
- status

### Supplier Profile

- supplier id
- languages
- main skills
- tools
- years of experience
- hourly rate
- weekly availability
- portfolio links
- notes

### Supplier Skill Suggestion

- id
- supplier id
- suggested skill
- source text
- status
- reviewed by

### Time Entry

- id
- project id
- supplier id
- date
- hours
- description
- status
- approved by

### Supplier Payment

- id
- supplier id
- project id
- amount owed
- amount paid
- currency
- status

### Change Request

- id
- project id
- requested by client id
- title
- description
- status
- agency price
- supplier cost
- approved date

### File Link

- id
- project id
- title
- url
- file type
- visibility
- added by

### Project Message

- id
- project id
- author role
- body
- visibility
- created date

### Decision Log

- id
- project id
- decision
- made by role
- impact
- created date

## Status Principles

Statuses should describe operational reality, not just labels. The system should make it obvious what is blocked and who owns the next action.

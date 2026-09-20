# Trip Copilot

End-to-end implementation workspace for the frozen Trip Copilot v1 product contract. This repository is **not a prototype**: the target is a deployable, persistent product covering the complete approved current scope.

## Governing authority

```text
Roadmap v1.7
    ↓
Integrated Spec v1.3.1 — FINAL FREEZE
    ↓
Block 3 v1.2 — FINAL FREEZE
    ↓
Implementation
    ↓
QA / END-TO-END VALIDATION
    ↓
Deployment / Pilot
```

No downstream code may silently change product scope. Current/future boundaries are enforced in the domain layer and tests.

## Engineering baseline

- Next.js / TypeScript
- PostgreSQL + Prisma
- Clerk authentication
- Inngest background jobs
- Cloudflare R2 object storage with local filesystem fallback
- OpenAI Responses API + Structured Outputs behind the application AI boundary

## Current product surface implemented

- Account / identity
- Multi-channel ingestion: manual, text, PDF, email webhook, WhatsApp webhook
- Secure source preservation + parsing
- AI candidate extraction with per-field confidence/evidence
- Validation, provenance and deduplication
- Canonical TRIP + SEGMENT persistence
- Timeline + inferred connections
- Right Now
- Daily Briefing + notification ledger
- Documents + retention/deletion workflow
- Budget + Preferences
- Expenses + corrections
- Conflict lifecycle and dismissal semantics
- Group travel
- Safety consent + one-time location share + trusted contacts
- Offline/PWA read cache
- ICS + Google Calendar export/link
- Contextual referral instrumentation
- Events, audit log, transactional outbox, idempotency ledger

## Deliberate non-scope

No current endpoints or active infrastructure are provided for live monitoring, disruption recovery, rebooking, autonomous supplier action, booking execution, payments, planning automation, TripIt import/export, or screenshot/image ingestion.

## Local development

1. Copy `.env.example` to `.env.local`.
2. Start PostgreSQL (for example `docker compose up -d db`).
3. Run `npm install`.
4. Run `npm run db:generate`.
5. Run `npm run db:migrate`.
6. Run `npm run db:seed`.
7. Run `npm run dev`.

For local no-credential development, keep `DEV_AUTH_BYPASS=true` and use the included deterministic tenant/traveler IDs. For a real environment, disable the bypass and configure Clerk, OpenAI, Inngest and R2.

## Validation

`npm run test` runs dependency-free core and contract tests. `npm run typecheck` and `npm run build` require dependencies to be installed.

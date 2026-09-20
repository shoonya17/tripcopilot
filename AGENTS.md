# Trip Copilot Engineering Rules

## Authority

Roadmap v1.7 > Integrated Spec v1.3.1 > Block 3 v1.2 > code.

The repository contains implementation, not a new product specification. A material product change requires an explicit versioned governance change before code changes.

## Canonical truth

The server/database owns canonical trip truth. AI output, parser output, frontend state, PWA caches, source documents, notifications and derived views are not systems of record.

## AI boundary

AI is an interpreter. It emits candidate data only. Every candidate must pass validation, provenance and deduplication before canonical commit. Source content is untrusted data and never instruction authority.

## Mutation safety

Every mutable canonical record uses `row_version` optimistic concurrency. Required mutation endpoints use tenant-scoped `Idempotency-Key`. Canonical mutation + provenance + event/outbox write must remain transactional.

## Current/future boundary

Do not activate live monitoring, disruption recovery, autonomous action, planning, booking execution, payments, TripIt import/export, screenshot/image ingestion or other future capabilities merely because future architecture is described.

## Offline

Offline/PWA is read-only in the current build. Canonical writes require connectivity.

## Code review

Prefer vertical, end-to-end increments. A feature is complete only when persistence, domain behavior, API surface, UI surface where applicable, failure handling and tests are all present.

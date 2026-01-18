---
name: storage-adapter-plan
overview: Define backend-agnostic storage adapter interface and outline migration path from Firestore-bound repos to adapter-based services without implementing Firestore adapter yet.
todos:
  - id: identify-ops
    content: Inventory current operations/query patterns to cover
    status: completed
  - id: design-interface
    content: Draft storage adapter interface and result metadata
    status: completed
  - id: error-contract
    content: Define shared error shape and mapping guidance
    status: completed
  - id: service-mapping
    content: Outline service delegation/bridge to adapter
    status: completed
---

# Storage Adapter Abstraction

- Scope anchors: Follow current domain operations and data model in [src/data/models.ts](src/data/models.ts); keep Phase 1 simplifications from [SPECIFICATION.md](SPECIFICATION.md) and defer items in [LATER.md](LATER.md).
- Goal: Replace repo/service layer coupling to Firestore with a single storage adapter interface that can back any future adapter; Firestore implementation stays as-is for now (no adapter written yet).

## Plan

- **Inventory needs**: List required domain operations and query patterns from existing services and repo usage: root listing, node fetch with children, children listing, node create/update, field CRUD, card ordering helper, field history read/write, cascade delete expectations (Phase 1: leaf-only per LATER), undo snapshot expectations (in-memory only).
- **Design adapter surface**: Draft a `StorageAdapter` interface (e.g., `src/data/storage/storageAdapter.ts`) with domain-shaped methods (not Firestore API). Include minimal shared result wrapper for data + metadata (e.g., timestamps, maybe `etag`/`rev` placeholder), and a normalized error shape (code, message, retryable boolean, cause optional) for friendly handling.
- **Map queries to adapter**: Define which adapter methods support which query patterns (by `parentId`, by `dataFieldId`, by `treeID` if already present). Keep Phase 1 indexes only; defer breadcrumb/ancestor and cardOrdering expansions per LATER.
- **Integrate at service boundary**: Outline how `getNodeService`/`getFieldService` would delegate to the adapter (thin translation layer). Plan to leave Firestore repo functions intact behind a temporary bridge until a Firestore adapter is written.
- **Return types & metadata**: Decide on adapter return contracts (Promise of data, plus light metadata structure). Keep minimal: `updatedAt`, `updatedBy` passthrough; note future extensibility for sync states without implementing.
- **Error handling standard**: Specify a friendly error contract and mapping to UI (Snackbar) with categories (not-found, validation, conflict, transient). Plan to add a small helper module for creating these errors.
- **Testing strategy**: Recommend an in-memory adapter stub for unit tests (not implemented now) and how services can be swapped via existing `setNodeService/setFieldService` hooks.

## Todos

- identify-ops: Inventory current service/repo operations and query patterns to cover in the adapter.
- design-interface: Draft `StorageAdapter` interface with domain-shaped methods and minimal result metadata.
- error-contract: Define shared error shape and mapping guidance for UI-friendly messaging.
- service-mapping: Outline how node/field services will delegate to the adapter and how to bridge existing Firestore repos until an adapter exists.
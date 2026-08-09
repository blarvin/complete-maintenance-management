---
name: user-profile
description: Who the user is and how they think about this codebase
metadata: 
  node_type: memory
  type: user
  originSessionId: 0a9adc95-2652-408c-b66e-79d2b92e3963
---

Solo developer prototyping a local-first asset/maintenance-management app (Qwik + Dexie/IndexedDB, Firestore as a dumb sync mirror). Architecturally sophisticated: thinks in **seams, capabilities, and the registry/manifest model** (one `Element`, immutable `kind`, behaviour in a per-kind manifest; six capability descriptors). Strong preference for **building the structural seam first, then deferring consumers** until a concrete kind forces the shape — and for **genericity without overbuild** (e.g. a generic `NavigableRow` over a jobs special-case, but no formal render-location schema axis until it's actually needed).

Keeps a set of living planning docs and expects them treated as source-of-truth and kept in sync: SPECIFICATION.md (framework), ELEMENT-MODEL.md (kind catalogue), code-work-map.md (the work map with ◐/✅ markers), ISSUES.md / IMPLEMENTATION.md / LATER.md. See [[working-style-docs-and-smells]] for the workflow expectations.

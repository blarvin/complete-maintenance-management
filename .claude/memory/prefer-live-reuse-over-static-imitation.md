---
name: prefer-live-reuse-over-static-imitation
description: For preview/read-only surfaces, wire the real component in a real mode rather than building a static imitation
metadata:
  type: feedback
---

When a surface needs to *show* what something is, reach for the real component
in an existing mode (`pendingMode` over local state, a controlled config
component) before writing a read-only renderer for it. Twice in the Library-lens
build (2026-08-20) the user pushed a static rendering toward a live one: an inert
Definition preview became a live microcosm, and a static "kind + schema list"
became an archetype (live instance above live `ConfigRows`, knob edits
re-rendering the instance).

**Why:** what distinguishes two things of the same kind is their *behaviour* —
an enum's options, a number's thresholds and units. A static picture cannot show
behaviour, so a preview built to imitate one teaches less and drifts from the
real thing. The app's components already support ephemeral modes, so "live"
usually costs less code than the imitation would.

**How to apply:** check whether the component is already controlled or accepts
`pendingMode`/`config` before designing a read-only path. Make safety come from
the data (a synthetic id with no Element behind it) rather than from disabling
the UI — then verify nothing escaped by reading IndexedDB and the sync queue
after interacting. Disable only the affordances that address a *real* id (e.g.
Delete). See [[user-profile]] and [[working-style-docs-and-smells]].

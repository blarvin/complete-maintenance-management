---
name: working-style-docs-and-smells
description: How the user wants slices finished — doc-sync ritual + proactive smell-surfacing
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0a9adc95-2652-408c-b66e-79d2b92e3963
---

When a slice of work lands, the user expects two things beyond the code:

1. A **doc-sync ritual** (only *after* they confirm it works in the app): update ISSUES.md (one-screen; delete done items, don't check off), IMPLEMENTATION.md (a note in the existing **"non-obvious choices" bulleted voice**), LATER.md (deferrals), and code-work-map.md (flip the ◐/✅ markers). Match each doc's established voice.
2. **Proactive surfacing** of smells, quirks, tangents, latent observations, and lurking bugs at slice boundaries — they explicitly ask for this and value the happy-path-plus-caveats read, not just "done."

Also: decide a capability's/kind's concrete shape **on a forcing kind, not in the abstract** — park richer behaviour to LATER.md until a second consumer forces it (this is how `jobs`-as-container is deferred to `logbook`/#6c).

**Why:** the docs are the project's real memory across sessions; stale docs or unflagged debt break the seams-first method they rely on. **How to apply:** don't update docs until they confirm; then mirror voice/markers; end substantial work with a short "smells/observations" pass. See [[user-profile]].

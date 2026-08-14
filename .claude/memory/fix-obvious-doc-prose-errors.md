---
name: fix-obvious-doc-prose-errors
description: Just fix plainly-broken docs prose (mangled pastes, stale claims) without asking; report it afterwards
metadata:
  type: feedback
---

When a docs file contains an obviously broken artefact — a sentence truncated
mid-clause, a fragment pasted into the wrong item, prose asserting a mechanism
the code no longer has — repair it directly and say what was repaired. Don't
stop to ask permission for the obvious ones.

**Why:** confirmed 2026-08-14. I reunited a Features item whose tail had been
glued onto a Tech Debt item, and rewrote a stale IMPLEMENTATION.md claim about a
removed sync exemption; the user's response was to approve both and ask for the
behaviour to continue. The repair is unambiguous and zero-risk, so a round trip
buys nothing.

**How to apply:** the licence covers *mechanical* repair where the correct text
is recoverable from evidence — a parenthesis that opens in one item and closes in
another, a claim contradicted by code you have read. It does not cover rewriting
meaning, reordering items, or deciding what an ambiguous fragment meant; those
still come back. Verify against the code before calling prose stale
([[working-style-docs-and-smells]]), and mention every such fix when summarising,
since docs are working-tree changes the user will commit.

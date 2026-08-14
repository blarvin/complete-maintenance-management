---
name: config-tree-sketches
description: Where the six config-tree/Definition-Packs ASCII wireframes live, and how to recover diagrams from past session transcripts
metadata:
  node_type: memory
  type: reference
---

The 2026-08-14 design session that produced **Definition Packs** and
**Config-tree UI** drew six ASCII wireframes (tree switcher, App Defaults node,
`New Node Fields` container, lock-as-navigation, inherited-value chrome, lens
policy card, packs). They were parked in `docs/LATER.md` in *distilled prose
only* — the diagrams themselves were never written to any doc and were nearly
lost.

- **Published page** (sketches + a status stripe on each, added 2026-08-14 after
  the Add Surface spec landed): https://claude.ai/code/artifact/5c5c35e8-ff92-4c98-a5c2-193eadd7d7ad
- **Original transcript**: `0da027f1-d821-45d1-bddf-d2900390285a.jsonl`,
  assistant messages at 0-based line indices 128 and 150.

**Why:** LATER captured the *conclusions* well enough to re-derive several of
them blind, but not the drawings — and Flow 4 (the ghosted-value + source-chip +
revert widget) is now spec-load-bearing in SPECIFICATION.md → Field Details.

**How to apply:** past sessions are readable at
`~/.claude/projects/<slug>/*.jsonl`, one JSON object per line; filter
`type == 'assistant'` and join the `content[].text` blocks. **Read them with
`[System.IO.File]::ReadAllLines($p, [Text.Encoding]::UTF8)`** — PowerShell 5.1's
`Get-Content` mangles box-drawing characters into mojibake, same root cause as
[[ps51-file-rewrite-encoding]]. When a session produces diagrams worth keeping,
publish them rather than trusting prose to carry them. See
[[next-branch-tree-native-field-ui]] and [[working-style-docs-and-smells]].

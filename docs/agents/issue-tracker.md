# Issue tracker: `docs/ISSUES.md`

Issues for this repo are **not** on GitHub. The tracker is a single committed
markdown file: **`docs/ISSUES.md`**, the active work queue. GitHub Issues is
unused — never run `gh issue`.

`docs/ISSUES.md` holds everything that needs doing now: bugs, unfinished
business, deferred *parts* of work already begun, and observed refactor/cleanup
needs. Sections in order: Bugs, Features, then further themed sections
(e.g. Architecture Migration), then Tech Debt.

## What is *not* the tracker

- **`docs/LATER.md`** is an **ideas** file, not an issue queue — whole ideas and
  features discussed but not begun, plus work decided for a later real phase.
  Read it for context (it tells you what is deliberately out of scope), but do
  not file work there. If an idea in it becomes actual work, it moves to
  `docs/ISSUES.md`.
- **`docs/SPECIFICATION.md`** (product requirements), **`docs/ELEMENT-MODEL.md`**
  (the kind catalogue), and **`docs/IMPLEMENTATION.md`** (non-obvious choices
  already made) are reference documents. A skill producing a spec should
  reconcile with these rather than duplicate them.

## House rules (from `docs/ISSUES.md` — obey these when writing)

- **Only open items.** When done, **delete** the item — don't check it off.
  Completion lives in git history.
- **One-line outcomes**, not task breakdowns. Say where it came from.
- **One screen where it counts.** Bugs and Features stay scannable; the themed
  sections and Tech Debt are long tails.
- **Sections group; position is a hint, not a queue.** No statuses, no label
  vocabulary. A bracketed `[tag]` is ad-hoc and means whatever it says.
- **Append to the bottom** of a section. Reordering is the dev's, not yours.
- Items are numbered `N.)` within their section: bold lead-in, then prose.

## Filing issues at the end of a session

File only what you **observed** — a failing test, a hand-test result, code you
actually read. A suspicion is not an issue; raise it in chat instead. One line,
outcome-shaped, with its provenance in the prose.

## When a skill says "publish to the issue tracker"

Append a numbered item to the right section of `docs/ISSUES.md` and renumber the
section. Never create a new tracker file, a `.scratch/` directory, or a GitHub
issue.

## When a skill says "fetch the relevant ticket"

Read `docs/ISSUES.md` and locate the item. Items are referenced by section +
number (e.g. "Bugs 2" or "Architecture Migration 7"), or by their bold lead-in
phrase. Numbers are **not** stable identifiers — they shift as items are
deleted, so quote the lead-in phrase when referring to an item across a session.

## Triage labels

There are none. If a skill asks for a triage label, apply nothing; if it asks
for `wontfix`, delete the item (or move it to `docs/LATER.md` if it is more an idea than an issue).

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
- **One-line outcomes**, not task breakdowns.
- **One screen.** If the file grows, prune or delete stale items.
- **Order = priority.** Top of a section = do next.
- Items are numbered `N.)` within their section: bold lead-in, then prose.

## When a skill says "publish to the issue tracker"

Append a numbered item to the right section of `docs/ISSUES.md` and renumber the
section. Never create a new tracker file, a `.scratch/` directory, or a GitHub
issue.

## When a skill says "fetch the relevant ticket"

Read `docs/ISSUES.md` and locate the item. Items are referenced by section +
number (e.g. "Bugs 2" or "Architecture Migration 7"), or by their bold lead-in
phrase. Numbers are **not** stable identifiers — they shift as items are
deleted, so quote the lead-in phrase when referring to an item across a session.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** section per ticket.

- **Map**: `.claude/plans/<effort>-map.md` — the Notes / Decisions-so-far / Fog body.
- **Child ticket**: a numbered section in that file, with a `Type:` line
  (`research`/`prototype`/`grilling`/`task`) and a `Status:` line
  (`open`/`claimed`/`resolved`).
- **Blocking**: a `Blocked by: NN, NN` line near the top of the ticket. A ticket
  is unblocked when every ticket it lists is `resolved`.
- **Frontier**: the first ticket that is open, unblocked, and unclaimed, by number.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set
  `Status: resolved`, then add a context pointer to the map's Decisions-so-far.

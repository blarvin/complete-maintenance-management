# Complete Maintenance Management — Agent Guide

Asset-maintenance tracker built on a hierarchical tree UI. solid-js 1.9 SPA
(client-only, no router — the FSM is the navigation model), TypeScript strict,
Dexie/IndexedDB primary with Firestore as a sync mirror, Vitest + Cypress,
CSS modules over a 3-layer token system. Phase 1 MVP.

## Philosophy

**Spec-driven.** `docs/SPECIFICATION.md` is the source of truth for product
requirements, the data model, architecture, and UX. Consult it before
implementing. It is not a summary of the code — it is what the code owes.

**This is prototyping.** Do the simplest thing that works. Build only what the
spec requires; prefer a hardcoded choice over a generalisation where the spec
defers the richer feature. If something genuinely bigger surfaces, explain it
and offer to defer it to `docs/LATER.md` rather than building it.

## Where things go

1. **docs/SPECIFICATION.md** — product requirements, data model, the
   registry/manifest framework, UX patterns. One `Element`, one immutable
   `kind`, behaviour in a per-kind manifest.
2. **docs/ELEMENT-MODEL.md** — the kind catalogue: one self-contained spec per
   kind (composition, value shape, config sub-fields, placement, UX, status).
   SPEC owns the framework; this owns the kinds.
3. **docs/IMPLEMENTATION.md** — non-obvious choices already made, only where a
   future reader asks "why is it like this?" and the answer isn't in the code.
4. **docs/ISSUES.md** — the active work queue; everything that needs doing now.
5. **docs/LATER.md** — whole ideas not yet begun, and Phase 2+ work.

**ISSUES vs LATER**: unfinished business, deferred *parts* of work already
begun, and observed refactor needs go in **ISSUES**. **LATER** is for whole
ideas not started and far-future phases. A leftover caused by current-branch
work belongs in ISSUES.

Issues live in `docs/ISSUES.md` — never GitHub. See `docs/agents/issue-tracker.md`.

## Never

- **Never `git commit` or `git push`.** Suggest the message; the user commits.
- **Never `gh issue`** — this repo's tracker is `docs/ISSUES.md`.
- **Never `&&` or `||`** in a command — see Shell below.
- **Never bulk-rewrite a file** via `Get-Content`/`Set-Content`; it mangles
  UTF-8 and adds a BOM. Use the Edit/Write tools.
- **Never put double quotes inside a git commit message** — PS 5.1
  argument-splitting breaks it.
- **Never write plan files outside `.claude/plans/`** — not home, not global.
- **Never hardcode absolute paths** in committed config; this repo is developed
  on two machines, and `CLAUDE_PROJECT_DIR` arrives empty.
- **No ADR or `CONTEXT.md` ceremony.** Reasoning lives in IMPLEMENTATION.md prose.

## Shell

The Bash tool runs **`powershell.exe` (Windows PowerShell 5.1)** regardless of
which shell Claude Code was launched from. So:

- `&&` and `||` are **parser errors**. Dependent: `A; if ($?) { B }`.
  Independent: `A; B`.
- Prefer parallel tool calls over chaining when commands don't depend on each other.
- Commands the *user* runs via `!` go to Git Bash — bash syntax is fine there.

## Commands

```bash
npm run dev          # Vite dev server, :5173 (registers no service worker)
npm run build        # Typecheck + prod build to dist/ (compiles SW, injects precache manifest)
npm run preview:pwa  # Serve dist/ on :4173 — the only way to exercise the PWA
npm run test         # Vitest (known: hangs after passing — ISSUES → Tech Debt)
npm run typecheck
npm run lint
npm run emulator     # Firebase emulator, :8080
npm run cypress      # Needs emulator + dev server up; every spec's cy.freshVisit()
                     # wipes the emulator and deletes the app's IndexedDB first
```

Emulator mode in the browser: `?emulator=true`, or
`localStorage.setItem('USE_FIRESTORE_EMULATOR','true')`.

## Code style

- **TypeScript**: strict; discriminated unions + type guards; no prop spreading.
- **Solid**: never destructure props (it breaks tracking); hooks take
  `Accessor<T>` in and return accessors out; `<Show keyed>` only when a subtree
  must genuinely remount; `<Dynamic>` for registry-picked components.
  `eslint-plugin-solid` runs at **error** across `src/`, including
  `solid/reactivity`.
- **CSS**: module CSS with design tokens; minimal inline styles.
- **Tests**: domain logic in service/adapter layers, not components.

## Tooling

**jCodeMunch MCP** — use it for all code navigation; don't Read/Grep/Glob to
explore. Call `jcodemunch_guide` once at session start and follow it exactly.
Keep this pointer short on purpose: the guide is version-current, whereas a
pasted snippet drifts (the previous one named five tools that no longer exist).
This repo is indexed as **`blarvin/complete-maintenance-management`** — pass that
as `repo` rather than spending a `resolve_repo` call. A PostToolUse hook
reindexes edited files automatically; don't call `register_edit` by hand.

Two limits, both observed: **`docs/*.md` isn't indexed at all** — Read/Grep the
docs directly, jcm will report a confident zero for prose that's plainly there.
And **`citable: false` on a zero-result answer means "absence not proven"**, not
boilerplate — the index was stale or a channel was down, so go look yourself
before reporting a gap. `citable: true` is real evidence of absence.

**context7 MCP** — use liberally. Any time you touch a solid-js, Dexie,
Firebase, Vite or Vitest API, fetch the docs rather than trusting recall, *even
when you think you know it*. Much cheaper than a wrong reactive primitive.

## Working with me

**File what you find.** At the end of an implementation session, append to
`docs/ISSUES.md` anything you **observed** — a failing test, a hand-test result,
code you actually read. Never file a suspicion; raise those in chat instead.
One line, outcome-shaped, with provenance ("surfaced in the Phase IV hand-test",
"same in the Qwik original"). Append to the **bottom** of the section; ordering
is the user's call, not yours.

**Settings hygiene.** `.claude/settings.json` is committed and must work on both
machines. `.claude/settings.local.json` is gitignored scratch that Claude Code
appends to on every approval. When local has visibly accumulated, sweep it: drop
entries already covered by a committed pattern and one-off junk, then **ask
before** promoting anything into `settings.json` — widening the committed
allowlist changes the security posture on both machines.

**Memory is repo content.** The auto-memory store is committed at
`.claude/memory/`, reached through a directory junction. Treat a new or edited
file there as an ordinary working-tree change and mention it when summarising.
New clone: run `scripts/link-memory.ps1` once.

---
name: no-working-tree-edits-on-master
description: Never edit files while checked out on master — branch first, and treat "we could do X" as discussion, not a go-ahead
metadata:
  type: feedback
---

**Do not write to the working tree while HEAD is `master`.** Branch first, or wait
for an explicit instruction to edit. And when the user says something like "yeah, I
guess we can do surgery on the SPEC without git", that is agreement on *method*, not
authorisation to start editing — confirm before touching files.

**Why:** Stated 2026-08-20, mid-turn, after I read "we can do surgery on the SPEC
without git" as a green light and made eight edits to `docs/SPECIFICATION.md` on
master. They stopped me with "no edits, were on master". Master is the guarded
branch they compare against while deciding; a dirty tree there costs them their
reference point even though `git restore` undoes it cleanly.

**How to apply:** On master, do investigation and produce the *plan* — exact line
ranges, before/after text in the reply — and let them choose the branch. Scratchpad
files are fine anywhere. Same instinct as [[user-commits-and-pushes-manually]]:
anything that changes repo state is theirs to authorise. Related:
[[working-style-docs-and-smells]].

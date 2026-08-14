---
name: user-commits-and-pushes-manually
description: Never run git push — the user pushes by hand; git commit is allowed only on [auto]-tagged ISSUES items
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2eb31c04-e43c-4d9c-8994-4f696b1a45f7
  modified: 2026-08-09T08:40:58.618Z
---

**Never run `git push`** — the user pushes by hand, always. **`git commit` is allowed, but only on issues tagged `[auto]`** in `docs/ISSUES.md`; untagged work still ends with a suggested message and a stop. Staging and all read-only git is fine.

**Why:** They want to own what reaches the remote. The commit half was relaxed on 2026-08-11 ("why am I holding you back?") so marked, self-contained issues can be taken end-to-end; local commits are reviewable and resettable, a push is not. Original stance stated 2026-08-09.

**How to apply:** On an `[auto]` issue — implement, verify, then one commit per issue, deleting the item from ISSUES.md in the same commit. Otherwise hand them a message in a fenced block and stop. `git push` remains denied in `.claude/settings.json`, so attempting it just fails; the commit denies were removed there (deny beats allow, so it could not be relaxed from gitignored local settings). Commit messages must avoid double quotes — see [[ps51-git-commit-quotes]]. Related: [[working-style-docs-and-smells]].

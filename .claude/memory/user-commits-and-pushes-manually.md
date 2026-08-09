---
name: user-commits-and-pushes-manually
description: Never run git commit or git push — the user does both by hand; supply a suggested commit message instead
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2eb31c04-e43c-4d9c-8994-4f696b1a45f7
  modified: 2026-08-09T08:40:58.618Z
---

The user commits and pushes manually. Never run `git commit` or `git push`. Staging (`git add`) and all read-only git is fine.

**Why:** They want to review and own what lands in history and what goes to the remote. Stated 2026-08-09.

**How to apply:** When work is complete, stage if useful, then hand them a suggested commit message in a fenced block and stop. Both commands are also denied in `.claude/settings.json` permissions, so attempting them just fails. Commit messages must avoid double quotes — see [[ps51-git-commit-quotes]]. Related: [[working-style-docs-and-smells]].

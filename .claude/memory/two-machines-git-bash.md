---
name: two-machines-git-bash
description: User runs Claude Code in git bash on two different Windows machines — never hardcode absolute paths in checked-in config
metadata: 
  node_type: memory
  type: user
  originSessionId: 2d7fd0eb-5d8f-4c89-b736-b5c99645a66b
  modified: 2026-08-09T09:16:50.031Z
---

The user works on **two different Windows machines** and always launches Claude Code from **git bash** (not PowerShell), even though the agent's shell tool is PowerShell.

**Why:** Anything checked into the repo that assumes one machine's user path, or assumes the spawning shell is PowerShell, will break on the other machine or when the harness shells out via `sh`.

**How to apply:**
- Never hardcode `C:\Users\blarv\...` into checked-in config (`.claude/settings.json`, hook commands, scripts). Use **project-relative paths** — hooks run with cwd at the project root, which is both shell- and machine-agnostic.
- In hook scripts themselves, derive the project dir from `path.resolve(__dirname, '..', '..')` rather than trusting `CLAUDE_PROJECT_DIR`, which has been observed arriving **empty** in this setup. An empty expansion yields `/.claude/...`, which Node on Windows resolves to `C:\.claude\...` → `MODULE_NOT_FOUND`.
- Testing bash from the PowerShell tool is quote-hostile: PS 5.1 strips escaped quotes out of `bash -c '...'`. Write a `.sh` to the scratchpad and run `bash file.sh` instead. Related: [[ps51-git-commit-quotes]].

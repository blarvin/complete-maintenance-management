---
name: jcodemunch-watcher-setup
description: "How the jCodeMunch auto-reindex watcher is kept running on the blarv Windows machine, and the two traps in setting it up"
metadata: 
  node_type: memory
  type: project
  originSessionId: ee71ceb2-624c-4410-a8c2-6c5593b84079
  modified: 2026-08-10T20:54:06.744Z
---

On the `blarv` Windows machine, the jCodeMunch watcher is started at logon by
`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\jcodemunch-watch-all.cmd`,
which runs `C:\Users\blarv\.local\bin\uvx.exe --with watchfiles jcodemunch-mcp watch-all`
minimized. Verified surviving a real logout/login on 2026-08-10. Delete that file to
undo it. This is machine-local, so it is NOT in the repo and may not be set up on the
second machine — see [[two-machines-git-bash]].

**Why:** without a watcher the index only refreshes on commit, so jcm answers "0 results"
for code that exists in the working tree. That is worse than slow — it produces confident
wrong answers about absence. With the watcher live, deletions propagate too and
absence_evidence comes back `citable: true`.

**How to apply:** two traps, both hit once already. (1) `watch-install` and even a plain
`schtasks /Create /SC ONLOGON` both fail with `ERROR: Access is denied` for a standard
user on this box — do not send the user through an elevation loop, use the Startup
folder instead. (2) The bare `jcodemunch-mcp watch-all` exits immediately with
`FATAL: watchfiles is required`; `--with watchfiles` is mandatory in every invocation.
Check state with `uvx jcodemunch-mcp watch-status` and read `watcher_holder`, not
`service.active` — the latter tracks the schtasks service and stays `false` by design.

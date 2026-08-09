---
name: ps51-git-commit-quotes
description: PowerShell 5.1 mangles embedded double quotes when passing here-string commit messages to git — commits fail with bogus pathspec errors
metadata: 
  node_type: memory
  type: project
  originSessionId: 99bdb509-b0c4-4dbc-993e-2eae51421c80
---

In this repo's shell (Windows PowerShell 5.1), passing a `git commit -m @'…'@` here-string that CONTAINS double quotes breaks native argument passing: the message splits at the quotes and git errors with `pathspec '…' did not match any file(s)`.

**Why:** PS 5.1 re-quotes arguments containing spaces when invoking native exes; embedded `"` inside the argument terminates the quoting mid-string.

**How to apply:** Never put `"` characters inside commit messages (or any multi-word native-exe argument) — rephrase with single quotes or no quotes. Single quotes inside the here-string are safe.

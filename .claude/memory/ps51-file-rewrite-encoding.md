---
name: ps51-file-rewrite-encoding
description: Never bulk-rewrite repo files via PowerShell 5.1 Get-Content/Set-Content — it mangles UTF-8 and adds a BOM
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 85e8c88a-c400-406e-b506-964d12a10b14
  modified: 2026-08-09T17:40:32.932Z
---

In this repo, do **not** rewrite existing files with PowerShell 5.1
`Get-Content -Raw` + `Set-Content -Encoding utf8`. 5.1 reads as ANSI (cp1252)
unless the file has a BOM, so every em-dash, arrow, and box-drawing character in
the project docs comes back as `â€”` mojibake, and `-Encoding utf8` then writes a
BOM the files never had.

**Why:** the docs (SPECIFICATION, ISSUES, LATER, CLAUDE.md, the rules files) are
dense with em-dashes and box-drawing; a single bulk sed-style pass silently
corrupts hundreds of characters, and the damage is invisible in a terminal diff.

**How to apply:** use the Edit tool for targeted edits. For a genuine multi-file
regex pass, use .NET directly with an explicit BOM-less encoder:

```powershell
$enc = New-Object System.Text.UTF8Encoding($false)
$t = [System.IO.File]::ReadAllText($path, $enc)
[System.IO.File]::WriteAllText($path, $new, $enc)
```

Then verify: first three bytes must not be `239,187,191`, and the text must not
match `Ã|â€`. Related: [[ps51-git-commit-quotes]].

# Link Claude Code's auto-memory store into this repo. Run once per machine.
#
# The store normally lives at ~/.claude/projects/<slug>/memory/, which is
# per-machine and never committed, and there is no setting to relocate it
# (autoMemoryEnabled is a boolean, nothing more). This points the canonical
# path at .claude/memory/ in the working tree via a directory junction, so
# memory writes land as ordinary tracked files.
#
# Symptom that it is missing: .claude/memory/ exists in the repo but Claude
# never recalls anything from it.
#
# No admin needed — junctions do not require elevation.
# Safe to re-run: no-ops when already linked, and folds in any machine-local
# memories before swapping.

$root = (git rev-parse --show-toplevel)
$canon = Join-Path $env:USERPROFILE ".claude\projects\$($root -replace '[:/\\]','-')\memory"
$repoMem = Join-Path $root ".claude\memory"

if ((Test-Path $canon) -and (Get-Item $canon).LinkType -eq 'Junction') {
  "Already linked."
} else {
  if (Test-Path $canon) {
    Copy-Item "$canon\*" $repoMem -Recurse -Force   # fold any local-only memories in
    Remove-Item $canon -Recurse -Force -Confirm:$false
  }
  New-Item -ItemType Directory -Force (Split-Path $canon) | Out-Null
  New-Item -ItemType Junction -Path $canon -Target $repoMem | Out-Null
  "Linked $canon -> $repoMem"
}

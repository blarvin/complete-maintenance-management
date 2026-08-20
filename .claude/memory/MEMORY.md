# Memory Index

- [User profile](user-profile.md) — solo dev; seams/capabilities/registry-manifest thinker; genericity without overbuild
- [Working style: docs + smells](working-style-docs-and-smells.md) — post-confirm doc-sync ritual; expects proactive smell-surfacing; decide kinds on a forcing kind
- [User commits and pushes manually](user-commits-and-pushes-manually.md) — push is never the agent's; commit only on [auto]-tagged issues
- [No working-tree edits on master](no-working-tree-edits-on-master.md) — branch first; "we could do X" is discussion, not a go-ahead
- [PS 5.1 git commit quotes](ps51-git-commit-quotes.md) — no double quotes inside commit messages; PS 5.1 arg-splitting breaks git
- [PS 5.1 file-rewrite encoding](ps51-file-rewrite-encoding.md) — never bulk-rewrite files via Get-Content/Set-Content; it mangles UTF-8 and adds a BOM
- [Two machines, git bash](two-machines-git-bash.md) — never hardcode absolute paths in checked-in config; CLAUDE_PROJECT_DIR arrives empty
- [jCodeMunch watcher setup](jcodemunch-watcher-setup.md) — Startup .cmd runs the watcher at logon; needs --with watchfiles, schtasks is denied
- [Tree-native Field UI (landed)](next-branch-tree-native-field-ui.md) — Add Surface is a Field row; composer + legacy are dormant, not deleted; [Fields UI] no longer means parked
- [Fix obvious doc prose errors](fix-obvious-doc-prose-errors.md) — repair mangled pastes and stale claims directly; report, don't ask
- [Config tree sketches](config-tree-sketches.md) — the six ASCII wireframes: published page + transcript id, and how to recover diagrams from past sessions
- [Chrome MCP tab runs no rAF](chrome-mcp-tab-no-raf.md) — smooth scroll / CSS animation / screenshots stall there; assert DOM state, leave motion to the user

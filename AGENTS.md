# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd comment <id> "msg" # Add implementation notes
bd sync               # Sync beads data
# NOTE: Only user runs bd close, git commit, git push
```

## Landing the Plane (Session Completion)

**When ending a work session**, complete all steps below.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up, and tell the User about them.
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Add comments to issues explaining work done; leave open for user to close
4. **Sync beads** - Run `bd sync` to sync issue data
5. **Hand off** - Provide context for next session
6. **Suggest commit message** - Provide a commit message (10 words or less)

**CRITICAL RULES:**
- Only the USER commits and pushes code (`git commit`, `git push`)
- Agent can run `bd sync` but NOT `git commit` or `git push`
- Agent leaves issues open; only user closes after verification


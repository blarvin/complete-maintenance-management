# Plan: Retrospective Skill

## Design

A `/retro` skill invoked manually at the end of a task or session. Two modes:

1. **`/retro`** (default) — Review the current session, write findings to `.claude/retros/YYYY-MM-DD[-N].md`
2. **`/retro synthesize`** — Read all retros, propose concrete improvements (new rules, hook changes, skill ideas, CLAUDE.md edits)

### Why NOT a hook
- SessionEnd hooks run a shell command, not Claude — they can't analyze what happened
- A hook could *remind* you to run `/retro`, but the analysis itself needs Claude's context
- We could add a Notification hook for "session ending, consider running /retro" but that's optional/additive

### Why NOT forked context
- The skill needs access to the current conversation to know what happened
- Forked context would lose that — it would only see the skill prompt

## Files to Create

### 1. `.claude/skills/retro/SKILL.md`
- `disable-model-invocation: true` (user-invoked only)
- `allowed-tools: Read, Write, Edit, Glob, Grep, Bash(date *), AskUserQuestion`
- `argument-hint: "[synthesize] - optional, reviews past retros and proposes improvements"`
- Uses `$ARGUMENTS` to switch between record and synthesize modes
- Instructions for each mode

### 2. `.claude/skills/retro/template.md`
Structured template for retro entries:
- **Session summary** — what was the task
- **What worked** — patterns, tools, approaches that were effective
- **What didn't work** — friction, mistakes, repeated effort, missing context
- **Time sinks** — where did effort go that shouldn't have
- **Context gaps** — what knowledge was missing that caused mistakes
- **Proposed improvements** — specific, actionable (new rule, hook, skill, CLAUDE.md change)

### 3. `.claude/retros/` directory
- Created on first use (skill instructions say to `mkdir -p`)
- Files named `YYYY-MM-DD.md`, with `-2`, `-3` suffix if multiple per day

### 4. `.claude/skills/retro/synthesis-prompt.md`
Instructions for synthesize mode:
- Read all retros via Glob
- Identify recurring themes
- Propose concrete changes with specific file paths and content
- Ask user to approve each change

## No other files modified
- No hooks added (the skill is manual)
- No settings changes needed

## Verification
- Run `/retro` after this session — should produce a `.claude/retros/2026-02-07.md`
- Run `/retro synthesize` — should read that file and propose improvements
- Confirm the template structure is useful and not too bureaucratic

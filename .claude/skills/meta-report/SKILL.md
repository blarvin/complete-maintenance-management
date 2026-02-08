---
description: Generate a comprehensive METAPROCESS.md report auditing the entire Claude Code meta-layer — configs, skills, rules, hooks, MCPs, usage patterns, and emerging techniques.
argument-hint: [full|quick] - optional, defaults to full (includes web research)
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - WebSearch
  - WebFetch
  - TaskCreate
  - TaskUpdate
  - TaskList
---

# /meta-report — Meta-Layer Audit & Report

Generate a comprehensive report on the Claude Code meta-layer for this project and write it to `.claude/METAPROCESS.md`, overwriting the previous report.

## Execution Flow

### Phase 0: Usage Data Collection

0. **Gather usage metrics** from two sources before analysis begins:

   **a) Tool usage log (`.claude/usage.log`):**
   - Read `.claude/usage.log` if it exists (tab-separated: timestamp, tool_name, path/command)
   - Compute per-tool invocation counts (e.g., Read: 342, Edit: 87, Grep: 56)
   - Compute per-file access counts (most-read files, most-edited files)
   - Compute per-MCP usage counts (group `mcp__context7__*`, `mcp__claude-in-chrome__*`, etc.)
   - Identify skill invocations by looking for `Read` calls to `SKILL.md` files followed by the skill's allowed tools
   - Note the log's date range (earliest → latest entry) and total entry count
   - If the log doesn't exist or is empty, note "Usage logging enabled but no data yet"

   **b) Git history for meta-layer files:**
   - Run `git log --oneline --follow -- <file>` for each meta-layer file (CLAUDE.md, rules, skills, settings, memory files)
   - Count commits touching each file and note last-modified date
   - This captures update frequency even before the usage log existed

   Store these metrics for use in Sections 1–4 and 7 of the report.

### Phase 1: Inventory & Analysis

1. **Scan all meta-layer files.** Read every file in:
   - `.claude/` (settings, rules, skills, plans, METAPROCESS.md)
   - `CLAUDE.md` at project root and any parent `CLAUDE.md` files
   - `~/.claude/projects/.../memory/` (auto-memory files)
   - `.cursor/` if present (rules, plans)
   - Note file sizes (line counts), purposes, and relationships

2. **Analyze each component.** For every file/config found:
   - Summarize its purpose and content
   - Assess quality (grade A through D) against best practices
   - Note strengths and remaining issues
   - Check for staleness, duplication, drift between tools

3. **Audit MCP servers & plugins.** Review the active MCP configuration:
   - List all configured MCP servers (from settings or context)
   - For each: what it does, how often it's used, whether it's well-suited
   - Identify gaps — things we do manually that an MCP could automate
   - Note any redundancy between MCPs

4. **Analyze meta-skills.** Review all skills in `.claude/skills/`:
   - For each skill: purpose, usage frequency (if trackable), quality
   - Specifically track `/retro` skill existence and usage evolution
   - Specifically track `/meta-report` (this skill) — self-referential analysis
   - Note skill gaps — common workflows that lack a skill

### Phase 2: External Research (skip if argument is "quick")

5. **Web search: cutting-edge Claude Code techniques.** Search for:
   - "Claude Code advanced techniques 2026"
   - "Claude Code skills best practices"
   - "Claude Code MCP servers popular"
   - Synthesize findings into actionable recommendations
   - Focus on proven techniques in real-world use, not speculation

6. **Web search: MCP ecosystem.** Search for:
   - Popular/useful MCP servers for development workflows
   - Compare against our current MCP setup
   - Identify new opportunities that fit this project's needs (Qwik, TypeScript, offline-first, maintenance management)

### Phase 3: Report Generation

7. **Write METAPROCESS.md** with these sections (in order):

```
# Meta-Layer Audit Report
*Generated: [date]*

## 1. Inventory
Table of all meta-layer files with purpose, line count, last-modified date, git commits, and access count from usage log.

## 2. Component Assessments
### 2.1 CLAUDE.md — Grade: [X]
### 2.2 Auto-Memory — Grade: [X]
### 2.3 Rules — Grade: [X]
### 2.4 Skills — Grade: [X]
### 2.5 Settings & Hooks — Grade: [X]
### 2.6 Cursor Configuration — Grade: [X]
### 2.7 Cross-Tool Coherence — Grade: [X]

## 3. MCP & Plugin Audit
Current MCPs, usage counts from log (mcp__*__ tool calls), gaps, redundancies, recommendations.

## 4. Meta-Skills Analysis
### 4.1 /meta-report (this skill)
Self-referential: how this report process is working, what changed since last run.
### 4.2 /retro
Usage count, evolution, value delivered. (Zero baseline if not yet created.)
### 4.3 /offline-test
### 4.4 [any other skills]

## 5. Cutting-Edge Techniques
Researched techniques from the Claude Code ecosystem.
What's proven and adopted vs. experimental.
Applicability to this project.

## 6. Anti-Patterns & Technical Debt
Known issues, staleness, drift, duplication.
Resolved items (strikethrough).

## 7. Usage Statistics
Summary tables from Phase 0 data:
- Top 10 tools by invocation count
- Top 10 most-accessed files
- MCP usage breakdown
- Log date range and total entries
- Git commit counts for meta-layer files
If usage log has no data yet, show "Logging active since [date], no data accumulated yet."

## 8. Summary Scorecard
Table: Component | Grade | Status | Change from Last Report

## 9. Meta-on-Meta
Commentary on the report itself:
- How has the report format evolved?
- What new sections were added this run and why?
- Recommendations for the next report cycle.
```

### Phase 4: Verification

8. **Confirm the report** by reading back `.claude/METAPROCESS.md` and verifying all sections are present.
9. **Notify the user** with a brief summary of key findings and grade changes.

## Quality Standards

- Be honest in assessments — don't inflate grades
- Grade scale: A (excellent), B (good, minor issues), C (functional, notable gaps), D (needs rework)
- Use "+/-" modifiers for nuance (A-, B+, etc.)
- When comparing to last report, note improvements and regressions
- Keep the report under 300 lines — dense and useful, not padded
- Every recommendation should be actionable

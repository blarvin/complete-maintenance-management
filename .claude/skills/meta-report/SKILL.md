---
description: Generate a comprehensive METAPROCESS.md report auditing the entire Claude Code meta-layer — configs, skills, rules, hooks, MCPs, usage patterns, context engineering effectiveness, and emerging techniques.
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

### Phase 0: Usage & History Data Collection

0. **Gather usage metrics** from two sources before analysis begins:

   **a) Tool usage log (`.claude/usage.log`):**
   - Read `.claude/usage.log` if it exists (tab-separated: timestamp, tool_name, path/command)
   - Compute per-tool invocation counts (e.g., Read: 342, Edit: 87, Grep: 56)
   - Compute per-file access counts (most-read files, most-edited files)
   - Compute per-MCP usage counts (group `mcp__context7__*`, `mcp__claude-in-chrome__*`, etc.)
   - Identify skill invocations by looking for `Read` calls to `SKILL.md` files followed by the skill's allowed tools
   - Note the log's date range (earliest → latest entry) and total entry count
   - If the log doesn't exist or is empty, note "Usage logging enabled but no data yet"

   **b) Git history for ALL tracked markdown files:**
   - Run `git log --oneline --follow -- <file>` for each meta-layer file (CLAUDE.md, rules, skills, settings, memory files)
   - Run `git log --oneline --follow -- <file>` for each context engineering file (SPECIFICATION.md, ISSUES.md, LATER.md, IMPLEMENTATION.md, REFACTORING_AUDIT.md, and any other root-level `.md` files that serve as project documentation)
   - Count commits touching each file and note last-modified date
   - For context engineering files, also run `git log --format="%H %ai %s" -- <file>` to capture commit dates for growth/coupling analysis in Phase 1.5

   Store these metrics for use throughout the report.

### Phase 1: Meta-Layer Inventory & Analysis

1. **Scan all meta-layer files.** Read every file in:
   - `.claude/` (settings, rules, skills, plans, METAPROCESS.md)
   - `CLAUDE.md` at project root and any parent `CLAUDE.md` files
   - `~/.claude/projects/.../memory/` (auto-memory files)
   - `.cursor/` if present (rules, plans)
   - Note file sizes (line counts), purposes, and relationships

2. **Analyze each meta-layer component.** For every file/config found:
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

### Phase 1.5: Context Engineering Analysis

This phase analyzes the system of project documentation files used to steer AI behavior — the "context engineering" layer. This is distinct from the meta-layer (configs, skills, rules); these are the knowledge documents the meta-layer references and protects.

**Identify context engineering files:** All root-level `.md` files that serve as project knowledge/instructions. Typical files include SPECIFICATION.md, ISSUES.md, LATER.md, IMPLEMENTATION.md, REFACTORING_AUDIT.md, CLAUDE.md (also a meta-layer file), and any one-off docs (deletion_discussion.md, etc.). Read each file.

5. **Static Analysis — Information Architecture:**

   a) **Role clarity**: For each file, can its purpose be stated in one sentence? Has any file become a grab-bag mixing concerns? Does the file's stated purpose (if any) match its actual contents?

   b) **Instruction hierarchy**: Map how information flows. CLAUDE.md declares a documentation hierarchy — does the actual content match? Do rules reference the right files? Are there files that nothing points to (orphan docs)?

   c) **Cross-reference integrity**: Check references between files. When CLAUDE.md says "check SPECIFICATION.md first," does the spec actually contain the information needed? When rules say "consult LATER.md," is LATER.md structured to answer the question?

   d) **Redundancy detection**: Is the same information stated in multiple files? Some duplication is intentional (reinforcement), but unintentional duplication drifts over time. Flag any content that appears in 2+ files and assess whether it's intentional.

   e) **Schema consistency**: Do files follow consistent formatting patterns? Do they use the same terminology? Is there a clear convention for how entries are structured?

6. **Dynamic Analysis — Effectiveness Signals:**

   Use git history and usage.log data gathered in Phase 0.

   a) **Update frequency & patterns**: Which context files are updated often? Which are stale? Compare update frequency to development activity — a file untouched for 20 feature commits may be drifting from reality.

   b) **Update coupling**: When ISSUES.md marks items done, does LATER.md also change in the same commit or nearby commits? When features are implemented, does IMPLEMENTATION.md get updated? The project-context-management rule defines a workflow (verify → ISSUES.md → IMPLEMENTATION.md → LATER.md) — check whether this workflow is actually followed by examining commit history.

   c) **Growth trajectory**: Use `git log --format="%H" -- <file>` and `git show <hash>:<file> | wc -l` for a few checkpoints to see if files are growing, stable, or shrinking. Flag any file on a path to becoming unwieldy (300+ lines for instruction files, 500+ lines for reference docs).

   d) **Consultation patterns**: From usage.log, which context files does Claude actually Read during sessions? Are there files that are supposed to be consulted (per rules) but rarely accessed? Are there files read constantly that could be summarized or restructured for faster consumption?

   e) **Dead context detection**: Identify content that may be dead weight:
      - One-off discussion documents that were never revisited after their initial purpose
      - Sections within files that haven't changed in weeks despite active development
      - Placeholder files with minimal content (e.g., 2-line AGENTS.md)
      - Resolved items that haven't been archived or cleaned up

   f) **Content-reality drift**: Where feasible, spot-check a few spec claims against actual code. For example, does the sorting policy in SPECIFICATION.md match the actual implementation? Flag any obvious drift without doing an exhaustive audit.

7. **Synthesize findings** into categorized verdicts:
   - **Working Well** — patterns that are effective and should be maintained
   - **Needs Attention** — issues that are causing friction or risk
   - **Opportunity** — things not broken but could be meaningfully better

### Phase 2: External Research (skip if argument is "quick")

8. **Web search: cutting-edge Claude Code techniques.** Search for:
   - "Claude Code advanced techniques 2026"
   - "Claude Code skills best practices"
   - "Claude Code MCP servers popular"
   - Synthesize findings into actionable recommendations
   - Focus on proven techniques in real-world use, not speculation

9. **Web search: MCP ecosystem.** Search for:
   - Popular/useful MCP servers for development workflows
   - Compare against our current MCP setup
   - Identify new opportunities that fit this project's needs

10. **Web search: context engineering patterns.** Search for:
    - "context engineering AI coding assistants 2026" or "Claude Code context engineering"
    - "CLAUDE.md best practices project documentation"
    - "specification driven development AI assistants"
    - Look for patterns like: ADRs (Architecture Decision Records), RFC-driven development, README-driven development, prompt-file patterns, living documentation approaches
    - **Compare, don't just list**: For each pattern found, assess against our specific system. Does it solve a problem we actually have (identified in Phase 1.5)? Would it replace or complement what we already do?
    - Identify max 5 actionable opportunities, each tied to a specific finding from the static/dynamic analysis

### Phase 3: Report Generation

11. **Write METAPROCESS.md** with these sections (in order):

```
# Meta-Layer Audit Report
*Generated: [date]*

## 1. Inventory
Table of all meta-layer files (configs, rules, skills, hooks, memory) with purpose, line count, last-modified date, git commits, and access count from usage log.
Do NOT include context engineering files here — they get their own section.

## 2. Component Assessments
### 2.1 CLAUDE.md — Grade: [X]
### 2.2 Auto-Memory — Grade: [X]
### 2.3 Rules — Grade: [X]
### 2.4 Skills — Grade: [X]
### 2.5 Settings & Hooks — Grade: [X]
### 2.6 Cursor Configuration — Grade: [X]
### 2.7 Cross-Tool Coherence — Grade: [X]

## 3. Context Engineering Audit — Grade: [X]
This is the analysis of the project's documentation system used to steer AI behavior.

### 3.1 File Inventory & Roles
Table: File | Purpose (1 sentence) | Lines | Commits | Last Updated | Verdict
Verdict = Working Well / Needs Attention / Dead Weight / Placeholder

### 3.2 Static: Information Architecture
Findings-driven (not file-by-file). Organized by finding type:
- Instruction hierarchy: does it work? Map the flow.
- Cross-reference integrity: broken links, orphan docs
- Redundancy: intentional reinforcement vs. unintentional drift
- Schema consistency: do files follow conventions?
Each finding gets a verdict: Working Well / Needs Attention / Opportunity

### 3.3 Dynamic: Effectiveness Signals
Findings-driven. Organized by signal:
- Update coupling: is the defined workflow actually followed?
- Stale sections: content that hasn't kept pace with development
- Growth alerts: files trending toward unwieldy
- Consultation gaps: files that should be read but aren't (or vice versa)
- Dead context: one-off docs, placeholders, resolved-but-not-archived items
- Content-reality drift: spec claims that don't match code
Each finding backed by data (commit counts, dates, usage.log entries).

### 3.4 Theoretical: Community Patterns & Opportunities
Max 5 recommendations. Each one must:
1. Name the pattern/technique
2. Describe what it is (1-2 sentences)
3. Cite what specific problem from 3.2/3.3 it addresses
4. Describe what adoption would look like for this project
Do NOT include patterns that don't solve an observed problem.

## 4. MCP & Plugin Audit
Current MCPs, usage counts from log (mcp__*__ tool calls), gaps, redundancies, recommendations.

## 5. Meta-Skills Analysis
### 5.1 /meta-report (this skill)
Self-referential: how this report process is working, what changed since last run.
### 5.2 /retro
Usage count, evolution, value delivered. (Zero baseline if not yet created.)
### 5.3 [other skills]

## 6. Cutting-Edge Techniques
Researched techniques from the Claude Code ecosystem.
What's proven and adopted vs. experimental.
Applicability to this project.

## 7. Anti-Patterns & Technical Debt
Known issues, staleness, drift, duplication.
Resolved items (strikethrough).

## 8. Usage Statistics
Summary tables from Phase 0 data:
- Top 10 tools by invocation count
- Top 10 most-accessed files
- MCP usage breakdown
- Log date range and total entries
- Git commit counts for meta-layer files
If usage log has no data yet, show "Logging active since [date], no data accumulated yet."

## 9. Summary Scorecard
Table: Component | Grade | Status | Change from Last Report
Must include a "Context Engineering" row alongside existing component grades.

## 10. Meta-on-Meta
Commentary on the report itself:
- How has the report format evolved?
- What new sections were added this run and why?
- Recommendations for the next report cycle.
```

### Phase 4: Verification

12. **Confirm the report** by reading back `.claude/METAPROCESS.md` and verifying all sections are present.
13. **Notify the user** with a brief summary of key findings and grade changes.

## Quality Standards

- Be honest in assessments — don't inflate grades
- Grade scale: A (excellent), B (good, minor issues), C (functional, notable gaps), D (needs rework)
- Use "+/-" modifiers for nuance (A-, B+, etc.)
- When comparing to last report, note improvements and regressions
- Keep the report under 400 lines — dense and useful, not padded
- Every recommendation should be actionable and tied to evidence
- **Findings-driven, not file-driven** — organize by insight, not by file
- Context engineering section findings must cite data (commit counts, dates, line counts, usage.log entries)
- Theoretical recommendations must reference specific problems observed in the analysis

#!/usr/bin/env node
/*
 * Smart PreToolUse hook for Claude Code — PowerShell edition.
 *
 * Decomposes a compound PowerShell command line into the individual command
 * invocations it would actually execute, then checks each against the
 * PowerShell(...) allow/deny rules in your Claude Code settings (global +
 * project + project-local). If every invocation is allowed it auto-approves;
 * if any matches a deny rule it blocks; otherwise it stays silent and lets
 * Claude Code's normal permission prompt happen.
 *
 * Why this exists: Claude Code matches a permission rule against the WHOLE
 * command string, so `Get-Content a; Get-Content b` never matches
 * `PowerShell(Get-Content *)` and always prompts. This hook splits it up.
 *
 * Safety model (biased so mistakes prompt, never silently allow):
 *   - Deny extraction is exhaustive (pipelines, ;, $(...), & {...}, if/foreach
 *     bodies, $()-inside-double-quotes, here-strings).
 *   - Auto-ALLOW requires: no "danger signal" (::, destructive .NET methods,
 *     Invoke-Expression, New-Object, Start-Process, ...) AND every extracted
 *     command matches an allow rule. Anything unrecognized => passthrough.
 *   - PowerShell is case-insensitive; matching is too.
 *
 * Dependency-free (Node built-ins only). Input: JSON on stdin
 * { tool_name, tool_input: { command } }. Output: PreToolUse permissionDecision
 * JSON on stdout, or silent exit 0 to fall through to the normal prompt.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const TOOL = 'PowerShell';

const VERBOSE = ['1', 'true', 'yes'].includes(
  String(process.env.SMART_APPROVE_VERBOSE || '').toLowerCase()
);
const logLines = [];
function log(msg) {
  if (VERBOSE) logLines.push(msg);
}

// Constructs we can't reason about safely — presence forces a normal prompt
// (never auto-allow). Deny extraction still runs, so a deny rule can still fire.
const DANGER = new RegExp(
  [
    '::', // .NET static member access, e.g. [System.IO.File]::Delete(...)
    // destructive instance methods on objects
    '\\.\\s*(Delete|Remove|RemoveAt|Clear|Truncate|Kill|Move|MoveTo|CopyTo|' +
      'Create|Open|WriteAll\\w*|AppendAll\\w*|SetAccessControl|Encrypt|Decrypt)\\s*\\(',
    // cmdlets that execute/produce arbitrary code or processes
    '\\b(iex|Invoke-Expression|Invoke-Command|Start-Process|Start-Job|' +
      'Add-Type|New-Object|Register-\\w+|Set-ExecutionPolicy)\\b',
  ].join('|'),
  'i'
);

const KEYWORD = /^(if|elseif|else|foreach|for|while|do|until|switch|try|catch|finally|begin|process|end|filter|trap|data)\b/i;

// -------------------------------------------------------------------------
// Settings loading (mirrors Claude Code precedence: global < project < local)
// -------------------------------------------------------------------------
function loadSettings(p) {
  if (!p) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    return {};
  }
}

function loadMergedSettings() {
  const globalPath =
    process.env.CLAUDE_SETTINGS_PATH ||
    path.join(os.homedir(), '.claude', 'settings.json');
  const settings = loadSettings(globalPath);

  // CLAUDE_PROJECT_DIR is not reliably set on Windows; this file lives in
  // <project>/.claude/hooks/, so derive the project dir from __dirname instead.
  const projectDir =
    process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..');
  if (!projectDir) return settings;

  const shared = loadSettings(path.join(projectDir, '.claude', 'settings.json'));
  const local = loadSettings(path.join(projectDir, '.claude', 'settings.local.json'));

  const gp = settings.permissions || {};
  const sp = shared.permissions || {};
  const lp = local.permissions || {};
  const dedupe = (arr) => Array.from(new Set(arr));
  settings.permissions = Object.assign({}, gp, {
    allow: dedupe([...(gp.allow || []), ...(sp.allow || []), ...(lp.allow || [])]),
    deny: dedupe([...(gp.deny || []), ...(sp.deny || []), ...(lp.deny || [])]),
  });
  return settings;
}

// -------------------------------------------------------------------------
// Pattern matching. A PowerShell(...) rule's inner text is a glob where * is
// the only wildcard (colons are literal — Windows paths contain them).
// -------------------------------------------------------------------------
function globToRegExp(glob) {
  let out = '^';
  for (const ch of glob) {
    if (ch === '*') out += '.*';
    else out += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(out + '$', 'i');
}

function parsePatterns(patterns) {
  const result = [];
  const re = new RegExp('^' + TOOL + '\\((.+)\\)$');
  for (const pat of patterns || []) {
    const m = re.exec(pat);
    if (!m) continue;
    const inner = m[1];
    const star = inner.indexOf('*');
    const prefix = (star === -1 ? inner : inner.slice(0, star)).trim().toLowerCase();
    result.push({ prefix, re: globToRegExp(inner) });
  }
  return result;
}

function commandMatches(cmd, patterns) {
  const lc = cmd.toLowerCase();
  for (const { prefix, re } of patterns) {
    if (prefix && lc === prefix) return true;
    if (re.test(cmd)) return true;
  }
  return false;
}

// -------------------------------------------------------------------------
// Preprocessing: normalize newlines, strip block comments, neutralize
// here-strings (keeping any $() substitutions from double-quoted ones so
// hidden commands are still checked), and join backtick line-continuations.
// -------------------------------------------------------------------------
function balancedEnd(text, openIdx) {
  const open = text[openIdx];
  const close = open === '(' ? ')' : open === '{' ? '}' : ']';
  let depth = 0, inS = false, inD = false;
  for (let j = openIdx; j < text.length; j++) {
    const c = text[j];
    if (c === '`' && !inS) { j++; continue; }
    if (c === "'" && !inD) { inS = !inS; continue; }
    if (c === '"' && !inS) { inD = !inD; continue; }
    if (inS || inD) continue;
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') { depth--; if (depth === 0) return j; }
  }
  return text.length - 1;
}

function extractDollarParens(text) {
  const subs = [];
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] === '$' && text[i + 1] === '(') {
      const end = balancedEnd(text, i + 1);
      subs.push(text.slice(i + 2, end));
      i = end;
    }
  }
  return subs;
}

function preprocess(command) {
  let s = command.replace(/\r\n?/g, '\n');
  s = s.replace(/<#[\s\S]*?#>/g, ' '); // block comments
  // double-quoted here-string: keep its $() substitutions as statements
  s = s.replace(/@"\n([\s\S]*?)\n"@/g, (m, body) => {
    const subs = extractDollarParens(body);
    return subs.length ? ' ' + subs.join('; ') + ' ' : ' "" ';
  });
  s = s.replace(/@'\n([\s\S]*?)\n'@/g, ' "" '); // literal here-string
  s = s.replace(/`\n/g, ' '); // line continuation
  return s;
}

// -------------------------------------------------------------------------
// Splitting & extraction
// -------------------------------------------------------------------------

// Split on top-level statement/pipeline/chain separators: ; \n | || &&
function splitStatements(text) {
  const out = [];
  let cur = '', i = 0, inS = false, inD = false, depth = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '`' && !inS) { cur += ch + (text[i + 1] || ''); i += 2; continue; }
    if (ch === "'" && !inD) { inS = !inS; cur += ch; i++; continue; }
    if (ch === '"' && !inS) { inD = !inD; cur += ch; i++; continue; }
    if (inS || inD) { cur += ch; i++; continue; }
    if (ch === '(' || ch === '{' || ch === '[') { depth++; cur += ch; i++; continue; }
    if (ch === ')' || ch === '}' || ch === ']') { depth = Math.max(0, depth - 1); cur += ch; i++; continue; }
    if (depth === 0) {
      if ((ch === '&' && text[i + 1] === '&') || (ch === '|' && text[i + 1] === '|')) {
        out.push(cur); cur = ''; i += 2; continue;
      }
      if (ch === '|' || ch === ';' || ch === '\n') { out.push(cur); cur = ''; i++; continue; }
    }
    cur += ch; i++;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

// Return the inner contents of every top-level (...) / {...} group, plus any
// $(...) substitution found INSIDE double-quoted strings (those execute).
function extractGroups(text) {
  const groups = [];
  let i = 0, inS = false, inD = false;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '`' && !inS) { i += 2; continue; }
    if (ch === "'" && !inD) { inS = !inS; i++; continue; }
    if (ch === '"' && !inS) { inD = !inD; i++; continue; }
    if (inS) { i++; continue; }
    if (inD) {
      if (ch === '$' && text[i + 1] === '(') {
        const end = balancedEnd(text, i + 1);
        groups.push(text.slice(i + 2, end));
        i = end + 1; continue;
      }
      i++; continue;
    }
    if (ch === '(' || ch === '{') {
      const end = balancedEnd(text, i);
      groups.push(text.slice(i + 1, end));
      i = end + 1; continue;
    }
    i++;
  }
  return groups;
}

function matchAssignment(stmt) {
  // $x = ... | $env:x += ... | ${x} = ...  (operator at start, not a comparison)
  const m = /^(\$[\w:]+(?:\[[^\]]*\])?|\$\{[^}]+\})\s*(=|\+=|-=|\*=|\/=|%=)\s*([\s\S]+)$/.exec(stmt);
  if (!m) return null;
  return { rhs: m[3] };
}

function stripRedirections(s) {
  return s.replace(/\s*\d*>>?\s*&?\s*(\$null|[^\s|;]+)?/g, ' ').trim();
}

function normalizeLeaf(s) {
  return stripRedirections(s).replace(/\s+/g, ' ').trim();
}

// -------------------------------------------------------------------------
// Core: walk the command tree, collecting leaf command invocations.
// -------------------------------------------------------------------------
function analyze(command) {
  const commands = [];
  const state = { uncertain: false };
  const text = preprocess(command);
  if (DANGER.test(text)) state.uncertain = true;
  processBlock(text, commands, state);
  return { commands: Array.from(new Set(commands)), uncertain: state.uncertain };
}

function processBlock(text, commands, state) {
  for (const stmt of splitStatements(text)) processStatement(stmt, commands, state);
}

function processStatement(raw, commands, state) {
  let stmt = raw.trim();
  if (!stmt) return;

  // Keyword-headed compound (if/foreach/while/try/...): its (...) conditions and
  // {...} bodies are the only places commands can hide — recurse into them.
  if (KEYWORD.test(stmt)) {
    for (const g of extractGroups(stmt)) processBlock(g, commands, state);
    return;
  }

  // Call operator `& ...` / dot-source `. ...`
  if (/^&\s*\{/.test(stmt) || /^\.\s*\{/.test(stmt)) {
    for (const g of extractGroups(stmt)) processBlock(g, commands, state);
    return;
  }
  if (/^&\s+\S/.test(stmt) || /^\.\s+\S/.test(stmt)) {
    const after = stmt.replace(/^[&.]\s+/, '');
    const leaf = normalizeLeaf(after);
    if (leaf) commands.push(leaf);
    for (const g of extractGroups(after)) processBlock(g, commands, state);
    return;
  }

  // Assignment: analyze the right-hand side (it may be a command/pipeline)
  const asg = matchAssignment(stmt);
  if (asg) { processBlock(asg.rhs, commands, state); return; }

  const c = stmt[0];
  // Invoke a script by path: .\foo.ps1 or ./foo.ps1  => command
  if (c === '.' && (stmt[1] === '\\' || stmt[1] === '/')) {
    const leaf = normalizeLeaf(stmt);
    if (leaf) commands.push(leaf);
    for (const g of extractGroups(stmt)) processBlock(g, commands, state);
    return;
  }

  // Expression mode: $ ( @ " ' [ ! . - digit  => not a command itself; recurse
  // into groups for any nested command invocations.
  if ('$(@"\'[!.-'.includes(c) || /[0-9]/.test(c)) {
    for (const g of extractGroups(stmt)) processBlock(g, commands, state);
    return;
  }

  // Command mode: bareword (Verb-Noun, npm, git, grep, a path, ...)
  if (/[A-Za-z0-9_\\/~]/.test(c)) {
    const leaf = normalizeLeaf(stmt);
    if (leaf) commands.push(leaf);
    for (const g of extractGroups(stmt)) processBlock(g, commands, state);
    return;
  }

  state.uncertain = true; // unrecognized start — don't auto-allow
}

// -------------------------------------------------------------------------
// Decision
// -------------------------------------------------------------------------
function decide(command, settings) {
  if (!command || !command.trim()) return [null, null];
  const perms = settings.permissions || {};
  const allow = parsePatterns(perms.allow);
  const deny = parsePatterns(perms.deny);

  const { commands, uncertain } = analyze(command);
  log(`commands=${JSON.stringify(commands.slice(0, 6))}${commands.length > 6 ? '…' : ''} uncertain=${uncertain}`);

  for (const cmd of commands) {
    if (commandMatches(cmd, deny)) return ['deny', `Sub-command '${cmd}' matches a deny rule`];
  }
  if (uncertain) return [null, null];
  if (commands.length === 0) return ['allow', 'No command invocations (pure expression)'];
  for (const cmd of commands) {
    if (!commandMatches(cmd, allow)) return [null, null];
  }
  return ['allow', 'All sub-commands match allow rules'];
}

function buildReason(reason) {
  if (logLines.length === 0) return reason;
  const verbose = logLines.join(' | ');
  return reason ? `${reason} | ${verbose}` : verbose;
}

function main(raw) {
  let input;
  try {
    input = JSON.parse(raw.replace(/^﻿/, ''));
  } catch (e) {
    process.exit(0);
  }
  if ((input.tool_name || '') !== TOOL) process.exit(0);
  const command = (input.tool_input && input.tool_input.command) || '';
  if (!command) process.exit(0);

  const settings = loadMergedSettings();
  const [decision, reason] = decide(command, settings);

  if (decision !== null) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: decision,
          permissionDecisionReason: buildReason(reason),
        },
      }) + '\n'
    );
  }
  process.exit(0);
}

if (require.main === module) {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => (buf += d));
  process.stdin.on('end', () => main(buf));
}

module.exports = { analyze, decide, parsePatterns, splitStatements, extractGroups };

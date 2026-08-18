#!/usr/bin/env node
/*
 * PreToolUse hook for Claude Code — jCodeMunch front-door edition.
 *
 * Sibling of smart_approve.js, same idea one domain over: decide per-invocation
 * what a static permission rule cannot express. smart_approve.js does it for
 * compound PowerShell command lines; this does it for jcm's dispatcher, whose
 * read/write nature lives in its ARGUMENTS rather than its name.
 *
 * Why this exists: jcm runs in `tool_surface: "counter"`
 * (~/.code-index/config.jsonc), so every jcm call goes through `order` /
 * `route`. The server annotates both ToolAnnotations(readOnlyHint=false) —
 * correctly, since `order` CAN dispatch a state-changing action when the caller
 * passes allow_state_change=true (jcodemunch_mcp/server.py:1183). Claude Code's
 * plan mode prompts for approval on every call it cannot prove is read-only,
 * per invocation, and that gate is NOT satisfied by an `mcp__jcodemunch__order`
 * entry in permissions.allow. Result: the same prompt every time, six deep when
 * the model fans out order() calls in parallel.
 *
 * The decision, per call:
 *   - route  -> allow. It only ever RECOMMENDS an action; its execute path
 *               explicitly refuses state-changing ones (server.py:5212), so no
 *               argument turns it into a writer.
 *   - order  -> allow only when the dispatch is provably read-only:
 *               allow_state_change is not true, AND the action is not in the
 *               server's state-changing set, AND the action name does not trip
 *               the exec/write tripwire.
 *   - anything else -> stay silent, let the normal prompt happen.
 *
 * It never denies. Worst case is a passthrough to the usual prompt, so a gap
 * here costs a keystroke, never a silent write. The allowed set is strictly
 * NARROWER than the blanket `mcp__jcodemunch__order` rule already sitting in
 * .claude/settings.json.
 *
 * The two tables below mirror jcodemunch-mcp 1.108.283:
 * counter.STATE_CHANGING_ACTIONS + server._ANNOTATION_ONLY_WRITERS, and
 * counter._FORBIDDEN_VERB_RE. If jcm adds a state-changing action and this
 * drifts, the failure mode is a prompt this hook could have suppressed.
 *
 * Dependency-free (Node built-ins only). Input: JSON on stdin
 * { tool_name, tool_input }. Output: PreToolUse permissionDecision JSON on
 * stdout, or silent exit 0 to fall through to the normal prompt.
 */

'use strict';

const PREFIX = 'mcp__jcodemunch__';

// counter.STATE_CHANGING_ACTIONS + server._ANNOTATION_ONLY_WRITERS
const STATE_CHANGING = new Set([
  'index_repo',
  'index_folder',
  'index_file',
  'index_dependency',
  'invalidate_cache',
  'register_edit',
  'tune_weights',
  'set_tool_tier',
  'announce_model',
  'embed_repo',
  'import_runtime_signal',
  'summarize_repo',
  'finalize_handoff',
  'check_embedding_drift', // reports by default, but force=true re-pins the canary
]);

// counter._FORBIDDEN_VERB_RE — actions order() refuses outright. Belt and braces.
const FORBIDDEN_VERB =
  /(^|[._-])(exec|shell|run_command|spawn|eval|write_file|edit_file|patch|apply_patch|delete_file|rm|mv|chmod)($|[._-])/i;

// Returns a reason string to auto-approve, or null to stay silent.
function decide(toolName, input) {
  if (!toolName.startsWith(PREFIX)) return null;
  const tool = toolName.slice(PREFIX.length);

  if (tool === 'route') {
    return 'route recommends actions; its execute path refuses state-changing ones';
  }

  if (tool !== 'order') return null;

  if (input.allow_state_change === true) return null; // caller opted into writes
  const action = typeof input.action === 'string' ? input.action : '';
  if (!action) return null;
  if (STATE_CHANGING.has(action)) return null;
  if (FORBIDDEN_VERB.test(action)) return null;

  return `order('${action}') is a read-only dispatch (allow_state_change not set)`;
}

function main(raw) {
  let input;
  try {
    input = JSON.parse(raw.replace(/^﻿/, ''));
  } catch (e) {
    process.exit(0);
  }

  const reason = decide(input.tool_name || '', input.tool_input || {});
  if (reason !== null) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          permissionDecisionReason: reason,
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

module.exports = { decide };

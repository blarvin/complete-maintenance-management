#!/usr/bin/env node
/*
 * PostToolUse logger: append one tab-separated line per tool call to
 * .claude/usage.log
 *
 * Replaces log-tool-use.sh, which depended on jq (absent here) and on
 * `cat /dev/stdin` (unavailable under Git Bash), so it logged bare
 * timestamps with empty tool names for thousands of lines.
 *
 * Never fails the tool call: any error exits 0 silently.
 */

'use strict';

const fs = require('fs');
const path = require('path');

function main(raw) {
  let input;
  try {
    input = JSON.parse(raw.replace(/^﻿/, ''));
  } catch (e) {
    process.exit(0);
  }

  const tool = input.tool_name || 'unknown';
  const ti = input.tool_input || {};
  const detail = String(ti.file_path || ti.command || ti.pattern || '')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 120);

  const projectRoot =
    process.env.CLAUDE_PROJECT_DIR || path.join(__dirname, '..', '..');
  const logFile = path.join(projectRoot, '.claude', 'usage.log');

  const line = detail
    ? `${new Date().toISOString()}\t${tool}\t${detail}\n`
    : `${new Date().toISOString()}\t${tool}\n`;

  try {
    fs.appendFileSync(logFile, line, 'utf8');
  } catch (e) {
    /* logging must never break the session */
  }
  process.exit(0);
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => (buf += d));
process.stdin.on('end', () => main(buf));

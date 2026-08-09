#!/usr/bin/env node
/*
 * PreToolUse guard: block direct edits to protected files.
 *
 * Replaces the old `bash -c '... jq ...'` inline hook, which silently
 * no-opped on this machine because jq isn't installed (empty file_path =>
 * the case statement never matched => every edit was allowed).
 *
 * Dependency-free. Input: JSON on stdin { tool_name, tool_input: { file_path } }.
 * Exit 2 + stderr = block; exit 0 = allow.
 */

'use strict';

// Matched against the path with backslashes normalized to '/'.
const PROTECTED = [
  /(^|\/)package-lock\.json$/i,
  /(^|\/)SPECIFICATION\.md$/i,
  /(^|\/)\.env$/i,
  /(^|\/)\.env\.[^/]*$/i,
];

function main(raw) {
  let input;
  try {
    input = JSON.parse(raw.replace(/^﻿/, ''));
  } catch (e) {
    process.exit(0); // unparseable => fall through to normal permission checks
  }

  const ti = input.tool_input || {};
  // Edit/Write/NotebookEdit use file_path; MultiEdit-style payloads may carry edits[].
  const paths = [ti.file_path, ti.notebook_path].filter(Boolean);
  if (Array.isArray(ti.edits)) {
    for (const e of ti.edits) if (e && e.file_path) paths.push(e.file_path);
  }

  for (const p of paths) {
    const norm = String(p).replace(/\\/g, '/');
    if (PROTECTED.some((re) => re.test(norm))) {
      process.stderr.write(
        `BLOCKED: protected file ${p} - do not edit directly.\n`
      );
      process.exit(2);
    }
  }
  process.exit(0);
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => (buf += d));
process.stdin.on('end', () => main(buf));

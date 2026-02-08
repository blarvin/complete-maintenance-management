#!/bin/bash
# Claude Code PostToolUse logger
# Appends tool name, timestamp, and context to .claude/usage.log
# Input: JSON on stdin from Claude Code hook system

INPUT=$(cat /dev/stdin)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.command // empty' | head -c 120)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Determine project root (script is in .claude/hooks/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/.claude/usage.log"

# Append log entry (tab-separated for easy parsing)
if [ -n "$FILE_PATH" ]; then
  printf "%s\t%s\t%s\n" "$TIMESTAMP" "$TOOL_NAME" "$FILE_PATH" >> "$LOG_FILE"
else
  printf "%s\t%s\n" "$TIMESTAMP" "$TOOL_NAME" >> "$LOG_FILE"
fi

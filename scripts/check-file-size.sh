#!/bin/bash
# PostToolUse hook: warn when a .ts/.tsx file exceeds 400 lines
# Ref: docs/reference/file-size-directive.md
input=$(cat)
# Extract file_path from JSON without jq
f=$(echo "$input" | grep -oP '"file_path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"file_path"\s*:\s*"\([^"]*\)".*/\1/')
if [ -z "$f" ]; then
  f=$(echo "$input" | grep -oP '"filePath"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"filePath"\s*:\s*"\([^"]*\)".*/\1/')
fi
if echo "$f" | grep -qE '\.(tsx?|jsx?)$' && [ -f "$f" ]; then
  lines=$(wc -l < "$f")
  if [ "$lines" -gt 400 ]; then
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PostToolUse\",\"additionalContext\":\"WARNING: $f tiene $lines lineas (limite: 400). Segun docs/reference/file-size-directive.md, debe descomponerse antes de mergear.\"}}"
  fi
fi

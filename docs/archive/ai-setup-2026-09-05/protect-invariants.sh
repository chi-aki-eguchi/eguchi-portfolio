#!/bin/bash
# §0 invariant guard — blocks code that manually sets Content-Encoding or edits .env

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.content // empty')

# Skip docs — .md/.txt mentioning the header is not a violation
if ! echo "$FILE_PATH" | grep -qE '\.(md|txt|sh)$'; then
  if echo "$INPUT" | jq -r '.tool_input.content // .tool_input.new_string // empty' | grep -qi 'content-encoding'; then
    echo "§0 INVARIANT VIOLATION: Content-Encoding を手動で設定しないでください。Railway のプロキシが自動処理します。" >&2
    exit 2
  fi
fi

# Block direct .env edits
if echo "$FILE_PATH" | grep -qE '\.env($|\.)'; then
  echo "BLOCKED: .env ファイルは直接編集しないでください。環境変数は Railway ダッシュボードで管理します。" >&2
  exit 2
fi

exit 0

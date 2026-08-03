#!/bin/sh
# eguchi-portfolio の Codex カスタムエージェントを、ローカルの Codex 設定へ導入する。
#
# テンプレートの正本は docs/agents/codex-agents/*.toml（git 管理下）。
# 導入先の .codex/ はローカル専用（.gitignore 済み）なので、このスクリプトで同期する。
#
# 既存ファイルが違う内容なら上書きせず失敗する。Codex の config.toml は変更しない。

set -eu

usage() {
  cat <<'EOF'
Usage: install-codex-agents.sh [--target-dir <path>] [--check]

  --target-dir <path>  導入先ディレクトリを明示する（絶対パス推奨）。
                       省略時は $CODEX_HOME/agents、未設定なら $HOME/.codex/agents。
  --check              導入済みファイルが正本と一致するか検査するだけ。コピーしない。
  --help               このヘルプ。
EOF
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

script_dir=$(CDPATH= cd "$(dirname "$0")" && pwd) || exit 1
template_dir=$script_dir/../../docs/agents/codex-agents

if [ -n "${CODEX_HOME-}" ]; then
  target_dir=$CODEX_HOME/agents
else
  [ -n "${HOME-}" ] || fail "HOME も CODEX_HOME も未設定です。--target-dir を指定してください。"
  target_dir=$HOME/.codex/agents
fi

check_only=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --target-dir)
      [ "$#" -ge 2 ] && [ -n "$2" ] || fail "--target-dir にはパスが必要です。"
      case "$2" in
        --*) fail "--target-dir のパスは ./ か絶対パスで指定してください。" ;;
      esac
      target_dir=$2
      shift 2
      ;;
    --check) check_only=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) fail "不明な引数: $1（--help を参照）" ;;
  esac
done

case "$target_dir" in
  /*) ;;
  *) target_dir=$(pwd -P)/$target_dir ;;
esac
[ "$target_dir" != "/" ] || fail "ファイルシステムのルートは導入先にできません。"

agent_files='eguchi-luna-routine.toml eguchi-terra-impl.toml'

for agent_file in $agent_files; do
  template=$template_dir/$agent_file
  [ -f "$template" ] && [ ! -L "$template" ] || fail "正本が見つかりません: $template"
done

# 先に全件を検査してから、コピーを1件も行わずに失敗できるようにする。
conflict=0
for agent_file in $agent_files; do
  template=$template_dir/$agent_file
  destination=$target_dir/$agent_file

  if [ -L "$destination" ]; then
    printf 'CONFLICT: %s はシンボリックリンクです。手動で確認してください。\n' "$destination" >&2
    conflict=1
  elif [ -f "$destination" ]; then
    if cmp -s "$template" "$destination"; then
      printf 'OK: %s\n' "$destination"
    else
      printf 'CONFLICT: %s の内容が正本と違います。上書きしません。\n' "$destination" >&2
      printf '  差分: diff %s %s\n' "$destination" "$template" >&2
      conflict=1
    fi
  elif [ -e "$destination" ]; then
    printf 'CONFLICT: %s は通常ファイルではありません。\n' "$destination" >&2
    conflict=1
  elif [ "$check_only" -eq 1 ]; then
    printf 'MISSING: %s\n' "$destination" >&2
    conflict=1
  else
    printf 'INSTALL: %s\n' "$destination"
  fi
done

[ "$conflict" -eq 0 ] || fail "検査に失敗しました。導入先を確認してから再実行してください。"

if [ "$check_only" -eq 1 ]; then
  printf '検査に成功しました: %s\n' "$target_dir"
  exit 0
fi

mkdir -p "$target_dir"
for agent_file in $agent_files; do
  destination=$target_dir/$agent_file
  [ -f "$destination" ] || cp "$template_dir/$agent_file" "$destination"
done

# 導入後に、コピー結果が正本と一致することを確かめる。
for agent_file in $agent_files; do
  cmp -s "$template_dir/$agent_file" "$target_dir/$agent_file" ||
    fail "導入後の検証に失敗しました: $target_dir/$agent_file"
done

printf '導入しました: %s\n' "$target_dir"
printf 'Codex のタスクを新しく開始してから、エージェント名で呼び出してください。\n'

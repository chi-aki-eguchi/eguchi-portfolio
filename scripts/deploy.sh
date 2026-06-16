#!/usr/bin/env bash
# 実装完了時のデプロイ準備を1コマンドにまとめたもの。
#   1. ビルド確認 (tsc -b + bun test + vite build)。白画面(CDN汚染)恒久対策として
#      BUILD_TAG を自動生成し、全アセット名と BUILD_ID(X-Build) に同一値を刻む（content.md）。
#   2. スモークテスト（主要ページ200 + X-Build一致 + HTML参照アセット全200）。
#   3. デプロイ用 ZIP を作成（ルートに上書き + deploys/ に日付つきで保存・直近3つ保持）。
# いずれかが失敗したら ZIP は更新せず非0で終了する。
# 前提: ビルドは Mac 側で行い、dist 同梱の ZIP を Runable が配信するだけ（サンドボックス内
# での再ビルド/pm2再起動は前提にしない）。よってタグ付与は全てこの Mac 側スクリプトで完結する。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ZIP="eguchi-portfolio-deploy.zip"
SMOKE_PORT="${SMOKE_PORT:-4399}"

echo "▶ 1/3 ビルド確認 (tsc -b + bun test + vite build)"
# tsc -b: project references を実際に検査する（-b なしの tsc --noEmit は files:[] のため
# 何も検査しない＝過去に未importのuseRefで全ページ真っ白を見逃した）。
# bun test: PhotoGallery 等の描画スモークテスト（render時クラッシュをZIP作成前に検出）。
#
# 白画面（CDN汚染）恒久対策 — 1ビルド = 1タイムスタンプを自動付与:
#  ・BUILD_TAG を全アセット名に混ぜる（vite.config）→ 内容不変の vendor チャンクも毎回URLが変わり、
#    Cloudflare エッジの汚染キャッシュを物理的に回避する（content.md 修正A）。
#  ・同じ値を ogp.ts の BUILD_ID に刻む → X-Build ヘッダで本番反映を一目で確認（修正C）。
#  秋さんが手動でコマンド/ファイル編集をせずに済むよう、ここで完全自動化する。
BUILD_TAG="$(date +%Y%m%d-%H%M%S)"
OGP_TS="packages/web/src/api/ogp.ts"
# BUILD_ID 行をビルドタグに置換（BSD/GNU で -i の挙動が異なるため、テンポラリ経由で両対応）。
_tmp="$(mktemp)"
sed -E "s/(export const BUILD_ID = \")[^\"]*(\";)/\1${BUILD_TAG}\2/" "$OGP_TS" > "$_tmp" && mv "$_tmp" "$OGP_TS"
# クリーンビルド: 旧ビルドの dist を完全削除してから建てる。vite の emptyOutDir 任せにせず、
# 古いタグ無しアセット（例 index-XXXX.js）が dist に残って ZIP に混入する事故を物理的に断つ。
rm -rf packages/web/dist
( cd packages/web && BUILD_TAG="$BUILD_TAG" bun run build && bun test ./src 2>&1 | tail -4 )
# 検証1: アセット名にタグが刻まれたか（vite 出力設定の事故検知）。
if ! ls packages/web/dist/assets/ 2>/dev/null | grep -q -- "-${BUILD_TAG}\."; then
  echo "  ✗ dist/assets/ にビルドタグ ${BUILD_TAG} が見当たりません（vite.config の output 設定を確認）"; exit 1
fi
# 検証2【最重要・今回の不整合の直接ガード】: dist/index.html が参照する全 /assets/ が
# 実ファイルとして dist に在り、かつタグ付きか。index.html とアセットが別ビルド = ここで落ちる。
miss=0
for ref in $(grep -oE '/assets/[^"]+\.(js|css)' packages/web/dist/index.html | sort -u); do
  if [ ! -f "packages/web/dist${ref}" ]; then
    echo "  ✗ index.html 参照 ${ref} が dist に無い（index.html とアセットが別ビルド）"; miss=1
  elif ! printf '%s' "$ref" | grep -q -- "-${BUILD_TAG}\."; then
    echo "  ✗ index.html 参照 ${ref} にタグ ${BUILD_TAG} が無い"; miss=1
  fi
done
[ "$miss" = "0" ] || { echo "  ✗ dist の自己整合に失敗 → ZIP を更新しません"; exit 1; }
echo "  ✓ BUILD_TAG ${BUILD_TAG}: index.html⇔assets 整合・全タグ付き確認"

echo "▶ 2/3 スモークテスト (port ${SMOKE_PORT} で主要ページの 200 を確認)"
SMOKE_PID=""
cleanup() { [ -n "$SMOKE_PID" ] && kill "$SMOKE_PID" 2>/dev/null || true; }
trap cleanup EXIT
PORT="$SMOKE_PORT" bun packages/web/src/server.ts >/tmp/eguchi-smoke.log 2>&1 &
SMOKE_PID=$!

up=0
for _ in $(seq 1 40); do
  if curl -sf -o /dev/null "http://localhost:${SMOKE_PORT}/"; then up=1; break; fi
  sleep 0.5
done
if [ "$up" != "1" ]; then
  echo "  ✗ サーバが起動しませんでした。ログ:"; tail -20 /tmp/eguchi-smoke.log; exit 1
fi

fail=0
for path in / /gallery /series /about /contact; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${SMOKE_PORT}${path}")
  if [ "$code" = "200" ]; then echo "  ✓ ${path} → ${code}"; else echo "  ✗ ${path} → ${code}"; fail=1; fi
done

# 白画面恒久対策の検証（content.md 4章step4のローカル版）:
#  ・X-Build が今回の BUILD_TAG と一致するか（古い dist を掴んでいないか）。
#  ・HTML が参照する全 /assets/*.js|css が 200 か（= 真っ白の直接原因「アセットが読めない」を事前検出）。
xb=$(curl -s -D - -o /dev/null "http://localhost:${SMOKE_PORT}/" | awk 'tolower($1)=="x-build:"{print $2}' | tr -d '\r')
if [ "$xb" = "$BUILD_TAG" ]; then echo "  ✓ X-Build ${xb}"; else echo "  ✗ X-Build=${xb:-(無し)} が BUILD_TAG ${BUILD_TAG} と不一致"; fail=1; fi
assets=$(curl -s "http://localhost:${SMOKE_PORT}/" | grep -oE '/assets/[^"]+\.(js|css)' | sort -u || true)
if [ -z "$assets" ]; then
  echo "  ✗ HTML が /assets/ を参照していません（ビルド出力異常）"; fail=1
else
  for a in $assets; do
    code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${SMOKE_PORT}${a}")
    if [ "$code" = "200" ]; then echo "  ✓ ${a} → 200"; else echo "  ✗ ${a} → ${code}"; fail=1; fi
  done
fi
cleanup; SMOKE_PID=""; trap - EXIT
[ "$fail" = "0" ] || { echo "スモークテスト失敗のため ZIP は更新しません"; exit 1; }

echo "▶ 3/3 デプロイ ZIP 作成"
# ルート直下の *.png（作業用スクショ）だけ除外し、packages/ 配下の素材 png は残す。
EXCLUDES=(
  -x "${ZIP}"
  -x ".env" -x "*/.env" -x "*/.env.*" -x ".env.local"
  -x "node_modules/*" -x "*/node_modules/*"
  -x ".git/*"
  -x ".bun/*" -x "*/.bun/*"
  -x ".turbo/*" -x "*/.turbo/*"
  # dist は意図的に同梱する（2026-06-13 のインシデント対応）。
  # Runable 上の起動時ビルドは devDeps 不在で失敗し、try/catch が握りつぶして
  # 古い dist を配信し続けていた。ローカルの deploy ゲートで検証済みの dist を
  # そのまま出荷することで、本番のビルド環境差異を排除する。
  -x "screenshots/*"
  -x "deploys/*"
  -x ".claude/*"
  -x ".codex/*" -x ".Codex/*"
)
shopt -s nullglob
for f in *.png; do EXCLUDES+=( -x "$f" ); done
shopt -u nullglob

rm -f "$ZIP"
zip -r -q "$ZIP" . "${EXCLUDES[@]}"

# 検証3: 出荷物（ZIP）そのものを検査。作業ツリーではなく ZIP 内の index.html が参照する
# 全アセットが ZIP 内に実体として入っているか＝出荷される index.html とアセットが同一ビルドか。
zip_index="$(unzip -p "$ZIP" packages/web/dist/index.html 2>/dev/null)"
zip_members="$(unzip -Z1 "$ZIP" 'packages/web/dist/assets/*' 2>/dev/null || true)"
zmiss=0
for ref in $(printf '%s' "$zip_index" | grep -oE '/assets/[^"]+\.(js|css)' | sort -u); do
  printf '%s\n' "$zip_members" | grep -q -- "${ref}\$" || { echo "  ✗ ZIP: index.html 参照 ${ref} が ZIP 内に無い"; zmiss=1; }
done
if [ "$zmiss" != "0" ] || ! printf '%s' "$zip_index" | grep -q -- "-${BUILD_TAG}\."; then
  echo "  ✗ ZIP 成果物の自己整合に失敗（index.html と同梱アセットが不一致 or タグ無し）→ ZIP を破棄"; rm -f "$ZIP"; exit 1
fi
echo "  ✓ ZIP 成果物: index.html⇔同梱アセット 完全一致（BUILD_TAG ${BUILD_TAG}）"

mkdir -p deploys
STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="deploys/eguchi-portfolio-deploy-${STAMP}.zip"
cp "$ZIP" "$ARCHIVE"

# 直近3つだけ残して古いものを削除
ls -1t deploys/eguchi-portfolio-deploy-*.zip 2>/dev/null | tail -n +4 | while read -r old; do
  rm -f "$old"; echo "  🗑  古い ZIP を削除: ${old}"
done

SIZE="$(du -h "$ZIP" | cut -f1)"
echo "  ✓ ${ZIP} (${SIZE}) を更新 / アーカイブ: ${ARCHIVE}"
echo "  ✓ deploys/ の保持数: $(ls -1 deploys/eguchi-portfolio-deploy-*.zip | wc -l | tr -d ' ')"
echo "✅ デプロイ可能な状態の ZIP を更新しました（BUILD_TAG: ${BUILD_TAG}）"

# 本番（Runable Publish 後）の確認はローカルからは実行不可。手順だけ表示しておく（content.md 5章）。
cat <<EOF

── Runable Publish 後の本番チェック（手動）──
  1) curl -sI https://akieguchi.com/ | grep -i x-build          # → ${BUILD_TAG} が返れば反映OK
  2) curl -sI https://akieguchi.com/ | grep -i cf-cache-status  # → DYNAMIC が理想（HIT は要注意）
  3) HTML 参照アセットが全て 200 か / gzip 汚染(od 先頭が 1f 8b 以外)が無いか
EOF

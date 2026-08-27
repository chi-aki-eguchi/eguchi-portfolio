@AGENTS.md

# Claude Code

## いまのゴール

管理画面 `/admin` の刷新。6軸は
**デザイン / 使用感 / 完成度 / 高級感 / AI感の削減 / 可愛さ**。
正本は `docs/specs/admin-renewal-goal.md`。
`growth-monetization-plan.md` は事業計画であって、製品のゴールではない。

## やり方

- オーナーはコードを読まない。**差分ではなく実物を見せる。**
  admin のスクリーンショットは `scratch/look.config.ts` で撮れる
  （読み取りのみ。`bunx playwright test --config scratch/look.config.ts`）。
- 大きく変えることをためらわない。枝の上なら捨てられる。
- クレジットの残量で作業の範囲を縮めない。縮めるのは1回の区切りの大きさ。
  小さくコミットして、いつ中断されても壊れない状態を保つ。

## Compaction で残すもの

いまの目的と次の一手 / 変更中のファイル / 検証結果と正確な失敗内容 / 未解決の判断待ち。
古い探索と重複ログは残さない。

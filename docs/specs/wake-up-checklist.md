# 起きたら最初にやること（2026-07-28 朝）

短時間で終わる順に並べてある。**1番だけは必ずやってください。**
これをやらないと、いまのコードはローカルでも動きません。

---

## 1. DBへ列を足す（3分・必須）

```bash
cd /Users/chiaki/eguchi-portfolio-app/packages/web && bun run db:push
```

**実行前に「これから流すSQL」が表示されます。**
`ALTER TABLE photos ADD COLUMN` が**7本だけ**であることを確認してください。

| 出てよいもの | 出たら中止 |
|---|---|
| `ADD COLUMN shot_at_source` | `DROP` を含むもの |
| `ADD COLUMN shot_at_digitized` | `CREATE TABLE` |
| `ADD COLUMN source_width` | データの移し替え |
| `ADD COLUMN source_height` | 上記7本以外の列 |
| `ADD COLUMN source_format` | |
| `ADD COLUMN camera_make` | |
| `ADD COLUMN camera_model` | |

照合用のSQLは `packages/web/drizzle/0005_mysterious_madame_masque.sql` にあります。

**この変更は列を足すだけで、いま公開中のサイトには影響しません。**
古いコードはこれらの列を読まないためです。だからpushの前に当てて大丈夫です。

### なぜ必要か

Drizzleは「全列を名指しするSQL」を作ります。列を足した時点で、DBに列が無いと
写真の取得が500になります。一覧だけでなくトップのヒーロー写真も止まります。

---

## 2. 動くことを確かめる（5分）

```bash
cd /Users/chiaki/eguchi-portfolio-app && bun run smoke
```

**51件前後が成功し、失敗0件**になれば1番は成功です。
（成功件数は写真の枚数で変わります。**失敗0件**だけを見てください）

失敗した場合、`scratch/smoke-evidence/<時刻>/summary.md` に
何がどこで落ちたか・スクリーンショット・動画・トレースが残ります。

---

## 3. 画面を見て決めてほしいこと（15分）

`bun run dev` で管理画面を開いて確認してください。

| 見るところ | 決めること |
|---|---|
| 写真を取り込んだ直後 | 左端の**幅2pxの線**は、弱すぎないか / 邪魔でないか |
| 同上 | 「今回追加した◯枚を選択中」の**文言** |
| 同上 | **Escの体感**。いま目印を消すのは最後の段 |
| 同上 | 追加した写真が**画面外のまま**でよいか |

**どれも私は「確認済み」として扱っていません。**

選択肢は `docs/specs/library-band-decisions.md` にまとめてあります。

---

## 4. 写真を1枚アップロードして確かめる（5分）

**これは私にはできません**（実写真のアップロードは禁止されていたため）。

デジタル写真を1枚アップロードし、DBで次を確認してください。

- `shot_at_source` が `exif_original` になっているか
- `camera_make` と `camera_model` が別々に入っているか
- `source_width` / `source_height` が**元ファイルの寸法**になっているか
  （保存版の3200pxではなく）
- `source_format` が `jpeg` などになっているか

フィルムを1枚上げた場合は `shot_at_source` が `exif_digitized` か
`file_modified` になります。

---

## 5. 読むもの（時間があれば）

| 文書 | 内容 |
|---|---|
| `docs/specs/photo-metadata-extraction-plan.md` | 今回作ったものの全体像。冒頭に1番の警告 |
| `docs/specs/library-band-decisions.md` | 束機能で決めてほしいこと6件 |
| `docs/specs/library-finder-investigation.md` | Finder型管理画面の3案（案Bを推奨） |
| `docs/specs/admin-library-states.md` | Libraryの状態遷移とスマホで届かない操作 |
| `task.md` 冒頭 | いまの状態 |

---

## 6. push について

**56 commit以上が未pushです。私からはpushしません。**

push する前に1番を済ませてください。順番を逆にすると、
デプロイした瞬間に公開サイトの写真が表示されなくなります。

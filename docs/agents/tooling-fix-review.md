# 鮮度チェックとゲート修正の反対レビュー（Phase E）

> 2026-08-03。実施 = Codex Sol / high、読み取り専用。
> **「3. 未解決の反論」は原文のまま。要約に置き換えない。**
> 以下は Claude の採否。理由は1行ずつ。

| Sol の推奨 | 採否 | 理由 |
|---|---|---|
| 1. HEAD抽出をメタ情報部分に限定し、0件/2件以上を警告 | **採用** | 実装済み。見出しより前の箇条書きだけを対象にし、重複・不正値を拒否。テスト5件 |
| 2. 成功文を「HEAD欄は一致」へ弱める | **採用** | 実装済み。実際に検査しているのはHEAD欄だけで、Current Stateの中身は見ていない |
| 3. AI運用テストを製品ゲートから分離する | **不採用** | 分離した専用ゲートは「誰も実行しない」に戻る。今回の問題の本体がそれ。hookテストは一時HOMEを使い実環境を汚さないことを実測で確認済み。落ちる実害が出たら再検討する |
| 4. テストの外部依存を減らす（一時ディレクトリの削除等） | **一部採用** | 一時ディレクトリの後始末を実装し、実行後に残らないことを確認。Git/HOMEの注入化は未実施（P1） |
| 5. 数値規則を狭く書き直す | **採用** | 「測り直せる行数・ファイル数を現在の事実として書かない。日付付き監査結果・履歴・上限値は例外」へ修正 |

**不採用にした3について。** Sol の懸念（環境依存のテストが製品ゲート全体を止める）は
理屈として正しい。ただし今日直した問題は「ゲート外にあるテストが一度も走っていなかった」
ことであり、別ゲートへ移すと同じ状態に戻る。hook テストは `mkdtempSync` で
一時HOMEを作り、実利用者のHOMEを読まないことをコードで確認した。
**実際に製品作業を止める事故が起きたら、そのとき分離する。**

---

結論は **BLOCK** です。HEAD抽出は実際の1行形式を読めるようになりましたが、誤った値を拾って「鮮度OK」にできる穴が残っています。

用語:

- HEAD = 現在選ばれているcommit。
- commit = 変更を保存した単位。
- dirty = 未commitの変更がある状態。
- 品質ゲート = 公開前に合否を決める一連の検査。
- CI = サーバー上で自動実行する検査環境。

## 1. 確認済み事実

### P1: HEAD抽出は誤検出する

[check-handoff-freshness.mjs:27](scripts/ai/check-handoff-freshness.mjs:27) はCurrent State全体から最初の `**HEAD:**` を取得します。

読み取りだけの入力確認では、以下すべてで誤った `OLD` を取得しました。

- 引用内の例 → `OLD`
- コードブロック内の例 → `OLD`
- 正式欄より前にある重複欄 → `OLD`
- `**HEAD:**` と値が別行 → `OLD`

`\s*` は改行も許すため、別行のバッククォート付き文字列まで値として結び付けます。

追加テストは正常系と「欄なし」だけで、引用・コード例・重複・改行・不正値を検査していません。[handoff-tools.test.mjs:19](scripts/ai/handoff-tools.test.mjs:19)

特に、引用内の `HEAD: SELF` を先に置くと、正式欄が古い値でも `SELF` と判定され、誤って成功する可能性があります。

### P1: dirty判定がtask.mdだけ

[check-handoff-freshness.mjs:37](scripts/ai/check-handoff-freshness.mjs:37) は現在のHEADを取得しますが、未commit変更を調べる対象は `task.md` だけです。[同:38](scripts/ai/check-handoff-freshness.mjs:38)

したがって、次の状態でも「Current Stateは現在」と返せます。

- `task.md` はclean
- 製品コードなど別ファイルがdirty
- Current Stateには「Git: clean」と記録されたまま

成功メッセージは「HEADが一致」ではなく「Current Stateは現在」と断定しているため、実際の検査範囲より強すぎます。[同:67](scripts/ai/check-handoff-freshness.mjs:67)

### P1: SELFはCurrent Stateではなくtask.md全体を見ている

`SELF` は `task.md` を最後に変更したcommitを取得します。[check-handoff-freshness.mjs:54](scripts/ai/check-handoff-freshness.mjs:54)

しかし現在の `task.md` にはCurrent State終了後にも本文があります。[task.md:68](task.md:68)
これは「Current State以外を置かない」という規則にも反しています。[file-hygiene.md:10](.claude/rules/file-hygiene.md:10)

そのため、ブロック外だけを変更したcommitがHEADでも、Current State自体を更新したと誤認できます。

一方、以下は正しく働きます。

- `task.md` 自体がdirtyなら警告する。
- Current State更新後に別commitが追加されれば警告する。
- `task.md` を複数回更新した場合は、最後に触ったcommitだけを比較する。

### P1: test:toolsは製品ゲートへ環境依存を追加している

`test:tools` は `check` の途中に入り、失敗すると後続のbuildを含む品質ゲート全体が止まります。[package.json:21](package.json:21)

クレジットテストは次に依存します。

- 書込み可能な一時領域
- 実行可能ファイルを作れる環境
- `/bin/sh`
- 子プロセスの起動

根拠は [credit-status.test.mjs:58](.claude/hooks/credit-status.test.mjs:58) と [同:65](.claude/hooks/credit-status.test.mjs:65) です。作った一時ディレクトリを消す後処理もありません。

`HOME` は子プロセス用に一時HOMEへ置換されるため、名指しされた「異常なHOME」は比較的安全です。[同:74](.claude/hooks/credit-status.test.mjs:74)
より現実的な失敗要因は、一時領域が書込み不可・満杯の場合です。

さらに、handoffテストは実際の `buildPacket()` を呼びます。[handoff-tools.test.mjs:46](scripts/ai/handoff-tools.test.mjs:46)
これは実際のGit作業場所・Gitコマンド・`task.md`・利用者HOMEを読みます。[chatgpt-handoff.mjs:12](scripts/ai/chatgpt-handoff.mjs:12)、[同:70](scripts/ai/chatgpt-handoff.mjs:70)

通常のcloneでは動いても、Git履歴を含まない配布物やコンテナでは失敗します。リポジトリ内にCI設定は見つからなかったため、実際の外部CI環境は確認できません。

### Nodeの複数ファイル指定自体は問題なし

リポジトリはBunをパッケージ管理に使いますが、Node 22.xも明示的に要求しています。[package.json:4](package.json:4)

Node 22では `node --test` と複数ファイル指定が公式対応です。[Node.js 22 test runner](https://nodejs.org/download/release/v22.12.0/docs/api/test.html)

したがって、「Node 22で複数ファイルを渡せない」という懸念はありません。

ただし現マシンの `node` は24.16.0で、宣言された22.xと一致していません。NodeがないBun専用環境では、新しい `test:tools` だけが失敗します。Bunも `node:test` を部分対応と説明しているため、単純なランナー置換は慎重に行う必要があります。[Bunのnode:test互換性](https://bun.sh/docs/runtime/nodejs-compat)

### P1: 行数・ファイル数の規則は範囲が広すぎる

[AGENTS.md:18](AGENTS.md:18) は、Current Stateの上限以外、文書への行数・ファイル数の記載を全面的に禁止する文章です。

一方、既存の重要な安全規則には次があります。

- settingsの「4箇所同期」: [AGENTS.md:59](AGENTS.md:59)
- DBスキーマの「2ファイル同期」: [checklists.md:37](docs/checklists.md:37)
- 日付付き調査での測定値: [doc-cleanup-survey.md:50](docs/agents/doc-cleanup-survey.md:50)

画像サイズや容量は「行数・ファイル数」ではないため直接対象外ですが、「2ファイル同期」は文字どおり抵触します。古くなる測定値と、安全上必要な固定数が区別されていません。

また、変更対象と説明された [file-hygiene.md](.claude/rules/file-hygiene.md:1) には、この新規則が存在しません。

## 2. 推測

- Git付きの通常のLinux CI、Node 22、書込み可能な一時領域なら、`test:tools` は通る可能性が高いです。
- 一時ファイルの蓄積は使い捨てCIでは軽微ですが、ローカルでは徐々に残ります。
- HEADの引用・コード例は現在なくても、Current Stateへ調査例を載せる運用になれば十分起こり得ます。
- AI運用テストには価値がありますが、製品コードと無関係な一時領域・Git環境の問題で製品ゲートを止める代償は大きめです。

## 3. 未解決の反論

1. 「Current Stateは決められた書式なので誤検出しない」

   書式を検証する処理がなく、重複時も警告せず最初の値を採用します。安全な前提にはできません。

2. 「task.mdにはCurrent Stateしか置かないからファイル単位で十分」

   方針としては正しいですが、現在の実物にはブロック外本文があります。現時点では前提が成立していません。

3. 「Node 22を要求しているからNode不足は対象外」

   複数ファイル指定の互換性についてはその反論が妥当です。ただし実際のNodeバージョン固定や、Gitなし環境への対応は別問題です。

4. 「すべてのテストをcheckへ入れる方が安全」

   回帰検出は強くなります。ただし現在のテストは実際のGit・HOME・一時領域へ依存しており、製品の不具合でない理由でも全体を止めます。

5. 「行数禁止は、古くなる測定値だけを意味している」

   意図は妥当ですが、現在の文章にはその限定がありません。

## 4. 推奨

push前に最低限、次を直すことを推奨します。

1. HEAD抽出をCurrent State冒頭のメタ情報部分だけに限定する。

   - 最初の小見出しより前にあるトップレベルの箇条書きだけを対象にする。
   - 候補が0件または2件以上なら警告する。
   - 空白は `[ \t]*` にして改行を許さない。
   - 値は `SELF` またはcommitハッシュ形式だけ許可する。
   - 引用・コードブロック・重複・改行・不正値のテストを追加する。

2. 鮮度チェックの意味を修正する。

   - リポジトリ全体のclean/dirtyとCurrent StateのGit欄を照合する。
   - `task.md` のブロック外本文を解消するか、ブロック外があれば鮮度判定を拒否する。
   - 検査範囲をHEADだけにするなら、成功文も「HEAD欄は一致」に弱める。

3. AI運用テストを製品ゲートから分離する。

   推奨は `check:ai-tools` のような専用ゲートです。AI用スクリプトを変更したときとpush前に必須実行し、製品の `check` からは外します。警告だけにするより、別ゲートとして明確に失敗させる方が安全です。

4. テストの外部依存を減らす。

   - Git結果、HOME、`task.md`内容をテストから注入できる形にする。
   - 実利用者のGit作業場所やHOMEを読まない。
   - 一時ディレクトリを終了時に削除する。
   - Node 22を実行環境でも固定する。

5. 数値規則を狭く書き直す。

   「現役文書へ、再測定できる行数・リポジトリ内ファイル数を永続的な事実として書かない。日付・commit付き監査結果、履歴、固定された安全条件、上限値は例外」とし、`AGENTS.md` と `file-hygiene.md` を同期するのが安全です。

ファイル変更・作成・削除、gitコマンド、書込みを伴うテストは実施していません。Obsidianへの記録も禁止範囲に従い行っていません。

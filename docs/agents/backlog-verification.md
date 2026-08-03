# backlog 判定の検証記録

> 2026-08-04。Claude が実測して下した判定を、Codex Sol / high が読み取り専用で検証した。
> **Codex は5件中2件で不同意を出し、いずれも Codex が正しかった。**
> 結果は `docs/agents/backlog.md` へ反映済み。
>
> この記録は要約に置き換えない。次に同じ項目へ着手する者が、
> 「なぜその判定になったか」を追えるようにしてある。

---

### 1. B-6

- **判定**: 不同意
- **根拠**: 公開・非ゴミ箱の照合自体は正しいです。[admin.tsx:1008](packages/web/src/web/pages/admin.tsx:1008)。しかし `setupCompleted` が真なら写真状態を無視して完了になります。[admin.tsx:1033](packages/web/src/web/pages/admin.tsx:1033)、[admin.tsx:1075](packages/web/src/web/pages/admin.tsx:1075)
- **Claude が見落としていること**: 完了後にトップ写真を非公開・ゴミ箱へ移しても完了表示が残ります。公開側は非公開・ゴミ箱写真を除外するため、トップが空になる場合があります。[index.ts:2645](packages/web/src/api/index.ts:2645)

### 2. B-7

- **判定**: 同意
- **根拠**: `null` の場合だけ失敗とし、それ以外は読み込み完了を待たず即座に確認済みへ変更しています。[admin.tsx:1034](packages/web/src/web/pages/admin.tsx:1034)、[admin.tsx:1080](packages/web/src/web/pages/admin.tsx:1080)
- **Claude が見落としていること**: なし。オフライン・404・読み込み失敗でも新しい窓さえ作れれば完了扱いになる、という評価で正しいです。

### 3. B-5

- **判定**: 不同意
- **根拠**: `"local"` が localStorage（その端末・ブラウザ内だけの保存領域）なのは正しいです。[admin.tsx:160](packages/web/src/web/pages/admin.tsx:160)。ただしサーバーの `setupCompleted` が3項目すべてを完了へ復元します。[admin.tsx:1033](packages/web/src/web/pages/admin.tsx:1033)、[admin.tsx:1071](packages/web/src/web/pages/admin.tsx:1071)
- **Claude が見落としていること**: 別端末で3/3に復元するテストもあります。[admin-setup-flow.render.test.tsx:283](packages/web/src/web/pages/admin-setup-flow.render.test.tsx:283)。食い違うのは「3項目達成後、完了ボタンを押す前」だけです。

### 4. B-1

- **判定**: 同意
- **根拠**: 実宣言は216件です。226件にはコメント内の記述10件も含まれます。[styles.css:769](packages/web/src/web/styles.css:769)、[styles.css:4331](packages/web/src/web/styles.css:4331)。刷新用CSSだけでも実宣言40件・4回以上の重複指定17件があります。[styles.css:4621](packages/web/src/web/styles.css:4621)
- **Claude が見落としていること**: 44件は「4回以上」の合計で、正確には4回37件・5回5件・6回2件です。刷新は機能追加ではなく機能を保った再設計なので、単なる機能増とは言いにくいです。[admin-renewal-goal.md:99](docs/specs/admin-renewal-goal.md:99)。ただし増加全部を `de1feab` 単独のせいとは断定できません。

### 5. B-12

- **判定**: 同意
- **根拠**: wrapper は現在の `AdminPage` 本体を直接描画しています。[admin-demo.tsx:6](packages/web/src/web/pages/admin-demo.tsx:6)、[admin-demo.tsx:89](packages/web/src/web/pages/admin-demo.tsx:89)
- **Claude が見落としていること**: wrapper は未検証ではありません。本体描画、案内、言語、購入リンク、保存通知、対象外ホストの404を確認するテストがあります。[pages.render.test.tsx:892](packages/web/src/web/test/pages.render.test.tsx:892)。一方、最後に開いたタブを本番管理画面と同じ localStorage キーで共有するため、デモが Library 以外から始まる余地があります。[admin.tsx:449](packages/web/src/web/pages/admin.tsx:449)

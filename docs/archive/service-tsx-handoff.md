# Service ページ バグ修正引き継ぎ

## 経緯

Claude Design のフィードバック8項目を元に `service.tsx` を全面改修 → デプロイ後にバグ発生。
変更前コミット: `31a420a`（`git diff 31a420a HEAD -- packages/web/src/web/pages/service.tsx` で差分確認可）

---

## BUG-1: ページ全体が opacity:0（最重要・最優先）

**症状**: ページ読み込み後、全コンテンツがほぼ見えない。スクロールしても変わらない。

**確定した原因**: `usePageEntrance` フックの IntersectionObserver が `.page-entrance` 要素に `visible` クラスを一切付与していない。
- JS で検証済み: 14個の `.page-entrance` 要素のうち `visible` を持つものが **0**
- 全要素の `computedOpacity` が `0`
- 手動で `document.querySelectorAll('.page-entrance').forEach(el => el.classList.add('visible'))` を実行すると正常にレンダリングされることを確認済み

**調査の手がかり**:
- `usePageEntrance([photos.length])` — deps は `[photos.length]`
- `photos.length` は TanStack Query 由来。キャッシュヒットで初回レンダ時に非ゼロになる可能性あり
- `ref` が `<main>` に正しくアタッチされているか、`ref.current` が useEffect 時に null でないかを確認
- Observer callback 内で例外が発生していないか確認（`requestAnimationFrame` 内のエラーは console に出ないことがある）
- React 19 の Strict Mode による二重マウント→クリーンアップでの disconnect で回復しない可能性

**修正方針**（いずれかまたは組み合わせ）:
1. `useEffect` の先頭に `if (!container) return` の後、`console.log` でデバッグして原因特定
2. 確認後、根本修正（Observer が確実に発火するようにする）
3. フォールバック: Observer 失敗時に一定時間後 `visible` を強制付与する safety net を追加

---

## BUG-2: スティッキー CTA バーの左端がサイドバーに隠れる

**症状**: 画面下部の固定バーに「0 から始められます」と表示。「¥10,000 」が見切れ。

**原因**: `StickyCtaBar` の外側 div が `fixed bottom-0 inset-x-0` で全幅配置。しかし `.nav-pos-left > main` に `padding-left: 11rem`（`@media min-width: 768px`）がある。`fixed` 要素はこの padding を継承しない。

**修正**: 外側の `fixed` div に `md:left-[11rem]` を追加（`inset-x-0` を `left-0 right-0` に分解するか、Tailwind の `md:pl-[11rem]` を使う）。

```tsx
// 現在（593行目付近）
className="fixed bottom-0 inset-x-0 z-40 ..."

// 修正後
className="fixed bottom-0 left-0 right-0 md:left-[11rem] z-40 ..."
```

---

## BUG-3: 料金カードのリストマーカーが `--` になっている

**修正**: `service.tsx` 495行目の `--` を `—`（em-dash）に変更。

```tsx
// 現在
<span aria-hidden="true" className="...">--</span>

// 修正後
<span aria-hidden="true" className="...">—</span>
```

---

## 修正後チェックリスト

- [ ] `cd packages/web && tsc -b && bun run build` が通る
- [ ] ページ読み込み直後にファーストビュー（タイトル、サブテキスト、ナビピル、写真）が表示される
- [ ] スクロールで下部セクションのフェードイン発火
- [ ] スティッキー CTA バーの「¥10,000 から始められます」が全文表示される
- [ ] 料金カードのリストマーカーが `—` になっている
- [ ] FAQ アコーディオン開閉動作
- [ ] ADMIN / AFTER PURCHASE の Details 開閉動作
- [ ] モバイル表示でヒーロー写真が2枚横並び

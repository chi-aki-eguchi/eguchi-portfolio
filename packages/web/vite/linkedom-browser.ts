// ブラウザ用のビルドで `linkedom` の代わりに読ませる（2026-10-01）。
//
// 日本語の文節区切りに使う budoux は、Node 向けの HTML 処理（dom.js）のために
// linkedom（DOM の実装、約190KB）を読む。package.json の browser 欄では
// ブラウザ用の dom-browser.js に差し替える指定があるが、Vite のビルドでは
// 効かず、使っていない linkedom が vendor に丸ごと入っていた（実測 +192KB）。
// 公開サイトが使うのは文を区切る Parser だけ。ここでは dom-browser.js と同じく
// ブラウザの DOMParser に渡すだけにする。
export class DOMParser {
  parseFromString(html: string, type: DOMParserSupportedType): Document {
    return new window.DOMParser().parseFromString(html, type);
  }
}

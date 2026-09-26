import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  addPhoto,
  createBook,
  movePage,
  pageCount,
  parseBook,
  removeItem,
  STORAGE_KEY,
  type Item,
  type PortfolioDocument,
  type SourcePhoto,
} from "../lib/portfolio-pdf/model";
import { generate, readJson } from "../lib/portfolio-pdf/client";
import type { PdfIssue } from "../lib/portfolio-pdf/render";
import "../components/portfolio-pdf/editor.css";

type Output = {
  url: string;
  size: number;
  pages: number;
  quality: string;
  snapshot: string;
};
const sizeLabel = (bytes: number) =>
  `${(bytes / 1024 / 1024).toFixed(2)} MB（${bytes.toLocaleString()} bytes）`;
function download(data: Blob, name: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function AdminPdfPage() {
  const [ready, setReady] = useState(false),
    [books, setBooks] = useState<PortfolioDocument[]>([]),
    [book, setBook] = useState<PortfolioDocument>(createBook);
  const [photos, setPhotos] = useState<SourcePhoto[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [query, setQuery] = useState("");
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState("");
  const [issues, setIssues] = useState<PdfIssue[]>([]),
    [output, setOutput] = useState<Output | null>(null);
  const [storageBroken, setStorageBroken] = useState(false);
  const controller = useRef<AbortController | null>(null),
    fileRef = useRef<HTMLInputElement>(null);
  async function load() {
    setError("");
    try {
      const auth = await readJson<{ authenticated: boolean }>("/api/admin/me");
      if (!auth.authenticated) {
        setError("管理画面にログインしてください");
        return;
      }
      const result = await readJson<{ photos: SourcePhoto[] }>(
        "/api/admin/pdf/photos",
      );
      setPhotos(result.photos);
      try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        if (!Array.isArray(raw) || raw.length > 30) throw new Error();
        const stored = raw.map(parseBook);
        setBooks(stored);
        if (stored[0]) setBook(stored[0]);
      } catch {
        setStorageBroken(true);
        setError(
          "ブラウザーの保存データを読み込めません。上書きせず保持しています。作品集ファイルを読み込むか、保存データを削除してください",
        );
      }
      setReady(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    return () => controller.current?.abort();
  }, []);
  useEffect(
    () => () => {
      if (output) URL.revokeObjectURL(output.url);
    },
    [output],
  );
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirty || busy) e.preventDefault();
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty, busy]);
  // Returning from another window requires a new server auth check before local personal data is shown.
  useEffect(() => {
    const check = () => {
      void readJson<{ authenticated: boolean }>("/api/admin/me")
        .then((r) => {
          if (!r.authenticated) {
            setReady(false);
            setBooks([]);
            setBook(createBook());
            setOutput(null);
            setError("認証が切れました。ログインし直してください");
            controller.current?.abort();
          }
        })
        .catch(() => {
          setReady(false);
          setError("認証を確認できません。再試行してください");
        });
    };
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, []);
  const edit = (next: PortfolioDocument) => {
    setBook({ ...next, updatedAt: new Date().toISOString() });
    setDirty(true);
    setIssues([]);
    setNotice("");
    setOutput(null);
  };
  const editItem = (id: string, patch: Partial<Item>) =>
    edit({
      ...book,
      items: book.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    });
  const mayLeave = () =>
    !dirty || window.confirm("保存していない編集があります。切り替えますか？");
  const save = () => {
    try {
      parseBook(book);
      if (storageBroken)
        throw new Error(
          "壊れた保存データを保護しています。先にファイルを書き出し、保存データを削除してください",
        );
      const next = [book, ...books.filter((b) => b.id !== book.id)];
      if (next.length > 30)
        throw new Error("保存は30冊までです。不要な本を削除してください");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setBooks(next);
      setDirty(false);
      setNotice("このブラウザーに保存しました");
      setError("");
    } catch (e) {
      setError(
        (e as Error).message || "保存できません。ファイルを書き出してください",
      );
    }
  };
  const generatePdf = async (quality: "screen" | "print") => {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setOutput(null);
    setIssues([]);
    setProgress("認証と保存画像を確認しています");
    try {
      const result = await generate(book, quality, setProgress, abort.signal);
      setIssues(result.issues);
      if (result.bytes) {
        const blob = new Blob([new Uint8Array(result.bytes)], {
          type: "application/pdf",
        });
        setOutput({
          url: URL.createObjectURL(blob),
          size: blob.size,
          pages: result.pageCount,
          quality: quality === "print" ? "印刷用" : "送信用",
          snapshot: JSON.stringify(book),
        });
        setNotice("PDFを生成しました。全ページを確認して保存してください");
      } else setError("ページの問題を直して、もう一度出力してください");
    } catch (e) {
      setError(
        abort.signal.aborted ? "出力を中止しました" : (e as Error).message,
      );
    } finally {
      controller.current = null;
      setBusy(false);
      setProgress("");
    }
  };
  const removeSaved = () => {
    if (
      !window.confirm(
        "この本をブラウザーから削除しますか？書き出したファイルやWebの写真は残ります。",
      )
    )
      return;
    try {
      const next = books.filter((b) => b.id !== book.id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setBooks(next);
      setBook(next[0] || createBook());
      setDirty(false);
      setOutput(null);
      setNotice("この本の保存データを削除しました");
    } catch {
      setError("保存データを削除できませんでした");
    }
  };
  return (
    <main className="pdf-editor">
      <header className="pdf-header">
        <Link
          href="/admin"
          onClick={(e) => {
            if (!mayLeave() || busy) e.preventDefault();
          }}
        >
          ← 管理画面
        </Link>
        <h1>PDF作品集</h1>
        <span>Webと独立した、提出する一冊。</span>
      </header>
      {error && (
        <p role="alert" className="pdf-error">
          {error}
        </p>
      )}
      {!ready ? (
        <p>
          <Link href="/admin/login">ログイン</Link>{" "}
          <button onClick={() => void load()}>読み込みを再試行</button>
        </p>
      ) : (
        <>
          <p className="pdf-note">
            この端末・このブラウザーに、作品の選択・説明・氏名・連絡先を保存します。端末間の同期はありません。ブラウザーのデータ消去で失われるため、作品集ファイルも保存してください。画像本体は含まれません。保存データは暗号化されないため、共用端末では利用後に削除してください。Webの公開状態・文章・順番は変更しません。
          </p>
          <div className="pdf-toolbar">
            <label>
              保存した本
              <select
                value={books.some((b) => b.id === book.id) ? book.id : ""}
                disabled={busy}
                onChange={(e) => {
                  if (mayLeave()) {
                    const b = books.find((b) => b.id === e.target.value);
                    if (b) {
                      setBook(b);
                      setDirty(false);
                      setOutput(null);
                    }
                  }
                }}
              >
                <option value="" disabled>
                  未保存の本
                </option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={busy}
              onClick={() => {
                if (mayLeave()) {
                  setBook(createBook());
                  setDirty(false);
                  setOutput(null);
                }
              }}
            >
              新しい本
            </button>
            <button disabled={busy || storageBroken} onClick={save}>
              ブラウザーに保存
            </button>
            <button
              disabled={busy}
              onClick={() =>
                download(
                  new Blob([JSON.stringify(book, null, 2)], {
                    type: "application/json",
                  }),
                  `${book.title}.portfolio.json`,
                )
              }
            >
              作品集ファイルを書き出す
            </button>
            <button disabled={busy} onClick={() => fileRef.current?.click()}>
              読み戻す
            </button>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".json,application/json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f || !mayLeave()) return;
                try {
                  if (f.size > 2_000_000)
                    throw new Error("ファイルが大きすぎます");
                  const b = parseBook(JSON.parse(await f.text()));
                  edit({ ...b, id: crypto.randomUUID() });
                  setNotice(
                    "別の本として読み込みました。保存するとこのブラウザーに残ります",
                  );
                  setError("");
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            />
            <button
              disabled={busy || !books.some((b) => b.id === book.id)}
              onClick={removeSaved}
            >
              この本を削除
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "PDF作品集の保存データをすべてこのブラウザーから削除しますか？",
                  )
                ) {
                  try {
                    localStorage.removeItem(STORAGE_KEY);
                    setBooks([]);
                    setBook(createBook());
                    setStorageBroken(false);
                    setOutput(null);
                    setDirty(false);
                    setError("");
                  } catch {
                    setError("削除できませんでした");
                  }
                }
              }}
            >
              保存データを全削除
            </button>
          </div>
          <p aria-live="polite">
            {busy
              ? progress
              : notice || (dirty ? "未保存の編集があります" : "")}
            　{book.items.length} / 20 枚 ・ {pageCount(book)} / 24 ページ
          </p>
          <fieldset disabled={busy} className="pdf-fields">
            <div className="pdf-columns">
              <section>
                <h2>1. 本の名前と表紙</h2>
                <label>
                  本の名前
                  <input
                    value={book.title}
                    maxLength={500}
                    onChange={(e) => edit({ ...book, title: e.target.value })}
                  />
                </label>
                <label>
                  氏名
                  <input
                    value={book.cover.name}
                    maxLength={500}
                    onChange={(e) =>
                      edit({
                        ...book,
                        cover: { ...book.cover, name: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  用紙
                  <select
                    value={book.orientation}
                    onChange={(e) =>
                      edit({
                        ...book,
                        orientation: e.target
                          .value as PortfolioDocument["orientation"],
                      })
                    }
                  >
                    <option value="portrait">A4 縦</option>
                    <option value="landscape">A4 横</option>
                  </select>
                </label>
                <label>
                  表紙の写真
                  <select
                    value={book.cover.itemId || ""}
                    onChange={(e) =>
                      edit({
                        ...book,
                        cover: {
                          ...book.cover,
                          itemId: e.target.value || null,
                        },
                      })
                    }
                  >
                    <option value="">写真なし</option>
                    {book.items.map((i, n) => (
                      <option key={i.id} value={i.id}>
                        {n + 1}. {i.title || "無題"}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
              <section>
                <h2>2. プロフィール</h2>
                <label className="pdf-check">
                  <input
                    type="checkbox"
                    checked={book.pdfProfile.enabled}
                    onChange={(e) =>
                      edit({
                        ...book,
                        pdfProfile: {
                          ...book.pdfProfile,
                          enabled: e.target.checked,
                        },
                      })
                    }
                  />
                  最後のページに載せる
                </label>
                {book.pdfProfile.enabled && (
                  <>
                    <label>
                      PDF用プロフィール
                      <textarea
                        rows={5}
                        maxLength={8000}
                        value={book.pdfProfile.text}
                        onChange={(e) =>
                          edit({
                            ...book,
                            pdfProfile: {
                              ...book.pdfProfile,
                              text: e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      PDF用連絡先
                      <textarea
                        rows={2}
                        maxLength={2000}
                        value={book.pdfProfile.contact}
                        onChange={(e) =>
                          edit({
                            ...book,
                            pdfProfile: {
                              ...book.pdfProfile,
                              contact: e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                    <p className="pdf-note">
                      ここへ入力した情報だけを含めます。
                    </p>
                  </>
                )}
              </section>
            </div>
            <section>
              <h2>3. 既存の写真から選ぶ</h2>
              <label>
                写真を探す
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div className="pdf-picker">
                {photos
                  .filter((p) => `${p.title} ${p.id}`.includes(query))
                  .map((p) => {
                    const selected = book.items.some(
                      (i) => i.sourcePhotoId === p.id,
                    );
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={selected || book.items.length >= 20}
                        onClick={() => {
                          try {
                            edit(addPhoto(book, p));
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                        aria-label={`${p.title || `写真 ${p.id}`}を追加`}
                      >
                        <img
                          loading="lazy"
                          src={`/api/admin/pdf/photos/${p.id}/image?quality=thumb`}
                          alt=""
                          style={{ transform: `rotate(${p.rotation}deg)` }}
                        />
                        <span>
                          {selected ? "選択済み · " : ""}
                          {p.title || `写真 ${p.id}`}
                          {!p.isPublished ? "（非公開）" : ""}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </section>
            <section>
              <h2>4. ページと説明を整える</h2>
              <p className="pdf-note">
                写真は全体が入るように配置します。制作年は必要に応じて入力してください。
              </p>
              {book.pages.map((p, index) => (
                <article className="pdf-sheet" key={p.id}>
                  <div className="pdf-toolbar">
                    <h3>{index + 2} ページ</h3>
                    <button
                      disabled={index === 0}
                      onClick={() => edit(movePage(book, index, -1))}
                    >
                      前へ
                    </button>
                    <button
                      disabled={index === book.pages.length - 1}
                      onClick={() => edit(movePage(book, index, 1))}
                    >
                      後ろへ
                    </button>
                    {p.itemIds.length === 1 &&
                      book.pages[index + 1]?.itemIds.length === 1 && (
                        <button
                          onClick={() =>
                            edit({
                              ...book,
                              pages: book.pages.flatMap((page, n) =>
                                n === index
                                  ? [
                                      {
                                        ...p,
                                        layout: "two",
                                        pageCaption: [
                                          p.pageCaption,
                                          book.pages[index + 1].pageCaption,
                                        ]
                                          .filter(Boolean)
                                          .join(" / "),
                                        itemIds: [
                                          ...p.itemIds,
                                          ...book.pages[index + 1].itemIds,
                                        ],
                                      },
                                    ]
                                  : n === index + 1
                                    ? []
                                    : [page],
                              ),
                            })
                          }
                        >
                          次の写真と2枚に
                        </button>
                      )}
                    {p.itemIds.length === 2 && (
                      <>
                        <button
                          onClick={() =>
                            edit({
                              ...book,
                              pages: book.pages.flatMap((page, n) =>
                                n === index
                                  ? p.itemIds.map((id, j) => ({
                                      id: crypto.randomUUID(),
                                      layout: "one" as const,
                                      itemIds: [id],
                                      pageCaption: j === 0 ? p.pageCaption : "",
                                    }))
                                  : [page],
                              ),
                            })
                          }
                        >
                          1枚ずつに分ける
                        </button>
                        <button
                          onClick={() =>
                            edit({
                              ...book,
                              pages: book.pages.map((page, n) =>
                                n === index
                                  ? {
                                      ...page,
                                      itemIds: [...page.itemIds].reverse(),
                                    }
                                  : page,
                              ),
                            })
                          }
                        >
                          2枚の順を交換
                        </button>
                      </>
                    )}
                  </div>
                  <div className="pdf-items">
                    {p.itemIds.map((id) => {
                      const item = book.items.find((i) => i.id === id)!;
                      return (
                        <div className="pdf-item" key={id}>
                          <div className="pdf-photo">
                            <img
                              src={`/api/admin/pdf/photos/${item.sourcePhotoId}/image?quality=thumb`}
                              alt={item.title || "選んだ写真"}
                              style={{
                                transform: `rotate(${item.rotation}deg)`,
                              }}
                            />
                          </div>
                          <div>
                            <label>
                              作品タイトル
                              <input
                                value={item.title}
                                maxLength={500}
                                onChange={(e) =>
                                  editItem(id, { title: e.target.value })
                                }
                              />
                            </label>
                            <div className="pdf-columns">
                              <label>
                                制作年
                                <input
                                  value={item.year}
                                  maxLength={100}
                                  onChange={(e) =>
                                    editItem(id, { year: e.target.value })
                                  }
                                />
                              </label>
                              <label>
                                技法
                                <input
                                  value={item.technique}
                                  maxLength={500}
                                  onChange={(e) =>
                                    editItem(id, { technique: e.target.value })
                                  }
                                />
                              </label>
                            </div>
                            <label>
                              作品説明
                              <textarea
                                rows={3}
                                value={item.captionOverride}
                                maxLength={8000}
                                onChange={(e) =>
                                  editItem(id, {
                                    captionOverride: e.target.value,
                                  })
                                }
                              />
                            </label>
                            <button
                              onClick={() =>
                                editItem(id, {
                                  rotation: (item.rotation + 90) % 360,
                                })
                              }
                            >
                              右へ90°回転
                            </button>{" "}
                            <button onClick={() => edit(removeItem(book, id))}>
                              本から外す
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <label>
                    ページの説明
                    <input
                      value={p.pageCaption}
                      maxLength={2000}
                      onChange={(e) =>
                        edit({
                          ...book,
                          pages: book.pages.map((page) =>
                            page.id === p.id
                              ? { ...page, pageCaption: e.target.value }
                              : page,
                          ),
                        })
                      }
                    />
                  </label>
                </article>
              ))}
            </section>
          </fieldset>
          <section className="pdf-export">
            <h2>5. 全ページを確認して、PDFを保存</h2>
            <p className="pdf-note">
              送信用：長辺1600px・JPEG品質78。印刷用：保存画像の長辺3200px以内・品質95。画像は拡大しません。容量の上限保証・PDF/X・CMYKには対応していません。
            </p>
            <div className="pdf-toolbar">
              <button
                disabled={busy || !book.items.length}
                onClick={() => void generatePdf("screen")}
              >
                送信用PDFを生成
              </button>
              <button
                disabled={busy || !book.items.length}
                onClick={() => void generatePdf("print")}
              >
                印刷用PDFを生成
              </button>
              {busy && (
                <button onClick={() => controller.current?.abort()}>
                  中止
                </button>
              )}
            </div>
            {!!issues.length && (
              <ul className="pdf-issues">
                {issues.map((i, n) => (
                  <li key={n}>
                    {i.page}ページ：{i.message}
                    {i.severity === "error" ? "（出力できません）" : ""}
                  </li>
                ))}
              </ul>
            )}
            {output && output.snapshot === JSON.stringify(book) && (
              <>
                <p>
                  {output.quality} · {output.pages}ページ ·{" "}
                  {sizeLabel(output.size)}
                </p>
                <div className="pdf-toolbar">
                  <a
                    href={output.url}
                    download={`${book.title}-${output.quality}.pdf`}
                  >
                    PDFを保存
                  </a>
                  <a href={output.url} target="_blank" rel="noopener">
                    別のタブで全ページを開く
                  </a>
                </div>
                <p className="pdf-note">
                  保存したPDFは確定版です。後からWebや本を編集しても変更されません。印刷前に用紙をA4に指定し、紙で読みやすさを確認してください。
                </p>
                <iframe
                  title="生成したPDFの全ページ"
                  src={output.url}
                  className="pdf-preview"
                />
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}

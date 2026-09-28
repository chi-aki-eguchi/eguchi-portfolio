import { useEffect, useMemo, useState } from "react";
import fontkit from "@pdf-lib/fontkit";
import {
  layoutBook,
  type Measure,
  type Sheet,
  type ImageSizes,
} from "../../lib/portfolio-pdf/layout";
import type { PortfolioDocument } from "../../lib/portfolio-pdf/model";
let fontPromise: Promise<Measure> | undefined;
function loadMeasure() {
  return (fontPromise ??= fetch("/fonts/pdf/NotoSansJP-Regular.ttf")
    .then(async (response) => {
      if (!response.ok) throw new Error("文字のプレビューを読み込めません");
      const buffer = await response.arrayBuffer();
      const font = fontkit.create(new Uint8Array(buffer));
      const face = await new FontFace("PortfolioPaper", buffer).load();
      document.fonts.add(face);
      return {
        widthOfTextAtSize: (value: string, size: number) =>
          (font
            .layout(value)
            .glyphs.reduce((sum, glyph) => sum + glyph.advanceWidth, 0) /
            font.unitsPerEm) *
          size,
      };
    })
    .catch((error) => {
      fontPromise = undefined;
      throw error;
    }));
}
export function Paper({
  sheet,
  book,
  onItem,
  thumbnail = false,
}: {
  sheet: Sheet;
  book: PortfolioDocument;
  onItem?: (id: string) => void;
  thumbnail?: boolean;
}) {
  return (
    <svg
      viewBox={`0 0 ${sheet.width} ${sheet.height}`}
      className="pdf-paper"
      aria-label={`${sheet.id === "cover" ? "表紙" : sheet.id === "profile" ? "プロフィール" : "作品ページ"}の配置`}
    >
      <rect width={sheet.width} height={sheet.height} fill="white" />
      {sheet.photos.map((box, n) => {
        const item = book.items.find((i) => i.id === box.id)!;
        const swapped = item.rotation === 90 || item.rotation === 270;
        const w = swapped ? box.height : box.width,
          h = swapped ? box.width : box.height;
        return (
          <g
            key={`${box.id}-${n}`}
            transform={`translate(${box.x + box.width / 2} ${box.top + box.height / 2}) rotate(${item.rotation})`}
            onClick={() => onItem?.(box.id)}
            style={{ cursor: onItem ? "pointer" : undefined }}
          >
            <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="white" />
            <image
              href={`/api/admin/pdf/photos/${item.sourcePhotoId}/image?quality=${thumbnail ? "thumb" : "screen"}`}
              x={-w / 2}
              y={-h / 2}
              width={w}
              height={h}
              preserveAspectRatio="xMidYMid meet"
            />
          </g>
        );
      })}
      {sheet.texts.map((t, n) => (
        <text
          key={n}
          x={t.x}
          y={t.top + t.size}
          fontSize={t.size}
          fontFamily="PortfolioPaper"
          fill="#222"
          onClick={() => t.itemId && onItem?.(t.itemId)}
          style={{ cursor: t.itemId && onItem ? "pointer" : undefined }}
        >
          {t.lines.map((line, j) => (
            <tspan key={j} x={t.x} dy={j ? t.leading : 0}>
              {line}
            </tspan>
          ))}
        </text>
      ))}
    </svg>
  );
}
export default function BookCanvas({
  book,
  active,
  onSelect,
  onMove,
  onItem,
  disabled,
}: {
  book: PortfolioDocument;
  active: string;
  onSelect: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onItem: (id: string) => void;
  disabled: boolean;
}) {
  const [font, setFont] = useState<Measure | null>(null),
    [error, setError] = useState("");
  const [sizes, setSizes] = useState<ImageSizes>(new Map());
  const sources = book.items.map((i) => `${i.id}:${i.sourcePhotoId}`).join(",");
  useEffect(() => {
    let alive = true;
    // Use the same delivery pipeline as the PDF, including EXIF orientation.
    const images = book.items.map((item) => {
      const image = new Image();
      image.onload = () => {
        if (alive)
          setSizes((previous) =>
            new Map(previous).set(item.id, {
              width: image.naturalWidth,
              height: image.naturalHeight,
            }),
          );
      };
      image.src = `/api/admin/pdf/photos/${item.sourcePhotoId}/image?quality=thumb`;
      return image;
    });
    return () => {
      alive = false;
      images.forEach((image) => {
        image.onload = null;
      });
    };
    // Image references, not caption edits, determine which resources are loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources]);
  const [dragged, setDragged] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    loadMeasure()
      .then((f) => {
        if (alive) setFont(f);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  const sheets = useMemo(
    () => (font ? layoutBook(book, font, sizes) : []),
    [book, font, sizes],
  );
  const index = Math.max(
    0,
    sheets.findIndex((p) => p.id === active),
  );
  if (!font) return <output>{error || "ページの配置を準備しています…"}</output>;
  return (
    <div className="pdf-book-view">
      <nav className="pdf-filmstrip" aria-label="本のページ一覧">
        {sheets.map((p, n) => (
          <button
            key={p.id}
            type="button"
            aria-label={`${n + 1}ページを編集`}
            aria-current={n === index ? "page" : undefined}
            disabled={disabled}
            draggable={!disabled && p.id !== "cover" && p.id !== "profile"}
            onDragStart={(e) => {
              setDragged(n - 1);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", p.id);
            }}
            onDragEnd={() => setDragged(null)}
            onDragOver={(e) => {
              if (
                !disabled &&
                dragged !== null &&
                n > 0 &&
                n <= book.pages.length
              )
                e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (
                !disabled &&
                dragged !== null &&
                n > 0 &&
                n <= book.pages.length
              )
                onMove(dragged, n - 1);
              setDragged(null);
            }}
            onClick={() => onSelect(p.id)}
          >
            <Paper sheet={p} book={book} thumbnail />
            <span>
              {n + 1}
              {p.id === "cover"
                ? " 表紙"
                : p.id === "profile"
                  ? " プロフィール"
                  : ""}
            </span>
          </button>
        ))}
      </nav>
      <div className="pdf-canvas">
        <div className="pdf-canvas-nav">
          <button
            type="button"
            disabled={disabled || index === 0}
            onClick={() => onSelect(sheets[index - 1].id)}
          >
            前のページ
          </button>
          <span>
            {index + 1} / {sheets.length}
          </span>
          <button
            type="button"
            disabled={disabled || index === sheets.length - 1}
            onClick={() => onSelect(sheets[index + 1].id)}
          >
            次のページ
          </button>
        </div>
        <Paper
          sheet={sheets[index]}
          book={book}
          onItem={disabled ? undefined : onItem}
        />
        {!!sheets[index].issues.length && (
          <p role="alert" className="pdf-error">
            {sheets[index].issues.map((i) => i.message).join(" / ")}
          </p>
        )}
        <p className="pdf-note">
          写真や作品名を押すと、その写真の編集欄へ移ります。ページ一覧はドラッグで並べ替えられます。
        </p>
      </div>
    </div>
  );
}

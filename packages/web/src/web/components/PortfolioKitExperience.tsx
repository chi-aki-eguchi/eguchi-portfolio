import { useEffect, useRef, useState } from "react";

type PreviewSettings = Record<string, string | undefined>;

const EXPERIENCE_KEYS = [
  "topWorksLayout",
  "spacingSectionGap",
  "bgTexture",
  "bgTextureOpacity",
  "fontJa",
  "fontEn",
] as const;

function sendPreview(settings: PreviewSettings) {
  window.dispatchEvent(
    new window.MessageEvent("message", {
      origin: window.location.origin,
      data: { type: "preview-settings", settings },
    }),
  );
}

function ExperienceSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-[0.68rem] leading-5 text-[color:var(--text-quiet)]">
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 rounded border border-[rgba(var(--foreground-rgb),0.14)] bg-[var(--background)] px-2.5 text-[0.78rem] text-[rgba(var(--foreground-rgb),0.76)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function PortfolioKitExperience({
  initialSettings,
}: {
  initialSettings: PreviewSettings;
}) {
  const original = useRef(
    Object.fromEntries(
      EXPERIENCE_KEYS.map((key) => [key, initialSettings[key] ?? ""]),
    ),
  );
  const [collapsed, setCollapsed] = useState(false);
  const [preview, setPreview] = useState({
    topWorksLayout: initialSettings.topWorksLayout || "large-format",
    spacingSectionGap: initialSettings.spacingSectionGap || "1",
    bgTexture: initialSettings.bgTexture || "none",
    bgTextureOpacity: initialSettings.bgTextureOpacity || "0.08",
    fontJa: initialSettings.fontJa || "Shippori Mincho",
    fontEn: initialSettings.fontEn || "Cormorant Garamond",
  });

  useEffect(() => {
    sendPreview(preview);
  }, [preview]);

  useEffect(
    () => () => {
      sendPreview(original.current);
    },
    [],
  );

  const update = (settings: Partial<typeof preview>) =>
    setPreview((current) => ({ ...current, ...settings }));

  return (
    <aside
      aria-label="Portfolio Kit 体験モード"
      className="fixed bottom-3 right-3 z-[80] w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border border-[rgba(var(--foreground-rgb),0.12)] bg-[color-mix(in_srgb,var(--background)_96%,transparent)] p-3 shadow-[0_10px_40px_rgba(0,0,0,0.14)] backdrop-blur-md sm:bottom-5 sm:right-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-ja text-[0.78rem] text-[rgba(var(--foreground-rgb),0.78)]">
            見た目を体験する
          </p>
          <p className="mt-1 text-[0.65rem] leading-5 text-[color:var(--text-quiet)]">
            これは体験です。実際のサイトは変わりません。
          </p>
        </div>
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
          className="min-h-9 shrink-0 rounded border border-[rgba(var(--foreground-rgb),0.12)] px-2.5 text-[0.68rem] text-[color:var(--text-quiet)]"
        >
          {collapsed ? "開く" : "閉じる"}
        </button>
      </div>

      {!collapsed && (
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <ExperienceSelect
            label="写真の並べ方"
            value={preview.topWorksLayout}
            options={[
              { value: "large-format", label: "大きく静かに" },
              { value: "masonry", label: "高さを活かす" },
              { value: "clean-grid", label: "端正に揃える" },
            ]}
            onChange={(value) => update({ topWorksLayout: value })}
          />
          <ExperienceSelect
            label="余白の広さ"
            value={preview.spacingSectionGap}
            options={[
              { value: "0.8", label: "すっきり" },
              { value: "1", label: "標準" },
              { value: "1.25", label: "ゆったり" },
            ]}
            onChange={(value) => update({ spacingSectionGap: value })}
          />
          <ExperienceSelect
            label="背景の質感"
            value={preview.bgTexture}
            options={[
              { value: "none", label: "なし" },
              { value: "grain-fine", label: "フィルム粒子" },
              { value: "grain-coarse", label: "粗い紙" },
            ]}
            onChange={(value) => update({ bgTexture: value })}
          />
          <ExperienceSelect
            label="文字の雰囲気"
            value={`${preview.fontJa}|${preview.fontEn}`}
            options={[
              {
                value: "Shippori Mincho|Cormorant Garamond",
                label: "クラシック",
              },
              { value: "Noto Serif JP|Playfair Display", label: "モダン" },
              { value: "Noto Sans JP|Inter", label: "静かなゴシック" },
            ]}
            onChange={(value) => {
              const [fontJa, fontEn] = value.split("|");
              update({ fontJa, fontEn });
            }}
          />
        </div>
      )}

      <a
        href="/portfolio-kit"
        className="mt-3 inline-flex min-h-9 items-center text-[0.7rem] tracking-[0.04em] text-[color:var(--text-quiet)] underline underline-offset-4"
      >
        販売ページへ戻る
      </a>
    </aside>
  );
}

import { useEffect, useState } from "react";
import {
  DEVELOP_DOOR_DEFAULTS,
  DEVELOP_DOOR_KEYS,
  DEVELOP_DOOR_LABEL_MAX,
  DEVELOP_DOOR_NOTE_MAX,
  developDoorCopy,
  serializeDevelopDoors,
  type DevelopDoorCopy,
  type DevelopDoorKey,
} from "../../../shared/develop-structure";

/** その扉が何のページか（名前を変えても、どの欄がどのページか分かるように）。 */
const ROLE: Record<DevelopDoorKey, string> = {
  portrait: "人を撮った写真のページ",
  life: "日常の写真のページ",
  series: "シリーズの一覧",
  info: "自己紹介・料金・依頼",
};

/**
 * 扉の名前と添え書き（2026-10-13）。メニュー・トップの扉・ページの見出し・検索や共有の題名に出る言葉。
 *
 * 試作の「細かい調整」にあった欄。ふだんは畳んでおく（毎日は触らない）。欄を出たとき・Enter で保存する。
 * 名前を空にしたら、初めの名前に戻る（名前の無い扉は作らない）。添え書きは空にできる。
 */
export function DoorNames({
  value,
  onSave,
}: {
  /** 保存されている値（設定 developDoors の文字列）。 */
  value: string;
  onSave: (next: string, message: string) => void;
}) {
  const [draft, setDraft] = useState<DevelopDoorCopy>(() => developDoorCopy(value));
  // 保存された値が変わったら（保存の完了・元に戻す・失敗して戻ったとき）、欄をそれに合わせる。
  useEffect(() => setDraft(developDoorCopy(value)), [value]);

  const saved = serializeDevelopDoors(developDoorCopy(value));
  const commit = () => {
    const next = serializeDevelopDoors(draft);
    if (next === saved) setDraft(developDoorCopy(value));
    else onSave(next, "扉の名前を変えました");
  };
  const edit = (key: DevelopDoorKey, field: "label" | "note", text: string) =>
    setDraft((d) => ({ ...d, [key]: { ...d[key], [field]: text } }));
  const onKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur();
  };

  return (
    <details className="pp-doors">
      <summary>扉の名前</summary>
      <p>
        メニュー・トップの扉・ページの見出しに出る名前と、その横の添え書きです。変えると、その場で保存されます。
      </p>
      <div className="pp-doors__rows">
        {DEVELOP_DOOR_KEYS.map((key) => (
          <div key={key} className="pp-doors__row" data-pp-door={key}>
            <span className="pp-doors__role">{ROLE[key]}</span>
            <label>
              <span>名前</span>
              <input
                type="text"
                value={draft[key].label}
                maxLength={DEVELOP_DOOR_LABEL_MAX}
                placeholder={DEVELOP_DOOR_DEFAULTS[key].label}
                data-pp-door-label
                onChange={(event) => edit(key, "label", event.target.value)}
                onBlur={commit}
                onKeyDown={onKey}
              />
            </label>
            <label>
              <span>添え書き</span>
              <input
                type="text"
                value={draft[key].note}
                maxLength={DEVELOP_DOOR_NOTE_MAX}
                placeholder="（出さない）"
                data-pp-door-note
                onChange={(event) => edit(key, "note", event.target.value)}
                onBlur={commit}
                onKeyDown={onKey}
              />
            </label>
          </div>
        ))}
      </div>
      {saved !== "" && (
        <button type="button" className="pp-doors__reset" onClick={() => onSave("", "初めの名前に戻しました")}>
          初めの名前に戻す
        </button>
      )}
    </details>
  );
}

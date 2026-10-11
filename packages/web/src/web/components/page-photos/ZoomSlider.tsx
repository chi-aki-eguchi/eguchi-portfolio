/** 写真の大きさのつまみ（小さい四角 ― 大きい四角）。 */
export function ZoomSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <label className="pp-zoom" title="写真の大きさ">
      <i className="pp-zoom__small" aria-hidden="true" />
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        aria-label="写真の大きさ"
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <i className="pp-zoom__large" aria-hidden="true" />
    </label>
  );
}

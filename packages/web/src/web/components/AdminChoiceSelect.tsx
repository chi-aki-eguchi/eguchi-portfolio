import { Field } from "../pages/admin-ui";
import { useAdminI18n } from "../pages/admin-i18n";

/** Keyboard-native choices for settings that do not need a visual layout diagram. */
export function AdminChoiceSelect({ label, hint, value, options, onChange }: {
  label: string; hint?: string; value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  const { language } = useAdminI18n();
  return <Field label={label}>
    <select className="ax-input ax-select" aria-label={label} value={value} onChange={event => onChange(event.target.value)}>
      {options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
    </select>
    {hint && <details className="studio-choice-hint"><summary>{language === "ja" ? "選び方" : "About this setting"}</summary><p>{hint}</p></details>}
  </Field>;
}

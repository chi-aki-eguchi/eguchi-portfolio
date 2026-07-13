// 正本は shared/settings-keys.ts(api/ 側の許可リストとも共有するため)。
// このファイルはこれまで通り SETTINGS_PREVIEW_KEYS を re-export する。
export {
  SETTINGS_PREVIEW_KEYS,
  type SettingsPreviewKey,
} from "../../shared/settings-keys";
import {
  SETTINGS_PREVIEW_KEYS,
  type SettingsPreviewKey,
} from "../../shared/settings-keys";

// The iframe uses a separate React tree/query cache from the admin page. Mirror
// every settings key into that cache so text labels, nav/profile/contact fields,
// and feature toggles preview the same way CSS-variable controls do.
export const JS_PREVIEW_KEYS = SETTINGS_PREVIEW_KEYS;

export function makeSettingsPreviewPayload(
  settings: Record<string, string | undefined>,
): Record<SettingsPreviewKey, string> {
  const payload = {} as Record<SettingsPreviewKey, string>;
  for (const key of SETTINGS_PREVIEW_KEYS) payload[key] = settings[key] ?? "";
  return payload;
}

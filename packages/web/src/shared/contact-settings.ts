// 問い合わせ設定を保存・判定・公開で同じ規則にする純粋関数。
// 空欄は「この連絡手段を使わない」という有効な設定として許可する。

export const CONTACT_SETTING_KEYS = [
  "contactEmail",
  "formspreeUrl",
] as const;

export type ContactSettingKey = (typeof CONTACT_SETTING_KEYS)[number];

export function isContactSettingKey(value: string): value is ContactSettingKey {
  return (CONTACT_SETTING_KEYS as readonly string[]).includes(value);
}

/** 前後の空白は入力ミスなので、判定・保存・公開のどの経路でも取り除く。 */
export function normalizeContactSettingValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// RFC全体を再実装せず、公開mail-toにそのまま渡して安全な一般的な形式だけを許可する。
// `?` / `#` / `%` は mailto の宛先以外の意味を作れるため、一般利用の連絡先では受けない。
const EMAIL_PATTERN =
  /^(?!.*\.\.)[A-Z0-9](?:[A-Z0-9.!#$&'*+/=^_`{|}~-]*[A-Z0-9])?@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+$/i;

/** 空欄を除いた、実際に公開してよいメールアドレスか。 */
export function isUsableContactEmail(value: unknown): boolean {
  const email = normalizeContactSettingValue(value);
  return email.length > 0 && EMAIL_PATTERN.test(email);
}

/** 設定値として許可するメールアドレスか（空欄は連絡先の削除）。 */
export function isValidContactEmailSetting(value: unknown): boolean {
  const email = normalizeContactSettingValue(value);
  return email.length === 0 || isUsableContactEmail(email);
}

/**
 * 空欄を除いた、公開フォームの送信先として安全に使えるURLか。
 *
 * Formspree固有のホストに固定しない。互換フォームサービスを許可する一方で、
 * http、相対URL、認証情報入りURL、fragmentは送信先として曖昧または危険なので拒否する。
 */
export function isUsableContactEndpoint(value: unknown): boolean {
  const endpoint = normalizeContactSettingValue(value);
  if (!/^https:\/\//i.test(endpoint)) return false;

  try {
    const url = new URL(endpoint);
    return (
      url.protocol === "https:" &&
      url.hostname.length > 0 &&
      url.username.length === 0 &&
      url.password.length === 0 &&
      url.hash.length === 0
    );
  } catch {
    return false;
  }
}

/** 設定値として許可する送信先URLか（空欄はフォームの削除）。 */
export function isValidContactEndpointSetting(value: unknown): boolean {
  const endpoint = normalizeContactSettingValue(value);
  return endpoint.length === 0 || isUsableContactEndpoint(endpoint);
}

/** 保存済みの旧値が不正でも、公開側でそのまま使わないための入口。 */
export function usableContactEmail(value: unknown): string {
  const email = normalizeContactSettingValue(value);
  return isUsableContactEmail(email) ? email : "";
}

/** 保存済みの旧値が不正でも、公開側でPOSTしないための入口。 */
export function usableContactEndpoint(value: unknown): string {
  const endpoint = normalizeContactSettingValue(value);
  return isUsableContactEndpoint(endpoint) ? endpoint : "";
}

export function hasUsableContactChannel(
  contactEmail: unknown,
  formspreeUrl: unknown,
): boolean {
  return Boolean(
    usableContactEmail(contactEmail) || usableContactEndpoint(formspreeUrl),
  );
}

/** payloadに含まれたキーだけを検査し、無関係なSettings保存を妨げない。 */
export function invalidContactSettingKeys(
  values: Readonly<Record<string, string | undefined>>,
): ContactSettingKey[] {
  const invalid: ContactSettingKey[] = [];
  if (
    Object.prototype.hasOwnProperty.call(values, "contactEmail") &&
    !isValidContactEmailSetting(values.contactEmail)
  ) {
    invalid.push("contactEmail");
  }
  if (
    Object.prototype.hasOwnProperty.call(values, "formspreeUrl") &&
    !isValidContactEndpointSetting(values.formspreeUrl)
  ) {
    invalid.push("formspreeUrl");
  }
  return invalid;
}

/** 接点2項目だけを正規化し、他のSettings値は一切変えない。 */
export function normalizeContactSettingsPayload<
  T extends Record<string, string | undefined>,
>(values: Readonly<T>): T {
  const normalized: Record<string, string | undefined> = { ...values };
  for (const key of CONTACT_SETTING_KEYS) {
    if (Object.prototype.hasOwnProperty.call(normalized, key)) {
      normalized[key] = normalizeContactSettingValue(normalized[key]);
    }
  }
  return normalized as T;
}

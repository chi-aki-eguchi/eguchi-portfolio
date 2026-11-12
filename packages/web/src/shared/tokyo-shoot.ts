/**
 * 東京の旅行者向け撮影プラン（`/tokyo`、2026-11-12）。
 *
 * akieguchi.com だけのページ（Portfolio Kit を買った人のサイトには出さない）。
 * 料金・時間・枚数・エリア・作例の写真は、下の `TOKYO_SHOOT` の1か所で決める。
 * 3言語の文はその数字を読んで組み立てるので、数字を変えるのはここだけでよい。
 *
 * 文章は下書き（2026-11-12）。特に繁體中文はオーナーが直す前提。
 * キャンセル規定と注意事項は仮の文面で、画面でも「仮」と分かるように出す。
 */

export type TokyoLang = "zh-Hant" | "en" | "ja";
export type TokyoPlanId = "digital" | "film35" | "medium";
export type TokyoAreaId = "shibuya" | "asakusa" | "yanaka" | "shimokita";

export type TokyoPlan = {
  id: TokyoPlanId;
  minutes: number;
  priceYen: number;
  /** デジタルの納品枚数の目安。 */
  frames?: number;
  /** デジタルの納品までの日数。 */
  deliveryDays?: number;
};

export const TOKYO_SHOOT: {
  plans: readonly TokyoPlan[];
  areas: readonly TokyoAreaId[];
  photoIds: readonly number[];
  maxPeople: number;
} = {
  plans: [
    // デジタル: 約30枚、3日以内に納品。
    { id: "digital", minutes: 60, priceYen: 15000, frames: 30, deliveryDays: 3 },
    // フィルム＋デジタル: 35mm 1本＋デジタル。フィルムは現像後に追加納品。
    { id: "film35", minutes: 90, priceYen: 25000 },
    // 中判フィルム: 67 またはハッセル 1本＋デジタル。
    { id: "medium", minutes: 90, priceYen: 35000 },
  ],
  areas: ["shibuya", "asakusa", "yanaka", "shimokita"],
  /**
   * 作例の写真（公開中の写真の id、出す順）。先頭が表紙。
   * 仮の並び：写っている人への掲載確認が済んだものだけを残す（オーナー確認待ち）。
   */
  photoIds: [2080, 2237, 2232, 2053, 2408, 2404, 2183],
  /** 人数の選択肢の上限（これ以上は「以上」としてまとめる）。 */
  maxPeople: 5,
};

/** 言語ごとの住所。繁體中文を最初に見せるので、`/tokyo` が繁體中文。 */
export const TOKYO_PATHS: Record<TokyoLang, string> = {
  "zh-Hant": "/tokyo",
  en: "/tokyo/en",
  ja: "/tokyo/ja",
};
export const TOKYO_LANGS: readonly TokyoLang[] = ["zh-Hant", "en", "ja"];

/** `/tokyo` のページならその言語、違えば null。末尾のスラッシュは無視する。 */
export function tokyoLangFromPath(pathname: string): TokyoLang | null {
  const clean = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
  return TOKYO_LANGS.find((lang) => TOKYO_PATHS[lang] === clean) ?? null;
}

/** 共有カードの言語（og:locale）。 */
export const TOKYO_OG_LOCALE: Record<TokyoLang, string> = {
  "zh-Hant": "zh_TW",
  en: "en_US",
  ja: "ja_JP",
};

export function formatYen(priceYen: number): string {
  return `¥${priceYen.toLocaleString("en-US")}`;
}

/** 60 → 1、90 → 1.5。 */
function hours(minutes: number): string {
  return String(Math.round((minutes / 60) * 10) / 10);
}

export type TokyoCopy = {
  /** 言語の切り替えに出す名前。 */
  langName: string;
  /** `<title>` の先頭に来る語。 */
  pageTitle: string;
  heading: string;
  lead: string[];
  /** 写真の下に添える「フィルム」の語。 */
  film: string;
  /** ページの下に1本だけ置く、ポートフォリオへの出口。 */
  morePhotos: string;
  /** いちばん安いプランの時間と料金の1行（題のすぐ下と、スマホの下の帯）。 */
  from: (time: string, price: string) => string;
  /** 撮る人の写真に付ける見出し。 */
  aboutLabel: string;
  /** フォームの代わりに Instagram のDMでも連絡できる、の一文（Instagram の語の前後）。 */
  dm: { before: string; after: string };
  plansLabel: string;
  plan: Record<TokyoPlanId, { name: string; detail: (plan: TokyoPlan) => string }>;
  duration: (minutes: number) => string;
  toForm: string;
  areasLabel: string;
  areas: Record<TokyoAreaId, string>;
  areasNote: string;
  flowLabel: string;
  flow: string[];
  /** 仮の文面。見出しに「仮」と分かる語を入れる。 */
  notesLabel: string;
  notes: string[];
  form: {
    label: string;
    date: string;
    people: string;
    peopleOption: (count: number, orMore: boolean) => string;
    plan: string;
    area: string;
    areaOther: string;
    name: string;
    email: string;
    social: string;
    language: string;
    message: string;
    messagePlaceholder: string;
    choose: string;
    privacyBefore: string;
    privacyLink: string;
    privacyAfter: string;
    send: string;
    sending: string;
    sent: string;
    sendAnother: string;
    sendError: string;
    mailtoLead: string;
    errors: { date: string; plan: string; name: string; email: string; emailFormat: string };
  };
};

const FORM_LANGUAGE_NAMES = ["中文", "English", "日本語"] as const;
export const TOKYO_FORM_LANGUAGES: readonly string[] = FORM_LANGUAGE_NAMES;
/** そのページの言語で書く人が多いので、フォームの「使う言語」の初めの値にする。 */
export const TOKYO_FORM_LANGUAGE_DEFAULT: Record<TokyoLang, string> = {
  "zh-Hant": "中文",
  en: "English",
  ja: "日本語",
};

export const TOKYO_COPY: Record<TokyoLang, TokyoCopy> = {
  "zh-Hant": {
    langName: "繁體中文",
    pageTitle: "東京旅拍｜中文攝影師・底片人像",
    heading: "東京旅拍",
    lead: [
      "台灣出生，現在住東京。中文可以直接溝通。",
      "用數位和底片（Pentax 67、Hasselblad）拍人。",
    ],
    film: "底片",
    morePhotos: "看更多照片",
    from: (time, price) => `${time} ${price} 起`,
    aboutLabel: "攝影師",
    dm: { before: "也可以用 ", after: " 私訊聯絡。" },
    plansLabel: "方案",
    plan: {
      digital: {
        name: "數位",
        detail: (p) => `約 ${p.frames} 張，${p.deliveryDays} 天內交件`,
      },
      film35: { name: "底片＋數位", detail: () => "35mm 底片 1 卷＋數位。底片沖洗後另外交件" },
      medium: { name: "中片幅底片", detail: () => "Pentax 67 或 Hasselblad 1 卷＋數位。底片沖洗後另外交件" },
    },
    duration: (m) => `${hours(m)} 小時`,
    toForm: "預約詢問",
    areasLabel: "地點",
    areas: { shibuya: "澀谷・原宿", asakusa: "淺草", yanaka: "谷中", shimokita: "下北澤" },
    areasNote: "其他地點也可以討論。",
    flowLabel: "流程",
    flow: ["填寫下方表單", "確認日期和地點", "日期確定後，另行通知付款方式", "拍攝・交件"],
    notesLabel: "注意事項（暫定）",
    notes: [
      "拍攝 2 天前為止，可以免費改期或取消。前一天取消收取 50%，當天取消收取 100%。",
      "雨天可以改期，或改到有屋頂的地點。",
      "入場費等實際費用另計。",
      "照片可能會放在我的網站和社群。會事先詢問，也可以拒絕。",
    ],
    form: {
      label: "預約詢問",
      date: "希望日期",
      people: "人數",
      peopleOption: (n, more) => (more ? `${n} 人以上` : `${n} 人`),
      plan: "方案",
      area: "地點",
      areaOther: "其他・未定",
      name: "姓名",
      email: "Email",
      social: "Instagram 或 LINE（選填）",
      language: "聯絡時使用的語言",
      message: "其他（選填）",
      messagePlaceholder: "第二希望日期、想拍的感覺等",
      choose: "請選擇",
      privacyBefore: "送出前請先閱讀",
      privacyLink: "隱私權政策（英文）",
      privacyAfter: "。",
      send: "送出",
      sending: "傳送中…",
      sent: "已收到，謝謝。2〜3 天內回覆。",
      sendAnother: "再填一次",
      sendError: "送出失敗。請稍後再試。",
      mailtoLead: "也可以直接寄信：",
      errors: {
        date: "請選擇日期",
        plan: "請選擇方案",
        name: "請填寫姓名",
        email: "請填寫 Email",
        emailFormat: "Email 格式不正確",
      },
    },
  },
  en: {
    langName: "English",
    pageTitle: "Tokyo Portrait Photographer | Film & Digital Sessions",
    heading: "Portrait sessions in Tokyo",
    lead: [
      "Born in Taiwan, based in Tokyo. You can write to me in Chinese, English or Japanese.",
      "I photograph people on digital and on film — Pentax 67, Hasselblad.",
    ],
    film: "Film",
    morePhotos: "More photographs",
    from: (time, price) => `From ${price} · ${time}`,
    aboutLabel: "Photographer",
    dm: { before: "Or message me on ", after: "." },
    plansLabel: "Plans",
    plan: {
      digital: {
        name: "Digital",
        detail: (p) => `About ${p.frames} photos, delivered within ${p.deliveryDays} days`,
      },
      film35: { name: "Film + digital", detail: () => "One roll of 35mm film plus digital. Film follows after developing" },
      medium: {
        name: "Medium format film",
        detail: () => "One roll on Pentax 67 or Hasselblad, plus digital. Film follows after developing",
      },
    },
    duration: (m) => `${hours(m)} ${m === 60 ? "hour" : "hours"}`,
    toForm: "Request a session",
    areasLabel: "Areas",
    areas: { shibuya: "Shibuya · Harajuku", asakusa: "Asakusa", yanaka: "Yanaka", shimokita: "Shimokitazawa" },
    areasNote: "Other areas on request.",
    flowLabel: "How it works",
    flow: [
      "Send the form below",
      "We settle the date and place",
      "Once the date is set, I send payment details",
      "Shoot, then delivery",
    ],
    notesLabel: "Notes (provisional)",
    notes: [
      "Rescheduling or cancelling is free until 2 days before the shoot. 50% the day before, 100% on the day.",
      "If it rains we can move the date, or shoot somewhere covered.",
      "Admission fees and similar costs are extra.",
      "I may show photos on my site and social accounts. I ask first, and you can say no.",
    ],
    form: {
      label: "Request a session",
      date: "Preferred date",
      people: "People",
      peopleOption: (n, more) => (more ? `${n} or more` : String(n)),
      plan: "Plan",
      area: "Area",
      areaOther: "Other / undecided",
      name: "Name",
      email: "Email",
      social: "Instagram or LINE (optional)",
      language: "Language for messages",
      message: "Anything else (optional)",
      messagePlaceholder: "A second date, the mood you have in mind",
      choose: "Select",
      privacyBefore: "Please read the ",
      privacyLink: "Privacy Policy",
      privacyAfter: " before sending.",
      send: "Send",
      sending: "Sending…",
      sent: "Received, thank you. I reply within 2–3 days.",
      sendAnother: "Send another",
      sendError: "Could not send. Please try again in a moment.",
      mailtoLead: "Or email me directly:",
      errors: {
        date: "Please choose a date",
        plan: "Please choose a plan",
        name: "Please enter your name",
        email: "Please enter your email",
        emailFormat: "That email address does not look right",
      },
    },
  },
  ja: {
    langName: "日本語",
    pageTitle: "東京での撮影プラン｜旅行中のポートレート・フィルム撮影",
    heading: "東京での撮影",
    lead: [
      "台湾出身、東京在住。中国語・日本語・英語でやりとりできます。",
      "デジタルとフィルム（PENTAX 67、ハッセルブラッド）で人を撮っています。",
    ],
    film: "フィルム",
    morePhotos: "ほかの写真を見る",
    from: (time, price) => `${time} ${price}から`,
    aboutLabel: "撮る人",
    dm: { before: "", after: " のDMでも受け付けています。" },
    plansLabel: "プラン",
    plan: {
      digital: {
        name: "デジタル",
        detail: (p) => `約${p.frames}枚、${p.deliveryDays}日以内に納品`,
      },
      film35: { name: "フィルム＋デジタル", detail: () => "35mmフィルム1本＋デジタル。フィルムは現像後に追加で納品" },
      medium: {
        name: "中判フィルム",
        detail: () => "PENTAX 67 またはハッセルブラッド1本＋デジタル。フィルムは現像後に追加で納品",
      },
    },
    duration: (m) => `${hours(m)}時間`,
    toForm: "撮影を申し込む",
    areasLabel: "エリア",
    areas: { shibuya: "渋谷・原宿", asakusa: "浅草", yanaka: "谷中", shimokita: "下北沢" },
    areasNote: "ほかの場所も相談できます。",
    flowLabel: "流れ",
    flow: ["下のフォームを送る", "日程と場所を決める", "日程が決まったら、支払い方法をご案内", "撮影・納品"],
    notesLabel: "注意事項（仮）",
    notes: [
      "撮影の2日前までは、無料で日程変更・キャンセルできます。前日は50%、当日は100%をいただきます。",
      "雨の日は、日程を変えるか、屋根のある場所に変更できます。",
      "入場料などの実費は別途お願いします。",
      "写真をサイトやSNSに載せることがあります。事前に確認し、断ることもできます。",
    ],
    form: {
      label: "撮影の申し込み",
      date: "希望日",
      people: "人数",
      peopleOption: (n, more) => (more ? `${n}人以上` : `${n}人`),
      plan: "プラン",
      area: "エリア",
      areaOther: "その他・未定",
      name: "お名前",
      email: "メール",
      social: "Instagram または LINE（任意）",
      language: "やりとりの言語",
      message: "その他（任意）",
      messagePlaceholder: "第2希望日、撮りたい雰囲気など",
      choose: "選んでください",
      privacyBefore: "送信前に",
      privacyLink: "プライバシーポリシー",
      privacyAfter: "をご確認ください。",
      send: "送信",
      sending: "送信中…",
      sent: "受け取りました。2〜3日以内にお返事します。",
      sendAnother: "もう一度送る",
      sendError: "送信できませんでした。少し待ってからもう一度お試しください。",
      mailtoLead: "メールでも受け付けています：",
      errors: {
        date: "希望日を選んでください",
        plan: "プランを選んでください",
        name: "お名前を入力してください",
        email: "メールアドレスを入力してください",
        emailFormat: "メールアドレスの形式を確認してください",
      },
    },
  },
};

/** プランの1行（名前・時間・料金）。フォームの選択肢と、検索向けの本文で使う。 */
export function tokyoPlanLine(lang: TokyoLang, plan: TokyoPlan): string {
  const copy = TOKYO_COPY[lang];
  return `${copy.plan[plan.id].name}　${copy.duration(plan.minutes)}　${formatYen(plan.priceYen)}`;
}

/**
 * `<title>`。サーバー（api/ogp.ts）と画面（pages/tokyo.tsx）が同じ式を使う。
 * 英語と繁體中文の題には日本語の肩書きを入れない（shared/site-title.ts の英語URLと同じ考え）。
 */
export function tokyoDocumentTitle(lang: TokyoLang, names: { nameJa: string; nameEn: string; subtitle: string }): string {
  const page = TOKYO_COPY[lang].pageTitle;
  const nameJa = names.nameJa && names.nameJa !== names.nameEn ? names.nameJa : "";
  if (lang === "en") return [page, names.nameEn].filter(Boolean).join(" | ");
  if (lang === "zh-Hant") return [page, nameJa, names.nameEn].filter(Boolean).join(" | ");
  return [page, nameJa, names.nameEn, names.subtitle].filter(Boolean).join(" | ");
}

/** いちばん安いプラン。「〜から」の表示と、検索・共有の説明文が同じ数字を読む。 */
export function tokyoCheapestPlan(): TokyoPlan {
  return [...TOKYO_SHOOT.plans].sort((a, b) => a.priceYen - b.priceYen)[0]!;
}

/** そのページの言語での「1時間 ¥15,000 から」。 */
export function tokyoFromLine(lang: TokyoLang): string {
  const cheapest = tokyoCheapestPlan();
  return TOKYO_COPY[lang].from(TOKYO_COPY[lang].duration(cheapest.minutes), formatYen(cheapest.priceYen));
}

/**
 * 検索・共有に出る説明文。探している人の言葉（東京・旅拍・中文・底片・地名）と、いちばん安いプランの
 * 時間と料金。事実だけで組み、数字とエリアは上の表から読む。
 */
export function tokyoDescription(lang: TokyoLang, names: { nameJa: string; nameEn: string }): string {
  const copy = TOKYO_COPY[lang];
  const areas = TOKYO_SHOOT.areas.map((id) => copy.areas[id]);
  const from = tokyoFromLine(lang);
  const name = lang === "en" ? names.nameEn : names.nameJa || names.nameEn;
  if (lang === "en")
    return `Portrait sessions in Tokyo with ${name}, a Taiwan-born photographer. Digital and film (Pentax 67, Hasselblad) in ${areas.join(", ")}. ${from}.`;
  if (lang === "zh-Hant")
    return `${name}的東京旅拍。台灣出生，中文溝通。數位與底片（Pentax 67、Hasselblad）人像，${areas.join("、")}。${from}。`;
  return `${name}による東京での撮影プラン。台湾出身、中国語・日本語・英語に対応。デジタルとフィルム（PENTAX 67、ハッセルブラッド）、${areas.join("、")}。${from}。`;
}

/** JavaScript を動かさない読み手（検索など）向けの本文。画面と同じ事実だけを並べる。 */
export function tokyoFallbackParagraphs(lang: TokyoLang): string[] {
  const copy = TOKYO_COPY[lang];
  return [
    ...copy.lead,
    ...TOKYO_SHOOT.plans.map((plan) => `${tokyoPlanLine(lang, plan)}　${copy.plan[plan.id].detail(plan)}`),
    `${copy.areasLabel}: ${TOKYO_SHOOT.areas.map((id) => copy.areas[id]).join(" / ")}`,
    copy.flow.join(" → "),
  ];
}

/**
 * 通知メールに出る1通ぶんの内容。オーナーが読むので、項目名と選択肢は日本語で揃える
 * （申し込んだ人の画面の言語に関係なく、同じ形で届く）。
 */
export function tokyoInquiryFields(input: {
  pageLang: TokyoLang;
  date: string;
  people: string;
  planId: string;
  areaId: string;
  name: string;
  email: string;
  social: string;
  language: string;
  message: string;
}): Record<string, string> {
  const plan = TOKYO_SHOOT.plans.find((p) => p.id === input.planId);
  const ja = TOKYO_COPY.ja;
  const area = TOKYO_SHOOT.areas.find((id) => id === input.areaId);
  const fields: Record<string, string> = {
    subject: "東京撮影プランの申し込み",
    name: input.name.trim(),
    email: input.email.trim(),
    希望日: input.date,
    人数: input.people,
    プラン: plan ? tokyoPlanLine("ja", plan) : input.planId,
    エリア: area ? ja.areas[area] : ja.form.areaOther,
    使う言語: input.language,
    "Instagram・LINE": input.social.trim(),
    message: input.message.trim(),
    ページ: TOKYO_PATHS[input.pageLang],
  };
  // 空の任意項目は送らない（通知メールに空行を並べない）。
  for (const key of ["Instagram・LINE", "message"]) if (!fields[key]) delete fields[key];
  return fields;
}

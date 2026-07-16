import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Tab } from "./admin-shared";

export type AdminLanguage = "ja" | "en";

export const ADMIN_LANGUAGE_STORAGE_KEY = "admin:language";

type ChecklistCopy = {
  title: string;
  body: string;
};

export type AdminMessages = {
  languageToggleLabel: string;
  common: {
    open: string;
    close: string;
    save: string;
    saving: string;
    cancel: string;
    discard: string;
    add: string;
    delete: string;
    deleteAction: string;
    sessionExpired: string;
    unsupportedSettings: (keys: string) => string;
  };
  login: {
    eyebrow: string;
    title: string;
    passwordPlaceholder: string;
    passwordLabel: string;
    submit: string;
    incorrectPassword: string;
    tooManyAttempts: string;
    unavailable: string;
  };
  navigation: {
    label: string;
    tabs: Record<Tab, string>;
    groups: {
      photos: string;
      presentation: string;
      site: string;
    };
    openSite: string;
    logout: string;
    siteButton: string;
    logoutButton: string;
    groupTabs: (group: string) => string;
    closeSheet: string;
    palettePlaceholder: string;
    paletteLabel: string;
    paletteDestinationsLabel: string;
    paletteEmpty: string;
    trash: string;
  };
  shell: {
    unsavedTitle: string;
    unsavedBody: string;
    leaveWithoutSaving: string;
  };
  headers: {
    hero: string;
    profile: string;
    categories: string;
    series: string;
    pricing: string;
    service: string;
    settingsSaveFailed: string;
    libraryLoading: string;
    librarySelected: string;
    viewSite: string;
    closeViewSite: string;
  };
  demo: {
    banner: string;
    purchase: string;
    reset: string;
    guideEyebrow: string;
    guideTitle: string;
    guideSteps: readonly [string, string, string];
    guideNote: string;
    guideStart: string;
    savedNotice: string;
  };
  setup: {
    collapsedCompleted: string;
    collapsedReady: string;
    collapsedDismissed: string;
    reopen: string;
    title: string;
    description: string;
    checking: string;
    progress: (done: number, total: number) => string;
    finish: string;
    later: string;
    recommendedTitle: string;
    checklist: {
      siteName: ChecklistCopy;
      profile: ChecklistCopy;
      firstPhoto: ChecklistCopy;
      hero: ChecklistCopy;
      liveSite: ChecklistCopy;
    };
    recommended: {
      contact: ChecklistCopy;
      publicUrl: ChecklistCopy;
      categories: ChecklistCopy;
      appearance: ChecklistCopy;
    };
    infrastructure: {
      title: string;
      websiteFiles: ChecklistCopy;
      hosting: ChecklistCopy;
      dataStorage: ChecklistCopy;
      photoStorage: ChecklistCopy;
    };
    glossary: {
      title: string;
      repo: string;
      environmentVariables: ChecklistCopy;
      deploy: string;
      ogp: string;
    };
    storageHealth: {
      configured: string;
      missingSummary: string;
      missingVariables: string;
      missingFallback: string;
      missingAction: string;
    };
  };
  floatingSave: {
    failed: string;
    saved: string;
    unsaved: string;
  };
};

export const ADMIN_DICTIONARY = {
  ja: {
    languageToggleLabel: "表示言語",
    common: {
      open: "開く",
      close: "閉じる",
      save: "保存",
      saving: "保存中...",
      cancel: "キャンセル",
      discard: "破棄",
      add: "追加",
      delete: "削除",
      deleteAction: "削除する",
      sessionExpired: "セッションが切れました。再ログインしてください。",
      unsupportedSettings: (keys) =>
        `一部の設定が保存されませんでした（未対応のキー: ${keys}）`,
    },
    login: {
      eyebrow: "Portfolio Admin",
      title: "Sign in",
      passwordPlaceholder: "パスワード",
      passwordLabel: "パスワード",
      submit: "ログイン",
      incorrectPassword: "パスワードが違います",
      tooManyAttempts:
        "試行回数が多すぎます。しばらくしてから再度お試しください。",
      unavailable: "サーバー設定エラー (ADMIN_PASSWORD 未設定)",
    },
    navigation: {
      label: "管理画面",
      tabs: {
        setup: "はじめに",
        gallery: "Library",
        hero: "Hero",
        profile: "Profile",
        categories: "Categories",
        series: "Series",
        pricing: "Pricing",
        service: "Portfolio Kit",
        settings: "Settings",
      },
      groups: {
        photos: "写真",
        presentation: "見せ方",
        site: "サイト",
      },
      openSite: "公開サイトを開く",
      logout: "ログアウト",
      siteButton: "Site",
      logoutButton: "Logout",
      groupTabs: (group) => `${group}のタブ`,
      closeSheet: "シートを閉じる",
      palettePlaceholder:
        "移動先を検索…（Library / Hero / Settings / Trash など）",
      paletteLabel: "クイック移動",
      paletteDestinationsLabel: "移動先",
      paletteEmpty: "見つかりません",
      trash: "Trash",
    },
    shell: {
      unsavedTitle: "未保存の変更があります",
      unsavedBody: "保存していない内容があります。このまま移動しますか？",
      leaveWithoutSaving: "保存せず移動",
    },
    headers: {
      hero: "トップページのカルーセルに表示する写真を選びます。",
      profile: "About ページに表示する自己紹介とプロフィール写真です。",
      categories: "Gallery の絞り込みに使うカテゴリを管理します。",
      series:
        '作品群（"Still, life" のようなまとまり）。↑↓で並び替え。公開トグルで下書き/公開。写真の割り当てはLibraryのインスペクタ「Series」から。',
      pricing:
        "Contactページに表示される料金です。↑↓で並び替え。販売ページの料金はPortfolio Kit画面で編集します。",
      service:
        "/portfolio-kit 販売ページの内容を編集します。公開サイト側の表示条件は現在の設定に従います。",
      settingsSaveFailed: "保存失敗 — もう一度お試しください",
      libraryLoading: "読み込み中",
      librarySelected: "selected",
      viewSite: "サイトで確認",
      closeViewSite: "サイトで確認を閉じる",
    },
    demo: {
      banner: "これは体験版です。変更は実際には保存されません。",
      purchase: "気に入ったら ¥10,000 から",
      reset: "最初からやり直す",
      guideEyebrow: "Quick tour",
      guideTitle: "まず、3つだけ触ってみてください",
      guideSteps: [
        "Galleryで写真のレイアウトを変える",
        "Settingsでフォントを選び、ライブプレビューを見る",
        "Libraryで写真を並び替え、「サイトで確認」を開く",
      ],
      guideNote:
        "変更はプレビューへその場で反映されます。保存しても本物のサイトには影響しません。",
      guideStart: "体験をはじめる",
      savedNotice:
        "体験モード: 画面内だけに反映しました。実際には保存されません。",
    },
    setup: {
      collapsedCompleted: "セットアップ完了ずみです。",
      collapsedReady: "公開に必要な項目はそろっています。",
      collapsedDismissed: "「はじめに」を閉じています。",
      reopen: "もう一度見る",
      title: "公開までにやること",
      description:
        "むずかしい設定は最初だけです。見る人に公開する前に、上から順に5つを確認します。写真家本人は、基本的にこの管理画面を埋めれば大丈夫です。",
      checking: "確認中...",
      progress: (done, total) => `${done} / ${total} 完了`,
      finish: "セットアップ完了 → ライブラリへ",
      later: "あとで",
      recommendedTitle: "公開前にできれば確認",
      checklist: {
        siteName: {
          title: "サイトの名前を入れる",
          body: "表に出る名前と短い説明文。SNSで共有された時にも使われます。",
        },
        profile: {
          title: "プロフィールを書く",
          body: "名前、自己紹介、プロフィール写真。まずここが入るとサイトらしくなります。",
        },
        firstPhoto: {
          title: "写真を1枚あげる",
          body: "最初の写真をアップロードします。写真の保管場所が正しくつながっている確認にもなります。",
        },
        hero: {
          title: "トップ写真を選ぶ",
          body: "最初に見せたい写真を選びます。サイトの第一印象になります。",
        },
        liveSite: {
          title: "公開を確認する",
          body: "「開く」で実際のサイトを見て、トップに写真が出ているか確認します。ここまで来れば公開できています。",
        },
      },
      recommended: {
        contact: {
          title: "連絡先",
          body: "メールか問い合わせフォーム。撮影依頼を受けたい場合は入れておきます。",
        },
        publicUrl: {
          title: "公開URL",
          body: "独自ドメインを使う時に入れます。検索結果やSNS共有のURLが安定します。",
        },
        categories: {
          title: "写真の分類",
          body: "Gallery の絞り込みに使います。写真が増えてきたら整えると見やすくなります。",
        },
        appearance: {
          title: "見え方",
          body: "ギャラリーの並び方、余白、文字の大きさを確認します。最初は写真の順番と S/M/L が一番効きます。",
        },
      },
      infrastructure: {
        title: "公開の裏側にあるもの",
        websiteFiles: {
          title: "サイトのファイル一式",
          body: "見た目や管理画面のもとになるもの。",
        },
        hosting: {
          title: "公開場所",
          body: "サイトをインターネットで動かす場所。",
        },
        dataStorage: {
          title: "データの保存場所",
          body: "名前、説明文、写真一覧などを保存する場所。",
        },
        photoStorage: {
          title: "写真の保存場所",
          body: "アップロードした写真ファイルそのものを置く場所。",
        },
      },
      glossary: {
        title: "言葉の置き換え",
        repo: "サイトのファイル一式が入った箱。",
        environmentVariables: {
          title: "環境変数",
          body: "パスワードや接続先を書く、公開しない設定メモ。",
        },
        deploy: "変更したサイトをネット上に反映すること。",
        ogp: "SNSでURLを貼った時に出るタイトル・説明・画像。",
      },
      storageHealth: {
        configured:
          "写真の保存先: 必要な設定は入力済み（実際につながるかは最初のアップロードで確認されます）",
        missingSummary:
          "写真の保存先: 設定が不足しています — このままでは写真をアップロードできません。",
        missingVariables: "Railway の Variables で",
        missingFallback: "S3_BUCKET など",
        missingAction:
          "を確認し、設定を直して再デプロイしてください。分からない場合は、サイトを設定した人へこの画面を送ってください。",
      },
    },
    floatingSave: {
      failed: "保存に失敗しました",
      saved: "保存しました",
      unsaved: "保存していない変更があります",
    },
  },
  en: {
    languageToggleLabel: "Display language",
    common: {
      open: "Open",
      close: "Close",
      save: "Save",
      saving: "Saving...",
      cancel: "Cancel",
      discard: "Discard",
      add: "Add",
      delete: "Delete",
      deleteAction: "Delete",
      sessionExpired: "Your session has expired. Please sign in again.",
      unsupportedSettings: (keys) =>
        `Some settings could not be saved (unsupported keys: ${keys}).`,
    },
    login: {
      eyebrow: "Portfolio Admin",
      title: "Sign in",
      passwordPlaceholder: "Password",
      passwordLabel: "Password",
      submit: "Sign in",
      incorrectPassword: "Incorrect password.",
      tooManyAttempts: "Too many attempts. Please wait and try again.",
      unavailable: "Admin login is not configured on this site.",
    },
    navigation: {
      label: "Admin panel",
      tabs: {
        setup: "Getting started",
        gallery: "Library",
        hero: "Hero",
        profile: "Profile",
        categories: "Categories",
        series: "Series",
        pricing: "Pricing",
        service: "Portfolio Kit",
        settings: "Settings",
      },
      groups: {
        photos: "Photos",
        presentation: "Presentation",
        site: "Site",
      },
      openSite: "Open site",
      logout: "Log out",
      siteButton: "Site",
      logoutButton: "Log out",
      groupTabs: (group) => `${group} tabs`,
      closeSheet: "Close tab menu",
      palettePlaceholder:
        "Search destinations… (Library, Hero, Settings, Trash)",
      paletteLabel: "Quick navigation",
      paletteDestinationsLabel: "Destinations",
      paletteEmpty: "No matches",
      trash: "Trash",
    },
    shell: {
      unsavedTitle: "You have unsaved changes",
      unsavedBody: "Your changes have not been saved. Leave this screen?",
      leaveWithoutSaving: "Leave without saving",
    },
    headers: {
      hero: "Choose the photos shown in the home-page carousel.",
      profile: "Your biography and profile photo shown on the About page.",
      categories: "Manage the categories used to filter Gallery.",
      series:
        "Manage groups of work, such as “Still, life.” Set the sort order with ↑↓, switch between draft and published, and assign photos from Series in the Library inspector.",
      pricing:
        "Manage pricing shown on the Contact page. Set the sort order with ↑↓. Edit sales-page pricing in Portfolio Kit.",
      service:
        "Edit the /portfolio-kit sales page. Visibility on the public site follows the current settings.",
      settingsSaveFailed: "Could not save — please try again",
      libraryLoading: "Loading",
      librarySelected: "selected",
      viewSite: "View on site",
      closeViewSite: "Close site preview",
    },
    demo: {
      banner: "This is a demo. Changes are not saved to a live site.",
      purchase: "Like it? From ¥10,000",
      reset: "Start over",
      guideEyebrow: "Quick tour",
      guideTitle: "Start with these three steps",
      guideSteps: [
        "Change a photo layout in Gallery",
        "Choose a font in Settings and open the live preview",
        "Reorder photos in Library, then open “View on site”",
      ],
      guideNote:
        "Changes appear in the preview immediately. Saving here never affects a live site.",
      guideStart: "Start exploring",
      savedNotice:
        "Demo mode: Applied on this screen only. Nothing was saved.",
    },
    setup: {
      collapsedCompleted: "Setup is complete.",
      collapsedReady: "Everything required to publish is ready.",
      collapsedDismissed: "Getting started is hidden.",
      reopen: "View again",
      title: "Before you publish",
      description:
        "The initial setup is the only detailed part. Check these five items in order before sharing the site. For most photographers, completing this admin panel is enough.",
      checking: "Checking...",
      progress: (done, total) => `${done} / ${total} complete`,
      finish: "Finish setup → Library",
      later: "Later",
      recommendedTitle: "Recommended before publishing",
      checklist: {
        siteName: {
          title: "Add your site name",
          body: "The public name and short description. They are also used when the site is shared on social media.",
        },
        profile: {
          title: "Write your profile",
          body: "Add your name, biography, and profile photo. This gives the site its identity.",
        },
        firstPhoto: {
          title: "Upload one photo",
          body: "Upload your first photo. This also checks that photo storage is connected correctly.",
        },
        hero: {
          title: "Choose a hero photo",
          body: "Choose the first photo visitors see. It sets the site’s first impression.",
        },
        liveSite: {
          title: "Check the live site",
          body: "Select “Open” and confirm that a photo appears on the home page. Once it does, the site is ready to publish.",
        },
      },
      recommended: {
        contact: {
          title: "Contact",
          body: "Add an email address or contact form if you want to receive photography enquiries.",
        },
        publicUrl: {
          title: "Public URL",
          body: "Add this when using a custom domain. It keeps search and social-sharing links consistent.",
        },
        categories: {
          title: "Photo categories",
          body: "Categories are used to filter Gallery. They become useful as your collection grows.",
        },
        appearance: {
          title: "Appearance",
          body: "Review the gallery layout, spacing, and type sizes. Photo order and S/M/L sizes make the biggest difference first.",
        },
      },
      infrastructure: {
        title: "What runs behind the site",
        websiteFiles: {
          title: "Website files",
          body: "The files that create the site’s appearance and admin panel.",
        },
        hosting: {
          title: "Hosting",
          body: "The service that keeps the site available on the internet.",
        },
        dataStorage: {
          title: "Data storage",
          body: "Where names, descriptions, and the photo list are stored.",
        },
        photoStorage: {
          title: "Photo storage",
          body: "Where the uploaded photo files themselves are stored.",
        },
      },
      glossary: {
        title: "Plain-language terms",
        repo: "A folder that contains the complete set of website files.",
        environmentVariables: {
          title: "Environment variables",
          body: "Private settings for passwords and connection details. They are not shown publicly.",
        },
        deploy: "To publish the latest website changes to the internet.",
        ogp: "The title, description, and image shown when a URL is shared on social media.",
      },
      storageHealth: {
        configured:
          "Photo storage: Required settings are present. The first upload confirms the connection.",
        missingSummary:
          "Photo storage: Settings are missing — photos cannot be uploaded yet.",
        missingVariables: "In Railway Variables, check",
        missingFallback: "S3_BUCKET and related settings",
        missingAction:
          "then correct the settings and redeploy. If you are unsure, send this screen to the person who set up the site.",
      },
    },
    floatingSave: {
      failed: "Could not save",
      saved: "Saved",
      unsaved: "You have unsaved changes",
    },
  },
} as const satisfies Record<AdminLanguage, AdminMessages>;

type AdminLanguageContextValue = {
  language: AdminLanguage;
  setLanguage: (language: AdminLanguage) => void;
  t: AdminMessages;
};

const AdminLanguageContext = createContext<AdminLanguageContextValue | null>(
  null,
);

function readStoredAdminLanguage(): AdminLanguage {
  if (typeof window === "undefined") return "ja";
  try {
    const stored = window.localStorage.getItem(ADMIN_LANGUAGE_STORAGE_KEY);
    return stored === "en" || stored === "ja" ? stored : "ja";
  } catch {
    return "ja";
  }
}

export function getStoredAdminMessages(): AdminMessages {
  return ADMIN_DICTIONARY[readStoredAdminLanguage()];
}

function AdminLanguageStateProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AdminLanguage>(
    readStoredAdminLanguage,
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(ADMIN_LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Private browsing or a full storage quota: keep the choice in memory.
    }
  }, [language]);

  useEffect(() => {
    const previousLanguage = document.documentElement.lang;
    document.documentElement.lang = language;
    return () => {
      document.documentElement.lang = previousLanguage;
    };
  }, [language]);

  useEffect(() => {
    const syncLanguage = (event: StorageEvent) => {
      if (
        event.key === ADMIN_LANGUAGE_STORAGE_KEY &&
        (event.newValue === "ja" || event.newValue === "en")
      ) {
        setLanguage(event.newValue);
      }
    };
    window.addEventListener("storage", syncLanguage);
    return () => window.removeEventListener("storage", syncLanguage);
  }, []);

  const value = useMemo<AdminLanguageContextValue>(
    () => ({ language, setLanguage, t: ADMIN_DICTIONARY[language] }),
    [language],
  );

  return (
    <AdminLanguageContext.Provider value={value}>
      {children}
    </AdminLanguageContext.Provider>
  );
}

export function AdminLanguageProvider({ children }: { children: ReactNode }) {
  const parent = useContext(AdminLanguageContext);
  if (parent) return <>{children}</>;
  return <AdminLanguageStateProvider>{children}</AdminLanguageStateProvider>;
}

const japaneseFallback: AdminLanguageContextValue = {
  language: "ja",
  setLanguage: () => undefined,
  t: ADMIN_DICTIONARY.ja,
};

export function useAdminI18n(): AdminLanguageContextValue {
  return useContext(AdminLanguageContext) ?? japaneseFallback;
}

export function AdminLanguageToggle({ className = "" }: { className?: string }) {
  const { language, setLanguage, t } = useAdminI18n();
  return (
    <nav
      aria-label={t.languageToggleLabel}
      data-admin-language-toggle
      data-language={language}
      className={`admin-language-toggle inline-flex items-center gap-1.5 font-en text-[10px] tracking-[0.12em] ${className}`}
    >
      <button
        type="button"
        aria-pressed={language === "ja"}
        data-active={language === "ja" || undefined}
        onClick={() => setLanguage("ja")}
      >
        JP
      </button>
      <span aria-hidden="true">|</span>
      <button
        type="button"
        aria-pressed={language === "en"}
        data-active={language === "en" || undefined}
        onClick={() => setLanguage("en")}
      >
        EN
      </button>
    </nav>
  );
}

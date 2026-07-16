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

type MessageShape<T> = T extends (...args: infer Args) => string
  ? (...args: Args) => string
  : T extends string
    ? string
    : T extends object
      ? { [K in keyof T]: MessageShape<T[K]> }
      : T;

const ADMIN_PHASE_2B_JA = {
  library: {
    bulkOperation: {
      trash: "ゴミ箱へ移動",
      restore: "復元",
      purge: "完全削除",
    },
    captureStatus: {
      copied: "Copied",
      pasted: "Pasted",
      error: "失敗",
    },
    focalPoints: {
      topLeft: "左上",
      top: "上",
      topRight: "右上",
      left: "左",
      center: "中央",
      right: "右",
      bottomLeft: "左下",
      bottom: "下",
      bottomRight: "右下",
    },
    sort: {
      label: "Sort",
      ariaLabel: "表示の並び替え",
      options: {
        manual: "手動（保存されている順）",
        manualShort: "手動",
        uploadedNewest: "アップロード日（新しい順）",
        uploadedNewestShort: "アップロード日 新しい順",
        uploadedOldest: "アップロード日（古い順）",
        uploadedOldestShort: "アップロード日 古い順",
        dateNewest: "撮影日（新しい順）",
        dateNewestShort: "撮影日 新しい順",
        dateOldest: "撮影日（古い順）",
        dateOldestShort: "撮影日 古い順",
        series: "シリーズ",
        displaySize: "表示サイズ（S→L）",
        displaySizeShort: "表示サイズ",
        medium: "媒体/フィルム",
        camera: "カメラ",
        category: "カテゴリ",
        title: "タイトル",
        publication: "公開状態",
      },
      clearFiltersFirst: "フィルターを解除してから保存できます",
      saveHint:
        "現在の表示順を公開サイトの並び（sortOrder）に書き込みます",
      saveConfirm:
        "現在の表示順を公開サイトの並び順として保存します。よろしいですか？",
      saveAction: "この並びを保存",
      condition: (label: string) => `並び: ${label}`,
    },
    toolbar: {
      filters: "絞り込み",
      thumbnailSize: "サムネイルサイズ",
      photoColumns: "写真の表示列数",
      columns: (count: number) => `${count}列表示`,
      columnsText: (count: number) => `${count}列`,
      tableMode: "表形式の一括編集モード",
      shortcutsTitle: "キーボードショートカット (?)",
      shortcutsAria: "キーボードショートカット",
    },
    import: {
      mediumAria: "取り込み媒体",
      mediumHint:
        "Importする写真に付く媒体ラベルです（絞り込みではありません）",
      mediumLabel: "取り込み",
      digital: "デジタル",
      film: "フィルム",
      chooseImages: "画像ファイルを選択",
      dropHere: "ここにドロップして読み込み",
      retryFailed: "失敗分を再アップロード",
      failedReason: "アップロードに失敗しました",
      tooLargeReason: (limit: string) =>
        `画像が大きすぎます（上限: ${limit}）。`,
      failureSummary: (
        count: number,
        names: string,
        hasMore: boolean,
      ) => `${count} 件失敗: ${names}${hasMore ? " ほか" : ""}`,
      skippedNonImages: (count: number) =>
        `${count} 件は画像でないためスキップ`,
      skippedOnlyNonImages: (count: number) =>
        `画像ファイルではないため ${count} 件をスキップしました`,
      duplicateSummary: (
        count: number,
        names: string,
        hasMore: boolean,
      ) => `重複スキップ: ${count}枚 (${names}${hasMore ? " ほか" : ""})`,
    },
    filters: {
      active: "絞り込み中",
      clear: "解除",
      searchPlaceholder: "検索（タイトル・分類・機材・ファイル名）",
      searchAria: "写真を検索",
      clearSearch: "検索をクリア",
      uncategorized: "未分類",
      seriesAria: "シリーズで絞り込み",
      unassigned: "未割り当て",
      displaySizeAria: "表示サイズで絞り込み",
      mediumAria: "媒体で絞り込み",
      mediumAll: "媒体: All",
      mediumDigital: "Digital",
      mediumFilm: "Film",
      mediumMissing: "媒体なし",
      orientationAria: "写真の向きで絞り込み",
      portrait: "縦写真",
      landscape: "横写真",
      square: "正方形",
      featured: "Hero設定中",
      publicationAria: "公開状態で絞り込み",
      publicationAll: "公開状態: All",
      publishedOnly: "公開のみ",
      unpublishedOnly: "非公開のみ",
      missingDate: "撮影日なし",
      missingCapture: "機材なし",
      uploadedAria: "アップロード時期で絞り込み",
      recentDays: (days: string | number) => `直近${days}日`,
      clearAll: "すべて解除",
      searchCondition: (query: string) => `検索: ${query}`,
      categoryCondition: (label: string) => `カテゴリ: ${label}`,
      seriesCondition: (label: string) => `Series: ${label}`,
      mediumCondition: (label: string) => `媒体: ${label}`,
    },
    albums: {
      deleteAria: (name: string) => `${name}を削除`,
      add: "アルバム",
      title: "スマートアルバムを作成",
      description:
        "条件に合う写真を自動で集めます。空欄の項目は条件にしません。",
      name: "名前",
      nameAria: "アルバム名",
      namePlaceholder: "例: PENTAX 67",
      cameraContains: "カメラを含む",
      cameraAria: "カメラ",
      filmDigital: "フィルム / デジタル",
      unspecified: "指定なし",
      unspecifiedPlaceholder: "（指定なし）",
      medium: "媒体",
      mediumAria: "媒体条件",
      missing: "未入力",
      date: "日付",
      capture: "機材",
      category: "カテゴリ",
      categoryAria: "カテゴリ条件",
      series: "シリーズ",
      seriesAria: "シリーズ条件",
      size: "サイズ",
      sizeAria: "サイズ条件",
      publication: "公開状態",
      publicationAria: "公開状態条件",
      uploaded: "アップロード時期",
      uploadedAria: "時期条件",
      featured: "フィーチャー",
      only: "のみ",
      noCondition: "条件なし",
      saving: "保存中",
      create: "作成",
    },
    selection: {
      selected: (count: number) => `選択中 ${count}枚`,
      publish: "公開",
      unpublish: "非公開",
      setCategory: "Set Category",
      uncategorized: "未分類 (uncategorized)",
      setSeries: "Set Series",
      noSeries: "シリーズなし",
      draftSuffix: "（下書き）",
      unassign: "割り当て解除",
      size: "Size",
      rotate: "Rotate",
      date: "Date",
      dateAria: "選択写真に設定する撮影日",
      dateConfirm: (count: number, date: string) =>
        `${count}枚に撮影日 ${date} を設定します。よろしいですか？`,
      apply: "適用",
      applyMissingDateHint: "撮影日が空の選択写真だけに設定します",
      applyCount: (count: number) => `適用 (${count})`,
      clearFilmDateConfirm: (count: number) =>
        `選択したフィルム写真 ${count}枚の撮影日をクリアします（未設定に戻ります）。よろしいですか？`,
      clear: "クリア",
      clearFilmDateHint:
        "選択したフィルム写真の撮影日を未設定に戻します（EXIFは保存時に失われるため再読込はできません）",
      clearFilmDate: (count: number) =>
        `フィルムの撮影日をクリア (${count})`,
      addHero: "Heroに追加",
      removeHero: "Heroから外す",
      bulkEdit: "一括編集",
      moveToTrash: "ゴミ箱へ",
    },
    rotation: {
      leftTitle: "左へ90°回転",
      leftAria: "左へ90度回転",
      selectedLeftAria: "選択写真を左へ90度回転",
      rightTitle: "右へ90°回転",
      rightAria: "右へ90度回転",
      selectedRightAria: "選択写真を右へ90度回転",
      resetTitle: "向きを0°に戻す",
      resetAria: "選択写真の向きを0度に戻す",
      resetFocalTitle: "見せる中心を中央に戻す",
      resetFocalAria: "選択写真の見せる中心を中央に戻す",
    },
    conditions: {
      aria: "Libraryの表示条件",
      label: "表示条件",
      manualToDrag: "手動順に戻すとドラッグ可",
      clearToDrag: "条件解除でドラッグ可",
      clear: "条件を解除",
    },
    trash: {
      empty: "ゴミ箱は空です。移動した写真はここに表示されます。",
      retention: (days: number) =>
        `削除済み写真 — 復元するか、完全削除してください（${days}日後に自動で完全削除されます）`,
      purgeAll: "Purge All",
      purgeAllConfirm: (count: number) =>
        `${count}枚をすべて完全削除しますか？この操作は取り消せません。`,
      daysLeft: (days: number) => `残り${days}日`,
      restore: "復元",
      purge: "完全削除",
      purgeOneConfirm:
        "この写真を完全削除しますか？この操作は取り消せません。",
      moved: (count: number) => `${count}枚をゴミ箱に移動しました`,
      undo: "元に戻す",
      more: (count: number) => `+${count}枚`,
      acknowledge: (count: number) =>
        `${count}枚の写真が完全に削除され、復元できないことを理解しました`,
      purgeCountdown: (seconds: number) =>
        `完全削除（あと${seconds}秒）`,
    },
    empty: {
      noMatches: "条件に合う写真が見つかりません。",
      relaxFilters: "絞り込みや検索語を少しゆるめてみてください。",
      clearFilters: "絞り込みを解除",
      noPhotos: "まだ写真がありません。",
      importHint: "Importから写真を追加できます。",
      tableHint: "Gallery表示に戻ると、Importから追加できます。",
    },
    reorder: {
      lockedBySort:
        "並びが「手動」以外になっているため、いまは並び替えを保存できません。",
      lockedByFilter:
        "検索・絞り込み中のため、いまは並び替えを保存できません（シリーズ単独の絞り込みなら可）。",
      unlock: "並び替えできる状態に戻す",
      hint:
        "戻したあとは、パソコンでは写真をドラッグ、スマホでは写真の左下の矢印ボタンで並び替えられます。",
      seriesHint:
        "シリーズ内の並び替え — ここでの並びが公開シリーズページの表示順になります",
      moveFirst: "先頭へ移動",
      movePrevious: "前へ移動",
      moveNext: "後へ移動",
      moveLast: "末尾へ移動",
    },
    badges: {
      noDate: "日付なし",
      noCapture: "機材なし",
      noMedium: "媒体なし",
      unpublished: "非公開",
      missingAria: (labels: string) => `未入力: ${labels}`,
      usageAria: (labels: string) => `使用状況: ${labels}`,
    },
    bulkMetadata: {
      title: "一括メタ編集",
      description: (count: number) =>
        `選択中 ${count} 枚に適用。空欄の項目は変更しません。`,
      unchanged: "（変更しない）",
      noChange: "変更しない",
      applying: "適用中",
      apply: "適用",
    },
    storageAlert: {
      title: "写真の保存先がまだ接続されていません。",
      close: "閉じる",
      missing: (names: string) => `不足している設定: ${names}`,
      detail: (names: string) =>
        `Railway の Variables で ${names || "S3_BUCKET など"} を確認してください。設定を直して再デプロイされるまで、再アップロードしても失敗します。`,
      handoff:
        "分からない場合は、サイトを設定した人へこの画面を送ってください。",
      retry: "設定を直したあとに再試行する",
    },
    purgeResult: {
      progress: (operation: string, done: number, total: number) =>
        `${operation}中 — ${done} / ${total} 件`,
      completed: (operation: string) => `${operation}が完了しました`,
      stopped: (operation: string) => `${operation}を中断しました`,
      success: (count: number) => `成功 ${count}件`,
      failed: (count: number) => `失敗 ${count}件`,
      unprocessed: (count: number) => `未処理 ${count}件`,
      retryFailed: "失敗分のみ再試行",
    },
    preview: {
      closeAria: "プレビューを閉じる",
      instructions: (name: string) =>
        `${name} · ← → で移動 · Space / Esc で閉じる`,
      shortcutsTitle: "キーボードショートカット",
      shortcutClick: "クリック",
      shortcutOpen: "選択 / インスペクタを開く",
      shortcutMulti: "複数選択の切替",
      shortcutRange: "範囲選択",
      shortcutAll: "全選択",
      shortcutMove: "選択を移動",
      shortcutReorder: "写真を並べ替え（前後へ）",
      shortcutRotate: "選択写真を左 / 右へ90°回転",
      shortcutInspector: "インスペクタを開く",
      shortcutPreview: "クイックプレビュー",
      shortcutDelete: "選択を削除（ゴミ箱へ）",
      shortcutClose: "閉じる / 選択解除",
      shortcutHelp: "このヘルプ",
    },
    inspector: {
      editPhoto: "Edit Photo",
      quick: "よく使う",
      unsaved: "未保存",
      usageAria: "写真の使用状況",
      published: "公開",
      unpublished: "非公開",
      uncategorized: "未分類",
      quickCategory: "クイックカテゴリ",
      noCategory: "カテゴリなし",
      quickSeries: "クイックシリーズ",
      noSeries: "シリーズなし",
      metadata: "Metadata",
      focalPoint: "見せる中心",
      focalPointHint: "正方形・ヒーローなど、切り抜き表示の中心",
      focalPointAria: (label: string) => `見せる中心: ${label}`,
      title: "Title",
      titleHint: "Lightbox・SEO・alt に使用",
      titleAria: "タイトル",
      camera: "Camera",
      captureHint: "Lightbox の撮影情報として表示",
      cameraAria: "カメラ",
      lens: "Lens",
      lensAria: "レンズ",
      copyCapture: "カメラとレンズをコピー",
      pasteCapture: "クリップボードからカメラとレンズを貼り付け",
      filmDigital: "Film / Digital",
      shotDate: "撮影日",
      shotDateHint:
        "アップロード時にEXIFから自動設定。EXIFが無い写真はここで手入力（任意・空欄可）",
      shotDateAria: "撮影日",
      clearShotDate: "撮影日をクリア",
      clear: "クリア",
      description: "Description",
      descriptionHint: "Lightbox の写真説明（任意）",
      descriptionAria: "説明",
      saving: "Saving...",
      saved: "Saved",
      save: "Save",
      reset: "Reset",
      duplicate: "この写真を複製",
      saveFailed: "保存に失敗しました。もう一度お試しください。",
      hero: "ヒーロー",
      heroSet: (position: number) => `✓ 設定中（${position}番目）`,
      notSet: "未設定",
      series: "シリーズ",
      unassigned: "未割り当て",
      category: "カテゴリ",
      sortOrder: "表示順",
      orderPosition: (position: number, total: number) =>
        `${position} / ${total}番目`,
      usage: "使用状況",
      fileInfo: "File Info",
      moveToTrash: "写真をゴミ箱へ",
      photoFallback: "写真",
    },
    sitePreview: {
      top: "トップ",
      gallery: "ギャラリー",
      desktopTitle: "PC幅で確認",
      desktop: "PC幅",
      mobileTitle: "スマホ幅で確認",
      mobile: "スマホ幅",
      close: "プレビューを閉じる",
      title: "サイトプレビュー",
    },
    bulkTable: {
      saveFailed: "保存失敗",
      titleAria: "タイトル",
      cameraAria: "カメラ",
      lensAria: "レンズ",
      seriesAria: "シリーズ",
      filmShort: "フ",
      digitalShort: "デ",
    },
    feedback: {
      deleteFailed:
        "削除に失敗しました。再ログインが必要かもしれません。",
      restoreFailed:
        "復元に失敗しました。再ログインが必要かもしれません。",
      purgeFailed: "完全削除に失敗しました。",
      rotationChanged: (degrees: number) => `向きを ${degrees}° にしました`,
      rotationFailed: "向きの変更に失敗しました。",
      duplicated: "複製しました",
      duplicateFailed: "複製に失敗しました。",
      batchCategoryFailed: "カテゴリの一括変更に失敗しました。",
      updated: (count: number) => `${count}枚を更新しました`,
      batchFailed: "一括操作に失敗しました。",
      bulkMetadataFailed: "一括メタ編集に失敗しました。",
      albumSaveFailed: "スマートアルバムの保存に失敗しました。",
      orderSaved: "並び順を保存しました",
      reorderFailed: "並び替えの保存に失敗しました。",
      switchPhotoConfirm:
        "保存していない編集があります。保存せずに別の写真へ移動しますか？",
      switchPhotoAction: "保存せず移動",
      closeInspectorConfirm:
        "保存していない編集があります。保存せずに閉じますか？",
      closeInspectorAction: "保存せず閉じる",
    },
  },
  categories: {
    description:
      "ギャラリーのフィルターとして使用。↑↓で並び替え（この順で表示されます）。",
    empty: "まだカテゴリがありません。下の入力欄から追加できます。",
    moveUp: "上へ移動",
    moveDown: "下へ移動",
    deleteAria: (label: string) => `${label} を削除`,
    newCategory: "New Category",
    label: "Label",
    labelAria: "カテゴリ名",
    slug: "Slug",
    slugAria: "スラッグ",
    add: "Add",
    deleteConfirm: (label: string) => `「${label}」を削除しますか？`,
    errors: {
      addFailed:
        "追加に失敗しました。スラッグが重複していないか確認してください。",
      reservedSlug: (slug: string) =>
        `"${slug}" は予約語のため使用できません。`,
      duplicateSlug: (slug: string) =>
        `スラッグ "${slug}" は既に存在します。`,
      deleteFailed: "削除に失敗しました。",
      reorderFailed: "並び替えの保存に失敗しました。",
    },
  },
  series: {
    deletedCover: "元の写真は削除済み",
    empty: "まだシリーズがありません。作品のまとまりを作るとここに表示されます。",
    moveUp: "上へ移動",
    moveDown: "下へ移動",
    cardSummary: (count: number, cover: string) =>
      `${count} 枚${cover ? ` ・ 表紙: ${cover}` : ""}`,
    published: "公開",
    draft: "下書き",
    edit: "編集",
    deleteAria: (title: string) => `${title} を削除`,
    title: "Title",
    titleAria: "シリーズのタイトル",
    slug: "Slug",
    slugHint: "URL（/series/◯◯）に使用",
    slugAria: "シリーズのスラッグ",
    subtitle: "Subtitle",
    subtitleHint: "任意のサブタイトル",
    subtitleAria: "サブタイトル",
    statement: "Statement",
    statementHint: "シリーズのコンセプト文（改行可）",
    statementAria: "ステートメント",
    statementPlaceholder: "このシリーズについて…",
    coverPhoto: "Cover Photo",
    coverHint: "シリーズ一覧の表紙。未設定ならシリーズ先頭の写真を自動使用",
    automaticCover: "なし（自動）",
    noPhotos: "写真がありません",
    selectedCover: (name: string) => `選択中: ${name}`,
    layoutTheme: "Layout & Theme",
    layout: "レイアウト",
    layoutHint:
      "「グローバルに従う」はSettings→ギャラリー配置の設定を使います",
    global: "グローバル",
    layoutNames: {
      grid: "写真比率グリッド",
      "clean-grid": "正方形グリッド",
      "portrait-grid": "縦長グリッド",
      "landscape-grid": "横長グリッド",
      masonry: "マソンリー",
      justified: "行組み",
      mosaic: "モザイク",
      scroll: "縦スクロール1枚",
      stagger: "ずらし大",
      editorial: "雑誌見開き",
      collage: "コラージュ",
      "large-format": "大判",
    },
    photoOrder: "写真の並び順",
    photoOrderHint:
      "「グローバルに従う」はSettings→シリーズ並び順の設定を使います",
    manualOrder: "手動順",
    dateNewest: "撮影日↓新しい順",
    dateOldest: "撮影日↑古い順",
    background: "背景色",
    backgroundHint: "空欄=グローバル設定。#fff / #000 / #1a1a1a など",
    backgroundPlaceholder: "（グローバル設定を使用）",
    saving: "Saving...",
    save: "Save",
    close: "Close",
    newSeries: "New Series",
    newTitleAria: "新しいシリーズのタイトル",
    newSlugAria: "新しいシリーズのスラッグ",
    add: "Add",
    deleteConfirm: (title: string) => `「${title}」を削除しますか？`,
    deleteKeepsPhotos:
      "写真は削除されず、シリーズの割り当てだけが外れます。",
    errors: {
      addFailed:
        "追加に失敗しました。スラッグが重複していないか確認してください。",
      duplicateSlug: (slug: string) =>
        `スラッグ "${slug}" は既に存在します。`,
      saveFailed: "保存に失敗しました。",
      deleteFailed: "削除に失敗しました。",
      reorderFailed: "並び替えの保存に失敗しました。",
    },
  },
} as const;

type AdminPhase2bMessages = MessageShape<typeof ADMIN_PHASE_2B_JA>;

const ADMIN_PHASE_2B_EN = {
  library: {
    bulkOperation: {
      trash: "Move to Trash",
      restore: "Restore",
      purge: "Permanently delete",
    },
    captureStatus: {
      copied: "Copied",
      pasted: "Pasted",
      error: "Failed",
    },
    focalPoints: {
      topLeft: "Top left",
      top: "Top",
      topRight: "Top right",
      left: "Left",
      center: "Center",
      right: "Right",
      bottomLeft: "Bottom left",
      bottom: "Bottom",
      bottomRight: "Bottom right",
    },
    sort: {
      label: "Sort",
      ariaLabel: "Sort Library view",
      options: {
        manual: "Manual (saved order)",
        manualShort: "Manual",
        uploadedNewest: "Upload date (newest first)",
        uploadedNewestShort: "Upload date, newest first",
        uploadedOldest: "Upload date (oldest first)",
        uploadedOldestShort: "Upload date, oldest first",
        dateNewest: "Date taken (newest first)",
        dateNewestShort: "Date taken, newest first",
        dateOldest: "Date taken (oldest first)",
        dateOldestShort: "Date taken, oldest first",
        series: "Series",
        displaySize: "Display size (S→L)",
        displaySizeShort: "Display size",
        medium: "Medium / Film",
        camera: "Camera",
        category: "Category",
        title: "Title",
        publication: "Publication status",
      },
      clearFiltersFirst: "Clear the filters before saving this order",
      saveHint: "Write the current view order to the public-site sort order",
      saveConfirm:
        "Save the current view order as the public-site sort order?",
      saveAction: "Save this order",
      condition: (label: string) => `Sort: ${label}`,
    },
    toolbar: {
      filters: "Filters",
      thumbnailSize: "Thumbnail size",
      photoColumns: "Photo columns",
      columns: (count: number) => `Show ${count} columns`,
      columnsText: (count: number) => `${count} cols`,
      tableMode: "Bulk edit in table view",
      shortcutsTitle: "Keyboard shortcuts (?)",
      shortcutsAria: "Keyboard shortcuts",
    },
    import: {
      mediumAria: "Import medium",
      mediumHint:
        "This medium label is applied to imported photos. It is not a filter.",
      mediumLabel: "Import as",
      digital: "Digital",
      film: "Film",
      chooseImages: "Choose image files",
      dropHere: "Drop images here to import",
      retryFailed: "Retry failed uploads",
      failedReason: "Upload failed",
      tooLargeReason: (limit: string) =>
        `The image is too large (limit: ${limit}).`,
      failureSummary: (
        count: number,
        names: string,
        hasMore: boolean,
      ) => `${count} failed: ${names}${hasMore ? " and more" : ""}`,
      skippedNonImages: (count: number) =>
        `${count} non-image file${count === 1 ? " was" : "s were"} skipped`,
      skippedOnlyNonImages: (count: number) =>
        `Skipped ${count} non-image file${count === 1 ? "" : "s"}.`,
      duplicateSummary: (
        count: number,
        names: string,
        hasMore: boolean,
      ) => `Duplicates skipped: ${count} (${names}${hasMore ? " and more" : ""})`,
    },
    filters: {
      active: "Active filters",
      clear: "Clear",
      searchPlaceholder: "Search title, category, camera, or filename",
      searchAria: "Search photos",
      clearSearch: "Clear search",
      uncategorized: "Uncategorized",
      seriesAria: "Filter by series",
      unassigned: "Unassigned",
      displaySizeAria: "Filter by display size",
      mediumAria: "Filter by medium",
      mediumAll: "Medium: All",
      mediumDigital: "Digital",
      mediumFilm: "Film",
      mediumMissing: "No medium",
      orientationAria: "Filter by orientation",
      portrait: "Portrait",
      landscape: "Landscape",
      square: "Square",
      featured: "In Hero",
      publicationAria: "Filter by publication status",
      publicationAll: "Publication: All",
      publishedOnly: "Published only",
      unpublishedOnly: "Unpublished only",
      missingDate: "No date taken",
      missingCapture: "No camera or lens",
      uploadedAria: "Filter by upload date",
      recentDays: (days: string | number) => `Last ${days} days`,
      clearAll: "Clear all",
      searchCondition: (query: string) => `Search: ${query}`,
      categoryCondition: (label: string) => `Category: ${label}`,
      seriesCondition: (label: string) => `Series: ${label}`,
      mediumCondition: (label: string) => `Medium: ${label}`,
    },
    albums: {
      deleteAria: (name: string) => `Delete ${name}`,
      add: "Album",
      title: "Create smart album",
      description:
        "Photos matching these conditions are collected automatically. Empty fields are ignored.",
      name: "Name",
      nameAria: "Album name",
      namePlaceholder: "e.g. PENTAX 67",
      cameraContains: "Camera contains",
      cameraAria: "Camera",
      filmDigital: "Film / Digital",
      unspecified: "Any",
      unspecifiedPlaceholder: "(Any)",
      medium: "Medium",
      mediumAria: "Medium condition",
      missing: "Missing metadata",
      date: "Date taken",
      capture: "Camera / lens",
      category: "Category",
      categoryAria: "Category condition",
      series: "Series",
      seriesAria: "Series condition",
      size: "Display size",
      sizeAria: "Display size condition",
      publication: "Publication status",
      publicationAria: "Publication condition",
      uploaded: "Upload date",
      uploadedAria: "Upload-date condition",
      featured: "Hero",
      only: "Only",
      noCondition: "Any",
      saving: "Saving",
      create: "Create",
    },
    selection: {
      selected: (count: number) => `${count} selected`,
      publish: "Publish",
      unpublish: "Unpublish",
      setCategory: "Set Category",
      uncategorized: "Uncategorized",
      setSeries: "Set Series",
      noSeries: "No series",
      draftSuffix: " (Draft)",
      unassign: "Remove assignment",
      size: "Size",
      rotate: "Rotate",
      date: "Date",
      dateAria: "Date taken to apply to selected photos",
      dateConfirm: (count: number, date: string) =>
        `Set the date taken to ${date} for ${count} selected photo${count === 1 ? "" : "s"}?`,
      apply: "Apply",
      applyMissingDateHint: "Apply only to selected photos with no date taken",
      applyCount: (count: number) => `Apply (${count})`,
      clearFilmDateConfirm: (count: number) =>
        `Clear the date taken for ${count} selected film photo${count === 1 ? "" : "s"}? The date will become unset.`,
      clear: "Clear",
      clearFilmDateHint:
        "Clear the date taken on selected film photos. EXIF cannot be reread because it is removed during storage.",
      clearFilmDate: (count: number) => `Clear film dates (${count})`,
      addHero: "Add to Hero",
      removeHero: "Remove from Hero",
      bulkEdit: "Bulk edit",
      moveToTrash: "Move to Trash",
    },
    rotation: {
      leftTitle: "Rotate 90° left",
      leftAria: "Rotate 90 degrees left",
      selectedLeftAria: "Rotate selected photos 90 degrees left",
      rightTitle: "Rotate 90° right",
      rightAria: "Rotate 90 degrees right",
      selectedRightAria: "Rotate selected photos 90 degrees right",
      resetTitle: "Reset rotation to 0°",
      resetAria: "Reset selected photos to 0 degrees",
      resetFocalTitle: "Reset focal point to center",
      resetFocalAria: "Reset focal point of selected photos to center",
    },
    conditions: {
      aria: "Library view conditions",
      label: "View conditions",
      manualToDrag: "Return to Manual to drag",
      clearToDrag: "Clear conditions to drag",
      clear: "Clear conditions",
    },
    trash: {
      empty: "Trash is empty. Photos moved to Trash appear here.",
      retention: (days: number) =>
        `Deleted photos — restore or permanently delete them. They are permanently deleted automatically after ${days} days.`,
      purgeAll: "Delete all permanently",
      purgeAllConfirm: (count: number) =>
        `Permanently delete all ${count} photo${count === 1 ? "" : "s"}? This cannot be undone.`,
      daysLeft: (days: number) => `${days} day${days === 1 ? "" : "s"} left`,
      restore: "Restore",
      purge: "Permanently delete",
      purgeOneConfirm:
        "Permanently delete this photo? This cannot be undone.",
      moved: (count: number) =>
        `${count} photo${count === 1 ? "" : "s"} moved to Trash`,
      undo: "Undo",
      more: (count: number) => `+${count} more`,
      acknowledge: (count: number) =>
        `I understand that ${count} photos will be permanently deleted and cannot be restored.`,
      purgeCountdown: (seconds: number) =>
        `Permanently delete (${seconds}s)`,
    },
    empty: {
      noMatches: "No photos match these conditions.",
      relaxFilters: "Try broader filters or a shorter search term.",
      clearFilters: "Clear filters",
      noPhotos: "No photos yet.",
      importHint: "Add photos with Import.",
      tableHint: "Return to Gallery view to add photos with Import.",
    },
    reorder: {
      lockedBySort:
        "The current sort is not Manual, so the saved order cannot be changed.",
      lockedByFilter:
        "The saved order cannot be changed while searching or filtering. A single Series filter is allowed.",
      unlock: "Return to manual reordering",
      hint:
        "After returning, drag photos on desktop or use the arrow buttons at the lower left of each photo on mobile.",
      seriesHint:
        "Reorder within this series — this order is used on the public series page",
      moveFirst: "Move to first",
      movePrevious: "Move earlier",
      moveNext: "Move later",
      moveLast: "Move to last",
    },
    badges: {
      noDate: "No date",
      noCapture: "No camera / lens",
      noMedium: "No medium",
      unpublished: "Unpublished",
      missingAria: (labels: string) => `Missing metadata: ${labels}`,
      usageAria: (labels: string) => `Photo usage: ${labels}`,
    },
    bulkMetadata: {
      title: "Bulk metadata edit",
      description: (count: number) =>
        `Apply to ${count} selected photo${count === 1 ? "" : "s"}. Empty fields are unchanged.`,
      unchanged: "(Leave unchanged)",
      noChange: "Leave unchanged",
      applying: "Applying",
      apply: "Apply",
    },
    storageAlert: {
      title: "Photo storage is not connected yet.",
      close: "Close",
      missing: (names: string) => `Missing settings: ${names}`,
      detail: (names: string) =>
        `Check ${names || "S3_BUCKET and related settings"} in Railway Variables. Uploads will continue to fail until the settings are corrected and the site is redeployed.`,
      handoff:
        "If you are unsure, send this screen to the person who set up the site.",
      retry: "Retry after correcting the settings",
    },
    purgeResult: {
      progress: (operation: string, done: number, total: number) =>
        `${operation} — ${done} / ${total}`,
      completed: (operation: string) => `${operation} completed`,
      stopped: (operation: string) => `${operation} stopped`,
      success: (count: number) => `${count} succeeded`,
      failed: (count: number) => `${count} failed`,
      unprocessed: (count: number) => `${count} not processed`,
      retryFailed: "Retry failed items",
    },
    preview: {
      closeAria: "Close preview",
      instructions: (name: string) =>
        `${name} · ← → to move · Space / Esc to close`,
      shortcutsTitle: "Keyboard shortcuts",
      shortcutClick: "Click",
      shortcutOpen: "Select / open inspector",
      shortcutMulti: "Toggle multiple selection",
      shortcutRange: "Select range",
      shortcutAll: "Select all",
      shortcutMove: "Move selection",
      shortcutReorder: "Reorder photo earlier / later",
      shortcutRotate: "Rotate selected photos 90° left / right",
      shortcutInspector: "Open inspector",
      shortcutPreview: "Quick preview",
      shortcutDelete: "Move selection to Trash",
      shortcutClose: "Close / clear selection",
      shortcutHelp: "Open this help",
    },
    inspector: {
      editPhoto: "Edit Photo",
      quick: "Quick edits",
      unsaved: "Unsaved",
      usageAria: "Photo usage",
      published: "Published",
      unpublished: "Unpublished",
      uncategorized: "Uncategorized",
      quickCategory: "Quick category",
      noCategory: "No category",
      quickSeries: "Quick series",
      noSeries: "No series",
      metadata: "Metadata",
      focalPoint: "Focal point",
      focalPointHint:
        "The center used when the photo is cropped, such as in square and Hero layouts.",
      focalPointAria: (label: string) => `Focal point: ${label}`,
      title: "Title",
      titleHint: "Used in the Lightbox, SEO, and alt text",
      titleAria: "Title",
      camera: "Camera",
      captureHint: "Shown as capture information in the Lightbox",
      cameraAria: "Camera",
      lens: "Lens",
      lensAria: "Lens",
      copyCapture: "Copy camera and lens",
      pasteCapture: "Paste camera and lens from clipboard",
      filmDigital: "Film / Digital",
      shotDate: "Date taken",
      shotDateHint:
        "Set automatically from EXIF on import. Enter it here when EXIF is unavailable (optional).",
      shotDateAria: "Date taken",
      clearShotDate: "Clear date taken",
      clear: "Clear",
      description: "Description",
      descriptionHint: "Optional photo description shown in the Lightbox",
      descriptionAria: "Description",
      saving: "Saving...",
      saved: "Saved",
      save: "Save",
      reset: "Reset",
      duplicate: "Duplicate this photo",
      saveFailed: "Could not save. Please try again.",
      hero: "Hero",
      heroSet: (position: number) => `✓ Set (${position})`,
      notSet: "Not set",
      series: "Series",
      unassigned: "Unassigned",
      category: "Category",
      sortOrder: "Sort order",
      orderPosition: (position: number, total: number) =>
        `${position} of ${total}`,
      usage: "Usage",
      fileInfo: "File Info",
      moveToTrash: "Move photo to Trash",
      photoFallback: "Photo",
    },
    sitePreview: {
      top: "Home",
      gallery: "Gallery",
      desktopTitle: "Preview at desktop width",
      desktop: "Desktop",
      mobileTitle: "Preview at mobile width",
      mobile: "Mobile",
      close: "Close preview",
      title: "Site preview",
    },
    bulkTable: {
      saveFailed: "Save failed",
      titleAria: "Title",
      cameraAria: "Camera",
      lensAria: "Lens",
      seriesAria: "Series",
      filmShort: "F",
      digitalShort: "D",
    },
    feedback: {
      deleteFailed:
        "Could not move the photos to Trash. You may need to sign in again.",
      restoreFailed:
        "Could not restore the photos. You may need to sign in again.",
      purgeFailed: "Could not permanently delete the photos.",
      rotationChanged: (degrees: number) => `Rotation set to ${degrees}°`,
      rotationFailed: "Could not change the rotation.",
      duplicated: "Photo duplicated",
      duplicateFailed: "Could not duplicate the photo.",
      batchCategoryFailed: "Could not update the selected categories.",
      updated: (count: number) =>
        `${count} photo${count === 1 ? "" : "s"} updated`,
      batchFailed: "Could not update the selected photos.",
      bulkMetadataFailed: "Could not update the selected metadata.",
      albumSaveFailed: "Could not save the smart album.",
      orderSaved: "Sort order saved",
      reorderFailed: "Could not save the sort order.",
      switchPhotoConfirm:
        "This photo has unsaved edits. Move to another photo without saving?",
      switchPhotoAction: "Move without saving",
      closeInspectorConfirm:
        "This photo has unsaved edits. Close it without saving?",
      closeInspectorAction: "Close without saving",
    },
  },
  categories: {
    description:
      "Used as Gallery filters. Reorder with ↑↓; this is the public display order.",
    empty: "No categories yet. Add one with the fields below.",
    moveUp: "Move up",
    moveDown: "Move down",
    deleteAria: (label: string) => `Delete ${label}`,
    newCategory: "New Category",
    label: "Label",
    labelAria: "Category name",
    slug: "Slug",
    slugAria: "Category slug",
    add: "Add",
    deleteConfirm: (label: string) => `Delete “${label}”?`,
    errors: {
      addFailed: "Could not add the category. Check whether the slug is unique.",
      reservedSlug: (slug: string) => `“${slug}” is reserved and cannot be used.`,
      duplicateSlug: (slug: string) => `The slug “${slug}” already exists.`,
      deleteFailed: "Could not delete the category.",
      reorderFailed: "Could not save the category order.",
    },
  },
  series: {
    deletedCover: "Original photo has been deleted",
    empty: "No series yet. Create a group of work to see it here.",
    moveUp: "Move up",
    moveDown: "Move down",
    cardSummary: (count: number, cover: string) =>
      `${count} photo${count === 1 ? "" : "s"}${cover ? ` · Cover: ${cover}` : ""}`,
    published: "Published",
    draft: "Draft",
    edit: "Edit",
    deleteAria: (title: string) => `Delete ${title}`,
    title: "Title",
    titleAria: "Series title",
    slug: "Slug",
    slugHint: "Used in the URL (/series/...) ",
    slugAria: "Series slug",
    subtitle: "Subtitle",
    subtitleHint: "Optional subtitle",
    subtitleAria: "Subtitle",
    statement: "Statement",
    statementHint: "Series concept statement; line breaks are allowed",
    statementAria: "Statement",
    statementPlaceholder: "About this series…",
    coverPhoto: "Cover Photo",
    coverHint:
      "Cover shown in the Series list. The first photo is used automatically when no cover is selected.",
    automaticCover: "None (automatic)",
    noPhotos: "No photos",
    selectedCover: (name: string) => `Selected: ${name}`,
    layoutTheme: "Layout & Theme",
    layout: "Layout",
    layoutHint: "Global uses the Gallery layout selected in Settings.",
    global: "Global",
    layoutNames: {
      grid: "Aspect-ratio grid",
      "clean-grid": "Square grid",
      "portrait-grid": "Portrait grid",
      "landscape-grid": "Landscape grid",
      masonry: "Masonry",
      justified: "Justified rows",
      mosaic: "Mosaic",
      scroll: "Single-photo scroll",
      stagger: "Large stagger",
      editorial: "Editorial spread",
      collage: "Collage",
      "large-format": "Large format",
    },
    photoOrder: "Photo order",
    photoOrderHint: "Global uses the Series order selected in Settings.",
    manualOrder: "Manual order",
    dateNewest: "Date taken, newest first",
    dateOldest: "Date taken, oldest first",
    background: "Background color",
    backgroundHint: "Leave empty to use the global setting. Examples: #fff, #000, #1a1a1a",
    backgroundPlaceholder: "(Use global setting)",
    saving: "Saving...",
    save: "Save",
    close: "Close",
    newSeries: "New Series",
    newTitleAria: "New series title",
    newSlugAria: "New series slug",
    add: "Add",
    deleteConfirm: (title: string) => `Delete “${title}”?`,
    deleteKeepsPhotos:
      "The photos are not deleted; only their series assignment is removed.",
    errors: {
      addFailed: "Could not add the series. Check whether the slug is unique.",
      duplicateSlug: (slug: string) => `The slug “${slug}” already exists.`,
      saveFailed: "Could not save the series.",
      deleteFailed: "Could not delete the series.",
      reorderFailed: "Could not save the series order.",
    },
  },
} as const satisfies AdminPhase2bMessages;

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
    demoIntro: string;
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
  phase2b: AdminPhase2bMessages;
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
      demoIntro:
        "これは、購入後にご自身のサイトを公開まで進める手順表の見本です。体験版ではサンプル一式が入っているためすべて完了になっていますが、実際は空の状態から、この順に埋めていくだけで公開できます。",
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
    phase2b: ADMIN_PHASE_2B_JA,
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
      purchase: "Get your own — from ¥10,000",
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
      demoIntro:
        "This is a preview of the checklist that guides you from a fresh install to a published site. In this demo everything is marked complete because sample content is preloaded — on your own site, you simply work through these steps from the top.",
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
    phase2b: ADMIN_PHASE_2B_EN,
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

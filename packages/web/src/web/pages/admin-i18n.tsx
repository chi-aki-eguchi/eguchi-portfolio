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
      copied: "コピーしました",
      pasted: "貼り付けました",
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
      label: "並び替え",
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
        random: "ランダム",
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
      view: "表示",
      thumbnailSize: "サムネイルサイズ",
      photoColumns: "写真の表示列数",
      columns: (count: number) => `${count}列表示`,
      columnsText: (count: number) => `${count}列`,
      tableMode: "表形式の一括編集モード",
      table: "表形式",
      trash: "ゴミ箱",
      shortcutsTitle: "キーボードショートカット (?)",
      shortcutsAria: "キーボードショートカット",
    },
    mode: {
      group: "Libraryの操作モード",
      normal: "閲覧",
      select: "選択",
      arrange: "並べ替え",
      startSelect: "選択モードを開始",
      startArrange: "並べるモードを開始",
      endSelection: "選択終了",
      finishArrange: "並べ替えを終了",
      selectionHint: "写真を押すと選択・解除できます",
      arrangeHint: "動かす写真を1枚選んでください",
    },
    import: {
      mediumAria: "取り込み媒体",
      mediumHint:
        "取り込む写真に付く媒体ラベルです（絞り込みではありません）",
      mediumLabel: "取り込み",
      action: "取り込む",
      digital: "デジタル",
      film: "フィルム",
      chooseImages: "画像ファイルを選択",
      dropHere: "ここにドロップして読み込み",
      retryFailed: "失敗分を再アップロード",
      // 取り込み中の進捗。ここだけ英語の直書きが残っていた。
      progress: (done: number, total: number) =>
        `取り込み中 ${done} / ${total}`,
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
      resultSummary: (addedCount: number, failedCount: number) =>
        `追加 ${addedCount}枚 / 失敗 ${failedCount}枚`,
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
      categoryAll: (count: number) => `すべて（${count}）`,
      seriesAll: "すべてのシリーズ",
      sizeAll: "すべてのサイズ",
      orientationAll: "すべての向き",
      timeAll: "すべての期間",
      mediumAll: "すべての媒体",
      mediumDigital: "デジタル",
      mediumFilm: "フィルム",
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
      seriesCondition: (label: string) => `シリーズ: ${label}`,
      sizeCondition: (label: string) => `サイズ: ${label}`,
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
      more: "その他",
      selected: (count: number) => `選択中 ${count}枚`,
      selectedWithHidden: (count: number, hiddenCount: number) =>
        `選択中 ${count}枚（うち${hiddenCount}枚は絞り込みの外）`,
      recentlyAdded: "今回追加",
      recentlyAddedSelected: (count: number) =>
        `今回追加した${count}枚を選択中`,
      recentlyAddedHeading: (count: number) => `今回追加 ${count}枚`,
      recentlyAddedOutsideFilters:
        "現在の絞り込みに関係なく表示しています",
      endRecentlyAddedDisplay: "表示を終了",
      publish: "公開",
      unpublish: "非公開",
      setCategory: "カテゴリを設定",
      uncategorized: "未分類",
      setSeries: "シリーズを設定",
      noSeries: "シリーズなし",
      draftSuffix: "（下書き）",
      unassign: "割り当て解除",
      size: "サイズ",
      rotate: "回転",
      date: "撮影日",
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
      // まとめる入口が「壊す側」にしか無いと、200枚戻すのに200回マウスを
      // 乗せて狙うことになる。戻すのは取り返しがつくので確認は挟まない。
      restoreAll: "すべて戻す",
      purgeAll: "すべて完全削除",
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
      loading: "写真を読み込んでいます…",
      loadFailed: "写真を読み込めませんでした。",
      retry: "再読み込み",
      noMatches: "条件に合う写真が見つかりません。",
      relaxFilters: "絞り込みや検索語を少しゆるめてみてください。",
      clearFilters: "絞り込みを解除",
      noPhotos: "まだ写真がありません。",
      importHint: "「取り込む」から写真を追加できます。",
      tableHint: "写真一覧に戻ると、「取り込む」から追加できます。",
    },
    reorder: {
      activeLabel:
        "公開ギャラリーの手動順を変更中・1操作ごと自動保存",
      publicOrderLocked:
        "現在の公開並びは手動順ではないため、ここでは並べ替えできません",
      settingsLoading:
        "公開ギャラリーの並び順を確認中のため、まだ並べ替えできません。",
      settingsError:
        "公開ギャラリーの並び順を取得できないため、並べ替えできません。再読み込みしてください。",
      lockedBySort:
        "並びが「手動」以外になっているため、いまは並び替えを保存できません。",
      lockedByFilter:
        "検索・絞り込み中のため、いまは並び替えを保存できません（シリーズ単独の絞り込みなら可）。",
      unlock: "並び替えできる状態に戻す",
      unlockAndArrange: "解除して並べ替える",
      hint:
        "戻したあとは、パソコンでは写真をドラッグ、スマホでは写真の左下の矢印ボタンで並び替えられます。",
      seriesHint:
        "シリーズ内の並び替え — ここでの並びが公開シリーズページの表示順になります",
      seriesPositionHint:
        "位置番号は表示中シリーズ内の番号です。保存時は写真全体の順序へ反映します。",
      saving: "保存中…一覧の確認が終わるまで操作できません",
      saved: "保存済み",
      conflict:
        "別の画面で順序が変わったため保存できませんでした。最新の順序を取り直しました。",
      undo: "直前の並べ替えを元に戻す",
      undoSaving: "元に戻した順序を保存中…",
      undoSaved: "元に戻した順序を保存しました",
      undoFailed:
        "元に戻した順序を保存できませんでした。Undo前の保存済み順へ戻しました。",
      dragHandle: "ドラッグして並べ替え",
      region: "写真の並べ替え操作",
      targetPrompt: "動かす写真を1枚選んでください",
      targetLabel: (position: number) =>
        `${position}番の写真を動かしています`,
      targetPill: "動かす写真",
      positionLabel: (position: number, total: number) =>
        `${position} / ${total} 番目`,
      moveSummary: (from: number, to: number) =>
        `${from}番目から${to}番目へ移動しました`,
      chooseAgain: "選び直す",
      invalidPosition: (total: number) =>
        `1〜${total}の番号を入力してください`,
      mobileTitle: "並べ替え",
      cancelExitWait: "中止して残る",
      waitingToExit: "保存後に終了します",
      exitSaving: "保存しています…完了後に並べ替えを終了します",
      continueWaiting: "このまま待つ",
      stayAfterRefreshFailure: "この画面に残る",
      reloadAfterRefreshFailure: "再読み込みする",
      failedExit: (count: number) =>
        `保存できていない移動が${count}件あります`,
      retryFailedSave: "もう一度保存",
      discardFailedAndExit: "変更を取り消して終了",
      moveFirst: "先頭へ移動",
      movePrevious: "前へ移動",
      moveNext: "後へ移動",
      moveLast: "末尾へ移動",
      moveToPosition: "何番目へ移動",
      positionTitle: "何番目へ移動",
      positionDescription: (total: number) =>
        `全${total}枚のうち、移動先の番号を入力してください。`,
      seriesPositionDescription: (total: number) =>
        `表示中シリーズ${total}枚のうち、移動先の番号を入力してください。`,
      positionInput: "移動先の番号",
      moveAction: "移動する",
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
      missing: "写真の追加に必要な準備が完了していません。",
      detail:
        "この状態では写真を追加できません。同じ操作を繰り返さず、設定担当者へご連絡ください。",
      handoff:
        "連絡時は、この画面のスクリーンショットと、写真を追加しようとした時刻をお送りください。",
      retry: "設定担当者から完了の連絡が来たら再試行する",
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
      editPhoto: "写真を編集",
      sections: {
        basic: "基本",
        classification: "分類",
        details: "詳細",
      },
      close: "写真の詳細を閉じる",
      quick: "よく使う",
      unsaved: "未保存",
      usageAria: "写真の使用状況",
      published: "公開",
      unpublished: "非公開",
      displaySize: "サイズ",
      // 表形式の見出し行。目には見えないが、読み上げソフトには列名として届く。
      selectColumn: "選択",
      thumbnailColumn: "サムネイル",
      uncategorized: "未分類",
      quickCategory: "クイックカテゴリ",
      noCategory: "カテゴリなし",
      quickSeries: "クイックシリーズ",
      noSeries: "シリーズなし",
      metadata: "メタデータ",
      focalPoint: "見せる中心",
      focalPointHint: "正方形・ヒーローなど、切り抜き表示の中心",
      focalPointAria: (label: string) => `見せる中心: ${label}`,
      title: "タイトル",
      titleHint: "Lightbox・SEO・alt に使用",
      titleAria: "タイトル",
      titlePlaceholder: "タイトル未設定",
      camera: "カメラ",
      captureHint: "Lightbox の撮影情報として表示",
      cameraAria: "カメラ",
      lens: "レンズ",
      lensAria: "レンズ",
      copyCapture: "カメラとレンズをコピー",
      pasteCapture: "クリップボードからカメラとレンズを貼り付け",
      copy: "コピー",
      paste: "貼り付け",
      filmDigital: "フィルム / デジタル",
      shotDate: "撮影日",
      shotDateHint:
        "アップロード時にEXIFから自動設定。EXIFが無い写真はここで手入力（任意・空欄可）",
      shotDateAria: "撮影日",
      clearShotDate: "撮影日をクリア",
      clear: "クリア",
      description: "説明",
      descriptionHint: "Lightbox の写真説明（任意）",
      descriptionAria: "説明",
      descriptionPlaceholder: "写真の説明…",
      saving: "保存中…",
      saved: "保存しました",
      save: "保存",
      reset: "元に戻す",
      duplicate: "この写真を複製",
      saveFailed: "保存に失敗しました。もう一度お試しください。",
      retry: "やり直す",
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
      fileInfo: "ファイル情報",
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
      reorderRefreshFailed:
        "順序は保存されましたが、最新の一覧を確認できませんでした。再読み込みしてください。",
      invalidManualOrder:
        "保存済みの手動順を確認できないため、並べ替えを開始できません。再読み込みしてください。",
      refreshFailed:
        "操作に失敗しました。通信状況を確認するか、再ログインしてください。",
      switchPhotoConfirm:
        "保存していない編集があります。保存せずに別の写真へ移動しますか？",
      switchPhotoAction: "保存せず移動",
      closeInspectorConfirm:
        "保存していない編集があります。保存せずに閉じますか？",
      closeInspectorAction: "保存せず閉じる",
    },
  },
  hero: {
    error:
      "操作に失敗しました。通信状況を確認するか、再ログインしてください。",
    slidesTitle: "トップページの写真",
    danglingWarning: (count: number) =>
      `${count} 件のヒーロー選択が削除済み（ゴミ箱内含む）の写真を参照しています。公開サイトには表示されず、ゴミ箱から復元すると突然ヒーローに再表示されます。`,
    cleaningUp: "整理中...",
    removeFromSelection: "選択から外す",
    slidesHint:
      "トップページのカルーセルに表示する写真。ドラッグで並び替え。未選択の場合はギャラリーの先頭から自動表示。",
    noneSelected: "ヒーロー写真が未設定です",
    selectFromGalleryHint: "下のギャラリーから写真を選んでください",
    movePrevious: "前へ移動",
    moveNext: "後へ移動",
    removeAria: "ヒーローから削除",
    galleryTitle: "ギャラリー",
    galleryHint: "クリックでヒーローに追加 / 解除",
    noPhotosYet: "まだ写真がありません。Libraryから追加できます。",
    toggleAria: (name: string, isHero: boolean) =>
      `${name} をヒーローから${isHero ? "外す" : "追加"}`,
  },
  profile: {
    selectImageFile: "画像ファイルを選択してください",
    uploadFailed: "プロフィール写真のアップロードに失敗しました",
    selectPhotoAria: "プロフィール写真を選択",
    photoTitle: "プロフィール写真（Aboutページ）",
    uploadPhoto: "写真を選ぶ",
    portraitRecommendation: "縦3:4がおすすめ",
    fields: {
      nameLabel: "名前（日本語）",
      namePlaceholder: "写真家の名前",
      nameKataLabel: "振り仮名 (カタカナ)",
      nameKataPlaceholder: "エグチアキ",
      nameEnLabel: "名前（英語）",
      nameEnPlaceholder: "写真家の名前",
      bioLabel: "自己紹介",
      bioPlaceholder: "自己紹介を書く",
      bioEnLabel: "自己紹介（英語）",
      bioEnPlaceholder:
        "Write your bio in English... (blank falls back to Bio)",
      statementLabel: "作家ステートメント",
      statementPlaceholder: "空欄でも崩れません。後から追記OK",
      statementEnLabel: "作家ステートメント (EN)",
      statementEnPlaceholder:
        "English version (blank falls back to Statement)",
      gearLabel: "使用機材 (1行に1つ)",
      gearPlaceholder: "PENTAX 67\nLeica M6\n...",
      instagramLabel: "Instagram",
      instagramPlaceholder: "https://instagram.com/...",
      xUrlLabel: "X URL",
      xUrlPlaceholder: "https://twitter.com/...",
      noteUrlLabel: "note URL",
      noteUrlPlaceholder: "https://note.com/...",
    },
  },
  categories: {
    description:
      "ギャラリーのフィルターとして使用。↑↓で並び替え（この順で表示されます）。",
    empty: "まだカテゴリがありません。下の入力欄から追加できます。",
    moveUp: "上へ移動",
    moveDown: "下へ移動",
    deleteAria: (label: string) => `${label} を削除`,
    newCategory: "新しいカテゴリ",
    label: "名前",
    labelAria: "カテゴリ名",
    slug: "スラッグ",
    slugAria: "スラッグ",
    add: "カテゴリを追加",
    deleteConfirm: (label: string) => `「${label}」を削除しますか？`,
    deleteUncategorizes:
      "この分類が付いた写真は「未分類」になります。写真は消えませんが、分類は元に戻せません。",
    deleteUncategorizesCount: (count: number) =>
      `写真${count}枚が「未分類」になります。写真は消えませんが、分類は元に戻せません。`,
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
    title: "タイトル",
    titleAria: "シリーズのタイトル",
    slug: "スラッグ",
    slugHint: "URL（/series/◯◯）に使用",
    slugAria: "シリーズのスラッグ",
    subtitle: "サブタイトル",
    subtitleHint: "任意のサブタイトル",
    subtitleAria: "サブタイトル",
    statement: "ステートメント",
    statementHint: "シリーズのコンセプト文（改行可）",
    statementAria: "ステートメント",
    statementPlaceholder: "このシリーズについて…",
    coverPhoto: "表紙写真",
    coverHint: "シリーズ一覧の表紙。未設定ならシリーズ先頭の写真を自動使用",
    automaticCover: "なし（自動）",
    noPhotos: "写真がありません",
    selectedCover: (name: string) => `選択中: ${name}`,
    layoutTheme: "レイアウトとテーマ",
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
    saving: "保存中…",
    save: "保存",
    close: "閉じる",
    newSeries: "新しいシリーズ",
    newTitleAria: "新しいシリーズのタイトル",
    newSlugAria: "新しいシリーズのスラッグ",
    add: "シリーズを追加",
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
  pricing: {
    moveUp: "上へ移動",
    moveDown: "下へ移動",
    published: "公開",
    draft: "下書き",
    edit: "編集",
    deleteAria: (title: string) => `${title} を削除`,
    titleLabel: "タイトル",
    titleAria: "プランのタイトル",
    titlePlaceholder: "ポートレート",
    priceLabel: "料金",
    priceHint: "自由記述（例: ¥15,000〜）",
    priceAria: "価格",
    descriptionLabel: "説明文",
    descriptionHint: "プランの説明（任意）",
    descriptionAria: "プランの説明",
    descriptionPlaceholder: "2時間・データ20枚 など",
    featuresLabel: "含まれるもの",
    featuresHint: "1行に1項目（箇条書き）",
    featuresPlaceholder: "撮影2時間\nデータ20枚\nレタッチ込み",
    noteLabel: "補足",
    noteHint: "注意書きなど（任意）",
    notePlaceholder: "交通費別途",
    add: "プランを追加",
    empty:
      "まだ料金プランがありません。下の「プランを追加」から追加できます。",
    deleteConfirm: (title: string) => `「${title}」を削除しますか？`,
    errors: {
      addFailed: "追加に失敗しました。",
      saveFailed: "保存に失敗しました。",
      deleteFailed: "削除に失敗しました。",
      reorderFailed: "並び替えの保存に失敗しました。",
    },
  },
  service: {
    topWorksEmpty: "公開中の写真はまだありません",
    topWorksSelectedSuffix: "（選択中）",
    arrayControls: {
      up: "上へ",
      down: "下へ",
      remove: "削除",
    },
    hero: {
      label: "ラベル",
      headingHint: "見出し（改行で行分割）",
      description: "説明文",
      factsHint: "冒頭に出す要点（価格・含まれるもの・公開目安）",
      factLabel: (n: number) => `要点 ${n}: ラベル`,
      factBody: (n: number) => `要点 ${n}: 内容`,
      ctaPricing: "CTA: 料金",
      ctaExample: "CTA: 実例",
    },
    examples: {
      sectionTitle: "実例セクション",
      label: "ラベル",
      heading: "見出し",
      description: "説明文",
      ctaLabel: "CTA",
      linksHint: "実例リンク",
      linkTitle: "タイトル",
      linkBody: "説明",
      linkHref: "リンク先",
      add: "追加",
    },
    painSolutions: {
      sectionTitle: "こんな悩み / このサイトなら",
      label: "ラベル",
      concernTitle: "悩みタイトル",
      concernBody: "悩み本文",
      solutionTitle: "解決タイトル",
      solutionBody: "解決本文",
      add: "追加",
    },
    pricing: {
      sectionTitle: "料金",
      intro:
        "/portfolio-kit 販売ページの料金です。Contactページの料金は サイト > Pricing で編集します。",
      label: "ラベル",
      plan: (n: number) => `プラン ${n}`,
      planName: "プラン名",
      price: "価格",
      description: "説明文",
      stripePaymentLink: "Stripe の決済リンク",
      features: "特徴（1行ごとに箇条書き）",
      ctaText: "CTA文言",
      recommended: "おすすめ表示",
      add: "プラン追加",
      noteOnline: "決済後の案内文（Stripe有効時）",
      noteOffline: "決済準備中の案内文",
      disclaimer: "外部費用の注意書き",
    },
    purchaseFlow: {
      sectionTitle: "購入後の流れ",
      label: "ラベル",
      heading: "見出し",
      description: "説明文",
      stepsHint: "ステップ",
      stepTitle: "タイトル",
      stepBody: "本文",
      add: "ステップ追加",
      footnote: "脚注",
    },
    faq: {
      label: "ラベル",
      question: "質問",
      answer: "回答",
      add: "質問追加",
    },
    finalCta: {
      sectionTitle: "最下部CTA",
      heading: "見出し",
      description: "説明文",
      ctaOnline: "CTA（Stripe有効時）",
      ctaOffline: "CTA（オフライン時）",
      snsHint: "SNSリンク",
      add: "SNS追加",
      snsLabelAria: "SNSリンクの表示名",
      snsUrlAria: "SNSリンクのURL",
    },
    stickyCta: {
      leftText: "左側テキスト",
      pricingCta: "料金リンク文言",
      ctaOnline: "CTA（Stripe有効時）",
      ctaOffline: "CTA（オフライン時）",
    },
    adminShowcase: {
      sectionTitle: "管理画面紹介",
      label: "ラベル",
      heading: "見出し",
      description: "説明文",
      featuresHint: "機能リスト",
      featureTitle: "タイトル",
      featureBody: "説明",
      add: "機能追加",
    },
  },
  settingsBasic: {
    groupTitle: "基本・見た目",
    resetToDefault: "初期設定に戻す",
    adminPasswordTitle: "管理パスワード",
    adminPasswordHint: "ログイン用パスワードはサーバー側で管理します。設定名:",
    previewTitle: "プレビュー",
    units: {
      columns: "列",
      photos: "枚",
      px: "px",
      pxPerSec: "px/秒",
    },
    typoControl: {
      numericInputAriaLabel: (label: string) => `${label}（数値入力）`,
      opacityTitle: (percent: number) => `0〜1（現在 ${percent}%）`,
      unitTitle: (unit: string) => `単位: ${unit}`,
    },
    contactValidation: {
      email: "メールアドレスの形式を確認してください。空欄にすると表示しません。",
      endpoint:
        "送信先は https:// で始まる有効なURLにしてください。空欄にするとフォームを表示しません。",
    },
    siteBasics: {
      title: "サイト基本情報",
      fields: {
        siteName: {
          label: "サイト名（ロゴ・日本語）",
          placeholder: "Photographer Name",
          hint: "",
        },
        siteNameEn: {
          label: "サイト名（英語表記）",
          placeholder: "Photographer Name",
          hint: "",
        },
        heroSubtitle: {
          label: "トップの肩書き",
          placeholder: "Photography",
          hint: "",
        },
        siteDescription: {
          label: "サイトの説明文",
          placeholder: "Photography portfolio.",
          hint: "検索結果・SNSシェア時に出る。空欄ならサイト名から自動生成",
        },
        footerText: {
          label: "フッターの文",
          placeholder: "空欄 = © 今年 サイト名（自動）",
          hint: "",
        },
        contactIntro: {
          label: "お問い合わせの案内文",
          placeholder: "Feel free to...",
          hint: "",
        },
        contactIntroEn: {
          label: "お問い合わせの案内文（英語）",
          placeholder: "空欄なら日本語文を表示",
          hint: "",
        },
        contactNote: {
          label: "Contact 添え書き",
          placeholder:
            "「まだ決まっていないけれど相談したい」という段階でも歓迎です。",
          hint: "",
        },
        contactNoteEn: {
          label: "Contact 添え書き (英語)",
          placeholder: "空欄なら日本語文を表示",
          hint: "",
        },
        contactFlow: {
          label: "依頼の流れ",
          placeholder: "ご相談 → すり合わせ → 撮影 → 納品",
          hint: "",
        },
        contactFlowEn: {
          label: "依頼の流れ (英語)",
          placeholder: "空欄なら日本語文を表示",
          hint: "",
        },
        contactEnglishNote: {
          label: "英語対応の一言",
          placeholder: "English inquiries welcome.",
          hint: "JP/EN どちらでも常時表示",
        },
        contactMessagePlaceholder: {
          label: "Message 入力例",
          placeholder: "例: 希望する撮影の内容 / 希望日・場所",
          hint: "",
        },
        contactEmail: {
          label: "連絡先メールアドレス",
          placeholder: "you@example.com",
          hint: "",
        },
        formspreeUrl: {
          label: "お問い合わせフォームの送信先",
          placeholder: "https://formspree.io/f/...",
          hint: "空欄ならフォームを表示しない",
        },
        siteUrl: {
          label: "公開サイトの基準URL",
          placeholder: "https://example.com",
          hint: "空欄ならサーバー設定を使う",
        },
        googleSiteVerification: {
          label: "Google サイト確認コード",
          placeholder: "例: AbC123xyz...",
          hint: 'Search Console「HTMLタグ」方式の content="..." の中身だけを貼り付け。保存後すぐ全ページの <head> に出力されます（画像サイトマップの登録に必要）',
        },
        footerCtaLabel: {
          label: "フッター導線テキスト（任意）",
          placeholder: "例: 撮影のご相談はこちら",
          hint: "",
        },
        templateCreditLabel: {
          label: "テンプレート購入クレジット",
          placeholder: "Site template by Aki Eguchi",
          hint: "",
        },
        templateCreditUrl: {
          label: "テンプレート購入クレジット URL",
          placeholder: "https://akieguchi.com/portfolio-kit",
          hint: "無効なURLは文字だけ表示",
        },
      },
    },
    portfolioKit: {
      title: "Portfolio Kit",
      fieldLabel: "Portfolio Kitの表示",
      fieldHint:
        "自動はakieguchi.comで直リンクとクレジットだけ有効、ナビは非表示です。「表示」はページとナビを有効化、「非表示」はページも無効化します",
      modeLabels: {
        auto: "自動（既定）",
        on: "表示",
        off: "非表示",
      },
    },
    hero: {
      title: "Hero（ファーストビュー）",
      intro:
        "トップページ最上部の写真表示です。ここで選んだ見せ方が、サイトに来た人が最初に見る1画面の印象を決めます。",
      summaryFullscreen: (modeName: string) => `${modeName}・フルスクリーン`,
      summaryNormal: (modeName: string, height: string) =>
        `${modeName}・通常・高さ${height}%`,
      modeLabel: "表示モード",
      modeHint:
        "カルーセル/1枚絵=従来 / 静謐グリッド・エディトリアル・没入型=新レイアウト。切替は保存後に反映",
      modeNames: {
        carousel: "カルーセル",
        single: "1枚絵",
        "quiet-grid": "静謐グリッド",
        editorial: "エディトリアル",
        immersive: "没入型",
      },
      modeDescriptions: {
        carousel: "複数写真が順番に切り替わる",
        single: "1枚を大きく固定表示",
        "quiet-grid": "複数枚を整然と見せる",
        editorial: "大小をつけた写真集風",
        immersive: "画面いっぱいに写真を見せる",
      },
      randomLabel: "HEROをランダムに",
      randomHint:
        "「選んだ順」はいま登録してあるHERO写真をその順で出します。「順番だけ」は同じ写真のまま並びを毎回変え、「全体から」は公開中の写真すべてから毎回選びます（HEROに選んでいない写真も出ます）。並びは訪問ごとに変わり、見ている最中は変わりません",
      randomOptions: {
        off: "選んだ順",
        shuffle: "順番だけ",
        any: "全体から",
      },
      speedLabel: "登場する速さ",
      speedHint: "トップページを開いたときに、写真と文字が静かに現れる速さです",
      speedAriaLabel: (label: string) => `登場する速さ: ${label}`,
      speedNames: {
        slow: "ゆっくり",
        standard: "標準",
        quick: "すばやく",
      },
      orderLabel: "出てくる順番",
      orderHint:
        "文字と写真のどちらを先に見せるかを選びます。標準は「写真から」です",
      orderAriaLabel: (label: string) => `出てくる順番: ${label}`,
      orderNames: {
        "text-first": "文字から",
        "photo-first": "写真から",
        together: "同時に",
      },
      displayModeLabel: "画面の使い方",
      displayModeHint:
        "フルスクリーン=最初の1画面を写真が覆う（下の「高さ」設定は無視されます）",
      displayModeOptions: {
        normal: "通常（高さ設定に従う）",
        fullscreen: "フルスクリーン",
      },
      heightLabel: "高さ",
      heightHint:
        "ビューポート高に対する割合。スマホは自動で上限調整。フルスクリーン時は無効",
      titlePositionLabel: "名前の表示位置",
      titlePositionHint:
        "1枚絵/フルスクリーンでは写真上の位置、カルーセル（通常）では写真下の文字寄せとして効きます",
      titlePositionOptions: {
        center: "中央（既定）",
        "bottom-left": "左下",
        "bottom-right": "右下",
        "top-left": "左上",
        "top-right": "右上",
      },
      scrollEffectLabel: "スクロール演出",
      scrollEffectHint:
        "トップを下にスクロールしたときの写真の動き。OS設定で「視差効果を減らす」の人には自動で無効になります",
      scrollEffectOptions: {
        none: "なし（既定）",
        fade: "フェード",
        sink: "沈み込み",
        parallax: "パララックス",
      },
      overlayLabel: "オーバーレイ",
      overlayHint: "1枚絵モードで名前を読みやすくする暗いグラデーション",
      overlayOptions: {
        on: "あり",
        off: "なし",
      },
    },
    nav: {
      title: "ナビゲーション（位置・ホバー）",
      summary: (positionName: string, hoverName: string) =>
        `${positionName}・${hoverName}`,
      intro:
        "全ページ共通のメニューです（PC表示）。位置とホバー時の反応を変えられます。スマホでは位置に関わらず常にハンバーガーメニューです。",
      positionLabel: "位置",
      positionNames: {
        top: "上",
        left: "左 縦置き",
        bottom: "下 固定",
      },
      positionDescriptions: {
        top: "画面上部に固定",
        left: "画面左に縦のメニュー",
        bottom: "画面下部に固定",
      },
      hoverLabel: "ホバー演出",
      hoverHint: "マウスを乗せたとき/キーボードフォーカス時の反応",
      hoverOptions: {
        fade: "フェード（既定）",
        underline: "下線が伸びる",
        dot: "点がともる",
        blur: "にじみ→くっきり",
      },
      headerBgLabel: "ページ最上部の帯",
      headerBgHint:
        "いちばん上にいるときの、メニューの後ろの地。下へスクロールすると、どれを選んでもぼかした帯に戻ります（本文の上でリンクが読めなくなるため）",
      headerBgOptions: {
        solid: "帯を出す（既定）",
        fade: "薄いフェード",
        none: "文字だけ",
      },
      headerBgNote:
        "帯が消えて写真が上まで伸びるのは、TOPのHERO表示を「全画面」にしているときだけです。全画面でない場合、帯の裏は本文の余白なので見た目はほとんど変わりません。文字のまわりには暈しが入りますが、「文字だけ」は写真の明暗に左右されます。明るい配色のまま暗い写真を使うと、メニューが沈んで読みにくくなります（実測で確認）。迷うときは「薄いフェード」が安全です。",
      hoverShortNames: {
        fade: "フェード",
        underline: "下線",
        dot: "点",
        blur: "にじみ",
      },
    },
    mood: {
      title: "作風を選ぶ",
      summary: "まとめて着せ替える",
      intro:
        "写真の並べ方・トップの見せ方・メニューの反応・地の質感・About と Contact の構成を、まとめて入れ替えます。ひとつずつ探さなくても、雰囲気の違う出発点から始められます。",
      names: {
        quiet: "しずか",
        editorial: "雑誌",
        gallery: "展示",
        darkroom: "暗室",
      },
      descriptions: {
        quiet: "既定に近い、静かな標準。迷ったらここから",
        editorial: "左に寄せた誌面。紙の地を薄く敷く",
        gallery: "白い展示壁。等間隔に並べ、覆いを外す",
        darkroom: "写真を画面いっぱいに。帯を消し、粒子を乗せる",
      },
      note:
        "押すと下の各設定が書き換わりますが、まだ保存はされません。プレビューで確かめてから保存してください。気に入らなければ「変更を破棄」で元に戻せます。色と書体は変えないので、選び直した配色はそのまま残ります。",
    },
    pageLayout: {
      title: "ページの構成",
      intro:
        "色や文字の大きさではなく、写真と文章の置き方そのものを変えます。同じ設定でも構成が違えば、サイトの印象は大きく変わります。",
      aboutLabel: "About（プロフィール）の構成",
      aboutHint: "顔写真と自己紹介の並べ方",
      aboutOptions: {
        side: "写真を左（既定）",
        stack: "写真を上に大きく",
        quiet: "写真なし・文章だけ",
      },
      aboutNote:
        "プロフィール写真を登録していないときは、どれを選んでも「写真なし」で表示します（空の四角を置かないため）。",
      contactLabel: "Contact（お問い合わせ）の構成",
      contactHint: "説明文とフォームの並べ方",
      contactOptions: {
        center: "中央・細め（既定）",
        left: "左寄せ",
        split: "説明を左・フォームを右",
      },
      contactNote:
        "2列になるのはPCの幅があるときだけで、スマホでは説明の下にフォームが続きます。説明文（英語での歓迎・導入文・ひとこと・依頼の流れ）をどれも書いていない場合は、左が空くのを避けて「左寄せ」で表示します。",
      seriesLabel: "Series（シリーズ一覧）の札",
      seriesHint: "作品群の入口に並ぶ、表紙と題名の組み方",
      seriesOptions: {
        caption: "表紙の下に題名（既定）",
        overlay: "題名を表紙に重ねる",
        wide: "3:2 の横長",
      },
      seriesNote:
        "重ねるときは、文字が沈まないように表紙の下側へ暗い幕を敷きます。それでも明るい表紙では読みにくくなることがあるので、迷うときは「表紙の下に題名」が安全です。表紙を登録していないシリーズは、空の四角ではなく題名を出します。",
      viewerLabel: "写真ビューアの壁",
      viewerHint: "写真を大きく開いたときの地の色",
      viewerOptions: {
        wall: "白い展示壁（既定）",
        cinema: "暗室（黒地）",
        paper: "生成りの紙",
      },
      viewerNote:
        "壁と文字の色は必ず対で替わるので、どれを選んでも操作は読めます。サイト全体のテーマ（明／暗）とは切り離してあり、ビューアだけこの設定に従います。",
      statementLabel: "TOPに作家の言葉を置く",
      statementHint: "Profile の「作家ステートメント」をトップページにも出します",
      statementOptions: {
        off: "出さない（既定）",
        before: "作品の前",
        after: "作品の後",
      },
      statementNote:
        "文章は Profile の「作家ステートメント」をそのまま使います（同じ文を2箇所に書かせると必ず片方が古くなるため）。まだ書いていない場合は何も出ません。",
      titleLabel: "各ページの見出しの型",
      titleHint: "Gallery / Series / About / Contact の冒頭に出る見出し",
      titleOptions: {
        label: "小さな大文字・中央（既定）",
        left: "小さな大文字・左寄せ",
        display: "大きな見出し・左",
        hidden: "出さない",
      },
      titleNote:
        "「出さない」でも、読み上げのための見出しは目に見えない形で残ります。ページは本文から始まります。",
      footerLabel: "フッターの並べ方",
      footerHint: "全ページの終わりに出る、SNSと著作表示の並び",
      footerOptions: {
        center: "中央に積む（既定）",
        left: "左に寄せる",
        split: "SNSを左・著作表示を右",
      },
    },
    spacing: {
      title: "余白・スペーシング",
      intro:
        "ページの「間」の量を倍率で調整します。1.0 が現在のリズム。スマホは元の比率のまま縮みます。",
      heroBottomLabel: "ヒーロー直下",
      heroBottomHint: "ヒーロー写真と作品セクションの間",
      sectionGapLabel: "セクション間",
      sectionGapHint: "作品〜CTA〜フッターなどセクション同士の基本余白",
      pageTopLabel: "ページ冒頭",
      pageTopHint:
        "ギャラリー・シリーズ・About・Contact など各ページ最初の「ため」",
      footerTopLabel: "フッター上",
      footerTopHint: "ページ末尾とフッターの間",
      ratioControlLabel: "倍率",
    },
    bgTexture: {
      title: "背景の質感（グレイン）",
      intro:
        "写真以外のサイト背景に、ごく薄いノイズを重ねます。写真自体や、写真を拡大表示する画面には影響しません。",
      textureLabel: "テクスチャ",
      textureHint:
        "背景にごく薄いノイズを敷きます。写真の上や、写真を拡大表示する画面には乗りません",
      names: {
        none: "なし",
        "grain-fine": "フィルム粒子",
        "grain-coarse": "粗い紙",
        paper: "和紙・繊維",
        marble: "大理石調",
        mist: "霞（かすみ）",
      },
      descriptions: {
        none: "質感を足さない",
        "grain-fine": "細かく均一な粒子感",
        "grain-coarse": "ざらついた紙の繊維感",
        paper: "縦に流れる繊維状のムラ",
        marble: "波紋のような上品なムラ",
        mist: "柔らかい雲のようなムラ",
      },
      previewNote:
        "見本は模様の違いが分かるよう少し強めに表示しています。実際の濃さは下の「濃度」で調整します。",
      opacityLabel: "濃度",
      opacityHint: "0.06前後がおすすめ。上げすぎると写真より質感が目立ちます",
    },
    fade: {
      title: "写真のフェードイン",
      intro: "ギャラリーなどで写真がスクロールして画面に入ってきたときの動きです。",
      appearanceLabel: "現れ方",
      appearanceHint:
        "コラージュのような枠・傾きつきレイアウトでは「浮き上がり」より「フェード」「なし」が自然に見えます",
      names: {
        fade: "フェード",
        none: "なし",
        rise: "浮き上がり",
        scale: "ズーム",
      },
      descriptions: {
        fade: "透明から少しずつ現れる",
        none: "即表示・動きなし",
        rise: "少し下から上がってくる",
        scale: "小さくから拡大して現れる",
      },
    },
    galleryLayout: {
      title: "ギャラリー配置",
      introPrefix: "ページごとに写真の並べ方を選べます。プレビューで",
      introTop: "トップ",
      introSuffix:
        "ページを開くと即反映。列数・大きさ・間隔はどの配置にも効きます。",
      targetLabel: "対象ページ",
      categoryLabels: {
        aligned: "整列グリッド",
        editorial: "写真集レイアウト",
      },
      descriptions: {
        grid: "元の縦横比を保って整列",
        "clean-grid": "Instagram風・すべて正方形",
        "portrait-grid": "縦長4:5・人物写真向け",
        "landscape-grid": "横長3:2・風景写真向け",
        // 「3列」と書いていたが嘘だった（2026-08-09 オーナー報告・実測で確認）。
        // マソンリーも他の配置と同じく最大列数に従う。設定プレビューの枠が
        // 狭くて3列までしか入らないため、固定に見えていた。
        masonry: "縦横比を保って敷き詰め・列数は最大列数に従う",
        justified: "縦横比を保ち行ごとに敷き詰め・S/M/Lで大小",
        mosaic: "S/M/L混在・抜け感のある並び",
        scroll: "1枚ずつ大きく＋情報を添えて表示",
        stagger: "1枚ずつ左右互い違いに配置",
        editorial: "2枚1組・左大右小の見開き風",
        collage: "重なりと角度でスナップ写真風",
        "large-format": "2列の大判表示＋キャプション",
      },
      topWorksHeading: "トップ（Works）に出す写真",
      topWorksModeLabel: "選び方",
      topWorksModeHint:
        "自動=ギャラリーの並び順の先頭9枚 / ランダム=訪問ごとに入れ替え / 手動=下で選んだ写真を選んだ順に表示。最上部のヒーロー写真とは別の設定です",
      topWorksModeOptions: {
        auto: {
          name: "並び順から自動",
          desc: "ギャラリーの並びの先頭9枚",
        },
        random: {
          name: "ランダム",
          desc: "訪問ごとにシャッフル",
        },
        manual: {
          name: "手動で選択",
          desc: "下で写真を選ぶ",
        },
      },
      topWorksPickerLabel: "トップに出す写真",
      topWorksPickerHint:
        "クリックで選択/解除。番号の順（選んだ順）に表示されます。未選択のあいだは自動と同じ表示",
      initialCountLabel: "初期表示枚数",
      initialCountHint:
        "トップページのヒーロー下 Works 欄に最初から表示する写真の枚数。スクロールするとさらに追加表示されます",
      gridHeading: "ギャラリーの列数・大きさ・余白",
      maxColumnsLabel: "最大列数",
      maxColumnsHint:
        "広い画面で最大何列まで並べるか。実際の列数は「表示できる幅 ÷ 写真1枚の最小幅」で決まり、足りなければ自動で減ります（スマホは1〜2列）。配置の種類は関係なく、マソンリーも同じ",
      columnsCappedByPreview: (previewWidth: number, fits: number) =>
        `このプレビューは幅 ${previewWidth}px なので、ここでは最大 ${fits} 列までしか出ません。公開サイトの実際の幅ではもっと並びます。ここで列を増やしたいときは「写真の大きさ」を下げてください`,
      photoSizeLabel: "写真の大きさ",
      photoSizeControlLabel: "大きさ",
      photoSizeHint: "大きくすると1枚が広くなり、その分列数が自動で減ります",
      gapLabel: "間隔",
      gapControlLabel: "余白倍率",
      gapHint: "写真同士の余白の倍率（0.2=詰める / 3.0=広い）",
      topGridHeading:
        "トップ（Works）の列数・大きさ・余白 — 動かすまではギャラリーと同じ値",
      topMaxColumnsLabel: "最大列数（トップ）",
      topMaxColumnsHint: "トップ下部の作品の最大列数。ギャラリーとは独立です",
      topPhotoSizeLabel: "写真の大きさ（トップ）",
      topPhotoSizeHint: "トップ下部の作品の大きさ。ギャラリーとは独立です",
      topGapLabel: "間隔（トップ）",
      topGapHint: "トップ下部の作品の余白倍率。ギャラリーとは独立です",
      // 「コラージュ」と書いていたが、collage は抜け頻度もサイズの緩急も
      // 読んでいない。選んでも動かないつまみを、動くと書かない（2026-08-07）。
      mosaicHeading: "モザイクだけの調整",
      emptyRateLabel: "抜け（空セル）の頻度",
      emptyRateControlLabel: "抜け頻度",
      emptyRateHint:
        "0で抜けなし＝詰める。大きいほど余白が増える。スマホでは自動的に控えめになります",
      sizeVariationLabel: "サイズの緩急",
      sizeVariationControlLabel: "緩急の強さ",
      sizeVariationHint:
        "S/M/L の大きさの差をどれだけ強調するか。0=ほぼ均一 / 1.0=メリハリ最大",
      shuffleLabel: "配置のシャッフル",
      shuffleHint:
        "写真は同じまま、抜けの入る位置を別パターンに変えます。今の配置がイマイチなら押してみてください",
      shuffleButton: "配置をシャッフル",
    },
    seriesSection: {
      title: "シリーズ",
      navLabel: "ナビに「Series」を表示",
      navHint:
        "「自動」は公開シリーズが1つでもあればリンクを表示します（既定）。「表示」は常に表示、「非表示」は常に隠します。シリーズの作成・写真割り当ては上部の Series タブ・Library のインスペクタから",
      navOptions: {
        auto: "自動",
        on: "表示",
        off: "非表示",
      },
      gridIntroPrefix: "シリーズ一覧（表紙写真のグリッド）の見せ方。プレビューの",
      gridIntroSuffix:
        "ページに反映されます。タイルは表紙写真のみ（文字なし）。表紙未設定のシリーズは先頭写真が自動で使われます。",
      columnsPcLabel: "シリーズ列数（PC）",
      columnsPcHint: "タイルを大きく見せたいなら少なめ（2〜3列推奨）",
      columnsPcControlLabel: "PC 列数",
      columnsMobileLabel: "シリーズ列数（スマホ）",
      columnsMobileHint: "スマホ表示時の列数",
      columnsMobileControlLabel: "スマホ 列数",
      excludeLabel: "シリーズの写真をギャラリーに出すか",
      excludeHint:
        "「出さない」にすると、どれかのシリーズに入れた写真は Gallery ページに並ばなくなります。シリーズはシリーズのページで見せ、Gallery にはどこにも属さない写真だけを並べたいときに使います",
      excludeOptions: {
        show: "出す",
        hide: "出さない",
      },
      streamIntro:
        "TOP ページで、シリーズの表紙写真とキャプションを横へゆっくり流す帯。触れている間は止まり、押すとそのシリーズへ入ります。OS で「視差効果を減らす」を選んでいる人には流さず、自分で横へ送れる帯として出ます。",
      streamPlaceLabel: "TOP に流す",
      streamPlaceHint: "Works（写真の並び）の前と後、どちらに置くか",
      streamPlaceOptions: {
        off: "出さない",
        before: "Works の前",
        after: "Works の後",
      },
      streamLabelLabel: "帯の見出し",
      streamLabelHint: "空欄なら Series",
      streamCaptionLabel: "帯にタイトルを出す",
      streamCaptionHint: "写真だけにするか、下にシリーズ名を添えるか",
      streamCaptionOptions: {
        on: "出す",
        off: "写真だけ",
      },
      streamSpeedLabel: "流れる速さ",
      streamSpeedHint:
        "1秒に何px流れるか。シリーズを増やしても体感の速さは変わりません",
      streamSpeedControlLabel: "速さ",
      streamHeightLabel: "帯の写真の高さ",
      streamHeightHint: "大きいほど1枚が大きく、同時に見える数は減ります",
      streamHeightControlLabel: "高さ",
      orderIntro:
        "写真の並び順。「手動順」は Library でドラッグした順番。シリーズごとに上書きしたい場合は Series タブの各シリーズ編集から設定できます。",
      gallerySortLabel: "ギャラリーの並び順",
      gallerySortHint: "ギャラリーページ・トップの写真の並べ方",
      seriesSortLabel: "シリーズ内の並び順",
      seriesSortHint:
        "各シリーズ詳細ページの写真の並べ方（シリーズ側で個別設定もできます）",
      sortOptions: {
        manual: "手動順（D&D）",
        date_desc: "撮影日↓新しい順",
        date_asc: "撮影日↑古い順",
        upload_desc: "アップロード↓新しい順",
        random: "ランダム",
      },
    },
  },
  settingsIntegrations: {
    groupTitle: "連携・販売",
    visibilityOn: "表示",
    visibilityOff: "非表示",
    note: {
      title: "note連携",
      intro:
        "note に投稿すると最新記事が About ページの「Journal」に自動表示されます（30分キャッシュ）。取得失敗時はセクションが消えるだけでサイトは壊れません。",
      visibilityLabel: "表示",
      visibilityHint: "About ページに最新記事を表示するか",
      usernameLabel: "note ユーザー名",
      usernameHint: "note.com/◯◯ の ◯◯ 部分（例: chi_aki_zip）",
      usernamePlaceholder: "chi_aki_zip",
      displayCountLabel: "表示件数",
      displayCountHint: "一覧に表示する記事数",
      countControlLabel: "件数",
      countUnit: "件",
    },
    print: {
      title: "プリント販売",
      intro:
        "外部ストア（BOOTH等）への控えめなリンクを About ページに表示します。未設定なら何も表示されません。",
      visibilityLabel: "表示",
      visibilityHint: "About ページにプリント購入リンクを表示するか",
      storeUrlLabel: "ストアURL",
      storeUrlHint: "BOOTH等の販売ページURL",
      storeUrlPlaceholder: "https://...",
      linkLabelLabel: "リンク文言",
      linkLabelHint: "ボタンの表示テキスト",
      linkLabelPlaceholder: "プリントを購入する",
      descriptionLabel: "説明文（任意）",
      descriptionHint: "サイズ・価格の概要など",
      descriptionAria: "プリント説明文",
      descriptionPlaceholder: "A4 / ¥3,000〜 ...",
    },
    cta: {
      title: "撮影依頼への案内",
      intro:
        "トップ・ギャラリー・シリーズ各ページの末尾に「撮影のご依頼」への導線を表示します。閲覧者が作品を見終えた直後に依頼へつなげる動線です。",
      visibilityLabel: "表示",
      visibilityHint: "各ページ末尾に依頼CTAを表示するか",
      headingLabel: "見出し",
      headingHint: "例: 撮影のご依頼 / Work with me",
      headingAria: "CTA見出し",
      headingPlaceholder: "撮影のご依頼",
      bodyLabel: "本文（任意）",
      bodyHint: "依頼を後押しする一言。撮影ジャンル・対応範囲など",
      bodyAria: "CTA本文",
      bodyPlaceholder: "ポートレート・作品撮り・取材など、お気軽にご相談ください。",
      buttonLabel: "ボタン文言",
      buttonHint: "Contact ページへのリンク文言",
      buttonAria: "CTAボタン文言",
      buttonPlaceholder: "お問い合わせ",
    },
  },
  settingsDesign: {
    groupTitle: "デザイン・文言",
    themeColors: {
      title: "背景・文字色",
      backgroundLabel: "背景色",
      backgroundSwatchAria: "背景色",
      backgroundHexAria: "背景色（HEX）",
      textLabel: "文字色",
      textSwatchAria: "文字色",
      textHexAria: "文字色（HEX）",
      darkLabel: "暗い表示のときの色",
      darkHint:
        "スマホやパソコンが暗い設定の人には、この色で表示されます。空のままなら黒に近い既定の配色になります",
      darkBackgroundSwatchAria: "暗い表示のときの背景色",
      darkBackgroundHexAria: "暗い表示のときの背景色（HEX）",
      darkTextSwatchAria: "暗い表示のときの文字色",
      darkTextHexAria: "暗い表示のときの文字色（HEX）",
    },
    fonts: {
      title: "フォント",
      pairingLabel: "ペアリング",
      pairingHint:
        "和文と欧文の組み合わせをワンクリックで一括設定。下の個別選択でいつでも上書きできます",
      jaFontLabel: "日本語フォント",
      enFontLabel: "英語フォント",
      defaultWeight: (weight: string) => `既定（${weight}）`,
      heroWeightLabel: "ヒーロー名の太さ",
      heroWeightHintKnown: "選択中の日本語フォントが読み込むウェイトから選択",
      heroWeightHintUnknown:
        "フォント未選択/カスタムのため一般的なウェイトを表示（フォント側が未対応の値は近似表示になります）",
      bodyWeightLabel: "本文の太さ",
      bodyWeightHint: "サイト全体の本文の太さ",
    },
    fontPicker: {
      formatError: "対応形式は .woff2 / .woff / .ttf / .otf です",
      sizeError: "フォントファイルは2MBまでです",
      networkError: "アップロードに失敗しました（ネットワークエラー）",
      nameAria: "フォント名",
      fileAria: "フォントファイルを選択",
      fontDefault: "既定のまま",
      fontCustom: "自分のフォントを使う（アップロード）",
      fontUploading: "アップロード中…",
      fontUploadHint: "フォントファイルを選ぶ（.woff2 / .woff / .ttf / .otf）",
      replace: "差し替え",
    },
    fontSize: {
      title: "文字の大きさ",
      globalScaleLabel: "全体スケール",
      globalScaleHint: "全部の文字をまとめて大小（モバイル縮小率と併用可）",
      globalScaleControlLabel: "スケール",
      heroGroupLabel: "ヒーロー名 / サブタイトル",
      nameLabel: "名前",
      enNameLabel: "EN名",
      subtitleLabel: "サブタイトル",
      navGroupLabel: "ナビゲーション",
      sizeLabel: "サイズ",
      sectionGroupLabel: "セクション見出し（Recent Work / Contact 等）",
      pageHeadingGroupLabel: "ページ見出し（About名前）",
      bodyGroupLabel: "本文",
      footerGroupLabel: "フッター",
    },
    fontColor: {
      title: "文字の色",
      heroGroupLabel: "ヒーロー名 / サブタイトル",
      nameLabel: "名前",
      enNameLabel: "EN名",
      subtitleLabel: "サブタイトル",
      accentGroupLabel: "アクセントカラー（差し色）",
      accentLabel: "アクセント",
      accentHint:
        "ホバー・選択中・フォーカスにまとめて効く差し色。薄い色は背景とのコントラストが低く見えにくい場合があります",
      accentPlaceholder: "未設定 = 従来の色",
      linkGroupLabel: "リンク",
      linkHoverLabel: "ホバー色",
      linkHoverHint:
        "本文中リンクのホバー色。未設定ならアクセントカラー→既定の順で適用",
      linkHoverPlaceholder: "#1a1a1a",
      underlineLabel: "下線",
      underlineHint: "リンクに下線を表示するか",
      underlineOn: "あり",
      underlineOff: "なし",
      opacityGroupLabel: "不透明度（詳細）",
      navOpacityLabel: "ナビ",
      sectionOpacityLabel: "セクション見出し",
      footerOpacityLabel: "フッター",
      snsOpacityLabel: "SNSアイコン",
    },
    fontTracking: {
      title: "文字の間隔",
      heroGroupLabel: "ヒーロー名",
      nameTrackingLabel: "名前 字間",
      enNameTrackingLabel: "EN名 字間",
      navGroupLabel: "ナビゲーション",
      trackingLabel: "字間",
      sectionGroupLabel: "セクション見出し",
      leadingLabel: "行間",
      bodyGroupLabel: "本文",
    },
    siteCopy: {
      title: "サイト文言",
      navGroupLabel: "ナビゲーション",
      snsGroupLabel: "SNS ラベル",
      sectionGroupLabel: "セクション見出し",
      formGroupLabel: "コンタクトフォーム（お問い合わせページのフォーム内）",
      fields: {
        navLabelTop: {
          label: "ロゴ (TOP)",
          hint: "",
          placeholder: "TOP",
        },
        navLabelGallery: {
          label: "Gallery リンク",
          hint: "",
          placeholder: "Gallery",
        },
        navLabelAbout: {
          label: "About リンク",
          hint: "",
          placeholder: "About",
        },
        navLabelContact: {
          label: "Contact リンク",
          hint: "",
          placeholder: "Contact",
        },
        snsLabelInstagram: {
          label: "Instagram",
          hint: "",
          placeholder: "Instagram",
        },
        snsLabelTwitter: {
          label: "X / Twitter",
          hint: "",
          placeholder: "X",
        },
        snsLabelNote: {
          label: "note",
          hint: "",
          placeholder: "note",
        },
        worksLabel: {
          label: "Works 見出し",
          hint: "",
          placeholder: "Works",
        },
        viewAllLabel: {
          label: "View all リンク",
          hint: "見出しの横",
          placeholder: "View all →",
        },
        viewAllCtaLabel: {
          label: "View all ボタン",
          hint: "一覧の下",
          placeholder: "すべての作品を見る",
        },
        galleryLabel: {
          label: "Gallery 見出し",
          hint: "",
          placeholder: "Gallery",
        },
        filterAllLabel: {
          label: "フィルター All",
          hint: "",
          placeholder: "All",
        },
        profileLabel: {
          label: "Profile 見出し",
          hint: "",
          placeholder: "Profile",
        },
        contactLabel: {
          label: "Contact 見出し",
          hint: "",
          placeholder: "Contact",
        },
        contactFormName: { label: "Name ラベル", placeholder: "Name" },
        contactFormEmail: { label: "Email ラベル", placeholder: "Email" },
        contactFormSubject: { label: "Subject ラベル", placeholder: "Subject" },
        contactSubjectOptions: {
          label: "件名選択肢 (カンマ区切り)",
          placeholder:
            "Shooting,Press / Media,Collaboration,テンプレートについて,Other",
        },
        contactFormMessage: { label: "Message ラベル", placeholder: "Message" },
        contactSendButton: { label: "送信ボタン", placeholder: "Send" },
        contactSendingButton: {
          label: "送信中ボタン",
          placeholder: "Sending...",
        },
        contactSentMessage: {
          label: "送信完了メッセージ",
          placeholder:
            "お送りいただきありがとうございます。2〜3日以内にお返事します。",
        },
        contactSendAnother: {
          label: "もう一通送る",
          placeholder: "Send another",
        },
        contactErrorMessage: {
          label: "エラーメッセージ",
          placeholder: "Failed to send. Please try again.",
        },
      },
    },
    presets: {
      title: "撮影情報プリセット",
      intro: "写真編集インスペクタの Camera / Lens 入力候補。初期候補も削除できます。",
      cameraLabel: "カメラ",
      lensLabel: "レンズ",
      cameraPlaceholder: "例: Hasselblad 500C/M",
      lensPlaceholder: "例: Planar 80mm f/2.8",
      saveFailed: "プリセットの保存に失敗しました。もう一度お試しください。",
      empty: "候補なし",
      add: "追加",
      removeAria: (name: string) => `${name} を削除`,
    },
    preview: {
      syncOnTitle: "設定変更がリアルタイム反映中",
      syncOffTitle: "リアルタイム反映OFF",
      syncOn: "同期 中",
      syncOff: "同期 停止",
      reload: "再読み込み",
      expand: "大きく表示",
      collapse: "編集へ戻る",
      expandTitle: "編集を一時的に畳んでプレビューを広げる",
      openInNewTab: "別窓",
      openInNewTabTitle: "保存済みの内容が別のタブで開きます",
      resizeLabel: "プレビューの幅",
      resetWidth: "幅を戻す",
      resetWidthTitle: "プレビューの幅を標準へ戻す",
      unsavedWhileExpanded: (count: number) => `未保存 ${count}件`,
      viewEdit: "編集",
      viewPreview: "プレビュー",
      viewSwitchLabel: "編集とプレビューの切り替え",
      openPreview: "プレビューを開く",
      closePreview: "プレビューを閉じる",
    },
    colorPickerAria: (label: string) => `${label} カラーピッカー`,
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
        random: "Random",
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
      view: "View",
      thumbnailSize: "Thumbnail size",
      photoColumns: "Photo columns",
      columns: (count: number) => `Show ${count} columns`,
      columnsText: (count: number) => `${count} cols`,
      tableMode: "Bulk edit in table view",
      table: "Table",
      trash: "Trash",
      shortcutsTitle: "Keyboard shortcuts (?)",
      shortcutsAria: "Keyboard shortcuts",
    },
    mode: {
      group: "Library interaction mode",
      normal: "Browse",
      select: "Select",
      arrange: "Reorder",
      startSelect: "Start selection mode",
      startArrange: "Start arrange mode",
      endSelection: "End selection",
      finishArrange: "Finish arranging",
      selectionHint: "Tap a photo to select or deselect it",
      arrangeHint: "Choose one photo to move",
    },
    import: {
      mediumAria: "Import medium",
      mediumHint:
        "This medium label is applied to imported photos. It is not a filter.",
      mediumLabel: "Import as",
      action: "Import",
      digital: "Digital",
      film: "Film",
      chooseImages: "Choose image files",
      dropHere: "Drop images here to import",
      retryFailed: "Retry failed uploads",
      progress: (done: number, total: number) => `Importing ${done} / ${total}`,
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
      resultSummary: (addedCount: number, failedCount: number) =>
        `${addedCount} added / ${failedCount} failed`,
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
      categoryAll: (count: number) => `All (${count})`,
      seriesAll: "All series",
      sizeAll: "All sizes",
      orientationAll: "All orientations",
      timeAll: "All time",
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
      sizeCondition: (label: string) => `Size: ${label}`,
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
      more: "More",
      selected: (count: number) => `${count} selected`,
      selectedWithHidden: (count: number, hiddenCount: number) =>
        `${count} selected (${hiddenCount} outside filters)`,
      recentlyAdded: "Added in this import",
      recentlyAddedSelected: (count: number) =>
        `${count} from this import selected`,
      recentlyAddedHeading: (count: number) =>
        `Added in this import: ${count}`,
      recentlyAddedOutsideFilters:
        "Shown regardless of the current filters",
      endRecentlyAddedDisplay: "Stop showing",
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
      restoreAll: "Restore all",
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
      loading: "Loading photos…",
      loadFailed: "Could not load photos.",
      retry: "Retry",
      noMatches: "No photos match these conditions.",
      relaxFilters: "Try broader filters or a shorter search term.",
      clearFilters: "Clear filters",
      noPhotos: "No photos yet.",
      importHint: "Add photos with Import.",
      tableHint: "Return to Gallery view to add photos with Import.",
    },
    reorder: {
      activeLabel:
        "Changing the public gallery's manual order · autosaves every move",
      publicOrderLocked:
        "The public order is not manual, so photos cannot be reordered here.",
      settingsLoading:
        "Checking the public gallery order. Reordering is unavailable until it loads.",
      settingsError:
        "The public gallery order could not be loaded, so reordering is unavailable. Reload the page.",
      lockedBySort:
        "The current sort is not Manual, so the saved order cannot be changed.",
      lockedByFilter:
        "The saved order cannot be changed while searching or filtering. A single Series filter is allowed.",
      unlock: "Return to manual reordering",
      unlockAndArrange: "Clear conditions and reorder",
      hint:
        "After returning, drag photos on desktop or use the arrow buttons at the lower left of each photo on mobile.",
      seriesHint:
        "Reorder within this series — this order is used on the public series page",
      seriesPositionHint:
        "Position numbers refer to this visible series. Saving applies the change to the full photo order.",
      saving: "Saving… controls stay locked until the refreshed list is ready",
      saved: "Saved",
      conflict:
        "The order changed in another window, so this save was rejected. The latest order has been loaded.",
      undo: "Undo the last reorder",
      undoSaving: "Saving the restored order…",
      undoSaved: "The restored order was saved",
      undoFailed:
        "Undo could not be saved. The last saved order before Undo has been restored.",
      dragHandle: "Drag to reorder",
      region: "Photo reorder controls",
      targetPrompt: "Choose one photo to move",
      targetLabel: (position: number) => `Moving photo ${position}`,
      targetPill: "Moving photo",
      positionLabel: (position: number, total: number) =>
        `${position} / ${total}`,
      moveSummary: (from: number, to: number) =>
        `Moved from position ${from} to ${to}`,
      chooseAgain: "Choose another",
      invalidPosition: (total: number) =>
        `Enter a number from 1 to ${total}`,
      mobileTitle: "Reorder",
      cancelExitWait: "Cancel and stay",
      waitingToExit: "Will exit after saving",
      exitSaving: "Saving… Reorder mode will close when this finishes",
      continueWaiting: "Keep waiting",
      stayAfterRefreshFailure: "Stay on this screen",
      reloadAfterRefreshFailure: "Reload",
      failedExit: (count: number) =>
        `${count} move${count === 1 ? "" : "s"} could not be saved`,
      retryFailedSave: "Save again",
      discardFailedAndExit: "Discard the move and exit",
      moveFirst: "Move to first",
      movePrevious: "Move earlier",
      moveNext: "Move later",
      moveLast: "Move to last",
      moveToPosition: "Move to position",
      positionTitle: "Move to position",
      positionDescription: (total: number) =>
        `Enter a position among all ${total} photos.`,
      seriesPositionDescription: (total: number) =>
        `Enter a position among the ${total} photos in this visible series.`,
      positionInput: "Destination position",
      moveAction: "Move",
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
      missing: "The preparation required to add photos is not complete.",
      detail:
        "Photos cannot be added yet. Please do not repeat the same action; contact the person who set up your site.",
      handoff:
        "Send them a screenshot of this message and the time when you tried to add the photo.",
      retry: "Retry after your setup contact confirms it is ready",
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
      sections: {
        basic: "Basic",
        classification: "Classification",
        details: "Details",
      },
      close: "Close photo details",
      quick: "Quick edits",
      unsaved: "Unsaved",
      usageAria: "Photo usage",
      published: "Published",
      unpublished: "Unpublished",
      displaySize: "Size",
      selectColumn: "Select",
      thumbnailColumn: "Thumbnail",
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
      titlePlaceholder: "Untitled",
      camera: "Camera",
      captureHint: "Shown as capture information in the Lightbox",
      cameraAria: "Camera",
      lens: "Lens",
      lensAria: "Lens",
      copyCapture: "Copy camera and lens",
      pasteCapture: "Paste camera and lens from clipboard",
      copy: "Copy",
      paste: "Paste",
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
      descriptionPlaceholder: "Photo description...",
      saving: "Saving...",
      saved: "Saved",
      save: "Save",
      reset: "Reset",
      duplicate: "Duplicate this photo",
      saveFailed: "Could not save. Please try again.",
      retry: "Try again",
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
      reorderRefreshFailed:
        "The order was saved, but the latest list could not be confirmed. Reload the page.",
      invalidManualOrder:
        "The saved manual order is invalid, so reordering is unavailable. Reload the page.",
      refreshFailed:
        "The operation failed. Check your connection or sign in again.",
      switchPhotoConfirm:
        "This photo has unsaved edits. Move to another photo without saving?",
      switchPhotoAction: "Move without saving",
      closeInspectorConfirm:
        "This photo has unsaved edits. Close it without saving?",
      closeInspectorAction: "Close without saving",
    },
  },
  hero: {
    error: "The operation failed. Check your connection or sign in again.",
    slidesTitle: "Hero Slides",
    danglingWarning: (count: number) =>
      `Hero has ${count} selection${count === 1 ? "" : "s"} pointing to a deleted photo (including photos in Trash). It won't appear on the public site, and restoring the photo from Trash will make it reappear in Hero unexpectedly.`,
    cleaningUp: "Cleaning up...",
    removeFromSelection: "Remove from selection",
    slidesHint:
      "Photos shown in the home-page carousel. Drag to reorder. If none are selected, the first photos in Gallery are shown automatically.",
    noneSelected: "No hero photos selected yet",
    selectFromGalleryHint: "Choose photos from the gallery below",
    movePrevious: "Move earlier",
    moveNext: "Move later",
    removeAria: "Remove from Hero",
    galleryTitle: "Gallery",
    galleryHint: "Click to add to or remove from Hero",
    noPhotosYet: "No photos yet. Add photos from Library.",
    toggleAria: (name: string, isHero: boolean) =>
      isHero ? `Remove ${name} from Hero` : `Add ${name} to Hero`,
  },
  profile: {
    selectImageFile: "Please choose an image file",
    uploadFailed: "Could not upload the profile photo",
    selectPhotoAria: "Choose profile photo",
    photoTitle: "Profile Photo (About page)",
    uploadPhoto: "Upload photo",
    portraitRecommendation: "3:4 portrait recommended",
    fields: {
      nameLabel: "Name (JP)",
      namePlaceholder: "Photographer Name",
      nameKataLabel: "Phonetic reading (katakana)",
      nameKataPlaceholder: "エグチアキ",
      nameEnLabel: "Name (EN)",
      nameEnPlaceholder: "Photographer Name",
      bioLabel: "Bio",
      bioPlaceholder: "Write your bio...",
      bioEnLabel: "Bio (EN)",
      bioEnPlaceholder:
        "Write your bio in English... (blank falls back to Bio)",
      statementLabel: "Statement",
      statementPlaceholder:
        "It's fine to leave this blank — you can add it later.",
      statementEnLabel: "Statement (EN)",
      statementEnPlaceholder:
        "English version (blank falls back to Statement)",
      gearLabel: "Equipment used (one per line)",
      gearPlaceholder: "PENTAX 67\nLeica M6\n...",
      instagramLabel: "Instagram",
      instagramPlaceholder: "https://instagram.com/...",
      xUrlLabel: "X URL",
      xUrlPlaceholder: "https://twitter.com/...",
      noteUrlLabel: "note URL",
      noteUrlPlaceholder: "https://note.com/...",
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
    deleteUncategorizes:
      "Photos in this category become uncategorized. The photos stay, but the category cannot be restored.",
    deleteUncategorizesCount: (count: number) =>
      `${count} photo${count === 1 ? "" : "s"} become uncategorized. The photos stay, but the category cannot be restored.`,
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
  pricing: {
    moveUp: "Move up",
    moveDown: "Move down",
    published: "Published",
    draft: "Draft",
    edit: "Edit",
    deleteAria: (title: string) => `Delete ${title}`,
    titleLabel: "Title",
    titleAria: "Plan title",
    titlePlaceholder: "Portrait",
    priceLabel: "Price",
    priceHint: "Free text (e.g. ¥15,000+)",
    priceAria: "Price",
    descriptionLabel: "Description",
    descriptionHint: "Plan description (optional)",
    descriptionAria: "Plan description",
    descriptionPlaceholder: "e.g. 2 hours, 20 edited images",
    featuresLabel: "What's included",
    featuresHint: "One item per line",
    featuresPlaceholder:
      "2-hour session\n20 edited images\nRetouching included",
    noteLabel: "Notes",
    noteHint: "Additional notes (optional)",
    notePlaceholder: "Travel expenses billed separately",
    add: "Add Plan",
    empty: "No pricing plans yet. Add one with “Add Plan” below.",
    deleteConfirm: (title: string) => `Delete “${title}”?`,
    errors: {
      addFailed: "Could not add the plan.",
      saveFailed: "Could not save.",
      deleteFailed: "Could not delete the plan.",
      reorderFailed: "Could not save the sort order.",
    },
  },
  service: {
    topWorksEmpty: "No published photos yet.",
    topWorksSelectedSuffix: " (selected)",
    arrayControls: {
      up: "Move up",
      down: "Move down",
      remove: "Remove",
    },
    hero: {
      label: "Label",
      headingHint: "Heading (each line break starts a new line)",
      description: "Description",
      factsHint:
        "Key points shown up top (price, what's included, rough time to launch)",
      factLabel: (n) => `Point ${n}: label`,
      factBody: (n) => `Point ${n}: content`,
      ctaPricing: "CTA: Pricing",
      ctaExample: "CTA: Examples",
    },
    examples: {
      sectionTitle: "Examples",
      label: "Label",
      heading: "Heading",
      description: "Description",
      ctaLabel: "CTA",
      linksHint: "Example links",
      linkTitle: "Title",
      linkBody: "Description",
      linkHref: "Link",
      add: "Add",
    },
    painSolutions: {
      sectionTitle: "Concerns & Solutions",
      label: "Label",
      concernTitle: "Concern title",
      concernBody: "Concern body",
      solutionTitle: "Solution title",
      solutionBody: "Solution body",
      add: "Add",
    },
    pricing: {
      sectionTitle: "Pricing",
      intro:
        "Pricing for the /portfolio-kit sales page. Contact-page pricing is edited under Site > Pricing.",
      label: "Label",
      plan: (n) => `Plan ${n}`,
      planName: "Plan name",
      price: "Price",
      description: "Description",
      stripePaymentLink: "Stripe Payment Link",
      features: "Features (one per line)",
      ctaText: "CTA text",
      recommended: "Show as recommended",
      add: "Add Plan",
      noteOnline: "Note after payment (Stripe enabled)",
      noteOffline: "Note while payment setup is in progress",
      disclaimer: "Notice about external costs",
    },
    purchaseFlow: {
      sectionTitle: "Purchase Flow",
      label: "Label",
      heading: "Heading",
      description: "Description",
      stepsHint: "Steps",
      stepTitle: "Title",
      stepBody: "Body",
      add: "Add Step",
      footnote: "Footnote",
    },
    faq: {
      label: "Label",
      question: "Question",
      answer: "Answer",
      add: "Add Question",
    },
    finalCta: {
      sectionTitle: "Final CTA",
      heading: "Heading",
      description: "Description",
      ctaOnline: "CTA (Stripe enabled)",
      ctaOffline: "CTA (offline)",
      snsHint: "Social links",
      add: "Add Social Link",
      snsLabelAria: "Social link label",
      snsUrlAria: "Social link URL",
    },
    stickyCta: {
      leftText: "Left-side text",
      pricingCta: "Pricing link text",
      ctaOnline: "CTA (Stripe enabled)",
      ctaOffline: "CTA (offline)",
    },
    adminShowcase: {
      sectionTitle: "Admin Showcase",
      label: "Label",
      heading: "Heading",
      description: "Description",
      featuresHint: "Feature list",
      featureTitle: "Title",
      featureBody: "Description",
      add: "Add Feature",
    },
  },
  settingsBasic: {
    groupTitle: "Basics & Appearance",
    resetToDefault: "Reset to default",
    adminPasswordTitle: "Admin Password",
    adminPasswordHint: "Set via environment variable",
    previewTitle: "Preview",
    units: {
      columns: "cols",
      photos: "photos",
      px: "px",
      pxPerSec: "px/s",
    },
    typoControl: {
      numericInputAriaLabel: (label: string) => `${label} (numeric input)`,
      opacityTitle: (percent: number) => `0 to 1 (currently ${percent}%)`,
      unitTitle: (unit: string) => `Unit: ${unit}`,
    },
    contactValidation: {
      email: "Enter a valid email address, or leave this blank to hide it.",
      endpoint:
        "Enter a valid https:// URL, or leave this blank to hide the form.",
    },
    siteBasics: {
      title: "Site Basics",
      fields: {
        siteName: {
          label: "Site Name (Logo)",
          placeholder: "Photographer Name",
          hint: "",
        },
        siteNameEn: {
          label: "Site Name (EN)",
          placeholder: "Photographer Name",
          hint: "",
        },
        heroSubtitle: {
          label: "Hero Subtitle",
          placeholder: "Photography",
          hint: "",
        },
        siteDescription: {
          label: "Site Description (SEO)",
          placeholder: "Photography portfolio.",
          hint: "The meta description used in search results, OGP, and social sharing. Uses the text on the left automatically when left blank.",
        },
        footerText: {
          label: "Footer Text",
          placeholder: "Leave blank for “© this year Site Name” (automatic)",
          hint: "",
        },
        contactIntro: {
          label: "Contact Page Intro",
          placeholder: "Feel free to...",
          hint: "",
        },
        contactIntroEn: {
          label: "Contact Page Intro (English)",
          placeholder: "Falls back to the Japanese text when left blank",
          hint: "",
        },
        contactNote: {
          label: "Contact Note",
          placeholder:
            "e.g. “Even if it's not decided yet, feel free to reach out.”",
          hint: "",
        },
        contactNoteEn: {
          label: "Contact Note (English)",
          placeholder: "Falls back to the Japanese text when left blank",
          hint: "",
        },
        contactFlow: {
          label: "Booking Flow",
          placeholder: "Consultation → Planning → Shoot → Delivery",
          hint: "",
        },
        contactFlowEn: {
          label: "Booking Flow (English)",
          placeholder: "Falls back to the Japanese text when left blank",
          hint: "",
        },
        contactEnglishNote: {
          label: "English Welcome Note",
          placeholder: "English inquiries welcome.",
          hint: "Always shown, in both JP and EN",
        },
        contactMessagePlaceholder: {
          label: "Message Example",
          placeholder: "e.g. The kind of shoot you want / preferred date & location",
          hint: "",
        },
        contactEmail: {
          label: "Contact Email",
          placeholder: "you@example.com",
          hint: "",
        },
        formspreeUrl: {
          label: "Contact Form URL",
          placeholder: "https://formspree.io/f/...",
          hint: "Leave blank to hide the form",
        },
        siteUrl: {
          label: "Site URL (Public Domain)",
          placeholder: "https://example.com",
          hint: "Uses the server's SITE_URL when left blank",
        },
        googleSiteVerification: {
          label: "Google Site Verification Code",
          placeholder: "e.g. AbC123xyz...",
          hint: 'Paste just the content="..." value from Search Console\'s “HTML tag” method. It is written to every page\'s <head> as soon as you save (required to register the image sitemap).',
        },
        footerCtaLabel: {
          label: "Footer CTA Text (Optional)",
          placeholder: "e.g. Enquire about a shoot",
          hint: "",
        },
        templateCreditLabel: {
          label: "Template Purchase Credit",
          placeholder: "Site template by Aki Eguchi",
          hint: "",
        },
        templateCreditUrl: {
          label: "Template Purchase Credit URL",
          placeholder: "https://akieguchi.com/portfolio-kit",
          hint: "An invalid URL shows as plain text",
        },
      },
    },
    portfolioKit: {
      title: "Portfolio Kit",
      fieldLabel: "Show Portfolio Kit",
      fieldHint:
        "Auto enables only the direct link and credit on akieguchi.com, with the nav item hidden. “Shown” enables both the page and the nav item; “Hidden” disables the page too.",
      modeLabels: {
        auto: "Auto (default)",
        on: "Shown",
        off: "Hidden",
      },
    },
    hero: {
      title: "Hero (First View)",
      intro:
        "The photo display at the very top of the home page. The style you choose here sets the first impression for anyone who visits the site.",
      summaryFullscreen: (modeName: string) => `${modeName} · Fullscreen`,
      summaryNormal: (modeName: string, height: string) =>
        `${modeName} · Normal · Height ${height}%`,
      modeLabel: "Display Mode",
      modeHint:
        "Carousel and Single Photo are the original layouts; Quiet Grid, Editorial, and Immersive are newer ones. Switching takes effect after you save.",
      modeNames: {
        carousel: "Carousel",
        single: "Single Photo",
        "quiet-grid": "Quiet Grid",
        editorial: "Editorial",
        immersive: "Immersive",
      },
      modeDescriptions: {
        carousel: "Multiple photos cycle in sequence",
        single: "One large, fixed photo",
        "quiet-grid": "Several photos shown in an orderly grid",
        editorial: "A photobook-style mix of large and small",
        immersive: "A single photo fills the screen",
      },
      randomLabel: "Randomise Hero",
      randomHint:
        "“As picked” keeps the hero photos in their saved order. “Order only” keeps the same photos but reshuffles them, and “From all” picks from every published photo (including ones you did not choose for the hero). The order changes per visit and stays put while browsing.",
      randomOptions: {
        off: "As picked",
        shuffle: "Order only",
        any: "From all",
      },
      speedLabel: "Reveal Speed",
      speedHint:
        "How quickly the photo and text quietly appear when the home page loads.",
      speedAriaLabel: (label: string) => `Reveal speed: ${label}`,
      speedNames: {
        slow: "Slow",
        standard: "Standard",
        quick: "Quick",
      },
      orderLabel: "Reveal Order",
      orderHint:
        "Choose whether the text or the photo appears first. The default is “Photo first.”",
      orderAriaLabel: (label: string) => `Reveal order: ${label}`,
      orderNames: {
        "text-first": "Text first",
        "photo-first": "Photo first",
        together: "Together",
      },
      displayModeLabel: "Screen Usage",
      displayModeHint:
        "Fullscreen fills the entire first screen with the photo (the “Height” setting below is ignored).",
      displayModeOptions: {
        normal: "Normal (uses the Height setting)",
        fullscreen: "Fullscreen",
      },
      heightLabel: "Height",
      heightHint:
        "A percentage of the viewport height. The upper limit adjusts automatically on mobile. Not used in Fullscreen mode.",
      titlePositionLabel: "Name Position",
      titlePositionHint:
        "In Single Photo or Fullscreen this positions the name over the photo; in Carousel (Normal) it aligns the name below the photo.",
      titlePositionOptions: {
        center: "Center (default)",
        "bottom-left": "Bottom left",
        "bottom-right": "Bottom right",
        "top-left": "Top left",
        "top-right": "Top right",
      },
      scrollEffectLabel: "Scroll Effect",
      scrollEffectHint:
        "How the photo moves as visitors scroll down the home page. Automatically disabled for visitors with “Reduce Motion” enabled in their OS settings.",
      scrollEffectOptions: {
        none: "None (default)",
        fade: "Fade",
        sink: "Sink",
        parallax: "Parallax",
      },
      overlayLabel: "Overlay",
      overlayHint: "A dark gradient that keeps the name readable in Single Photo mode.",
      overlayOptions: {
        on: "On",
        off: "Off",
      },
    },
    nav: {
      title: "Navigation (Position & Hover)",
      summary: (positionName: string, hoverName: string) =>
        `${positionName} · ${hoverName}`,
      intro:
        "The menu shared by every page (desktop view). You can change its position and its hover response. On mobile it is always a hamburger menu, regardless of position.",
      positionLabel: "Position",
      positionNames: {
        top: "Top",
        left: "Left, Vertical",
        bottom: "Bottom, Fixed",
      },
      positionDescriptions: {
        top: "Fixed to the top of the screen",
        left: "A vertical menu on the left",
        bottom: "Fixed to the bottom of the screen",
      },
      hoverLabel: "Hover Effect",
      hoverHint: "The response on mouse hover or keyboard focus.",
      hoverOptions: {
        fade: "Fade (default)",
        underline: "Underline grows",
        dot: "Dot lights up",
        blur: "Blur to sharp",
      },
      headerBgLabel: "Header Bar at the Top",
      headerBgHint:
        "What sits behind the menu while you are at the very top. Once you scroll, every option returns to the blurred bar, so links stay readable over the content.",
      headerBgOptions: {
        solid: "Show the bar (default)",
        fade: "Soft fade",
        none: "Text only",
      },
      headerBgNote:
        "The bar disappears and the photo reaches the top only when the home hero is set to fullscreen. Otherwise there is only page margin behind the bar, so little changes. The text gets a soft halo, but Text only still depends on the photo: a light colour scheme over a dark photo leaves the menu hard to read. Soft fade is the safer choice.",
      hoverShortNames: {
        fade: "Fade",
        underline: "Underline",
        dot: "Dot",
        blur: "Blur",
      },
    },
    mood: {
      title: "Choose a Mood",
      summary: "Change several settings at once",
      intro:
        "Swaps the photo arrangement, the home hero, the menu behaviour, the background texture, and the About and Contact composition in one go — so you can start from a distinct look instead of hunting for each setting.",
      names: {
        quiet: "Quiet",
        editorial: "Editorial",
        gallery: "Gallery",
        darkroom: "Darkroom",
      },
      descriptions: {
        quiet: "Close to the default. Start here if unsure",
        editorial: "Left-aligned spread on a faint paper ground",
        gallery: "A white wall: even spacing, no overlay",
        darkroom: "Photos edge to edge, no bar, with grain",
      },
      note:
        "Pressing one rewrites the settings below but does not save yet. Check it in the preview first — “Discard changes” puts everything back. Colours and typefaces are left alone, so your palette survives.",
    },
    pageLayout: {
      title: "Page Composition",
      intro:
        "This changes how the photo and the words are arranged, not their colour or size. The same settings can read very differently once the composition changes.",
      aboutLabel: "About page composition",
      aboutHint: "How the portrait and the introduction sit together",
      aboutOptions: {
        side: "Photo on the left (default)",
        stack: "Large photo on top",
        quiet: "No photo — words only",
      },
      aboutNote:
        "While no profile photo is set, every option renders as “words only”, so an empty box never takes up the space.",
      contactLabel: "Contact page composition",
      contactHint: "How the introduction and the form sit together",
      contactOptions: {
        center: "Centred, narrow (default)",
        left: "Left aligned",
        split: "Words left, form right",
      },
      contactNote:
        "The two columns appear only on wider screens; on a phone the form simply follows the text. If none of the introduction fields are filled in, it falls back to “left aligned” so the left column is never empty.",
      seriesLabel: "Series index cards",
      seriesHint: "How each cover and title sit together",
      seriesOptions: {
        caption: "Title below the cover (default)",
        overlay: "Title over the cover",
        wide: "Wide 3:2 stills",
      },
      seriesNote:
        "Overlaid titles get a dark scrim along the bottom of the cover so they stay readable, but a bright cover can still swallow them — “title below the cover” is the safer choice. A series with no cover shows its title instead of an empty box.",
      viewerLabel: "Photo viewer backdrop",
      viewerHint: "The ground behind a photo opened large",
      viewerOptions: {
        wall: "White gallery wall (default)",
        cinema: "Darkroom (black)",
        paper: "Natural paper",
      },
      viewerNote:
        "The backdrop and the text colour always change together, so the controls stay readable whichever you pick. This is independent of the site’s light/dark theme — only the viewer follows it.",
      statementLabel: "Your words on the home page",
      statementHint: "Shows the artist statement from Profile on the home page too",
      statementOptions: {
        off: "Don’t show (default)",
        before: "Before the work",
        after: "After the work",
      },
      statementNote:
        "The text comes straight from the artist statement in Profile — writing it twice would leave one copy stale. Nothing appears until you have written one.",
      titleLabel: "Page heading treatment",
      titleHint: "The heading that opens Gallery, Series, About and Contact",
      titleOptions: {
        label: "Small caps, centred (default)",
        left: "Small caps, left",
        display: "Large heading, left",
        hidden: "Don’t show it",
      },
      titleNote:
        "Even when hidden, the heading stays in place for screen readers — the page simply opens with its content.",
      footerLabel: "Footer arrangement",
      footerHint: "How the social links and the copyright sit at the end of every page",
      footerOptions: {
        center: "Stacked, centred (default)",
        left: "Stacked, left aligned",
        split: "Social left, copyright right",
      },
    },
    spacing: {
      title: "Spacing",
      intro:
        "Adjust the amount of “space between” on the page as a multiplier. 1.0 is the current rhythm. Mobile scales down at the same ratio.",
      heroBottomLabel: "Below Hero",
      heroBottomHint: "Between the hero photo and the works section",
      sectionGapLabel: "Between Sections",
      sectionGapHint: "The base spacing between sections, such as works, CTA, and footer",
      pageTopLabel: "Page Top",
      pageTopHint:
        "The pause at the top of each page — Gallery, Series, About, Contact, and so on",
      footerTopLabel: "Above Footer",
      footerTopHint: "Between the end of the page and the footer",
      ratioControlLabel: "Ratio",
    },
    bgTexture: {
      title: "Grain Texture",
      intro:
        "Overlays a very faint noise on the site background, away from photos. It does not affect the photos themselves or any screen where a photo is shown enlarged.",
      textureLabel: "Texture",
      textureHint:
        "Lays a very faint noise over the background. It does not appear over photos or on screens where a photo is shown enlarged.",
      names: {
        none: "None",
        "grain-fine": "Fine Grain",
        "grain-coarse": "Coarse Paper",
        paper: "Washi Fiber",
        marble: "Marbled",
        mist: "Mist",
      },
      descriptions: {
        none: "No texture added",
        "grain-fine": "Fine, even film-grain texture",
        "grain-coarse": "Rough, fibrous paper texture",
        paper: "Vertical, fiber-like variation",
        marble: "Subtle, wave-like marbling",
        mist: "Soft, cloud-like haze",
      },
      previewNote:
        "The samples are shown a little stronger than actual so the patterns are easy to tell apart. Adjust the real strength with “Opacity” below.",
      opacityLabel: "Opacity",
      opacityHint: "Around 0.06 is recommended. Too high and the texture competes with the photos.",
    },
    fade: {
      title: "Photo Fade-In",
      intro: "The motion used when photos scroll into view, such as in the Gallery.",
      appearanceLabel: "Appearance",
      appearanceHint:
        "For framed, tilted layouts like Collage, “Fade” or “None” tend to look more natural than “Rise.”",
      names: {
        fade: "Fade",
        none: "None",
        rise: "Rise",
        scale: "Zoom",
      },
      descriptions: {
        fade: "Appears gradually from transparent",
        none: "Appears instantly, no motion",
        rise: "Rises up slightly from below",
        scale: "Scales up from smaller to full size",
      },
    },
    galleryLayout: {
      title: "Gallery Layout",
      introPrefix: "Choose how photos are arranged, per page. Changes apply as soon as you open the",
      introTop: "Top",
      introSuffix:
        "preview page. Columns, size and spacing apply to every layout.",
      targetLabel: "Target Page",
      categoryLabels: {
        aligned: "Aligned Grids",
        editorial: "Editorial Layouts",
      },
      descriptions: {
        grid: "Aligned in a grid, keeping each photo's original aspect ratio",
        "clean-grid": "Instagram-style — every photo cropped to a square",
        "portrait-grid": "Portrait 4:5 crop, suited to people and portraits",
        "landscape-grid": "Landscape 3:2 crop, suited to scenery and landscapes",
        masonry: "Packed tightly while keeping aspect ratio; follows Max Columns",
        justified: "Packed row by row at true aspect ratio; S/M/L sets the size",
        mosaic: "A mix of S/M/L sizes with open, airy gaps",
        scroll: "One large photo at a time, with its details alongside",
        stagger: "One photo at a time, alternating left and right",
        editorial: "Pairs of photos in a magazine-spread layout, large left / small right",
        collage: "Overlapping, tilted photos, like a stack of snapshots",
        "large-format": "Two large-format columns with captions",
      },
      topWorksHeading: "Photos Shown in Top (Works)",
      topWorksModeLabel: "Selection",
      topWorksModeHint:
        "Auto shows the first 9 photos in the Gallery order; Random reshuffles on every visit; Manual shows the photos you choose below, in the order you chose them. This is separate from the hero photos at the very top.",
      topWorksModeOptions: {
        auto: {
          name: "Auto, from sort order",
          desc: "The first 9 photos in the Gallery order",
        },
        random: {
          name: "Random",
          desc: "Reshuffled on every visit",
        },
        manual: {
          name: "Choose manually",
          desc: "Choose photos below",
        },
      },
      topWorksPickerLabel: "Photos Shown in Top",
      topWorksPickerHint:
        "Click to select or deselect. Photos display in the numbered order you chose them. Behaves like Auto until you make a selection.",
      initialCountLabel: "Initial Count",
      initialCountHint:
        "How many photos appear initially in the Works section below the hero on the home page. More load in as visitors scroll.",
      gridHeading: "Gallery Columns, Size & Spacing",
      maxColumnsLabel: "Max Columns",
      maxColumnsHint:
        "The maximum number of columns on a wide screen. The actual count is “available width ÷ minimum photo width”, dropping automatically when there is not enough room (1–2 on mobile). This applies to every layout, masonry included.",
      columnsCappedByPreview: (previewWidth: number, fits: number) =>
        `This preview is ${previewWidth}px wide, so it can only show ${fits} columns here. The live site has more room. To see more columns in this preview, lower “Photo Size”.`,
      photoSizeLabel: "Photo Size",
      photoSizeControlLabel: "Size",
      photoSizeHint: "Larger values widen each photo, which automatically reduces the column count.",
      gapLabel: "Spacing",
      gapControlLabel: "Spacing Ratio",
      gapHint: "A multiplier for the spacing between photos (0.2 = tight, 3.0 = wide).",
      topGridHeading:
        "Top (Works) Columns, Size & Spacing — Matches Gallery Until Changed",
      topMaxColumnsLabel: "Max Columns (Top)",
      topMaxColumnsHint:
        "The maximum column count for the works at the bottom of the home page. Independent of Gallery.",
      topPhotoSizeLabel: "Photo Size (Top)",
      topPhotoSizeHint:
        "The photo size for the works at the bottom of the home page. Independent of Gallery.",
      topGapLabel: "Spacing (Top)",
      topGapHint:
        "The spacing multiplier for the works at the bottom of the home page. Independent of Gallery.",
      mosaicHeading: "Mosaic Only",
      emptyRateLabel: "Gap (Empty Cell) Frequency",
      emptyRateControlLabel: "Gap Frequency",
      emptyRateHint:
        "0 means no gaps — everything packed tight. Higher values add more empty space. Automatically kept subtle on mobile.",
      sizeVariationLabel: "Size Contrast",
      sizeVariationControlLabel: "Contrast Strength",
      sizeVariationHint:
        "How much to emphasize the size difference between S/M/L. 0 = nearly uniform, 1.0 = maximum contrast.",
      shuffleLabel: "Shuffle Arrangement",
      shuffleHint:
        "Keeps the same photos but tries a different pattern of gaps. Press this if the current arrangement doesn't feel right.",
      shuffleButton: "Shuffle Arrangement",
    },
    seriesSection: {
      title: "Series",
      navLabel: "Show “Series” in Nav",
      navHint:
        "“Auto” shows the link whenever at least one series is published (default). “Show” always displays it; “Hide” always hides it. Create series and assign photos from the Series tab above or the Library inspector.",
      navOptions: {
        auto: "Auto",
        on: "Show",
        off: "Hide",
      },
      gridIntroPrefix: "The look of the Series list (a grid of cover photos). Reflected in the",
      gridIntroSuffix:
        "preview page. Tiles show only the cover photo (no text). A series without a cover automatically uses its first photo.",
      columnsPcLabel: "Series Columns (PC)",
      columnsPcHint: "Use fewer columns to show larger tiles (2–3 recommended).",
      columnsPcControlLabel: "PC Columns",
      columnsMobileLabel: "Series Columns (Mobile)",
      columnsMobileHint: "The column count on mobile.",
      columnsMobileControlLabel: "Mobile Columns",
      excludeLabel: "Series Photos in Gallery",
      excludeHint:
        "Choosing “Hide” keeps any photo that belongs to a series off the Gallery page. Use it when series should only be seen on their own pages and the Gallery should hold the standalone work.",
      excludeOptions: {
        show: "Show",
        hide: "Hide",
      },
      streamIntro:
        "A band on the home page where series covers and captions drift sideways. It pauses while you touch or hover it, and opens the series when clicked. Visitors who ask their OS to reduce motion get a band they can scroll themselves instead.",
      streamPlaceLabel: "Show on Home",
      streamPlaceHint: "Before or after the Works photo grid.",
      streamPlaceOptions: {
        off: "Hide",
        before: "Before Works",
        after: "After Works",
      },
      streamLabelLabel: "Band Heading",
      streamLabelHint: "Defaults to Series when left empty.",
      streamCaptionLabel: "Show Titles",
      streamCaptionHint: "Photos only, or the series name underneath.",
      streamCaptionOptions: {
        on: "Show",
        off: "Photos only",
      },
      streamSpeedLabel: "Drift Speed",
      streamSpeedHint:
        "Pixels per second. Adding more series does not change how fast it feels.",
      streamSpeedControlLabel: "Speed",
      streamHeightLabel: "Band Photo Height",
      streamHeightHint: "Taller means larger tiles and fewer visible at once.",
      streamHeightControlLabel: "Height",
      orderIntro:
        "The photo sort order. “Manual” follows the order you dragged in Library. To override it per series, use each series' edit screen in the Series tab.",
      gallerySortLabel: "Gallery Sort Order",
      gallerySortHint: "How photos are ordered on the Gallery page and the home page.",
      seriesSortLabel: "Sort Order Within Series",
      seriesSortHint:
        "How photos are ordered on each series detail page (can also be set individually per series).",
      sortOptions: {
        manual: "Manual (drag & drop)",
        date_desc: "Date taken ↓ newest first",
        date_asc: "Date taken ↑ oldest first",
        upload_desc: "Upload date ↓ newest first",
        random: "Random",
      },
    },
  },
  settingsIntegrations: {
    groupTitle: "Integrations & Sales",
    visibilityOn: "Show",
    visibilityOff: "Hide",
    note: {
      title: "note Integration",
      intro:
        "Posts on note appear automatically in the “Journal” section of the About page (cached for 30 minutes). If the feed can't be fetched, the section simply disappears — the rest of the site keeps working.",
      visibilityLabel: "Show",
      visibilityHint: "Whether to show recent posts on the About page",
      usernameLabel: "note Username",
      usernameHint: "The ◯◯ part of note.com/◯◯ (e.g. chi_aki_zip)",
      usernamePlaceholder: "chi_aki_zip",
      displayCountLabel: "Number Shown",
      displayCountHint: "How many posts to list",
      countControlLabel: "Count",
      countUnit: "posts",
    },
    print: {
      title: "Print Sales",
      intro:
        "Shows an understated link to an external store (such as BOOTH) on the About page. Nothing is shown if this is left unset.",
      visibilityLabel: "Show",
      visibilityHint: "Whether to show a print-purchase link on the About page",
      storeUrlLabel: "Store URL",
      storeUrlHint: "The URL of your sales page, such as on BOOTH",
      storeUrlPlaceholder: "https://...",
      linkLabelLabel: "Link Text",
      linkLabelHint: "The text shown on the button",
      linkLabelPlaceholder: "プリントを購入する",
      descriptionLabel: "Description (Optional)",
      descriptionHint: "A brief note on sizes, pricing, and so on",
      descriptionAria: "Print description",
      descriptionPlaceholder: "A4 / ¥3,000〜 ...",
    },
    cta: {
      title: "Booking Enquiry",
      intro:
        "Shows a prompt toward “Book a Shoot” at the end of the Top, Gallery, and Series pages — a path to enquiries right after a visitor finishes viewing your work.",
      visibilityLabel: "Show",
      visibilityHint: "Whether to show the booking prompt at the end of each page",
      headingLabel: "Heading",
      headingHint: "e.g. “Book a Shoot” or “Work with me”",
      headingAria: "CTA heading",
      headingPlaceholder: "撮影のご依頼",
      bodyLabel: "Body Text (Optional)",
      bodyHint:
        "A short line to encourage enquiries — genres you shoot, the scope you cover, and so on",
      bodyAria: "CTA body text",
      bodyPlaceholder: "ポートレート・作品撮り・取材など、お気軽にご相談ください。",
      buttonLabel: "Button Text",
      buttonHint: "The text for the link to the Contact page",
      buttonAria: "CTA button text",
      buttonPlaceholder: "お問い合わせ",
    },
  },
  settingsDesign: {
    groupTitle: "Design & Copy",
    themeColors: {
      title: "Background & Text Colour",
      backgroundLabel: "Background",
      backgroundSwatchAria: "Background colour",
      backgroundHexAria: "Background colour (hex)",
      textLabel: "Text",
      textSwatchAria: "Text colour",
      textHexAria: "Text colour (hex)",
      darkLabel: "Colours for dark display",
      darkHint:
        "Shown to visitors whose device is set to dark. Leave empty to use the default near-black palette.",
      darkBackgroundSwatchAria: "Dark background colour",
      darkBackgroundHexAria: "Dark background colour (hex)",
      darkTextSwatchAria: "Dark text colour",
      darkTextHexAria: "Dark text colour (hex)",
    },
    fonts: {
      title: "Fonts",
      pairingLabel: "Pairing",
      pairingHint:
        "Set a Japanese/Latin font pairing in one click. Override either one anytime with the pickers below.",
      jaFontLabel: "Japanese Font",
      enFontLabel: "English Font",
      defaultWeight: (weight: string) => `Default (${weight})`,
      heroWeightLabel: "Hero Name Weight",
      heroWeightHintKnown:
        "Choose from the weights loaded by the selected Japanese font",
      heroWeightHintUnknown:
        "Showing generic weights because no font is selected or a custom font is in use (unsupported values render as the nearest approximation)",
      bodyWeightLabel: "Body Weight",
      bodyWeightHint: "The body-text weight used across the site",
    },
    fontPicker: {
      formatError: "Supported formats are .woff2, .woff, .ttf, and .otf.",
      sizeError: "Font files must be 2MB or smaller.",
      networkError: "Upload failed (network error).",
      nameAria: "Font name",
      fileAria: "Choose a font file",
      fontDefault: "Default",
      fontCustom: "Custom (upload)",
      fontUploading: "Uploading...",
      fontUploadHint: "Upload font file (.woff2, .woff, .ttf, .otf)",
      replace: "Replace",
    },
    fontSize: {
      title: "Typography",
      globalScaleLabel: "Global Scale",
      globalScaleHint:
        "Scales all text up or down together (works alongside the mobile scale-down)",
      globalScaleControlLabel: "Scale",
      heroGroupLabel: "Hero Name / Subtitle",
      nameLabel: "Name",
      enNameLabel: "EN Name",
      subtitleLabel: "Subtitle",
      navGroupLabel: "Navigation",
      sizeLabel: "Size",
      sectionGroupLabel: "Section Headings (Recent Work, Contact, etc.)",
      pageHeadingGroupLabel: "Page Heading (About Name)",
      bodyGroupLabel: "Body",
      footerGroupLabel: "Footer",
    },
    fontColor: {
      title: "Text Colour",
      heroGroupLabel: "Hero Name / Subtitle",
      nameLabel: "Name",
      enNameLabel: "EN Name",
      subtitleLabel: "Subtitle",
      accentGroupLabel: "Accent Colour",
      accentLabel: "Accent",
      accentHint:
        "An accent colour applied to hover, selected, and focus states together. Light colours can be hard to see against the background when contrast is low.",
      accentPlaceholder: "Unset = the previous colours",
      linkGroupLabel: "Links",
      linkHoverLabel: "Hover Colour",
      linkHoverHint:
        "The hover colour for links within body text. If unset, falls back to the accent colour, then the default.",
      linkHoverPlaceholder: "#1a1a1a",
      underlineLabel: "Underline",
      underlineHint: "Whether links are underlined",
      underlineOn: "On",
      underlineOff: "Off",
      opacityGroupLabel: "Opacity (Advanced)",
      navOpacityLabel: "Nav",
      sectionOpacityLabel: "Section Headings",
      footerOpacityLabel: "Footer",
      snsOpacityLabel: "Social Icons",
    },
    fontTracking: {
      title: "Letter Spacing",
      heroGroupLabel: "Hero Name",
      nameTrackingLabel: "Name Tracking",
      enNameTrackingLabel: "EN Name Tracking",
      navGroupLabel: "Navigation",
      trackingLabel: "Tracking",
      sectionGroupLabel: "Section Headings",
      leadingLabel: "Line Height",
      bodyGroupLabel: "Body",
    },
    siteCopy: {
      title: "Site Copy",
      navGroupLabel: "Navigation",
      snsGroupLabel: "Social Labels",
      sectionGroupLabel: "Section Headings",
      formGroupLabel: "Contact Form (Within the Contact Page Form)",
      fields: {
        navLabelTop: {
          label: "Logo (TOP)",
          hint: "",
          placeholder: "TOP",
        },
        navLabelGallery: {
          label: "Gallery Link",
          hint: "",
          placeholder: "Gallery",
        },
        navLabelAbout: {
          label: "About Link",
          hint: "",
          placeholder: "About",
        },
        navLabelContact: {
          label: "Contact Link",
          hint: "",
          placeholder: "Contact",
        },
        snsLabelInstagram: {
          label: "Instagram",
          hint: "",
          placeholder: "Instagram",
        },
        snsLabelTwitter: {
          label: "X / Twitter",
          hint: "",
          placeholder: "X",
        },
        snsLabelNote: {
          label: "note",
          hint: "",
          placeholder: "note",
        },
        worksLabel: {
          label: "Works Heading",
          hint: "",
          placeholder: "Works",
        },
        viewAllLabel: {
          label: "View All Link",
          hint: "Beside the heading",
          placeholder: "View all →",
        },
        viewAllCtaLabel: {
          label: "View All Button",
          hint: "Below the list",
          placeholder: "すべての作品を見る",
        },
        galleryLabel: {
          label: "Gallery Heading",
          hint: "",
          placeholder: "Gallery",
        },
        filterAllLabel: {
          label: "Filter: All",
          hint: "",
          placeholder: "All",
        },
        profileLabel: {
          label: "Profile Heading",
          hint: "",
          placeholder: "Profile",
        },
        contactLabel: {
          label: "Contact Heading",
          hint: "",
          placeholder: "Contact",
        },
        contactFormName: { label: "Name Label", placeholder: "Name" },
        contactFormEmail: { label: "Email Label", placeholder: "Email" },
        contactFormSubject: { label: "Subject Label", placeholder: "Subject" },
        contactSubjectOptions: {
          label: "Subject Options (Comma-Separated)",
          placeholder:
            "Shooting,Press / Media,Collaboration,テンプレートについて,Other",
        },
        contactFormMessage: { label: "Message Label", placeholder: "Message" },
        contactSendButton: { label: "Send Button", placeholder: "Send" },
        contactSendingButton: {
          label: "Sending Button",
          placeholder: "Sending...",
        },
        contactSentMessage: {
          label: "Sent Confirmation Message",
          placeholder:
            "お送りいただきありがとうございます。2〜3日以内にお返事します。",
        },
        contactSendAnother: {
          label: "Send Another",
          placeholder: "Send another",
        },
        contactErrorMessage: {
          label: "Error Message",
          placeholder: "Failed to send. Please try again.",
        },
      },
    },
    presets: {
      title: "Capture Info Presets",
      intro:
        "Suggested Camera / Lens entries in the photo inspector. Built-in suggestions can be removed too.",
      cameraLabel: "Camera",
      lensLabel: "Lens",
      cameraPlaceholder: "e.g. Hasselblad 500C/M",
      lensPlaceholder: "e.g. Planar 80mm f/2.8",
      saveFailed: "Could not save the preset. Please try again.",
      empty: "No suggestions yet",
      add: "Add",
      removeAria: (name: string) => `Remove ${name}`,
    },
    preview: {
      syncOnTitle: "Changes apply live",
      syncOffTitle: "Live sync is off",
      syncOn: "Sync on",
      syncOff: "Sync off",
      reload: "Reload",
      expand: "Expand",
      collapse: "Back to editing",
      expandTitle: "Fold the form away and widen the preview",
      openInNewTab: "New tab",
      openInNewTabTitle: "Opens the saved site in another tab",
      resizeLabel: "Preview width",
      resetWidth: "Reset width",
      resetWidthTitle: "Reset the preview to the standard width",
      unsavedWhileExpanded: (count: number) => `${count} unsaved`,
      viewEdit: "Edit",
      viewPreview: "Preview",
      viewSwitchLabel: "Switch between editing and preview",
      openPreview: "Live preview",
      closePreview: "Hide preview",
    },
    colorPickerAria: (label: string) => `${label} colour picker`,
  },
} as const satisfies AdminPhase2bMessages;

export type AdminMessages = {
  languageToggleLabel: string;
  common: {
    open: string;
    close: string;
    save: string;
    saving: string;
    uploading: string;
    cancel: string;
    discard: string;
    add: string;
    delete: string;
    deleteAction: string;
    sessionExpired: string;
    loading: string;
    loadFailed: string;
    retry: string;
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
    collapseSidebar: string;
    expandSidebar: string;
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
    unsavedRowBody: string;
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
    libraryPhotos: string;
    dotSeparator: string;
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
    loadError: {
      title: string;
      body: string;
      retry: string;
      contact: string;
    };
    progress: (done: number, total: number) => string;
    resumeSummary: (done: number, total: number, next: string) => string;
    nextAction: (next: string) => string;
    finish: string;
    finishFailed: string;
    homePageConfirmAction: string;
    homePageOpenFailed: string;
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
      siteName: ChecklistCopy;
      profile: ChecklistCopy;
      contact: ChecklistCopy;
      publicUrl: ChecklistCopy;
      categories: ChecklistCopy;
      appearance: ChecklistCopy;
    };
    storageHealth: {
      configured: string;
      missingSummary: string;
      missingAction: string;
    };
  };
  phase2b: AdminPhase2bMessages;
  floatingSave: {
    failed: string;
    saved: string;
    unsaved: string;
  };
  formLayout: {
    navigationLabel: string;
    currentSection: string;
    switchSection: string;
    closeSectionList: string;
    changed: string;
    failed: string;
    noChanges: string;
    unsavedCount: (count: number) => string;
    changedSections: (labels: string) => string;
    saving: string;
    save: string;
    discard: string;
    saveFailed: string;
    goToFailed: string;
    savedAt: (time: string) => string;
    summaryUnset: string;
    summaryItems: (count: number) => string;
    basicSettings: string;
    advancedSettings: string;
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
      uploading: "アップロード中…",
      cancel: "キャンセル",
      discard: "破棄",
      // 一覧の3状態（読み込み中 / 読み込めなかった / 本当に0件）で使う共通語。
      // これが無かった画面は、失敗を「まだありません」と表示していた。
      loading: "読み込んでいます…",
      loadFailed: "読み込めませんでした。",
      retry: "再読み込み",
      add: "追加",
      delete: "削除",
      deleteAction: "削除する",
      sessionExpired: "セッションが切れました。再ログインしてください。",
      unsupportedSettings: (keys) =>
        `一部の設定が保存されませんでした（未対応のキー: ${keys}）`,
    },
    login: {
      eyebrow: "Portfolio Admin",
      title: "ログイン",
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
      siteButton: "サイト",
      logoutButton: "ログアウト",
      collapseSidebar: "サイドバーを畳む",
      expandSidebar: "サイドバーを開く",
      groupTabs: (group) => `${group}のタブ`,
      closeSheet: "シートを閉じる",
      // 例に挙げるのは画面の名前そのもの。ここだけ「Trash」と英語で書いていたが、
      // 一覧に並ぶ項目は「ゴミ箱」なので、探しても一致しない。到達点(3)
      // 「英語はタブ名などの固有名詞だけ」にも反する（2026-08-17 実測）。
      palettePlaceholder:
        "移動先を検索…（Library / Hero / Settings / ゴミ箱 など）",
      paletteLabel: "クイック移動",
      paletteDestinationsLabel: "移動先",
      paletteEmpty: "見つかりません",
      trash: "ゴミ箱",
    },
    shell: {
      unsavedTitle: "未保存の変更があります",
      unsavedBody: "保存していない内容があります。このまま移動しますか？",
      // 同じタブの中で、編集中の行を離れるとき（別の行を開く / 閉じる）。
      unsavedRowBody:
        "書きかけの内容があります。保存せずに閉じると元に戻せません。",
      leaveWithoutSaving: "保存せず移動",
    },
    headers: {
      hero: "トップページのカルーセルに表示する写真を選びます。",
      profile: "About ページに表示する自己紹介とプロフィール写真です。",
      categories: "Gallery の絞り込みに使うカテゴリを管理します。",
      series: "作品をシリーズにまとめます。写真の割り当てはLibraryで行います。",
      pricing:
        "Contactページに表示される料金です。↑↓で並び替え。販売ページの料金はPortfolio Kit画面で編集します。",
      service:
        "/portfolio-kit 販売ページの内容を編集します。公開サイト側の表示条件は現在の設定に従います。",
      settingsSaveFailed: "保存失敗 — もう一度お試しください",
      libraryLoading: "読み込み中",
      librarySelected: "枚を選択中",
      libraryPhotos: "枚",
      dotSeparator: " ・ ",
      viewSite: "サイトで確認",
      closeViewSite: "サイトで確認を閉じる",
    },
    demo: {
      banner: "これは体験版です。変更は実際には保存されません。",
      purchase: "気に入ったら ¥30,000・公開までおまかせ",
      reset: "最初からやり直す",
      guideEyebrow: "クイックツアー",
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
      collapsedCompleted: "セットアップは完了しています。",
      collapsedReady: "公開に必要な項目はそろっています。",
      collapsedDismissed: "「はじめに」を閉じています。",
      reopen: "もう一度見る",
      title: "公開までにやること",
      description:
        "まずは写真を1枚追加し、トップページに表示されることを確かめましょう。この3つだけ終えれば、最初の準備は完了です。名前やプロフィールは、あとからゆっくり整えられます。",
      checking: "確認中...",
      loadError: {
        title: "読み込めませんでした",
        body: "設定や写真の状態を確認できないため、完了状況は表示していません。",
        retry: "再試行",
        contact:
          "再試行しても解決しない場合は、この画面が表示されたことを設定担当者へ連絡してください。",
      },
      demoIntro:
        "これは、購入後にご自身のサイトを公開まで進める手順表の見本です。体験版ではサンプル一式が入っているためすべて完了になっていますが、実際は空の状態から、この順に埋めていくだけで公開できます。",
      progress: (done, total) => `${done} / ${total} 完了`,
      resumeSummary: (done, total, next) =>
        `${done} / ${total} まで進んでいます。次は「${next}」です。`,
      nextAction: (next) => `次へ：${next}`,
      finish: "セットアップ完了 → ライブラリへ",
      finishFailed:
        "完了を保存できませんでした。通信状況を確かめて、もう一度お試しください。",
      homePageConfirmAction: "写真が表示された",
      homePageOpenFailed:
        "トップページを新しいタブで開けませんでした。ブラウザでポップアップを許可して、もう一度「開く」を押してください。",
      later: "あとで",
      recommendedTitle: "あとでゆっくり整える",
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
          title: "写真を1枚追加する",
          body: "Libraryを開き、まずはお気に入りの写真を1枚だけ追加します。うまくいかない時は、表示される案内を設定担当者に送れば大丈夫です。",
        },
        hero: {
          title: "トップ写真を選ぶ",
          body: "最初に見せたい写真を選びます。サイトの第一印象になります。",
        },
        liveSite: {
          title: "トップページで確認する",
          body: "「開く」を押し、選んだ写真がトップページに表示されるか確かめます。写真が見えたら、最初の準備は完了です。",
        },
      },
      recommended: {
        siteName: {
          title: "サイトの名前と説明",
          body: "表に出る名前と短い説明文です。写真の表示を確認したあとで整えても大丈夫です。",
        },
        profile: {
          title: "プロフィール",
          body: "名前と自己紹介を入れます。最初から完璧に書かず、あとで書き直せます。",
        },
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
      storageHealth: {
        configured:
          "写真の保存先: 必要な設定は入力済み（実際につながるかは最初のアップロードで確認されます）",
        missingSummary:
          "写真の保存先: 設定が不足しています — このままでは写真をアップロードできません。",
        missingAction:
          "設定担当者へご連絡ください。その際は、この画面のスクリーンショットと、写真を追加しようとした時刻をお送りください。",
      },
    },
    phase2b: ADMIN_PHASE_2B_JA,
    floatingSave: {
      failed: "保存に失敗しました",
      saved: "保存しました",
      unsaved: "保存していない変更があります",
    },
    formLayout: {
      navigationLabel: "設定の節一覧",
      currentSection: "現在地",
      switchSection: "切り替え",
      closeSectionList: "節一覧を閉じる",
      changed: "変更あり",
      failed: "保存できず",
      noChanges: "未保存の変更はありません",
      unsavedCount: (count) => `未保存の変更 ${count}件`,
      changedSections: (labels) => `変更した節: ${labels}`,
      saving: "保存中...",
      save: "保存",
      discard: "破棄",
      saveFailed: "保存に失敗しました",
      goToFailed: "原因の節へ移動",
      savedAt: (time) => `${time} に保存`,
      summaryUnset: "未設定",
      summaryItems: (count) => `${count}項目を設定`,
      basicSettings: "ふだんの設定",
      advancedSettings: "詳しい設定",
    },
  },
  en: {
    languageToggleLabel: "Display language",
    common: {
      open: "Open",
      close: "Close",
      save: "Save",
      saving: "Saving...",
      uploading: "Uploading...",
      cancel: "Cancel",
      discard: "Discard",
      loading: "Loading…",
      loadFailed: "Could not load.",
      retry: "Reload",
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
      collapseSidebar: "Collapse sidebar",
      expandSidebar: "Expand sidebar",
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
      unsavedRowBody:
        "This entry has unsaved text. Closing without saving cannot be undone.",
      leaveWithoutSaving: "Leave without saving",
    },
    headers: {
      hero: "Choose the photos shown in the home-page carousel.",
      profile: "Your biography and profile photo shown on the About page.",
      categories: "Manage the categories used to filter Gallery.",
      series: "Group work into series. Assign photos from Library.",
      pricing:
        "Manage pricing shown on the Contact page. Set the sort order with ↑↓. Edit sales-page pricing in Portfolio Kit.",
      service:
        "Edit the /portfolio-kit sales page. Visibility on the public site follows the current settings.",
      settingsSaveFailed: "Could not save — please try again",
      libraryLoading: "Loading",
      librarySelected: "selected",
      libraryPhotos: "photos",
      dotSeparator: " · ",
      viewSite: "View on site",
      closeViewSite: "Close site preview",
    },
    demo: {
      banner: "This is a demo. Changes are not saved to a live site.",
      purchase: "Get your own — ¥30,000, fully set up",
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
        "Start by adding one photo and confirming that it appears on the home page. Once these three steps are done, the initial setup is complete. You can take your time with your name and profile later.",
      checking: "Checking...",
      loadError: {
        title: "Could not load your setup",
        body:
          "We could not check your settings and photos, so no steps are being marked incomplete.",
        retry: "Try again",
        contact:
          "If trying again does not help, tell the person who set up your site that you saw this screen.",
      },
      demoIntro:
        "This is a preview of the checklist that guides you from a fresh install to a published site. In this demo everything is marked complete because sample content is preloaded — on your own site, you simply work through these steps from the top.",
      progress: (done, total) => `${done} / ${total} complete`,
      resumeSummary: (done, total, next) =>
        `You have completed ${done} of ${total}. Next: ${next}.`,
      nextAction: (next) => `Next: ${next}`,
      finish: "Finish setup → Library",
      finishFailed:
        "Could not save completion. Check your connection and try again.",
      homePageConfirmAction: "I can see the photo",
      homePageOpenFailed:
        "The home page could not open in a new tab. Allow pop-ups in your browser, then select “Open” again.",
      later: "Later",
      recommendedTitle: "Take your time with these later",
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
          body: "Open Library and add just one favourite photo to begin. If it does not work, send the message shown on screen to the person who set up your site.",
        },
        hero: {
          title: "Choose a hero photo",
          body: "Choose the first photo visitors see. It sets the site’s first impression.",
        },
        liveSite: {
          title: "Check the home page",
          body: "Select “Open” and confirm that your chosen photo appears on the home page. Once you can see it, the initial setup is complete.",
        },
      },
      recommended: {
        siteName: {
          title: "Site name and description",
          body: "Add the public name and a short description. It is fine to do this after you have confirmed that your photo appears.",
        },
        profile: {
          title: "Profile",
          body: "Add your name and biography. It does not need to be perfect now; you can revise it at any time.",
        },
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
      storageHealth: {
        configured:
          "Photo storage: Required settings are present. The first upload confirms the connection.",
        missingSummary:
          "Photo storage: Settings are missing — photos cannot be uploaded yet.",
        missingAction:
          "Contact the person who set up your site. Send them a screenshot of this message and the time when you tried to add the photo.",
      },
    },
    phase2b: ADMIN_PHASE_2B_EN,
    floatingSave: {
      failed: "Could not save",
      saved: "Saved",
      unsaved: "You have unsaved changes",
    },
    formLayout: {
      navigationLabel: "Settings sections",
      currentSection: "Current",
      switchSection: "Switch",
      closeSectionList: "Close section list",
      changed: "Changed",
      failed: "Could not save",
      noChanges: "No unsaved changes",
      unsavedCount: (count) => `${count} unsaved change${count === 1 ? "" : "s"}`,
      changedSections: (labels) => `Changed sections: ${labels}`,
      saving: "Saving...",
      save: "Save",
      discard: "Discard",
      saveFailed: "Could not save",
      goToFailed: "Go to the affected section",
      savedAt: (time) => `Saved at ${time}`,
      summaryUnset: "Not set",
      summaryItems: (count) => `${count} item${count === 1 ? "" : "s"} set`,
      basicSettings: "Everyday settings",
      advancedSettings: "Advanced settings",
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

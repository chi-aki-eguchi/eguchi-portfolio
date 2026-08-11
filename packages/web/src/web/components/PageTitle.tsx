import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../lib/api";

/**
 * 各ページの見出し（GALLERY / SERIES / PROFILE / CONTACT）。
 *
 * **このKitのいちばん強い「型」だった。** どのページも、小さな大文字の英単語が
 * 1つ中央にあるところから始まる。写真も色も書体も変えたサイト同士でも、
 * この出だしが同じなので「同じテンプレート」だと分かってしまう。
 * 4ページに同じ塊が複製されていたので、ここへ集めたうえで選べるようにした。
 *
 *   label   小さな大文字・中央（既定。従来どおり）
 *   left    小さな大文字・左寄せ
 *   display 大きな見出し。大文字にせず、本文の見出しと同じ大きさで左に置く
 *   hidden  出さない。ページが本文から始まる
 *
 * **hidden でも要素は消さない。** 見出しが1つも無いページは読み上げの目印を
 * 失うので、目に見えない形（sr-only）で残す。
 */
export function PageTitle({
  children,
  className = "",
  align,
  revealClass = "page-entrance",
}: {
  children: React.ReactNode;
  /** 下側の余白など、ページ固有の間隔 */
  className?: string;
  /** ページ側に揃えたい理由があるときだけ渡す（Contact の構成など） */
  align?: "left" | "center";
  /** ページごとの登場演出のクラス名 */
  revealClass?: string;
}) {
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const style = ["label", "left", "display", "hidden"].includes(
    data?.pageTitleStyle ?? "",
  )
    ? data!.pageTitleStyle!
    : "label";

  if (style === "hidden")
    return <h1 className="sr-only">{children}</h1>;

  const centered = align ? align === "center" : style === "label";

  if (style === "display")
    return (
      <h1
        className={`font-bold break-words ${centered ? "text-center" : ""} ${revealClass} ${className}`}
        style={{
          fontSize: "var(--heading-size, 1.25rem)",
          color: "var(--foreground)",
          letterSpacing: "var(--body-tracking, 0.02em)",
          lineHeight: "var(--section-leading, 1.25)",
        }}
      >
        {children}
      </h1>
    );

  return (
    <h1
      /* 見出しは設定で自由に書ける。折り返せない語だと箱の幅は変わらないまま
         文字だけ外へ出る（実測 320px: 中身385px / 枠272px）。 */
      className={`font-en uppercase break-words ${centered ? "text-center" : ""} ${revealClass} ${className}`}
      style={{
        fontSize: "var(--section-label-size, 0.75rem)",
        color: "var(--section-label-color)",
        letterSpacing: "var(--section-label-tracking, 0.10em)",
        lineHeight: "var(--section-leading, 1.2)",
      }}
    >
      {children}
    </h1>
  );
}

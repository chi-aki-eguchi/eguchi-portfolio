import {
  colophonHasSubstance,
  seriesColophon,
  type ColophonPhoto,
} from "../lib/series-colophon";

/**
 * 作品群の奥付。
 *
 * 写真ごとの撮影情報はビューアの中にしか出ていなかった。作品群として
 * 「何点を、いつ、何で撮ったのか」はどこにも書かれていない。本の奥付と同じ
 * 位置——最後の写真のあと、次への導線の前——に、小さく置く。
 *
 * 見出しと値の表にしない。表にすると設定画面の見た目になり、
 * `admin-renewal-goal.md` の「AI感の削減」が避けろと言っている汎用UIそのもの
 * になる。事実を、行を変えながら静かに並べるだけにする。
 */
export function SeriesColophon({ photos }: { photos: ColophonPhoto[] }) {
  const c = seriesColophon(photos);
  if (!colophonHasSubstance(c) || !c) return null;

  // 「59点 ／ デジタル ／ 2024年8月」——分かっているものだけを繋ぐ。
  const head = [
    `${c.count}点`,
    c.medium ?? undefined,
    c.period ?? undefined,
  ].filter(Boolean) as string[];

  // レンズは1本ずつ nowrap で包む。素の文字列にすると
  // 「FE / 50mm F1.2 GM」のように**名前の途中で改行する**（実測）。
  // 折り返してよいのはレンズとレンズのあいだだけ。
  const lensLine = c.lenses.length ? (
    <>
      {c.lenses.map((lens, i) => (
        <span key={lens} className="series-colophon__item">
          {lens}
          {i < c.lenses.length - 1 ? "・" : ""}
        </span>
      ))}
      {c.lensesOmitted > 0 && (
        <span className="series-colophon__item">{` ほか${c.lensesOmitted}本`}</span>
      )}
    </>
  ) : null;

  return (
    <aside className="series-colophon page-entrance" aria-label="この作品群について">
      <p className="series-colophon__head font-en">{head.join(" ／ ")}</p>
      {c.cameras.length > 0 && (
        <p className="series-colophon__line font-en">
          {c.cameras.map((cam, i) => (
            <span key={cam} className="series-colophon__item">
              {cam}
              {i < c.cameras.length - 1 ? "・" : ""}
            </span>
          ))}
        </p>
      )}
      {lensLine && (
        <p className="series-colophon__line font-en">{lensLine}</p>
      )}
    </aside>
  );
}

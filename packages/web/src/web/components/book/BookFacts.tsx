import { mediumLine } from "../../lib/book";
import type { BookFacts } from "../../lib/book";

/** 章の事実。分かっていることだけを、行を変えて静かに並べる。 */
export function FactLines({ facts }: { facts: BookFacts }) {
  return (
    <div className="book-facts font-en">
      <p>
        {facts.count}
        <span className="book-facts__unit font-ja">枚</span>
        <span className="book-facts__sep" aria-hidden="true">／</span>
        <span className="font-ja">{mediumLine(facts, "ja")}</span>
      </p>
      {facts.cameras.length > 0 && <p>{facts.cameras.join(" ・ ")}</p>}
      {facts.digitalPeriod && (
        <p>
          <span className="font-ja">デジタル撮影 </span>
          {facts.digitalPeriod}
        </p>
      )}
    </div>
  );
}


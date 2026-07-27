import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import type {
  FullConfig,
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

// smokeが失敗した時に「何が・どこで・どう落ちたか」を必ずディスクへ残す。
// Playwrightの既定の出力先は実行のたびに消えるため、失敗の証拠が翌日には無い。
// ここでは実行ごとの専用フォルダへ書き、全部成功した実行だけ後片付けする。

type FailureRecord = {
  title: string;
  file: string;
  line: number;
  project: string;
  status: TestResult["status"];
  expectedStatus: TestCase["expectedStatus"];
  retry: number;
  durationMs: number;
  errors: string[];
  attachments: string[];
  stdout: string[];
  stderr: string[];
};

function textOf(chunks: readonly (string | Buffer)[]): string[] {
  return chunks.map((chunk) =>
    typeof chunk === "string" ? chunk : chunk.toString("utf8"),
  );
}

export default class EvidenceReporter implements Reporter {
  private readonly dir = process.env.SMOKE_EVIDENCE_DIR ?? "";
  private readonly failures: FailureRecord[] = [];
  private root = process.cwd();
  private startedAt = 0;
  private passed = 0;
  private skipped = 0;
  private readonly skippedTitles: string[] = [];

  onBegin(config: FullConfig): void {
    this.root = config.rootDir;
    this.startedAt = Date.now();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status === "skipped") {
      // 写真の枚数など実行時の条件で飛ぶテストがあり、実行のたびに件数が変わる。
      // 「落ちた」のか「そもそも走らなかった」のか後から分かるよう名前を残す。
      this.skipped += 1;
      this.skippedTitles.push(test.titlePath().filter(Boolean).join(" › "));
      return;
    }
    if (result.status === test.expectedStatus) {
      this.passed += 1;
      return;
    }
    const location = test.location;
    this.failures.push({
      title: test.titlePath().filter(Boolean).join(" › "),
      file: relative(this.root, location.file),
      line: location.line,
      project: test.parent.project()?.name ?? "unknown",
      status: result.status,
      expectedStatus: test.expectedStatus,
      retry: result.retry,
      durationMs: result.duration,
      errors: result.errors.map(
        (error) => error.stack ?? error.message ?? String(error),
      ),
      attachments: result.attachments
        .map((attachment) => attachment.path ?? "")
        .filter(Boolean)
        // 保存先フォルダの中から辿れる形にする（例: `artifacts/<テスト名>/trace.zip`）。
        .map((path) => relative(this.dir, path)),
      stdout: textOf(result.stdout),
      stderr: textOf(result.stderr),
    });
  }

  async onEnd(result: FullResult): Promise<void> {
    if (!this.dir) return;

    // 全部成功した実行は残さない。失敗した実行だけがフォルダとして残る。
    if (this.failures.length === 0) {
      rmSync(this.dir, { recursive: true, force: true });
      return;
    }

    mkdirSync(this.dir, { recursive: true });
    const summary = {
      finishedAt: new Date().toISOString(),
      status: result.status,
      durationMs: Date.now() - this.startedAt,
      passed: this.passed,
      failed: this.failures.length,
      skipped: this.skipped,
      skippedTitles: this.skippedTitles,
      failures: this.failures,
    };
    writeFileSync(
      `${this.dir}/summary.json`,
      `${JSON.stringify(summary, null, 2)}\n`,
      "utf8",
    );

    const lines = [
      `# smoke 失敗の記録 — ${summary.finishedAt}`,
      "",
      `結果: ${result.status} / 成功 ${this.passed} / 失敗 ${this.failures.length} / スキップ ${this.skipped}`,
      `所要: ${Math.round(summary.durationMs / 1000)}秒`,
      "",
    ];
    for (const failure of this.failures) {
      lines.push(
        `## ${failure.title}`,
        "",
        `- ファイル: \`${failure.file}:${failure.line}\``,
        `- 対象: ${failure.project}`,
        `- 状態: ${failure.status}（期待は ${failure.expectedStatus}）／再試行 ${failure.retry}回`,
        `- 所要: ${Math.round(failure.durationMs)}ms`,
        "",
        "```",
        ...failure.errors,
        "```",
        "",
      );
      if (failure.attachments.length > 0) {
        lines.push(
          "添付（スクリーンショット・トレース）:",
          ...failure.attachments.map((path) => `- \`${path}\``),
          "",
        );
      }
      if (failure.stderr.length > 0) {
        lines.push("標準エラー:", "```", ...failure.stderr, "```", "");
      }
    }
    writeFileSync(`${this.dir}/summary.md`, `${lines.join("\n")}\n`, "utf8");

    // 実行直後に見つけられるよう、保存先を最後に出す。
    process.stdout.write(`\n失敗の証拠を保存しました: ${this.dir}\n`);
  }
}

import { mkdir, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, extname, join } from "node:path";
import sharp from "sharp";

export const CONVERSION_SETTINGS = {
  maxPx: 3200,
  quality: 92,
  mozjpeg: true,
  chromaSubsampling: "4:4:4" as const,
  limitInputPixels: false,
};

export type ConvertSummary = {
  converted: string[];
  skipped: string[];
  failed: { file: string; reason: string }[];
  inputDir: string;
  outputDir: string;
};

type ConvertOptions = {
  inputDir?: string;
  outputDir?: string;
  log?: (message: string) => void;
};

const TIFF_EXTENSIONS = new Set([".tif", ".tiff"]);

function defaultInputDir(): string {
  return join(homedir(), "tiff-inbox");
}

function defaultOutputDir(): string {
  return join(homedir(), "tiff-converted");
}

function jpgNameFor(fileName: string): string {
  return `${basename(fileName, extname(fileName))}.jpg`;
}

function isTiff(fileName: string): boolean {
  return TIFF_EXTENSIONS.has(extname(fileName).toLowerCase());
}

function reasonFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function convertTiffInbox(
  options: ConvertOptions = {},
): Promise<ConvertSummary> {
  const inputDir = options.inputDir ?? defaultInputDir();
  const outputDir = options.outputDir ?? defaultOutputDir();
  const log = options.log ?? console.log;
  const summary: ConvertSummary = {
    converted: [],
    skipped: [],
    failed: [],
    inputDir,
    outputDir,
  };

  await mkdir(inputDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  const entries = (await readdir(inputDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && isTiff(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  if (!entries.length) {
    log(`TIFFが見つかりません: ${inputDir}`);
    return summary;
  }

  log(`入力: ${inputDir}`);
  log(`出力: ${outputDir}`);
  log(`${entries.length}件のTIFFを1件ずつ変換します。`);

  for (const entry of entries) {
    const sourcePath = join(inputDir, entry.name);
    const outputName = jpgNameFor(entry.name);
    const outputPath = join(outputDir, outputName);

    if (await pathExists(outputPath)) {
      summary.skipped.push(entry.name);
      log(`SKIP ${entry.name} -> ${outputName}（作成済み）`);
      continue;
    }

    try {
      log(`START ${entry.name} -> ${outputName}`);
      await sharp(sourcePath, {
        limitInputPixels: CONVERSION_SETTINGS.limitInputPixels,
      })
        .rotate()
        .resize({
          width: CONVERSION_SETTINGS.maxPx,
          height: CONVERSION_SETTINGS.maxPx,
          fit: "inside",
          withoutEnlargement: true,
        })
        .withMetadata()
        .jpeg({
          quality: CONVERSION_SETTINGS.quality,
          mozjpeg: CONVERSION_SETTINGS.mozjpeg,
          chromaSubsampling: CONVERSION_SETTINGS.chromaSubsampling,
        })
        .toFile(outputPath);
      summary.converted.push(entry.name);
      log(`OK ${entry.name} -> ${outputName}`);
    } catch (error) {
      const reason = reasonFromError(error);
      summary.failed.push({ file: entry.name, reason });
      log(`FAIL ${entry.name}: ${reason}`);
    }
  }

  log(
    `完了: 変換 ${summary.converted.length} / スキップ ${summary.skipped.length} / 失敗 ${summary.failed.length}`,
  );
  if (summary.failed.length) {
    log("失敗したファイル:");
    for (const failure of summary.failed) log(`- ${failure.file}: ${failure.reason}`);
  }

  return summary;
}

if (import.meta.main) {
  const summary = await convertTiffInbox();
  process.exit(summary.failed.length ? 1 : 0);
}

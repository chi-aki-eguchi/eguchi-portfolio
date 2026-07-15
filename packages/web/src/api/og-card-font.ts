import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const OG_CARD_FONT_PATH = resolve(
  import.meta.dir,
  "../../assets/fonts/NotoSerifJP.ttf",
);

type Point = { x: number; y: number; onCurve: boolean };
type Contour = Point[];
type Table = { offset: number; length: number };
type Glyph = {
  advanceWidth: number;
  contours: Contour[];
  path: string;
};

const fontData = readFileSync(OG_CARD_FONT_PATH);
const tables = readTables(fontData);
const head = requiredTable("head");
const hhea = requiredTable("hhea");
const maxp = requiredTable("maxp");
const cmap = requiredTable("cmap");
const glyf = requiredTable("glyf");
const hmtx = requiredTable("hmtx");
const loca = requiredTable("loca");

const unitsPerEm = fontData.readUInt16BE(head.offset + 18);
const indexToLocFormat = fontData.readInt16BE(head.offset + 50);
const numGlyphs = fontData.readUInt16BE(maxp.offset + 4);
const numLongHorMetrics = fontData.readUInt16BE(hhea.offset + 34);
const glyphOffsets = readGlyphOffsets();
const cmapLookup = createCmapLookup();
const glyphCache = new Map<number, Glyph>();

function readTables(data: Buffer): Map<string, Table> {
  const result = new Map<string, Table>();
  const count = data.readUInt16BE(4);
  for (let index = 0; index < count; index += 1) {
    const record = 12 + index * 16;
    result.set(data.toString("ascii", record, record + 4), {
      offset: data.readUInt32BE(record + 8),
      length: data.readUInt32BE(record + 12),
    });
  }
  return result;
}

function requiredTable(tag: string): Table {
  const table = tables.get(tag);
  if (!table) throw new Error(`Bundled OG font is missing its ${tag} table`);
  return table;
}

function readGlyphOffsets(): number[] {
  const offsets: number[] = [];
  for (let index = 0; index <= numGlyphs; index += 1) {
    offsets.push(
      indexToLocFormat === 0
        ? fontData.readUInt16BE(loca.offset + index * 2) * 2
        : fontData.readUInt32BE(loca.offset + index * 4),
    );
  }
  return offsets;
}

function createCmapLookup(): (codePoint: number) => number {
  const count = fontData.readUInt16BE(cmap.offset + 2);
  const candidates: Array<{
    offset: number;
    format: number;
    priority: number;
  }> = [];

  for (let index = 0; index < count; index += 1) {
    const record = cmap.offset + 4 + index * 8;
    const platform = fontData.readUInt16BE(record);
    const encoding = fontData.readUInt16BE(record + 2);
    const offset = cmap.offset + fontData.readUInt32BE(record + 4);
    const format = fontData.readUInt16BE(offset);
    if (format !== 4 && format !== 12) continue;
    const priority =
      format === 12 && platform === 3 && encoding === 10
        ? 4
        : format === 12
          ? 3
          : platform === 3
            ? 2
            : 1;
    candidates.push({ offset, format, priority });
  }

  const selected = candidates.sort((a, b) => b.priority - a.priority)[0];
  if (!selected) throw new Error("Bundled OG font has no supported cmap table");

  if (selected.format === 12) {
    const groupCount = fontData.readUInt32BE(selected.offset + 12);
    const groupsOffset = selected.offset + 16;
    return (codePoint) => {
      let low = 0;
      let high = groupCount - 1;
      while (low <= high) {
        const middle = (low + high) >>> 1;
        const group = groupsOffset + middle * 12;
        const start = fontData.readUInt32BE(group);
        const end = fontData.readUInt32BE(group + 4);
        if (codePoint < start) high = middle - 1;
        else if (codePoint > end) low = middle + 1;
        else return fontData.readUInt32BE(group + 8) + codePoint - start;
      }
      return 0;
    };
  }

  const segCount = fontData.readUInt16BE(selected.offset + 6) / 2;
  const endCodes = selected.offset + 14;
  const startCodes = endCodes + segCount * 2 + 2;
  const deltas = startCodes + segCount * 2;
  const rangeOffsets = deltas + segCount * 2;
  return (codePoint) => {
    if (codePoint > 0xffff) return 0;
    for (let index = 0; index < segCount; index += 1) {
      const end = fontData.readUInt16BE(endCodes + index * 2);
      if (codePoint > end) continue;
      const start = fontData.readUInt16BE(startCodes + index * 2);
      if (codePoint < start) return 0;
      const delta = fontData.readInt16BE(deltas + index * 2);
      const rangeOffsetEntry = rangeOffsets + index * 2;
      const rangeOffset = fontData.readUInt16BE(rangeOffsetEntry);
      if (rangeOffset === 0) return (codePoint + delta) & 0xffff;
      const glyphAddress =
        rangeOffsetEntry + rangeOffset + (codePoint - start) * 2;
      if (glyphAddress + 2 > cmap.offset + cmap.length) return 0;
      const glyphId = fontData.readUInt16BE(glyphAddress);
      return glyphId === 0 ? 0 : (glyphId + delta) & 0xffff;
    }
    return 0;
  };
}

function advanceWidth(glyphId: number): number {
  const metric = Math.min(glyphId, numLongHorMetrics - 1);
  return fontData.readUInt16BE(hmtx.offset + metric * 4);
}

function f2dot14(offset: number): number {
  return fontData.readInt16BE(offset) / 16384;
}

function glyphContours(glyphId: number, depth = 0): Contour[] {
  if (glyphId < 0 || glyphId >= numGlyphs || depth > 12) return [];
  const start = glyf.offset + glyphOffsets[glyphId];
  const end = glyf.offset + glyphOffsets[glyphId + 1];
  if (start === end) return [];

  const contourCount = fontData.readInt16BE(start);
  if (contourCount >= 0) return simpleGlyphContours(start, contourCount);
  return compoundGlyphContours(start, depth);
}

function simpleGlyphContours(offset: number, contourCount: number): Contour[] {
  if (contourCount === 0) return [];
  const endPoints: number[] = [];
  let cursor = offset + 10;
  for (let index = 0; index < contourCount; index += 1) {
    endPoints.push(fontData.readUInt16BE(cursor));
    cursor += 2;
  }

  const pointCount = endPoints.at(-1)! + 1;
  const instructionLength = fontData.readUInt16BE(cursor);
  cursor += 2 + instructionLength;

  const flags: number[] = [];
  while (flags.length < pointCount) {
    const flag = fontData[cursor++];
    flags.push(flag);
    if ((flag & 0x08) !== 0) {
      const repeats = fontData[cursor++];
      for (let count = 0; count < repeats; count += 1) flags.push(flag);
    }
  }

  const xCoordinates: number[] = [];
  let x = 0;
  for (const flag of flags) {
    if ((flag & 0x02) !== 0) {
      const delta = fontData[cursor++];
      x += (flag & 0x10) !== 0 ? delta : -delta;
    } else if ((flag & 0x10) === 0) {
      x += fontData.readInt16BE(cursor);
      cursor += 2;
    }
    xCoordinates.push(x);
  }

  const points: Point[] = [];
  let y = 0;
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if ((flag & 0x04) !== 0) {
      const delta = fontData[cursor++];
      y += (flag & 0x20) !== 0 ? delta : -delta;
    } else if ((flag & 0x20) === 0) {
      y += fontData.readInt16BE(cursor);
      cursor += 2;
    }
    points.push({
      x: xCoordinates[index],
      y,
      onCurve: (flag & 0x01) !== 0,
    });
  }

  const contours: Contour[] = [];
  let first = 0;
  for (const last of endPoints) {
    contours.push(points.slice(first, last + 1));
    first = last + 1;
  }
  return contours;
}

function compoundGlyphContours(offset: number, depth: number): Contour[] {
  const contours: Contour[] = [];
  let cursor = offset + 10;
  let more = true;

  while (more) {
    const flags = fontData.readUInt16BE(cursor);
    const componentGlyph = fontData.readUInt16BE(cursor + 2);
    cursor += 4;

    const words = (flags & 0x0001) !== 0;
    const xyValues = (flags & 0x0002) !== 0;
    const arg1 = words
      ? xyValues
        ? fontData.readInt16BE(cursor)
        : fontData.readUInt16BE(cursor)
      : xyValues
        ? fontData.readInt8(cursor)
        : fontData[cursor];
    const arg2 = words
      ? xyValues
        ? fontData.readInt16BE(cursor + 2)
        : fontData.readUInt16BE(cursor + 2)
      : xyValues
        ? fontData.readInt8(cursor + 1)
        : fontData[cursor + 1];
    cursor += words ? 4 : 2;

    let xx = 1;
    let xy = 0;
    let yx = 0;
    let yy = 1;
    if ((flags & 0x0008) !== 0) {
      xx = yy = f2dot14(cursor);
      cursor += 2;
    } else if ((flags & 0x0040) !== 0) {
      xx = f2dot14(cursor);
      yy = f2dot14(cursor + 2);
      cursor += 4;
    } else if ((flags & 0x0080) !== 0) {
      xx = f2dot14(cursor);
      xy = f2dot14(cursor + 2);
      yx = f2dot14(cursor + 4);
      yy = f2dot14(cursor + 6);
      cursor += 8;
    }

    const component = glyphContours(componentGlyph, depth + 1).map((contour) =>
      contour.map((point) => ({
        x: point.x * xx + point.y * xy,
        y: point.x * yx + point.y * yy,
        onCurve: point.onCurve,
      })),
    );

    let dx = xyValues ? arg1 : 0;
    let dy = xyValues ? arg2 : 0;
    if (!xyValues) {
      const parentPoint = contours.flat()[arg1];
      const componentPoint = component.flat()[arg2];
      if (parentPoint && componentPoint) {
        dx = parentPoint.x - componentPoint.x;
        dy = parentPoint.y - componentPoint.y;
      }
    }
    if ((flags & 0x0004) !== 0) {
      dx = Math.round(dx);
      dy = Math.round(dy);
    }

    contours.push(
      ...component.map((contour) =>
        contour.map((point) => ({
          ...point,
          x: point.x + dx,
          y: point.y + dy,
        })),
      ),
    );
    more = (flags & 0x0020) !== 0;
  }

  return contours;
}

function point(value: Point): string {
  return `${round(value.x)} ${round(value.y)}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function contourPath(contour: Contour): string {
  if (contour.length === 0) return "";
  const first = contour[0];
  const last = contour.at(-1)!;
  const start = first.onCurve
    ? first
    : last.onCurve
      ? last
      : {
          x: (first.x + last.x) / 2,
          y: (first.y + last.y) / 2,
          onCurve: true,
        };
  let path = `M${point(start)}`;
  let index = first.onCurve ? 1 : 0;

  while (index < contour.length) {
    const current = contour[index];
    if (current.onCurve) {
      path += `L${point(current)}`;
      index += 1;
      continue;
    }

    const next = index + 1 < contour.length ? contour[index + 1] : start;
    if (next.onCurve) {
      path += `Q${point(current)} ${point(next)}`;
      index += 2;
    } else {
      const middle = {
        x: (current.x + next.x) / 2,
        y: (current.y + next.y) / 2,
        onCurve: true,
      };
      path += `Q${point(current)} ${point(middle)}`;
      index += 1;
    }
  }
  return `${path}Z`;
}

function glyph(glyphId: number): Glyph {
  const cached = glyphCache.get(glyphId);
  if (cached) return cached;
  const contours = glyphContours(glyphId);
  const result = {
    advanceWidth: advanceWidth(glyphId),
    contours,
    path: contours.map(contourPath).join(""),
  };
  glyphCache.set(glyphId, result);
  return result;
}

export function bundledFontTextPath(
  text: string,
  options: {
    centerX: number;
    centerY: number;
    fontSize: number;
    letterSpacing: number;
  },
): string {
  const glyphs = Array.from(text, (character) =>
    glyph(cmapLookup(character.codePointAt(0)!)),
  );
  const scale = options.fontSize / unitsPerEm;
  const letterSpacingUnits = options.letterSpacing / scale;
  const totalAdvance =
    glyphs.reduce((total, current) => total + current.advanceWidth, 0) +
    Math.max(0, glyphs.length - 1) * letterSpacingUnits;
  let yMin = Number.POSITIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;
  for (const current of glyphs) {
    for (const contour of current.contours) {
      for (const currentPoint of contour) {
        yMin = Math.min(yMin, currentPoint.y);
        yMax = Math.max(yMax, currentPoint.y);
      }
    }
  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) yMin = yMax = 0;
  const x = options.centerX - (totalAdvance * scale) / 2;
  const baselineY = options.centerY + ((yMin + yMax) * scale) / 2;

  let penX = 0;
  const paths = glyphs
    .map((current) => {
      const path = current.path
        ? `<path d="${current.path}" transform="translate(${round(penX)} 0)"/>`
        : "";
      penX += current.advanceWidth + letterSpacingUnits;
      return path;
    })
    .join("");

  return `<g data-font-source="bundled-ttf-outline" transform="translate(${round(x)} ${round(baselineY)}) scale(${round(scale)} ${round(-scale)})">${paths}</g>`;
}

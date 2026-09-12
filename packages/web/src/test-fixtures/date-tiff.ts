// A real 1x1 grayscale TIFF. Dates live in TIFF IFDs, not a JPEG EXIF blob.
export function dateTiff(
  original?: string,
  digitized?: string,
  xmp?: string,
  bigEndian = false,
) {
  const buffer = Buffer.alloc(2048);
  buffer.write(bigEndian ? "MM" : "II");
  const u16 = (n: number, offset: number) =>
    bigEndian
      ? buffer.writeUInt16BE(n, offset)
      : buffer.writeUInt16LE(n, offset);
  const u32 = (n: number, offset: number) =>
    bigEndian
      ? buffer.writeUInt32BE(n, offset)
      : buffer.writeUInt32LE(n, offset);
  u16(42, 2);
  u32(8, 4);
  const tags: [number, number, number, number][] = [
    [256, 4, 1, 1],
    [257, 4, 1, 1],
    [258, 3, 1, 8],
    [259, 3, 1, 1],
    [262, 3, 1, 1],
    [273, 4, 1, 1900],
    [277, 3, 1, 1],
    [278, 4, 1, 1],
    [279, 4, 1, 1],
  ];
  if (original || digitized) tags.push([34665, 4, 1, 200]);
  if (xmp) {
    const bytes = Buffer.from(xmp);
    bytes.copy(buffer, 700);
    tags.push([700, 1, bytes.length, 700]);
  }
  const ifd = (offset: number, entries: typeof tags) => {
    entries.sort((a, b) => a[0] - b[0]);
    u16(entries.length, offset);
    entries.forEach(([tag, type, count, value], i) => {
      const pos = offset + 2 + i * 12;
      u16(tag, pos);
      u16(type, pos + 2);
      u32(count, pos + 4);
      if (type === 3 && count === 1) u16(value, pos + 8);
      else u32(value, pos + 8);
    });
  };
  ifd(8, tags);
  const exif: typeof tags = [];
  if (original) {
    buffer.write(original + "\0", 300);
    exif.push([36867, 2, 20, 300]);
  }
  if (digitized) {
    buffer.write(digitized + "\0", 340);
    exif.push([36868, 2, 20, 340]);
  }
  ifd(200, exif);
  buffer[1900] = 128;
  return buffer;
}

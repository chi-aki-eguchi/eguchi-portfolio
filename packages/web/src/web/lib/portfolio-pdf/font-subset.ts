/**
 * PDF に入れる日本語フォントを、使う文字だけに減らす（2026-10-02）。
 *
 * 以前は Noto Sans JP（5.7MB）を丸ごと埋め込み、どの PDF にも約3.4MB 余分に
 * 付いていた。pdf-lib＋fontkit のサブセット化は日本語の字形を壊したので
 * （public/fonts/pdf/README.md）、HarfBuzz（hb-subset、Google Fonts と同じ
 * 標準の道具）で先に減らし、出来たフォントを pdf-lib へはそのまま渡す。
 * 字形・字幅は元のフォントのまま。glyph の番号は振り直されるが、cmap も
 * 一緒に作り直されるので、pdf-lib はこのフォントだけを見て正しく描ける。
 *
 * wasm（harfbuzzjs の harfbuzz-subset.wasm、MIT）は外から何も読み込まない
 * 単体の物。呼ぶたびに新しく起こし、使い終わったら捨てる（PDF 1冊に1回）。
 */
type HbExports = {
  memory: WebAssembly.Memory;
  malloc(size: number): number;
  free(ptr: number): void;
  hb_blob_create(data: number, length: number, mode: number, userData: number, destroy: number): number;
  hb_blob_destroy(blob: number): void;
  hb_blob_get_data(blob: number, lengthPtr: number): number;
  hb_blob_get_length(blob: number): number;
  hb_face_create(blob: number, index: number): number;
  hb_face_destroy(face: number): void;
  hb_face_reference_blob(face: number): number;
  hb_subset_input_create_or_fail(): number;
  hb_subset_input_destroy(input: number): void;
  hb_subset_input_unicode_set(input: number): number;
  hb_set_add(set: number, codepoint: number): void;
  hb_subset_or_fail(face: number, input: number): number;
};

/** HB_MEMORY_MODE_WRITABLE: 渡した領域を HarfBuzz がそのまま使う。 */
const MEMORY_MODE_WRITABLE = 2;

export async function subsetFont(
  fontBytes: Uint8Array,
  text: Iterable<string>,
  wasmBytes: Uint8Array,
): Promise<Uint8Array> {
  const { instance } = await WebAssembly.instantiate(wasmBytes);
  const hb = instance.exports as unknown as HbExports;
  const heap = () => new Uint8Array(hb.memory.buffer);
  const fontPtr = hb.malloc(fontBytes.byteLength);
  if (!fontPtr) throw new Error("font subset: out of memory");
  heap().set(fontBytes, fontPtr);
  const blob = hb.hb_blob_create(fontPtr, fontBytes.byteLength, MEMORY_MODE_WRITABLE, 0, 0);
  const face = hb.hb_face_create(blob, 0);
  hb.hb_blob_destroy(blob);
  const input = hb.hb_subset_input_create_or_fail();
  if (!input) {
    hb.hb_face_destroy(face);
    hb.free(fontPtr);
    throw new Error("font subset: input");
  }
  const unicodes = hb.hb_subset_input_unicode_set(input);
  // 空白は行の組み立てに要る。数字はページ番号に使う。
  for (const ch of new Set([...Array.from(" 0123456789"), ...Array.from(text).flatMap((s) => Array.from(s))])) {
    hb.hb_set_add(unicodes, ch.codePointAt(0)!);
  }
  const subset = hb.hb_subset_or_fail(face, input);
  hb.hb_subset_input_destroy(input);
  hb.hb_face_destroy(face);
  if (!subset) {
    hb.free(fontPtr);
    throw new Error("font subset: failed");
  }
  const result = hb.hb_face_reference_blob(subset);
  const ptr = hb.hb_blob_get_data(result, 0);
  const length = hb.hb_blob_get_length(result);
  const out = heap().slice(ptr, ptr + length);
  hb.hb_blob_destroy(result);
  hb.hb_face_destroy(subset);
  hb.free(fontPtr);
  if (length < 12) throw new Error("font subset: empty");
  return out;
}

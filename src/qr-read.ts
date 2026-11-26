// THE APPLICATION'S QR CODE, READ BACK (Trade Ops workbench)
// The JavaScript LC prints a QR code of all its answers on its last page (lcPayload, "Generate QR Code"). When a
// customer prints the form or "Saves as PDF", the fields and scripts are gone but the QR code is still a picture on the
// page. Here it is found and decoded (zxing-wasm), and its JSON is matched against what else the PDF holds:
//   - fields still there: every answer in the QR code must equal the field's answer (a stale code is flagged);
//   - fields gone (printed): every typed answer in the QR code must appear in the printed text of the pages.
//   - lc-form's LC splits long answers into up to 16 codes ("QR code 3 of 7", QR structured append); they are put in
//     order by each code's own label and joined (joinResult). Every code is read with zxing-wasm, the same ZXing engine as lc-form's read_qr.py.
import { PDFDocument, PDFTextField } from "pdf-lib";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";
import { getDocument } from "pdfjs-dist";
import { PDFJS } from "./text"; // also sets up pdf.js's worker
import { type Field, type Template, type Value } from "./pdf";

/** What lcPayload puts in the QR code. */
export interface Payload {
  form: string;
  version: string;
  saved: string;
  complete: boolean;
  data: Record<string, Value>;
  truncated?: string[]; // paragraphs shortened to fit (they end in "...")
}
export interface Mismatch { id: string; label: string; qr: string; pdf: string }

/** The QR code's text as a payload, or undefined when it isn't one of ours. */
export function parsePayload(text: string): Payload | undefined {
  try {
    const p = JSON.parse(text); // (JSON's own white space, such as the padding spaces, is fine; a BOM or no-break space is not)
    return p && typeof p === "object" && typeof p.data === "object" && p.data && "form" in p ? p : undefined;
  } catch {
    return undefined;
  }
}

const shown = (v: Value | undefined) => (v === true ? "Yes" : v === false || v === undefined ? "" : Array.isArray(v) ? v.join(", ") : v);
const squash = (s: string) => s.replace(/\s+/g, " ").trim();
/** One form for comparing: blank, unticked and an empty list are all "". */
const canon = (v: unknown) =>
  v === undefined || v === null || v === false || v === "" ? "" : v === true ? "true" :
  Array.isArray(v) ? [...v].map(String).sort().join("|") : squash(String(v));
const fields = (t: Template) => t.sections.flatMap(s => s.fields);
/** A shortened paragraph matches when the full answer starts with what the code kept. */
const cut = (p: Payload, f: Field, qr: string) => p.truncated?.includes(f.id) && qr.endsWith("...") ? qr.slice(0, -3).trim() : undefined;

/** Fields still in the PDF: each answer must be the same in the QR code. */
export function matchFields(t: Template, p: Payload, data: Record<string, unknown>): Mismatch[] {
  const out: Mismatch[] = [];
  for (const f of fields(t)) {
    const qr = canon(p.data[f.id]), pdf = canon(data[f.id]);
    if (qr === pdf) continue;
    const kept = cut(p, f, qr);
    if (kept !== undefined && pdf.startsWith(kept)) continue;
    out.push({ id: f.id, label: f.label, qr: shown(p.data[f.id]), pdf: shown(data[f.id] as Value) });
  }
  return out;
}

/** Printed PDF (no fields): every typed answer in the QR code must be in the pages' text. Choices (ticks, options,
 *  lists) can't be told from printed text, so they are taken from the QR code as they are.
 *  Some viewers print or save a form without its answers as text (drawn as shapes, or as a picture): then most
 *  answers are "missing" though nothing is wrong. So when fewer than half are found, the pages are `readable: false`
 *  and nothing is flagged; the QR code is the record. */
export function matchPrinted(t: Template, p: Payload, text: string): { mismatches: Mismatch[]; readable: boolean } {
  const page = squash(text).toUpperCase(), out: Mismatch[] = [];
  let typed = 0;
  for (const f of fields(t)) {
    const v = p.data[f.id];
    if (typeof v !== "string" || !v || !(f.kind === "text" || f.kind === "long" || f.kind === "date")) continue;
    typed++;
    const want = squash(cut(p, f, v) ?? v).toUpperCase();
    if (!page.includes(want)) out.push({ id: f.id, label: f.label, qr: v, pdf: "not found on the printed pages" });
  }
  const readable = out.length <= typed / 2; // ponytail: a half-found threshold; tune if real customer PDFs sit near it
  return { mismatches: readable ? out : [], readable };
}

/** One QR code read from a picture: its raw bytes, and its place in a structured-append set: index (0-based), size
 *  (total) and id (the QR parity, as a string). index is -1 when the code is not in a set. */
export interface Code { bytes: Uint8Array; index: number; size: number; id: string }

/** The most codes an application can have (QR structured append allows 16), and the most bytes they can hold. */
export const MAX_CODES = 16;
const MAX_BYTES = MAX_CODES * 2329;
/** Thrown by readQr when QR codes were found but can't make one application; the message says why. */
export class QrRefusal extends Error {}

export type Joined = { payload: Payload } | { error: string };

const key = (c: Code) => `${c.index},${c.size},${c.id},${c.bytes.join(",")}`;
const numbers = (a: number[]) => (a.length === 1 ? `code ${a[0]}` : `codes ${a.join(", ")}`);
/** The bytes as UTF-8 text, or undefined when they are not valid UTF-8 (a damaged code; never guessed at). */
const utf8 = (b: Uint8Array) => { try { return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(b); } catch { return undefined; } };
const parseBytes = (b: Uint8Array) => { const t = utf8(b); return t === undefined ? undefined : parsePayload(t); };
const concat = (order: Code[]) => {
  const all = new Uint8Array(order.reduce((n, c) => n + c.bytes.length, 0));
  order.reduce((at, c) => (all.set(c.bytes, at), at + c.bytes.length), 0);
  return all;
};

/** The application from 1 to 16 codes found anywhere (any page, any order). Codes that carry the structured-append label
 *  are ordered by it (index, total, and the parity every code of one application shares); they are never ordered by
 *  trying permutations. Codes without the label (some scanners drop it) are accepted only as one or two, in either order.
 *  Bytes are joined before decoding, so a character split between two codes survives. The text is parsed as JSON only. */
export function joinResult(codes: Code[]): Joined {
  if (!codes.length) return { error: "No QR code found." };
  const list = [...new Map(codes.map(c => [key(c), c])).values()]; // the same code twice counts once
  const labelled = list.filter(c => c.index >= 0), plain = list.filter(c => c.index < 0);
  if (labelled.length && plain.length) return { error: 'Some QR codes are labelled "code N of M" and some are not: they come from different applications. Scan one application at a time.' };
  if (plain.length) {
    if (plain.length > 2) return { error: `Found ${plain.length} different QR codes without a "code N of M" label; scan one application at a time.` };
    for (const order of plain.length === 1 ? [plain] : [plain, [...plain].reverse()]) {
      const p = parseBytes(concat(order));
      if (p) return { payload: p };
    }
    return { error: plain.length === 1 ? "The QR code is only part of an application, or not one of ours. Scan all its codes." : "The two QR codes don't belong together." };
  }
  if (list.some(c => !/^[0-9]{1,3}$/.test(c.id))) return { error: "A QR code's check value (parity) is not a number." };
  const ids = new Set(list.map(c => c.id));
  if (ids.size > 1) return { error: `The QR codes come from ${ids.size} different applications (their check values differ). Scan one application at a time.` };
  const sizes = [...new Set(list.map(c => c.size))].sort((a, b) => a - b);
  if (sizes.length > 1) return { error: `The QR codes disagree on how many codes there are (${sizes.join(" and ")}). Scan one application at a time.` };
  const [n] = sizes;
  if (!(n >= 1 && n <= MAX_CODES)) return { error: `The QR codes say they are one of ${n}; an application has 1 to ${MAX_CODES}.` };
  const byIndex = new Map<number, Code>();
  for (const c of list) {
    if (c.index >= n) return { error: `A QR code says it is code ${c.index + 1} of ${n}.` };
    if (byIndex.has(c.index)) return { error: `Two different QR codes both say they are code ${c.index + 1} of ${n}: they come from different applications. Scan one application at a time.` };
    byIndex.set(c.index, c);
  }
  const missing = Array.from({ length: n }, (_, i) => i).filter(i => !byIndex.has(i)).map(i => i + 1);
  if (missing.length) return { error: `${numbers(missing)} of ${n} not found; scan all ${n} codes.`.replace(/^c/, "C") };
  const ordered = Array.from({ length: n }, (_, i) => byIndex.get(i)!);
  const all = concat(ordered);
  if (all.length > MAX_BYTES) return { error: `The QR text is longer than ${MAX_CODES} codes can hold: it didn't come from this form.` };
  if (all.reduce((x, b) => x ^ b, 0) !== Number(ordered[0].id)) return { error: "The joined QR text doesn't match its check value (parity): a code is damaged, or the codes come from different applications." };
  const p = parseBytes(all); // JSON.parse allows the trailing padding spaces
  return p ? { payload: p } : { error: "The QR codes join up, but are not an application from these forms." };
}
/** joinResult, as the payload or undefined (the reason is in joinResult). */
export function joinCodes(codes: Code[]): Payload | undefined {
  const r = joinResult(codes);
  return "payload" in r ? r.payload : undefined;
}

// The browser loads the reader's WebAssembly from this site, not zxing-wasm's default CDN.
if (typeof document !== "undefined") prepareZXingModule({ overrides: { locateFile: (p: string, prefix: string) => (p.endsWith(".wasm") ? wasmUrl : prefix + p) } });

/** Every QR code in a picture (a page, or an uploaded scan). */
export async function codesIn(img: ImageData | Blob): Promise<Code[]> {
  const found = await readBarcodes(img, { formats: ["QRCode"], tryHarder: true, maxNumberOfSymbols: MAX_CODES });
  return found.filter(r => r.isValid).map(r => ({ bytes: r.bytes, index: r.sequenceIndex, size: r.sequenceSize, id: r.sequenceId }));
}

/** The application from the codes found on all the pages read (page numbers are 1-based): the same decision as joinResult
 *  over every code together. undefined: no code on any page. Throws QrRefusal (with the reason) when codes were found
 *  but they are not one whole application. `page` is the highest page that holds a code. */
export function joinPages(pages: { page: number; codes: Code[] }[]): { payload: Payload; page: number; codes: number } | undefined {
  const codes = pages.flatMap(p => p.codes);
  if (!codes.length) return undefined;
  const read = joinResult(codes);
  if ("error" in read) throw new QrRefusal(read.error);
  return { payload: read.payload, page: Math.max(...pages.filter(p => p.codes.length).map(p => p.page)), codes: new Set(codes.map(key)).size };
}

/** Finds and decodes the QR code(s) on the last page (where the form prints them); `all`: then the other pages too (a
 *  printed copy may have its pages in another order, or its codes on separate pages). */
export async function readQr(bytes: Uint8Array, all = false): Promise<{ payload: Payload; page: number; codes: number } | undefined> {
  // Form saved with its fields: "Generate QR Code" also keeps the code's text in the hidden field "__qr". Exact, no picture.
  const kept = await qrField(bytes).catch(() => undefined);
  if (kept) return { ...kept, codes: 0 };
  const doc = await getDocument({ data: bytes.slice(), ...PDFJS }).promise;
  try {
    const pages: { page: number; codes: Code[] }[] = [];
    for (let n = doc.numPages; n >= (all ? 1 : doc.numPages); n--) {
      const page = await doc.getPage(n);
      // 1. One code as printed text (the studio form draws its squares as ZapfDingbats "n"): rebuilt from where each square is.
      const items = (await page.getTextContent()).items.filter(i => "str" in i) as { str: string; transform: number[] }[];
      const fromText = await qrFromText(items), payload = fromText && parsePayload(fromText);
      if (payload) return { payload, page: n, codes: 1 };
      // 2. A picture of the page (a scan, or a copy whose text was turned into shapes), read by zxing: up to 16 codes.
      // ponytail: one scale (2x ≈ 144 dpi of the PDF page; a scanned page keeps its own pixels); add more if real scans fail.
      const vp = page.getViewport({ scale: 2 }), canvas = document.createElement("canvas");
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, viewport: vp }).promise;
      pages.push({ page: n, codes: await codesIn(ctx.getImageData(0, 0, canvas.width, canvas.height)) });
    }
    return joinPages(pages); // every page is read before deciding, so codes of another application on another page are seen
  } finally {
    await doc.destroy();
  }
}

/** The code's text from the hidden field "__qr", with the page its rows are on. */
async function qrField(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const field = doc.getForm().getFieldMaybe("__qr");
  const payload = field instanceof PDFTextField ? parsePayload(field.getText() ?? "") : undefined;
  if (!payload) return undefined;
  // The studio's form names its rows "__qr_0"...; lc-form's "__qr1_0"... (and "__qr2_..." for a second code).
  const row = (doc.getForm().getFieldMaybe("__qr_0") ?? doc.getForm().getFieldMaybe("__qr1_0"))?.acroField.getWidgets()[0]?.P();
  const page = doc.getPages().findIndex(p => p.ref === row);
  return { payload, page: page < 0 ? doc.getPageCount() : page + 1 };
}

/** The text of a QR code drawn as text: every square a ZapfDingbats "n" (or "■") in a small font, as the form's
 *  lcDrawQr writes its 177 rows. Each square's place gives its row and column; the code is redrawn clean and read. */
export async function qrFromText(items: { str: string; transform: number[] }[]): Promise<string | undefined> {
  const runs = items.filter(i => /^[n\u25a0 ]+$/.test(i.str) && /[n\u25a0]/.test(i.str) && Math.abs(i.transform[3]) < 6);
  if (runs.length < 50) return undefined;
  // One square's width: the smallest step between where runs start (a run is a few squares side by side).
  const xs = [...new Set(runs.map(i => Math.round(i.transform[4] * 100) / 100))].sort((a, b) => a - b);
  let pitch = Infinity;
  for (let k = 1; k < xs.length; k++) if (xs[k] - xs[k - 1] > 0.5) pitch = Math.min(pitch, xs[k] - xs[k - 1]);
  if (!isFinite(pitch)) return undefined;
  const dark: [number, number][] = [];
  for (const i of runs) [...i.str].forEach((c, k) => c !== " " && dark.push([i.transform[4] + k * pitch, i.transform[5]]));
  const x0 = Math.min(...dark.map(d => d[0])), y0 = Math.max(...dark.map(d => d[1]));
  const cells = dark.map(([x, y]) => [Math.round((x - x0) / pitch), Math.round((y0 - y) / pitch)]);
  const n = Math.max(...cells.flat()) + 1;
  if (n < 21 || n > 177) return undefined;
  // Redraw: 4 pixels a square, 4 white squares around.
  const px = 4, w = (n + 8) * px, img = new Uint8ClampedArray(w * w * 4).fill(255);
  for (const [cx, cy] of cells)
    for (let dy = 0; dy < px; dy++) {
      const at = (((cy + 4) * px + dy) * w + (cx + 4) * px) * 4;
      for (let dx = 0; dx < px; dx++) img.fill(0, at + dx * 4, at + dx * 4 + 3);
    }
  const [code] = await readBarcodes({ data: img, width: w, height: w, colorSpace: "srgb" }, { formats: ["QRCode"], maxNumberOfSymbols: 1 });
  return code?.isValid ? code.text : undefined;
}

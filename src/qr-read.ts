// THE APPLICATION'S QR CODE, READ BACK (Trade Ops workbench)
// The JavaScript LC prints a QR code of all its answers on its last page (lcPayload, "Generate QR Code"). When a
// customer prints the form or "Saves as PDF", the fields and scripts are gone but the QR code is still a picture on the
// page. Here it is found and decoded (jsQR), and its JSON is matched against what else the PDF holds:
//   - fields still there: every answer in the QR code must equal the field's answer (a stale code is flagged);
//   - fields gone (printed): every typed answer in the QR code must appear in the printed text of the pages.
import jsQR from "jsqr";
import { PDFDocument, PDFTextField } from "pdf-lib";
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
    const p = JSON.parse(text.trim());
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
 *  lists) can't be told from printed text, so they are taken from the QR code as they are. */
export function matchPrinted(t: Template, p: Payload, text: string): Mismatch[] {
  const page = squash(text).toUpperCase(), out: Mismatch[] = [];
  for (const f of fields(t)) {
    const v = p.data[f.id];
    if (typeof v !== "string" || !v || !(f.kind === "text" || f.kind === "long" || f.kind === "date")) continue;
    const want = squash(cut(p, f, v) ?? v).toUpperCase();
    if (!page.includes(want)) out.push({ id: f.id, label: f.label, qr: v, pdf: "not found on the printed pages" });
  }
  return out;
}

/** Finds and decodes the QR code on the last page (where the form prints it); `all`: then the other pages too (a
 *  printed copy may have its pages in another order or the code page scanned separately). */
export async function readQr(bytes: Uint8Array, all = false): Promise<{ payload: Payload; page: number } | undefined> {
  // Form saved with its fields: "Generate QR Code" also keeps the code's text in the hidden field "__qr". Exact, no picture.
  const kept = await qrField(bytes).catch(() => undefined);
  if (kept) return kept;
  const doc = await getDocument({ data: bytes.slice(), ...PDFJS }).promise;
  try {
    for (let n = doc.numPages; n >= (all ? 1 : doc.numPages); n--) {
      const page = await doc.getPage(n);
      // 1. The code as printed text (the form draws its squares as ZapfDingbats "n"): rebuilt from where each square is.
      const items = (await page.getTextContent()).items.filter(i => "str" in i) as { str: string; transform: number[] }[];
      const fromText = qrFromText(items), payload = fromText && parsePayload(fromText);
      if (payload) return { payload, page: n };
      // 2. A picture of the page (a scan, or a copy whose text was turned into shapes). The squares drawn as text have
      //    thin white gaps between them, which confuse the reader at some sizes: so several sizes are tried.
      // ponytail: a few fixed scales; add a gap-closing filter or a stronger reader (zxing) if real scans fail.
      for (const scale of [2, 1.75, 3]) {
        const vp = page.getViewport({ scale }), canvas = document.createElement("canvas");
        canvas.width = Math.ceil(vp.width);
        canvas.height = Math.ceil(vp.height);
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, viewport: vp }).promise;
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        const read = code && parsePayload(code.data);
        if (read) return { payload: read, page: n };
      }
    }
    return undefined;
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
  const row = doc.getForm().getFieldMaybe("__qr_0")?.acroField.getWidgets()[0]?.P();
  const page = doc.getPages().findIndex(p => p.ref === row);
  return { payload, page: page < 0 ? doc.getPageCount() : page + 1 };
}

/** The text of a QR code drawn as text: every square a ZapfDingbats "n" (or "■") in a small font, as the form's
 *  lcDrawQr writes its 177 rows. Each square's place gives its row and column; the code is redrawn clean and read. */
export function qrFromText(items: { str: string; transform: number[] }[]): string | undefined {
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
  return jsQR(img, w, w, { inversionAttempts: "dontInvert" })?.data;
}

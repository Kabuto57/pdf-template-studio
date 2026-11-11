// THE APPLICATION'S QR CODE, READ BACK (Trade Ops workbench)
// The JavaScript LC prints a QR code of all its answers on its last page (lcPayload, "Generate QR Code"). When a
// customer prints the form or "Saves as PDF", the fields and scripts are gone but the QR code is still a picture on the
// page. Here it is found and decoded (jsQR), and its JSON is matched against what else the PDF holds:
//   - fields still there: every answer in the QR code must equal the field's answer (a stale code is flagged);
//   - fields gone (printed): every typed answer in the QR code must appear in the printed text of the pages.
import jsQR from "jsqr";
import { getDocument } from "pdfjs-dist";
import "./text"; // sets up pdf.js's worker
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
  const doc = await getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  try {
    for (let n = doc.numPages; n >= (all ? 1 : doc.numPages); n--) {
      const page = await doc.getPage(n);
      // A version 40 code has 177 squares across 450 pt: ~3x gives each square 7 pixels or so; a scan may need more.
      for (const scale of [3, 4.5]) {
        const vp = page.getViewport({ scale }), canvas = document.createElement("canvas");
        canvas.width = Math.ceil(vp.width);
        canvas.height = Math.ceil(vp.height);
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, viewport: vp }).promise;
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        const payload = code && parsePayload(code.data);
        if (payload) return { payload, page: n };
        if (code) break; // a QR code, but not one of ours
      }
    }
    return undefined;
  } finally {
    await doc.destroy();
  }
}

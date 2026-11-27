// GENERATE QR CODE IN THE STUDIO'S FILL STEP. The smart forms' answers are put into the fill page's engine (src/fill/engine.ts),
// which runs lc-form's own Generate QR Code script: same checks, same text, same codes as Acrobat. The codes are then drawn on the
// QR page of the written PDF (squares as filled rectangles; codes 3 and up on extra pages) and the text is kept in the hidden
// field "__qr", as lc-form's PDF does, so Extract reads the saved form back exactly.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { SMART_FORMS } from "./canvas/forms";
import { H, W, safe } from "./canvas/layout";
import { openForm, type Engine } from "./fill/engine";
import type { Template, Values } from "./pdf";

export interface Qr { text: string; codes: { rows: string[]; label: string }[]; slots: [number, number, number][]; page: number; heading: string }
export type Result = { qr: Qr } | { message: string };

const NONE = "Generate QR Code works for the smart forms. For an edited or uploaded form, export the form file (the </> button) and build it with lc-form: `python build.py <form file>`.";

/** The smart form `t` still is (its file, unedited), or undefined. */
function smartFormOf(t: Template) {
  const f = SMART_FORMS.find(s => s.file === t.file);
  return f && JSON.stringify({ ...t, file: undefined, pdfName: undefined }) === JSON.stringify(f.form) ? f : undefined;
}

/** The studio's answers into the engine's boxes (a question left out is blank), then Acrobat's calculation runs once. */
function fillIn(eng: Engine, t: Template, values: Values) {
  const qs = t.sections.flatMap(s => s.fields), doc = eng.doc;
  for (const q of qs) {
    const v = values[q.id], set = (name: string, x: string) => { const f = doc.getField(name); if (f) f.value = x; };
    if (q.kind === "check") set(q.id, v === true ? "Yes" : "Off");
    else if (q.kind === "checks") (q.options ?? []).forEach((o, i) => set(`${q.id}__${i}`, Array.isArray(v) && v.includes(o) ? "Yes" : "Off"));
    else if (q.kind === "radio") set(q.id, (q.options ?? []).map(safe).find(o => v !== undefined && o === safe(String(v))) ?? "Off");
    else if (q.kind === "select") { const o = safe(String(v ?? "")); set(q.id, doc.getField(q.id)?.options.includes(o) ? o : ""); }
    else set(q.id, typeof v === "string" ? safe(v).slice(0, q.max || undefined) : "");
  }
  if (qs[0]) eng.fire(qs[0].id);
}

/** Generate QR Code: the form's own checks first (the message lists what is missing or wrong), then the codes. */
export async function generateQr(t: Template, values: Values): Promise<Result> {
  const form = smartFormOf(t);
  if (!form) return { message: NONE };
  const eng = await openForm(form.file);
  fillIn(eng, t, values);
  eng.press("generate-qr");
  const codes = eng.codes();
  if (!codes.length) return { message: eng.alerts.at(-1) ?? "The QR code could not be generated." };
  return { qr: { text: eng.doc.getField("__qr")!.value, codes, slots: eng.laid.qr.slots, page: eng.laid.qr.page, heading: form.form.formCode ?? form.form.title } };
}

/** One filled rectangle per run of dark squares of a code, in the slot's PDF units (origin bottom left; 4 squares quiet zone). */
export function squares(rows: string[], [x, y, size]: number[]) {
  const m = size / 185, out: [number, number, number, number][] = [];
  rows.forEach((row, r) => { for (const run of row.matchAll(/n+/g)) out.push([x + (run.index! + 4) * m, y + size - (r + 5) * m, run[0].length * m, m]); });
  return out;
}

/** The PDF with the QR codes drawn on its QR page and on extra pages after it, and the text in the hidden field "__qr".
 *  `keepText: false` leaves the field out, so only the pictures are left to read. */
export async function addQr(pdf: Uint8Array, qr: Qr, keepText = true): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf), font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const grey = rgb(0.5, 0.5, 0.5);
  qr.codes.forEach((code, k) => {
    const slot = qr.slots[k % 2];
    let page = doc.getPage(qr.page);
    if (k >= 2) {
      if (k % 2 === 0) {
        page = doc.insertPage(qr.page + k / 2, [W, H]);
        page.drawText("APPLICATION QR CODE (CONTINUED)", { x: 40, y: H - 56, size: 11, font: bold });
        page.drawText(qr.heading, { x: 40, y: 24, size: 7, font, color: grey });
      } else page = doc.getPage(qr.page + (k - 1) / 2);
    }
    page.drawRectangle({ x: slot[0], y: slot[1], width: slot[2], height: slot[2], borderColor: grey, borderWidth: 0.5 });
    for (const [x, y, w, h] of squares(code.rows, slot)) page.drawRectangle({ x, y, width: w, height: h, color: rgb(0, 0, 0) });
    if (code.label) page.drawText(safe(code.label), { x: slot[0], y: slot[1] + slot[2] + 2, size: 8, font });
  });
  if (keepText) {
    const field = doc.getForm().createTextField("__qr");
    field.setText(qr.text);
    field.addToPage(doc.getPage(qr.page), { x: 0, y: 0, width: 1, height: 1, borderWidth: 0 });
  }
  return doc.save();
}

/** One code as an SVG picture (a rectangle per run of squares, sharp at any size), for the panel. */
export function codeSvg(rows: string[], n: number) {
  let d = "";
  rows.forEach((row, y) => { for (const m of row.matchAll(/n+/g)) d += `M${m.index! + 4} ${y + 4}h${m[0].length}v1h-${m[0].length}z`; });
  return `<svg viewBox="0 0 185 185" role="img" aria-label="QR code ${n}"><path d="${d}" shape-rendering="crispEdges"/></svg>`;
}

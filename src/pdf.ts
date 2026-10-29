// Build a fillable PDF form from a template, and read the answers back out of a filled one.
import {
  PDFCheckBox, PDFDocument, PDFDropdown, PDFFont, PDFHexString, PDFName, PDFOptionList, PDFPage,
  PDFRadioGroup, PDFString, PDFTextField, StandardFonts, rgb,
} from "pdf-lib";

export type Kind = "text" | "long" | "date" | "radio" | "checks" | "check";
export interface Field { id: string; label: string; kind: Kind; options?: string[]; half?: boolean }
export interface Section { title: string; fields: Field[] }
export interface Template { title: string; note: string; sections: Section[] }
export type Value = string | string[] | boolean;
export type Values = Record<string, Value>;

export const KINDS: Record<Kind, string> = {
  text: "Text", long: "Paragraph", date: "Date", radio: "Pick one", checks: "Tick any", check: "Tick box",
};
export const hasOptions = (k: Kind) => k === "radio" || k === "checks";

const RED = rgb(0xe3 / 255, 0x1b / 255, 0x23 / 255), INK = rgb(0.067, 0.067, 0.067);
const GREY = rgb(0.4, 0.4, 0.4), RULE = rgb(0.8, 0.8, 0.8), WHITE = rgb(1, 1, 1);
const W = 595.28, H = 841.89, M = 42, GAP = 16, BOTTOM = 56;
const KEY = PDFName.of("FormTemplate"); // the template rides inside the PDF, so extraction knows the sections

// ponytail: standard fonts only cover Latin-1. Embed a Unicode font (pdf-lib + fontkit) if names in other scripts matter.
const MAP: Record<string, string> = { "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "..." };
export const safe = (s: string) => s.replace(/[^\n\x20-\x7e\xa0-\xff€]/g, c => MAP[c] ?? "?");

const subId = (id: string, i: number) => `${id}__${i}`;

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of safe(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const t = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(t, size) > width) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}

/** Makes the blank (or, with values, the filled) form. */
export async function buildPdf(t: Template, values: Values = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const form = doc.getForm();
  doc.setTitle(safe(t.title));
  doc.setCreator("PDF Template Studio");
  doc.catalog.set(KEY, PDFHexString.fromText(JSON.stringify(t)));
  const tip = (f: { acroField: { dict: { set(k: PDFName, v: PDFHexString): void } } }, label: string) =>
    f.acroField.dict.set(PDFName.of("TU"), PDFHexString.fromText(label));

  let page: PDFPage = doc.addPage([W, H]), top = 0;
  const newPage = () => { page = doc.addPage([W, H]); top = H - M; };
  page.drawRectangle({ x: 0, y: H - 8, width: W, height: 8, color: RED });
  page.drawText(safe(t.title), { x: M, y: H - 58, size: 20, font: bold, color: INK });
  top = H - 72;
  for (const line of wrap(t.note, font, 9, W - 2 * M)) { page.drawText(line, { x: M, y: top - 9, size: 9, font, color: GREY }); top -= 12; }
  top -= 10;

  const opts = { borderColor: GREY, borderWidth: 0.75, backgroundColor: WHITE };
  // Lays out a field at (x, top) in width w; draws it only when `draw`. Returns the height used.
  function place(f: Field, x: number, w: number, draw: boolean): number {
    const v = values[f.id];
    if (f.kind === "check") {
      const lines = wrap(f.label, font, 9, w - 16);
      if (draw) {
        const cb = form.createCheckBox(f.id);
        cb.addToPage(page, { x, y: top - 11, width: 10, height: 10, ...opts });
        tip(cb, f.label);
        if (v === true) cb.check();
        lines.forEach((l, i) => page.drawText(l, { x: x + 16, y: top - 9 - i * 11, size: 9, font, color: INK }));
      }
      return Math.max(12, lines.length * 11);
    }
    if (draw) page.drawText(safe(f.label), { x, y: top - 8, size: 8, font: bold, color: GREY });
    let y = top - 13;
    if (hasOptions(f.kind)) {
      const list = f.options ?? [];
      const group = f.kind === "radio" && draw ? form.createRadioGroup(f.id) : undefined;
      if (group) tip(group, f.label);
      let cx = x;
      list.forEach((o, i) => {
        const span = 14 + font.widthOfTextAtSize(safe(o), 9) + 14;
        if (cx > x && cx + span > x + w) { cx = x; y -= 16; }
        if (draw) {
          const box = { x: cx, y: y - 11, width: 10, height: 10, ...opts };
          if (group) {
            group.addOptionToPage(safe(o), page, box);
          } else {
            const cb = form.createCheckBox(subId(f.id, i));
            cb.addToPage(page, box);
            tip(cb, `${f.label}: ${o}`);
            if (Array.isArray(v) && v.includes(o)) cb.check();
          }
          page.drawText(safe(o), { x: cx + 14, y: y - 9.5, size: 9, font, color: INK });
        }
        cx += span;
      });
      if (group && typeof v === "string" && list.includes(v)) group.select(safe(v));
      return top - y + 14;
    }
    const h = f.kind === "long" ? 46 : 20;
    if (draw) {
      const tf = form.createTextField(f.id);
      if (f.kind === "long") tf.enableMultiline();
      tip(tf, f.kind === "date" ? `${f.label} (DD/MM/YYYY)` : f.label);
      if (typeof v === "string" && v) tf.setText(safe(v));
      tf.addToPage(page, { x, y: y - h, width: w, height: h, font, ...opts });
      tf.setFontSize(10);
      if (f.kind === "date" && !v) page.drawText("DD/MM/YYYY", { x: x + w - 58, y: y - h + 6.5, size: 7, font, color: RULE });
    }
    return 13 + h;
  }

  const col = (W - 2 * M - GAP) / 2;
  t.sections.forEach((s, si) => {
    // Pair up neighbouring half-width fields into one row.
    const rows: Field[][] = [];
    for (const f of s.fields) {
      const last = rows[rows.length - 1];
      if (f.half && last?.length === 1 && last[0].half) last.push(f); else rows.push([f]);
    }
    const height = (r: Field[]) => Math.max(...r.map(f => place(f, M, f.half ? col : W - 2 * M, false)));
    if (top - 34 - (rows[0] ? height(rows[0]) : 0) < BOTTOM) newPage();
    page.drawText(String(si + 1), { x: M, y: top - 14, size: 11, font: bold, color: RED });
    page.drawText(safe(s.title), { x: M + 16, y: top - 14, size: 11, font: bold, color: INK });
    page.drawLine({ start: { x: M, y: top - 20 }, end: { x: W - M, y: top - 20 }, thickness: 1, color: RED });
    top -= 30;
    for (const r of rows) {
      const h = height(r);
      if (top - h < BOTTOM) newPage();
      r.forEach((f, i) => place(f, M + i * (col + GAP), f.half ? col : W - 2 * M, true));
      top -= h + 10;
    }
    top -= 8;
  });

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 36 }, end: { x: W - M, y: 36 }, thickness: 0.5, color: RULE });
    p.drawText(safe(t.title), { x: M, y: 24, size: 7.5, font, color: GREY });
    const n = `Page ${i + 1} of ${pages.length}`;
    p.drawText(n, { x: W - M - font.widthOfTextAtSize(n, 7.5), y: 24, size: 7.5, font, color: GREY });
  });
  form.updateFieldAppearances(font);
  return doc.save();
}

export interface Row { section: string; id: string; label: string; value: Value }
export interface Extracted { template?: Template; rows: Row[]; data: Values }

const text = (o: unknown) => (o instanceof PDFHexString || o instanceof PDFString ? o.decodeText() : undefined);

/** Reads every answer from a filled PDF form, with the question it belongs to. */
export async function extractPdf(bytes: Uint8Array | ArrayBuffer): Promise<Extracted> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const raw = new Map<string, Value>(), tips = new Map<string, string>();
  for (const f of doc.getForm().getFields()) {
    const name = f.getName();
    const v: Value =
      f instanceof PDFTextField ? f.getText() ?? "" :
      f instanceof PDFRadioGroup ? f.getSelected() ?? "" :
      f instanceof PDFCheckBox ? f.isChecked() :
      f instanceof PDFDropdown || f instanceof PDFOptionList ? f.getSelected().join(", ") : "";
    raw.set(name, v);
    tips.set(name, text(f.acroField.dict.lookup(PDFName.of("TU"))) ?? name);
  }
  let template: Template | undefined;
  try { const s = text(doc.catalog.lookup(KEY)); if (s) template = JSON.parse(s); } catch { /* not one of ours */ }

  const rows: Row[] = [], data: Values = {};
  if (template) {
    for (const s of template.sections) for (const f of s.fields) {
      const value: Value = f.kind === "checks"
        ? (f.options ?? []).filter((_, i) => raw.get(subId(f.id, i)) === true)
        : raw.get(f.id) ?? (f.kind === "check" ? false : "");
      rows.push({ section: s.title, id: f.id, label: f.label, value });
      data[f.id] = value;
    }
  } else {
    // A form made elsewhere: fall back to each field's tooltip as its label.
    for (const [id, value] of raw) { rows.push({ section: "", id, label: tips.get(id)!, value }); data[id] = value; }
  }
  return { template, rows, data };
}

export const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "field";

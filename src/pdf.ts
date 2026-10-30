// Build a fillable PDF form from a template, and read the answers back out of a filled one.
import {
  PDFCheckBox, PDFDocument, PDFDropdown, PDFFont, PDFHexString, PDFName, PDFOptionList, PDFPage,
  PDFRadioGroup, PDFString, PDFTextField, StandardFonts, rgb,
} from "pdf-lib";

export type Kind = "text" | "long" | "date" | "radio" | "checks" | "check" | "select";
export interface Field { id: string; label: string; kind: Kind; options?: string[]; half?: boolean; required?: boolean }
export interface Section { title: string; fields: Field[] }
export interface Template {
  title: string; note: string; sections: Section[];
  base?: string; // an uploaded PDF (base64) whose own fields are filled, instead of drawing a new layout
}
export type Value = string | string[] | boolean;
export type Values = Record<string, Value>;

export const KINDS: Record<Kind, string> = {
  text: "Text", long: "Paragraph", date: "Date", radio: "Pick one", checks: "Tick any", check: "Tick box", select: "Drop-down",
};
export const hasOptions = (k: Kind) => k === "radio" || k === "checks" || k === "select";

const RED = rgb(0.8, 0, 0), INK = rgb(0, 0, 0), GREY = rgb(0.35, 0.35, 0.35), RULE = rgb(0.75, 0.75, 0.75), WHITE = rgb(1, 1, 1);
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
  if (t.base) return fillBase(t, values);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const form = doc.getForm();
  doc.setTitle(safe(t.title));
  doc.setCreator("PDF Template Studio");
  stamp(doc, t);

  let page: PDFPage = doc.addPage([W, H]), top = 0;
  const newPage = () => { page = doc.addPage([W, H]); top = H - M; };
  page.drawText(safe(t.title.toUpperCase()), { x: M, y: H - 62, size: 16, font: bold, color: INK });
  page.drawLine({ start: { x: M, y: H - 72 }, end: { x: W - M, y: H - 72 }, thickness: 1.5, color: INK });
  top = H - 80;
  for (const line of wrap(t.note, font, 8.5, W - 2 * M)) { page.drawText(line, { x: M, y: top - 9, size: 8.5, font, color: INK }); top -= 11.5; }
  top -= 10;

  const opts = { borderColor: INK, borderWidth: 0.75, backgroundColor: WHITE };
  // Lays out a field at (x, top) in width w; draws it only when `draw`. Returns the height used.
  function place(f: Field, x: number, w: number, draw: boolean): number {
    const v = values[f.id];
    if (f.kind === "check") {
      const lines = wrap(f.label, font, 9, w - 16);
      if (draw) {
        const cb = form.createCheckBox(f.id);
        cb.addToPage(page, { x, y: top - 11, width: 10, height: 10, ...opts });
        tip(cb, f.label);
        if (f.required) { cb.enableRequired(); page.drawText("*", { x: x - 7, y: top - 10, size: 9, font: bold, color: RED }); }
        if (v === true) cb.check();
        lines.forEach((l, i) => page.drawText(l, { x: x + 16, y: top - 9 - i * 11, size: 9, font, color: INK }));
      }
      return Math.max(12, lines.length * 11);
    }
    if (draw) {
      page.drawText(safe(f.label), { x, y: top - 8, size: 8, font, color: INK });
      if (f.required) page.drawText("*", { x: x + font.widthOfTextAtSize(safe(f.label), 8) + 2, y: top - 8, size: 9, font: bold, color: RED });
    }
    let y = top - 13;
    if (f.kind === "select") {
      if (draw) {
        const dd = form.createDropdown(f.id);
        dd.addOptions((f.options ?? []).map(safe));
        tip(dd, f.label);
        if (f.required) dd.enableRequired();
        if (typeof v === "string" && f.options?.includes(v)) dd.select(safe(v));
        dd.addToPage(page, { x, y: y - 20, width: w, height: 20, font, ...opts });
        dd.setFontSize(10);
      }
      return 33;
    }
    if (hasOptions(f.kind)) {
      const list = f.options ?? [];
      const group = f.kind === "radio" && draw ? form.createRadioGroup(f.id) : undefined;
      if (group) { tip(group, f.label); if (f.required) group.enableRequired(); }
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
      if (f.required) tf.enableRequired();
      tip(tf, f.kind === "date" ? `${f.label} (DD/MM/YYYY)` : f.label);
      if (typeof v === "string" && v) tf.setText(safe(v));
      tf.addToPage(page, { x, y: y - h, width: w, height: h, font, ...opts });
      tf.setFontSize(10);
      if (f.kind === "date") {
        // Acrobat / Reader show a calendar picker and check the format.
        const js = (code: string) => doc.context.obj({ S: "JavaScript", JS: PDFHexString.fromText(code) });
        tf.acroField.dict.set(PDFName.of("AA"), doc.context.obj({ F: js('AFDate_FormatEx("dd/mm/yyyy");'), K: js('AFDate_KeystrokeEx("dd/mm/yyyy");') }));
      }
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
    page.drawRectangle({ x: M, y: top - 18, width: W - 2 * M, height: 16, color: INK });
    page.drawText(safe(`${si + 1}.  ${s.title.toUpperCase()}`), { x: M + 6, y: top - 13.5, size: 9, font: bold, color: WHITE });
    top -= 28;
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

const tip = (f: { acroField: { dict: { set(k: PDFName, v: PDFHexString): void } } }, label: string) =>
  f.acroField.dict.set(PDFName.of("TU"), PDFHexString.fromText(label));
/** Stores the template (minus any uploaded PDF) inside the PDF, so extraction knows the questions and sections. */
const stamp = (doc: PDFDocument, t: Template) => doc.catalog.set(KEY, PDFHexString.fromText(JSON.stringify({ ...t, base: undefined, uploaded: !!t.base })));

export const toB64 = (b: Uint8Array) => { let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

/** Fills the fields of an uploaded PDF, keeping its own layout. */
async function fillBase(t: Template, values: Values): Promise<Uint8Array> {
  const doc = await PDFDocument.load(fromB64(t.base!), { ignoreEncryption: true });
  const form = doc.getForm();
  for (const f of t.sections.flatMap(s => s.fields)) {
    const field = form.getFieldMaybe(f.id), v = values[f.id];
    if (!field) continue;
    tip(field, f.label);
    if (field instanceof PDFTextField) field.setText(typeof v === "string" && v ? safe(v) : undefined);
    else if (field instanceof PDFCheckBox) { if (v === true) field.check(); else field.uncheck(); }
    else if (field instanceof PDFRadioGroup) { if (typeof v === "string" && field.getOptions().includes(v)) field.select(v); else field.clear(); }
    else if (field instanceof PDFDropdown || field instanceof PDFOptionList) { if (typeof v === "string" && v) field.select(v); else field.clear(); }
  }
  stamp(doc, t);
  form.updateFieldAppearances(await doc.embedFont(StandardFonts.Helvetica));
  return doc.save();
}

const words = (name: string) => { const s = name.split(".").pop()!.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim(); return s.charAt(0).toUpperCase() + s.slice(1); };

export interface Imported { template: Template; values: Values; found: "fields" | "blanks" | "none" }

/**
 * Turns an existing PDF into a template. A fillable PDF keeps its fields; a printed-style PDF gets a
 * field added over each blank (____ or ☐) found by `findBlanks`. Answers already in it become `values`.
 */
export async function importPdf(bytes: Uint8Array, name: string,
  findBlanks: () => Promise<{ page: number; label: string; kind: "text" | "check"; x: number; y: number; w: number; h: number }[]>): Promise<Imported> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const title = doc.getTitle()?.trim() || words(name.replace(/\.pdf$/i, ""));
  const embedded = text(doc.catalog.lookup(KEY));
  const form = doc.getForm();
  let found: Imported["found"] = "fields";
  if (!form.getFields().length) {
    const blanks = await findBlanks();
    found = blanks.length ? "blanks" : "none";
    const font = await doc.embedFont(StandardFonts.Helvetica), pages = doc.getPages(), used = new Set<string>();
    for (const b of blanks) {
      let id = slug(b.label), n = 2;
      while (used.has(id)) id = `${slug(b.label)}_${n++}`;
      used.add(id);
      const box = { x: b.x, y: b.y, width: b.w, height: b.h, backgroundColor: undefined, borderWidth: 0 };
      const f = b.kind === "check" ? form.createCheckBox(id) : form.createTextField(id);
      if (f instanceof PDFTextField) { f.addToPage(pages[b.page - 1], { ...box, font }); f.setFontSize(0); } else f.addToPage(pages[b.page - 1], box);
      tip(f, b.label);
    }
  }
  const data = (await extractFields(doc)).data as Values;
  const pageOf = new Map(doc.getPages().map((p, i) => [p.ref.toString(), i + 1]));
  const sections = new Map<number, Field[]>();
  const placed = form.getFields().map(f => {
    const w = f.acroField.getWidgets()[0], r = w?.getRectangle() ?? { x: 0, y: 0 };
    return { f, page: pageOf.get(w?.P()?.toString() ?? "") ?? 1, x: r.x, y: r.y };
  }).sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  for (const { f, page } of placed) {
    const id = f.getName();
    const field: Field =
      f instanceof PDFCheckBox ? { id, label: "", kind: "check" } :
      f instanceof PDFRadioGroup ? { id, label: "", kind: "radio", options: f.getOptions() } :
      f instanceof PDFDropdown || f instanceof PDFOptionList ? { id, label: "", kind: "select", options: f.getOptions() } :
      { id, label: "", kind: f instanceof PDFTextField && f.isMultiline() ? "long" : "text" };
    field.label = text(f.acroField.dict.lookup(PDFName.of("TU"))) ?? words(id);
    if (f.isRequired()) field.required = true;
    sections.set(page, [...sections.get(page) ?? [], field]);
    // Clear answers so the template starts blank; they come back as `values`.
    if (f instanceof PDFTextField) f.setText(undefined); else if (f instanceof PDFCheckBox) f.uncheck();
    else if (f instanceof PDFRadioGroup || f instanceof PDFDropdown || f instanceof PDFOptionList) f.clear();
  }
  let template: Template = { title, note: "", sections: [...sections].map(([p, fields]) => ({ title: `Page ${p}`, fields })) };
  try {
    const e = embedded ? JSON.parse(embedded) as Template & { uploaded?: boolean } : undefined;
    // Made here: reopen the drawn layout. Uploaded before: keep its edited questions and sections.
    if (e && !e.uploaded) return { template: { title: e.title, note: e.note, sections: e.sections }, values: data, found };
    if (e) template = { title: e.title, note: e.note, sections: e.sections };
  } catch { /* use what was found */ }
  template.base = toB64(await doc.save());
  return { template, values: data, found };
}

export interface Row { section: string; id: string; label: string; value: Value; required?: boolean }
export interface Extracted { template?: Template; rows: Row[]; data: Record<string, unknown> }

const text = (o: unknown) => (o instanceof PDFHexString || o instanceof PDFString ? o.decodeText() : undefined);

/** Reads every answer from a filled PDF form, with the question it belongs to. */
export async function extractPdf(bytes: Uint8Array | ArrayBuffer): Promise<Extracted> {
  return extractFields(await PDFDocument.load(bytes, { ignoreEncryption: true }));
}

async function extractFields(doc: PDFDocument): Promise<Extracted> {
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
      rows.push({ section: s.title, id: f.id, label: f.label, value, required: f.required });
      data[f.id] = value;
    }
  } else {
    // A form made elsewhere: fall back to each field's tooltip as its label.
    for (const [id, value] of raw) { rows.push({ section: "", id, label: tips.get(id)!, value }); data[id] = value; }
  }
  return { template, rows, data };
}

export const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "field";

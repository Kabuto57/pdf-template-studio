// USING A PDF MADE ELSEWHERE (the studio's "Upload your PDF template")
//   importPdf: turns an existing PDF into a form description. A fillable PDF keeps its own fields; a printed-style
//              PDF gets a field added over each blank (____ or ☐).
//   fillBase:  fills such an uploaded PDF's own fields, keeping its own layout.
import { PDFCheckBox, PDFDocument, PDFDropdown, PDFName, PDFOptionList, PDFRadioGroup, PDFTextField, StandardFonts } from "pdf-lib";
import { tip } from "./look";
import { extractFields } from "./read";
import { stamp, stamped, text } from "./stored-template";
import { safe, slug, type Field, type Template, type Values } from "./types";

/** Bytes to base64 text and back (the uploaded PDF is kept inside the form description as text). */
export const toB64 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

/** A field name as words: "txtApplicantName" becomes "Applicant Name". */
const words = (name: string) => {
  const s = name.split(".").pop()!.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Fills the fields of an uploaded PDF, keeping its own layout. */
export async function fillBase(t: Template, values: Values): Promise<Uint8Array> {
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

export interface Imported { template: Template; values: Values; found: "fields" | "blanks" | "none" }
type Blank = { page: number; label: string; kind: "text" | "check"; x: number; y: number; w: number; h: number };

/**
 * Turns an existing PDF into a form description. A fillable PDF keeps its fields; a printed-style PDF gets a
 * field added over each blank found by `findBlanks`. Answers already in it come back as `values`.
 */
export async function importPdf(bytes: Uint8Array, name: string, findBlanks: () => Promise<Blank[]>): Promise<Imported> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const title = doc.getTitle()?.trim() || words(name.replace(/\.pdf$/i, ""));
  const embedded = stamped(doc);
  const form = doc.getForm();

  // No fields at all: add one over each blank (____ or ☐) found in the page text.
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
      if (f instanceof PDFTextField) { f.addToPage(pages[b.page - 1], { ...box, font }); f.setFontSize(0); }
      else f.addToPage(pages[b.page - 1], box);
      tip(f, b.label);
    }
  }
  const data = (await extractFields(doc)).data as Values;

  // One section per page, questions in reading order (top to bottom, left to right).
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
    // Clear the answers so the form starts blank; they come back as `values`.
    if (f instanceof PDFTextField) f.setText(undefined);
    else if (f instanceof PDFCheckBox) f.uncheck();
    else if (f instanceof PDFRadioGroup || f instanceof PDFDropdown || f instanceof PDFOptionList) f.clear();
  }
  let template: Template = { title, note: "", sections: [...sections].map(([p, fields]) => ({ title: `Page ${p}`, fields })) };

  // Made by this app: reopen the drawn layout. Uploaded before: keep its edited questions and sections.
  try {
    const e = embedded ? JSON.parse(embedded) as Template & { uploaded?: boolean } : undefined;
    if (e && !e.uploaded) return { template: { title: e.title, note: e.note, sections: e.sections }, values: data, found };
    if (e) template = { title: e.title, note: e.note, sections: e.sections };
  } catch { /* use what was found */ }
  template.base = toB64(await doc.save());
  return { template, values: data, found };
}

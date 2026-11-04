// Build a fillable PDF form from a template, and read the answers back out of a filled one.
import {
  AcroButtonFlags, PDFButton, PDFCheckBox, PDFDict, PDFRawStream, decodePDFRawStream, PDFDocument, PDFDropdown, PDFFont, PDFHexString, PDFName, PDFNumber, PDFObject, PDFOptionList, PDFPage,
  PDFRadioGroup, PDFString, PDFTextField, StandardFonts, rgb,
} from "pdf-lib";

export type Kind = "text" | "long" | "date" | "radio" | "checks" | "check" | "select";
export interface Field {
  id: string; label: string; kind: Kind; options?: string[]; half?: boolean; required?: boolean;
  requiredIf?: Rule[]; // mandatory only when another answer is picked (any rule matching is enough)
  max?: number; // most characters allowed, as on the bank's form
  format?: Format; // which keys the box accepts, and what a whole answer must look like
  activeIf?: Rule[]; // answerable only when one of these holds (default: requiredIf's rules); greyed and locked otherwise
}
/** Mandatory when `field` is one of `values` (or, with `not`, none of them). A tick box's values are "true" / "false". */
export interface Rule { field: string; values: string[]; not?: boolean }
export interface Section { title: string; fields: Field[] }
export interface Template {
  title: string; note: string; sections: Section[];
  base?: string; // an uploaded PDF (base64) whose own fields are filled, instead of drawing a new layout
  design?: "new"; // the LC only: draw it in the new design instead of the bank's own layout
}
export type Value = string | string[] | boolean;
// bad: keys refused while typing (same in the app and in Acrobat); ok: a whole answer; say: what's wrong otherwise.
export const FORMATS = {
  number: { bad: "[^0-9]", ok: /^\d+$/, say: "should be a whole number" },
  amount: { bad: "[^0-9.,]", ok: /^\d{1,3}(,?\d{3})*(\.\d{1,2})?$/, say: "is not an amount" },
  phone: { bad: "[^0-9+() -]", ok: /^\+?[\d ()-]*\d[\d ()-]*$/, say: "is not a phone number (digits, spaces, + - ( ) only)" },
  account: { bad: "[^0-9-]", ok: /^\d[\d-]*\d$|^\d$/, say: "is not an account number (digits and - only)" },
};
export type Format = keyof typeof FORMATS;
// "Funny characters": anything but what the bank's SWIFT messages carry, plus # & @ % (unit numbers, company names).
export const BAD_CHARS = "[^A-Za-z0-9 .,\\-/()':?+#&@%\\r\\n]";
export type Values = Record<string, Value>;

const holds = (v: Values) => (r: Rule) => {
  const x = v[r.field], hit = Array.isArray(x) ? x.some(o => r.values.includes(o)) : r.values.includes(String(x ?? ""));
  return r.not ? !hit && x !== undefined && x !== "" : hit;
};
export const isRequired = (f: Field, v: Values) => !!f.required || !!f.requiredIf?.some(holds(v));
/** The rules that switch a question on: a box under "Bill of lading" is only answerable once that is ticked. */
export const activeRules = (f: Field) => f.activeIf ?? (f.requiredIf ?? []).filter(r => !r.not);
export const isActive = (f: Field, v: Values) => { const r = activeRules(f); return !r.length || r.some(holds(v)); };

/** Acrobat (with JavaScript on): refuse wrong keys while typing, and a wrong whole answer when leaving the box. */
export const formatActions = (doc: PDFDocument, js: (code: string) => PDFObject, f: Field) => doc.context.obj({
  K: js(`if (!event.willCommit && /${FORMATS[f.format!].bad}/.test(event.change)) { event.rc = false; app.beep(0); }`),
  V: js(`if (event.value !== "" && !/${FORMATS[f.format!].ok.source}/.test(event.value)) { app.alert(${JSON.stringify(`${safe(f.label)} ${FORMATS[f.format!].say}.`)}); event.rc = false; }`),
});

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

export const subId = (id: string, i: number) => `${id}__${i}`;

/**
 * Dates as one drop-down of real dates ("15 Mar 2026"): needs no JavaScript, and 31 Feb is simply not offered.
 * Under it sits a hidden date box with Acrobat's own pop-up calendar; when Acrobat runs the form's JavaScript
 * (lcDates, at open) the box is shown and the list hidden. Whichever is shown is the answer.
 */
export const dateIds = (id: string) => [`${id}__list`];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PICK = "Pick a date";
const pad = (n: number) => String(n).padStart(2, "0");
const say = (d: Date) => `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
/** Every date from a year before the form is made to two years after. ponytail: re-made on each download, so it stays current. */
export function dateOptions(now = new Date()) {
  const out: string[] = [];
  for (let d = new Date(now.getFullYear() - 1, now.getMonth(), 1); d <= new Date(now.getFullYear() + 2, now.getMonth() + 1, 0); d.setDate(d.getDate() + 1)) out.push(say(d));
  return out;
}
export function addDateLists(form: ReturnType<PDFDocument["getForm"]>, page: PDFPage, id: string, label: string, v: unknown,
  r: { x: number; y: number; width: number; height: number }, font: PDFFont, size: number, extra: object = {}, js?: (code: string) => PDFObject) {
  const [d, m, y] = typeof v === "string" ? v.split("/").map(Number) : [];
  const want = d && m && y ? say(new Date(y, m - 1, d)) : "";
  const list = dateOptions();
  if (want && !list.includes(want)) list.unshift(want); // an answer outside the range is kept
  const dd = form.createDropdown(dateIds(id)[0]);
  dd.addOptions([PICK, ...list]);
  dd.select(want || PICK);
  dd.acroField.dict.set(PDFName.of("TU"), PDFHexString.fromText(safe(label)));
  dd.addToPage(page, { ...extra, ...r, font });
  dd.setFontSize(size);
  if (!js) return;
  const tf = form.createTextField(id);
  if (typeof v === "string" && v) tf.setText(v);
  tf.acroField.dict.set(PDFName.of("TU"), PDFHexString.fromText(`${safe(label)} (DD/MM/YYYY)`));
  // Acrobat shows its calendar on boxes formatted as a date, and refuses dates that don't exist (31/02).
  tf.acroField.dict.set(PDFName.of("AA"), form.doc.context.obj({ K: js('AFDate_KeystrokeEx("dd/mm/yyyy");'), F: js('AFDate_FormatEx("dd/mm/yyyy");') }));
  tf.addToPage(page, { ...extra, ...r, font });
  tf.setFontSize(size);
  tf.acroField.getWidgets()[0].dict.set(PDFName.of("F"), PDFNumber.of(2)); // hidden until Acrobat's JavaScript shows it
}
/** The picked date back to DD/MM/YYYY ("" if none). Also reads forms made with day / month / year lists. */
export function joinDate(parts: string[]) {
  if (parts.length === 3) { // DD, "MM Mon", YYYY: forms made before 4 Nov 2026
    const p = parts.map((s, i) => s === ["DD", "MM", "YYYY"][i] ? "" : i === 1 ? s.slice(0, 2) : s);
    return p.join("") ? p.join("/") : "";
  }
  const x = /^(\d\d) (\w{3}) (\d{4})$/.exec(parts[0] ?? "");
  return x ? `${x[1]}/${pad(MONTHS.indexOf(x[2]) + 1)}/${x[3]}` : "";
}

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
  const js = (code: string) => doc.context.obj({ S: "JavaScript", JS: PDFHexString.fromText(code) });
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

  const blocks: Blocks = new Map();
  const plain = { borderColor: INK, borderWidth: 0.75, backgroundColor: WHITE };
  const mandatory = { ...plain, borderColor: RED, borderWidth: 1.25 }; // mandatory boxes are outlined in red, not only starred
  // Lays out a field at (x, top) in width w; draws it only when `draw`. Returns the height used.
  function place(f: Field, x: number, w: number, draw: boolean): number {
    const v = values[f.id], req = isRequired(f, values);
    const style = req && (v === undefined || v === "" || v === false || (Array.isArray(v) && !v.length)) ? mandatory : plain; // red = mandatory and still blank
    const opts = activeRules(f).length ? { ...style, backgroundColor: undefined } : style; // see-through, so the grey "not yet" shade shows
    if (f.kind === "check") {
      const lines = wrap(f.label, font, 9, w - 16);
      if (draw) {
        const cb = form.createCheckBox(f.id);
        cb.addToPage(page, { x, y: top - 11, width: 10, height: 10, ...opts });
        tip(cb, f.label);
        if (req) { cb.enableRequired(); page.drawText("*", { x: x - 7, y: top - 10, size: 9, font: bold, color: RED }); }
        if (v === true) cb.check();
        lines.forEach((l, i) => page.drawText(l, { x: x + 16, y: top - 9 - i * 11, size: 9, font, color: INK }));
      }
      return Math.max(12, lines.length * 11);
    }
    if (draw) {
      blocks.set(f.id, { page, label: { x, y: top - 8, text: safe(f.label) } });
      page.drawText(safe(f.label), { x, y: top - 8, size: 8, font, color: INK });
      if (req) page.drawText("*", { x: x + font.widthOfTextAtSize(safe(f.label), 8) + 2, y: top - 8, size: 9, font: bold, color: RED });
    }
    let y = top - 13;
    if (f.kind === "select") {
      if (draw) {
        const dd = form.createDropdown(f.id);
        dd.addOptions((f.options ?? []).map(safe));
        tip(dd, f.label);
        if (req) dd.enableRequired();
        if (typeof v === "string" && f.options?.includes(v)) dd.select(safe(v));
        dd.addToPage(page, { x, y: y - 20, width: w, height: 20, font, ...opts });
        dd.setFontSize(10);
      }
      return 33;
    }
    if (hasOptions(f.kind)) {
      const list = f.options ?? [];
      let right = x;
      const group = f.kind === "radio" && draw ? form.createRadioGroup(f.id) : undefined;
      if (group) { tip(group, f.label); if (req) group.enableRequired(); }
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
        right = Math.max(right, cx + span - 10);
        cx += span;
      });
      if (group && typeof v === "string" && list.includes(v)) group.select(safe(v));
      if (draw) blocks.get(f.id)!.box = [x - 3, y - 14, right - x + 6, top - 13 - y + 17]; // all the options, framed as one
      return top - y + 14;
    }
    const h = f.kind === "long" ? 46 : 20;
    if (draw && f.kind === "date") addDateLists(form, page, f.id, f.label, v, { x, y: y - h, width: Math.min(w, 200), height: h }, font, 10, opts, js);
    else if (draw) {
      const tf = form.createTextField(f.id);
      if (f.kind === "long") tf.enableMultiline();
      if (req) tf.enableRequired();
      tip(tf, f.label);
      if (f.max) tf.setMaxLength(f.max);
      if (typeof v === "string" && v) tf.setText(safe(v).slice(0, f.max));
      tf.addToPage(page, { x, y: y - h, width: w, height: h, font, ...opts });
      tf.setFontSize(10);
      // Acrobat / Reader: number boxes refuse other keys.
      if (f.format) tf.acroField.dict.set(PDFName.of("AA"), formatActions(doc, js, f));
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
  addRedFrames(doc, form, t, values, { blocks, font });
  if (t.sections.some(s => s.fields.some(f => f.required || f.requiredIf))) addChecks(doc, form, pages[0], font, t, js);
  form.updateFieldAppearances(font);
  finishForm(doc, font);
  return doc.save();
}

/**
 * Red frames that need no JavaScript (many work laptops have Acrobat JavaScript switched off by IT).
 * A tick box or radio option can have extra copies of itself; ticking it switches every copy to its "on"
 * picture at once. So each trigger gets a copy just around every box its rule makes mandatory, drawn as a
 * red frame when on and as nothing when off: tick "Bill of lading" and its boxes are framed in red.
 * The copies sit underneath the real boxes, so typing and clicking still go to those.
 */
type Blocks = Map<string, { page: PDFPage; label: { x: number; y: number; text: string }; box?: [number, number, number, number] }>;
export function addRedFrames(doc: PDFDocument, form: ReturnType<PDFDocument["getForm"]>, t: Template, values: Values,
  // New design: frame a question's options as one and underline its label in red, as the app does.
  look?: { blocks: Blocks; font: PDFFont }) {
  const ctx = doc.context, pages = doc.getPages(), GAP = 0.6, T = 1.6;
  const off = (w: number, h: number) => ctx.register(ctx.stream("", { Type: "XObject", Subtype: "Form", BBox: [0, 0, w, h] }));
  const on = (w: number, h: number) => ctx.register(ctx.stream(`0.85 0 0 rg 0 0 ${w} ${h} re f`, { Type: "XObject", Subtype: "Form", BBox: [0, 0, w, h] }));
  const grey = (w: number, h: number) => ctx.register(ctx.stream(`0.86 g 0 0 ${w} ${h} re f`, { Type: "XObject", Subtype: "Form", BBox: [0, 0, w, h] }));
  // The tick box or radio option a rule points at: its "on" state, and whether it is on now. Lists need JavaScript.
  const triggerOf = (r: Rule) => {
    if (r.not) return undefined;
    const trigger = form.getFieldMaybe(r.field);
    let state: PDFName | undefined;
    if (trigger instanceof PDFCheckBox) { if (r.values.includes("true")) state = trigger.acroField.getOnValue(); }
    else if (trigger instanceof PDFRadioGroup) {
      const i = trigger.getOptions().indexOf(safe(r.values[0]));
      state = i < 0 ? undefined : trigger.acroField.getOnValues()[i];
      trigger.acroField.setFlagTo(AcroButtonFlags.RadiosInUnison, true); // copies with the same option switch together
    }
    if (!state) return undefined;
    return { owner: trigger as PDFCheckBox | PDFRadioGroup, state, isOn: trigger instanceof PDFCheckBox ? values[r.field] === true : values[r.field] === r.values[0] };
  };
  // Acrobat ignores a tick box's own pictures and draws its tick symbol (MK CA) in the DA colour and size instead,
  // over its background colour (MK BG), which it paints whether ticked or not.
  //  red:   no background; the symbol is a red square (ZapfDingbats "n") far bigger than the strip: cut to it, it fills it red.
  //  shade: a light grey background, and a white square when on: grey until the trigger is ticked, then nothing to see.
  const copy = (tr: NonNullable<ReturnType<typeof triggerOf>>, page: PDFPage, [sx, sy, sw, sh]: number[], kind: "red" | "shade" = "red") => {
    const big = Math.ceil(2 * Math.max(sw, sh) + 10), shade = kind === "shade";
    const c = ctx.register(ctx.obj({
      Type: "Annot", Subtype: "Widget", F: 64, // read-only: clicks on it do nothing
      Rect: [sx, sy, sx + sw, sy + sh], P: page.ref, Parent: tr.owner.ref, AS: tr.isOn ? tr.state : PDFName.of("Off"),
      MK: shade ? { BG: [0.86], CA: PDFString.of("n") } : { CA: PDFString.of("n") },
      DA: PDFString.of(`/ZaDb ${big} Tf ${shade ? "1 g" : "0.85 0 0 rg"}`), BS: { W: 0 },
      AP: { N: shade ? { [tr.state.decodeText()]: off(sw, sh), Off: grey(sw, sh) } : { [tr.state.decodeText()]: on(sw, sh), Off: off(sw, sh) } }, // the same, for every other viewer
    }));
    tr.owner.acroField.addWidget(c);
    page.node.Annots()!.insert(0, c); // underneath the real boxes, so typing and clicking still go to those
  };
  const all = t.sections.flatMap(s => s.fields);
  // Switchable questions' radio buttons see-through (pdf-lib paints them white), so the grey shade shows. Before any copies exist.
  for (const f of all) {
    const g = activeRules(f).length ? form.getFieldMaybe(f.id) : undefined;
    if (!(g instanceof PDFRadioGroup)) continue;
    for (const w of g.acroField.getWidgets()) w.dict.lookupMaybe(PDFName.of("MK"), PDFDict)?.delete(PDFName.of("BG"));
    g.updateAppearances();
  }
  // Each question's own boxes, taken before any copies are added (a trigger's copies are widgets of it too).
  const own = new Map(all.map(f => [f.id, (f.kind === "checks" ? (f.options ?? []).map((_, i) => subId(f.id, i)) : f.kind === "date" ? dateIds(f.id) : [f.id])
    .flatMap(name => form.getFieldMaybe(name)?.acroField.getWidgets() ?? [])
    .map(w => ({ w, page: pages.find(p => p.ref === w.P()) ?? pages[0], ...w.getRectangle() }))]));
  const boxes = (f: Field) => own.get(f.id) ?? [];

  for (const f of all) for (const r of f.requiredIf ?? []) {
    const tr = triggerOf(r);
    if (!tr) continue; // lists and "not" rules need JavaScript; the field still turns red where it runs
    // Four thin strips just outside the box, never over it: clicks inside the box still reach the box.
    const frame = (page: PDFPage, x: number, y: number, w0: number, h0: number) => {
      const o = GAP + T;
      for (const r of [[x - o, y + h0 + GAP, w0 + 2 * o, T], [x - o, y - o, w0 + 2 * o, T], [x - o, y - GAP, T, h0 + 2 * GAP], [x + w0 + GAP, y - GAP, T, h0 + 2 * GAP]])
        copy(tr, page, r);
    };
    const block = look?.blocks.get(f.id);
    if (block?.box) frame(block.page, ...block.box);
    else for (const b of boxes(f)) frame(b.page, b.x, b.y, b.width, b.height);
    if (block && look) { // a red line under the question's label
      const { x, y, text } = block.label;
      copy(tr, block.page, [x, y - 3.5, look.font.widthOfTextAtSize(text, 8), T]);
    }
  }
  // Questions that only apply once something is ticked: their boxes are grey until then.
  // ponytail: with several switching rules, any one off shows grey; exact "any of" needs JavaScript (which also locks them).
  for (const f of all) for (const r of activeRules(f)) {
    const tr = triggerOf(r);
    if (tr) for (const b of boxes(f)) copy(tr, b.page, [b.x - 0.5, b.y - 0.5, b.width + 1, b.height + 1], "shade");
  }
}

/**
 * The same mandatory rules as the app, inside the PDF, for Adobe Acrobat / Reader (other viewers ignore PDF scripts):
 * a hidden field recalculates on every change, sets each field's required flag and outlines blank mandatory ones in
 * red; a "Check form" button lists what is missing; saving or printing an incomplete form shows a warning.
 */
export function addChecks(doc: PDFDocument, form: ReturnType<PDFDocument["getForm"]>, page: PDFPage, font: PDFFont, t: Template, js: (code: string) => PDFObject,
  underlined: Set<string> = new Set()) { // fields drawn as a bottom line: no outline once filled
  const all = t.sections.flatMap(s => s.fields), byId = new Map(all.map(f => [f.id, f]));
  const model: Record<string, { k: Kind; l: string; c?: 1; s?: 1; u?: 1; o?: string[]; r?: [string, string[], 0 | 1][]; a?: [string, string[], 0 | 1][]; v?: [string, string] | 1 }> = {};
  const add = (f: Field) => model[f.id] ??= { k: f.kind, l: safe(f.label), ...(f.kind === "checks" ? { o: (f.options ?? []).map(safe) } : {}), ...(underlined.has(f.id) ? { u: 1 as const } : {}) };
  for (const f of all.filter(f => f.required || f.requiredIf)) {
    Object.assign(add(f), { c: 1 as const }, f.required ? { s: 1 as const } : {}, f.requiredIf ? { r: f.requiredIf.map(r => [r.field, r.values.map(safe), r.not ? 1 : 0] as [string, string[], 0 | 1]) } : {});
    for (const r of f.requiredIf ?? []) { const by = byId.get(r.field); if (by) add(by); }
  }
  // Questions that only apply once something is ticked or picked: locked (read-only) and grey until then.
  const rules = (rs: Rule[]) => rs.map(r => [r.field, r.values.map(safe), r.not ? 1 : 0] as [string, string[], 0 | 1]);
  for (const f of all.filter(f => activeRules(f).length)) {
    add(f).a = rules(activeRules(f));
    for (const r of activeRules(f)) { const by = byId.get(r.field); if (by) add(by); }
  }
  // Typed answers are checked too: ordinary characters only, and the box's format (phone, amount, ...).
  for (const f of all.filter(f => f.kind === "text" || f.kind === "long" || f.kind === "date"))
    add(f).v = f.format ? [FORMATS[f.format].ok.source, FORMATS[f.format].say] : 1;
  // The rules engine lives once, as a document-level script; every field and button calls lcRules(this).
  const lib = `function lcRules(d) {
var M = ${JSON.stringify(model)};
function has(a, x) { for (var i = 0; i < a.length; i++) if (a[i] == x) return true; return false; }
function val(id) {
  var m = M[id], f, a = [], i;
  if (m.k == "checks") { for (i = 0; i < m.o.length; i++) { f = d.getField(id + "__" + i); if (f && f.value != "Off") a.push(m.o[i]); } return a; }
  if (m.k == "date" && shown(id)) return d.getField(id).valueAsString;
  if (m.k == "date" && d.getField(id + "__list")) { a = /^(\\d\\d) (\\w{3}) (\\d{4})$/.exec(d.getField(id + "__list").valueAsString);
    return a ? a[1] + "/" + ("0" + ("JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(a[2]) / 3 + 1)).slice(-2) + "/" + a[3] : ""; }
  f = d.getField(id); if (!f) return "";
  if (m.k == "check") return f.value != "Off" ? "true" : "false";
  return f.value == "Off" ? "" : String(f.value);
}
function shown(id) { var f = d.getField(id); return !!f && f.display != 1; } // display.hidden
function empty(x) { return typeof x == "object" ? !x.length : x === ""; }
function any(r) { // does any rule hold?
  var i, j, x, hit;
  for (i = 0; i < r.length; i++) {
    x = val(r[i][0]); hit = false;
    if (typeof x == "object") { for (j = 0; j < x.length; j++) if (has(r[i][1], x[j])) hit = true; } else hit = has(r[i][1], x);
    if (r[i][2] ? !hit && !empty(x) : hit) return true;
  }
  return false;
}
function need(id) { var m = M[id]; return m.s ? true : any(m.r || []); }
function wrong(id) { // what is wrong with a typed answer, or ""
  var m = M[id], f = d.getField(id), s = m.k == "date" ? val(id) : f ? f.valueAsString : "", x, k;
  if (!m.v || !s) return "";
  x = s.match(new RegExp(${JSON.stringify(BAD_CHARS)}, "g"));
  if (x) { k = []; for (var i = 0; i < x.length; i++) if (!has(k, x[i])) k.push(x[i]); return "remove " + k.join(" ") + " (letters, digits and . , - / ( ) ' : ? + # & @ % only)"; }
  if (m.k == "date") { x = /^(\\d\\d)\\/(\\d\\d)\\/(\\d{4})$/.exec(s); k = x && new Date(+x[3], x[2] - 1, +x[1]); return k && k.getDate() == +x[1] && k.getMonth() == x[2] - 1 ? "" : "not a real date (DD/MM/YYYY)"; }
  return m.v.length && !new RegExp(m.v[0]).test(s) ? m.v[1] : "";
}
var miss = [], bad = [], id, m, q, b, w, names, i, f, on;
try {
for (id in M) {
  m = M[id]; if (!m.c && !m.v && !m.a) continue;
  on = !m.a || any(m.a);
  q = m.c && on ? need(id) : false; b = q && (m.k == "check" ? val(id) != "true" : empty(val(id)));
  if (b) miss.push(m.l);
  w = on ? wrong(id) : ""; if (w) { bad.push(m.l + ": " + w); b = true; }
  names = [id]; if (m.k == "checks") { names = []; for (i = 0; i < m.o.length; i++) names.push(id + "__" + i); }
  if (m.k == "date" && !shown(id) && d.getField(id + "__list")) names = [id + "__list"];
  for (i = 0; i < names.length; i++) { f = d.getField(names[i]); if (!f) continue; if (m.c && m.k != "checks") f.required = q;
    if (m.a) f.readonly = !on;
    if (!on) { f.lineWidth = 1; f.strokeColor = ["G", 0.6]; f.fillColor = ["G", 0.86]; continue; }
    f.lineWidth = b || !m.u ? 1 : 0; f.strokeColor = b ? color.red : m.u ? color.transparent : color.black; f.fillColor = b ? ["RGB", 1, 0.88, 0.88] : m.u ? color.transparent : color.white; }
}
} catch (e) { console.println("lcRules: " + e); }
miss.bad = bad;
return miss;
}
function lcDates(d) { // Acrobat: its calendar box replaces the date list
  var D = ${JSON.stringify(all.filter(f => f.kind === "date").map(f => f.id))}, i, t, p;
  for (i = 0; i < D.length; i++) { t = d.getField(D[i]); if (!t) continue; t.display = display.visible;
    p = d.getField(D[i] + "__list"); if (p) p.display = display.hidden; }
}
if (typeof app != "undefined" && /^(Exchange|Reader)/.test(app.viewerType)) lcDates(this);`;
  // A script stream, not a string: no 32,767-byte limit however many rules a form has.
  const libRef = doc.context.register(doc.context.flateStream(Uint8Array.from(lib, c => c.charCodeAt(0) & 0xff)));
  doc.catalog.set(PDFName.of("Names"), doc.context.obj({ JavaScript: doc.context.obj({ Names: [PDFHexString.fromText("lcRules"), doc.context.obj({ S: "JavaScript", JS: libRef })] }) }));
  const run = () => js("lcRules(this);");
  // Re-check the moment a box is ticked or an option picked (mouse up), and when leaving a text box or list (blur).
  for (const [id, m] of Object.entries(model)) {
    const names = m.k === "checks" ? (m.o ?? []).map((_, i) => subId(id, i)) : m.k === "date" && form.getFieldMaybe(dateIds(id)[0]) ? [...dateIds(id), id] : [id];
    for (const n of names) for (const w of form.getFieldMaybe(n)?.acroField.getWidgets() ?? []) {
      const aa = w.dict.lookupMaybe(PDFName.of("AA"), PDFDict) ?? doc.context.obj({});
      aa.set(PDFName.of(m.k === "check" || m.k === "checks" || m.k === "radio" || (m.k === "date" && n !== id) ? "U" : "Bl"), run());
      w.dict.set(PDFName.of("AA"), aa);
    }
  }
  // And after any value changes (Acrobat's recalculation), as a safety net.
  const calc = form.createTextField("__checks");
  calc.addToPage(page, { x: -20, y: -20, width: 1, height: 1, borderWidth: 0 }); // off the page
  calc.acroField.getWidgets()[0].dict.set(PDFName.of("F"), PDFNumber.of(2)); // hidden
  calc.acroField.dict.set(PDFName.of("AA"), doc.context.obj({ C: run() }));
  form.acroForm.dict.set(PDFName.of("CO"), doc.context.obj([calc.ref]));

  const report = (always: boolean) => `var m = typeof lcRules == "function" ? lcRules(this) : [], b = m.bad || [], t = [];
function list(a) { return "- " + a.slice(0, 15).join("\\n- ") + (a.length > 15 ? "\\n- ... and " + (a.length - 15) + " more" : ""); }
if (m.length) t.push(m.length + " mandatory question" + (m.length > 1 ? "s are" : " is") + " still blank:\\n" + list(m));
if (b.length) t.push(b.length + " answer" + (b.length > 1 ? "s need" : " needs") + " correcting:\\n" + list(b));
if (t.length) app.alert("This form is not ready to send. The boxes concerned are outlined in red.\\n\\n" + t.join("\\n\\n") + "\\n\\nPlease correct them before you send the form.", 1);
${always ? 'else app.alert("All mandatory questions are answered and every answer is in the right format. You can save the form and send it.", 3);' : ""}`;
  const btn = form.createButton("__check_form");
  btn.addToPage("Check form", page, { x: W - M - 84, y: H - 44, width: 84, height: 18, font, textColor: WHITE, backgroundColor: INK, borderColor: INK });
  btn.setFontSize(9);
  const widget = btn.acroField.getWidgets()[0].dict;
  widget.set(PDFName.of("A"), js(report(true)));
  widget.set(PDFName.of("F"), PDFNumber.of(0)); // shown on screen, not printed
  doc.catalog.set(PDFName.of("AA"), doc.context.obj({ WS: js(report(false)), WP: js(report(false)) })); // before save / print
}

const tip = (f: { acroField: { dict: { set(k: PDFName, v: PDFHexString): void } } }, label: string) =>
  f.acroField.dict.set(PDFName.of("TU"), PDFHexString.fromText(label));
/** Stores the template (minus any uploaded PDF) inside the PDF, so extraction knows the questions and sections. */
// Kept in a compressed stream: Adobe allows at most 32,767 bytes in one PDF string, and a big form's template is
// larger (the LC's is ~33 KB); over the limit, Acrobat would not let anyone type in the form.
export const stamp = (doc: PDFDocument, t: Template) =>
  doc.catalog.set(KEY, doc.context.register(doc.context.flateStream(new TextEncoder().encode(JSON.stringify({ ...t, base: undefined, uploaded: !!t.base })))));
/** The template stored by stamp(): a stream, or a string in PDFs made before. */
const stamped = (doc: PDFDocument) => {
  const o = doc.catalog.lookup(KEY);
  return o instanceof PDFRawStream ? new TextDecoder().decode(decodePDFRawStream(o).decode()) : text(o);
};

/**
 * Acrobat looks up the font named in each field's /DA in the form's default resources (/DR). Without it, clicking a
 * field does nothing: it cannot be typed in (pdf.js and browsers don't mind, so previews look fine).
 */
export function finishForm(doc: PDFDocument, font: PDFFont) {
  const af = doc.getForm().acroForm.dict;
  af.set(PDFName.of("DR"), doc.context.obj({ Font: { Helvetica: font.ref, Helv: font.ref } }));
  af.set(PDFName.of("DA"), PDFString.of("/Helv 0 Tf 0 g"));
}

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
  const embedded = stamped(doc);
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

// pdf-lib's decodeText() overflows the stack on long strings (a big embedded template): decode UTF-16 ourselves.
const utf16 = (b: Uint8Array) => b[0] === 0xfe && b[1] === 0xff ? new TextDecoder("utf-16be").decode(b) : undefined;
const text = (o: unknown) => o instanceof PDFHexString ? utf16(o.asBytes()) ?? o.decodeText() : o instanceof PDFString ? o.decodeText() : undefined;

/** Reads every answer from a filled PDF form, with the question it belongs to. */
export async function extractPdf(bytes: Uint8Array | ArrayBuffer): Promise<Extracted> {
  return extractFields(await PDFDocument.load(bytes, { ignoreEncryption: true }));
}

async function extractFields(doc: PDFDocument): Promise<Extracted> {
  const raw = new Map<string, Value>(), tips = new Map<string, string>(), shown = new Set<string>();
  for (const f of doc.getForm().getFields()) {
    const name = f.getName();
    if (f instanceof PDFButton || name.startsWith("__")) continue; // the built-in checks, not answers
    const v: Value =
      f instanceof PDFTextField ? f.getText() ?? "" :
      f instanceof PDFRadioGroup ? f.getSelected() ?? "" :
      f instanceof PDFCheckBox ? f.isChecked() :
      f instanceof PDFDropdown || f instanceof PDFOptionList ? f.getSelected().join(", ") : "";
    raw.set(name, v);
    if (!(((f.acroField.getWidgets()[0]?.dict.lookup(PDFName.of("F")) as PDFNumber | undefined)?.asNumber() ?? 0) & 2)) shown.add(name); // not hidden
    tips.set(name, text(f.acroField.dict.lookup(PDFName.of("TU"))) ?? name);
  }
  let template: Template | undefined;
  try { const s = stamped(doc); if (s) template = JSON.parse(s); } catch { /* not one of ours */ }

  const rows: Row[] = [], data: Values = {};
  if (template) {
    for (const s of template.sections) for (const f of s.fields) {
      const value: Value = f.kind === "checks"
        ? (f.options ?? []).filter((_, i) => raw.get(subId(f.id, i)) === true)
        : f.kind === "date" && !(raw.has(f.id) && shown.has(f.id)) && (raw.has(dateIds(f.id)[0]) || raw.has(`${f.id}__dd`))
          ? joinDate((raw.has(dateIds(f.id)[0]) ? dateIds(f.id) : ["dd", "mm", "yyyy"].map(p => `${f.id}__${p}`)).map(n => String(raw.get(n) ?? "")))
        : raw.get(f.id) ?? (f.kind === "check" ? false : "");
      rows.push({ section: s.title, id: f.id, label: f.label, value });
      data[f.id] = value;
    }
    const fields = template.sections.flatMap(s => s.fields); // rules can point at later answers, so judge once all are read
    rows.forEach((r, i) => { if (isRequired(fields[i], data)) r.required = true; });
  } else {
    // A form made elsewhere: fall back to each field's tooltip as its label.
    for (const [id, value] of raw) { rows.push({ section: "", id, label: tips.get(id)!, value }); data[id] = value; }
  }
  return { template, rows, data };
}

export const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "field";

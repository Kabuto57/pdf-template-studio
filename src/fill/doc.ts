// A STAND-IN FOR ACROBAT'S DOCUMENT, with no page in it: the fields lc-form's PDF has, and the little of Acrobat's JavaScript
// API that lc-form's scripts use (getField, value, required, readonly, display, fillColor ..., calculate, numFields,
// resetForm, print, pageNum, and the page templates: getTemplate().spawn, deletePages, numPages, each field's page). The scripts run on this; view.ts shows what changes in it (`dirty`) on the page.
import type { Laid } from "../canvas/layout";

export type Kind = "text" | "combobox" | "checkbox" | "radiobutton" | "button";
/** Acrobat's colour arrays: ["RGB", r, g, b], ["G", grey], ["T"]. */
export type Colour = readonly (string | number)[];
export const color = { red: ["RGB", 1, 0, 0], black: ["G", 0], white: ["G", 1], transparent: ["T"] } as const;
export const display = { visible: 0, hidden: 1, noPrint: 2, noView: 3 } as const;

const KINDS = { text: "text", choice: "combobox", check: "checkbox", radio: "radiobutton", button: "button" } as const;
const QR_ROWS = 177;

export class Field {
  options: string[] = [];
  initial: string;
  /** The page the box is on (0 = first); -1 for a page template's own boxes, which are on no page. */
  page = -1;
  // what the scripts change: any write marks the field for the page to redraw
  private s = { value: "", required: false, readonly: false, display: 0 as number, lineWidth: 1, strokeColor: ["G", 0] as Colour, fillColor: ["G", 1] as Colour };
  constructor(readonly doc: Doc, readonly name: string, readonly type: Kind, value: string) {
    this.s.value = this.initial = value;
  }
  private put<K extends keyof Field["s"]>(k: K, v: Field["s"][K]) { this.s[k] = v; this.doc.dirty.add(this); }
  get value() { return this.s.value; }
  set value(v: string) { this.put("value", v == null ? "" : String(v)); }
  get valueAsString() { return this.s.value; }
  get required() { return this.s.required; }
  set required(v: boolean) { this.put("required", !!v); }
  get readonly() { return this.s.readonly; }
  set readonly(v: boolean) { this.put("readonly", !!v); }
  get display() { return this.s.display; }
  set display(v: number) { this.put("display", v); }
  get lineWidth() { return this.s.lineWidth; }
  set lineWidth(v: number) { this.put("lineWidth", v); }
  get strokeColor() { return this.s.strokeColor; }
  set strokeColor(v: Colour) { this.put("strokeColor", v); }
  get fillColor() { return this.s.fillColor; }
  set fillColor(v: Colour) { this.put("fillColor", v); }
  /** A drop-down's selected line (a date list going back to "Pick a date"). */
  get currentValueIndices() { return this.options.indexOf(this.s.value); }
  set currentValueIndices(i: number) { this.put("value", this.options[i] ?? ""); }
  setFocus() { this.doc.onFocus?.(this.name); }
  reset() { this.s = { ...this.s, value: this.initial }; this.doc.dirty.add(this); }
}

export class Doc {
  fields = new Map<string, Field>();
  list: Field[] = [];
  dirty = new Set<Field>();
  calculate = true;
  numPages = 1;
  private page = 0;
  /** Hidden page templates (Acrobat's Template objects): name -> the boxes a copy of the page has. */
  templates = new Map<string, Field[]>();
  private spawned = 0;
  onFocus?: (name: string) => void;
  /** What this.print(...) was given (Print Form prints the pages up to the last QR code in use: its 3rd argument). */
  onPrint?: (...args: unknown[]) => void;
  onPage?: (n: number) => void;

  add(name: string, type: Kind, value = "", options: string[] = []) {
    const f = new Field(this, name, type, value);
    f.options = options;
    this.fields.set(name, f);
    this.list.push(f);
    return f;
  }
  /** Acrobat's doc.getTemplate(name).spawn({nPage, bRename: true}): a copy of the template page becomes page nPage; its boxes are
   *  new fields, renamed with a prefix the way the viewer does (the template's name stays at the end). */
  getTemplate(name: string) {
    const tpl = this.templates.get(name);
    if (!tpl) throw new Error(`no page template ${name}`);
    return { spawn: ({ nPage, bRename }: { nPage: number; bRename?: boolean }) => {
      const prefix = bRename ? `P${++this.spawned}_0.` : "";
      for (const f of this.list) if (f.page >= nPage) f.page++;
      for (const t of tpl) { const f = this.add(prefix + t.name, t.type); f.page = nPage; f.display = t.display; }
      this.numPages++;
    } };
  }
  /** Acrobat's doc.deletePages(n): the page and its boxes are gone, later pages move up. */
  deletePages(n: number | { nStart: number }) {
    const at = typeof n === "number" ? n : n.nStart;
    if (!(at >= 0 && at < this.numPages)) throw new Error(`no page ${at}`);
    this.list = this.list.filter(f => f.page !== at || (this.fields.delete(f.name), false));
    for (const f of this.list) if (f.page > at) f.page--;
    this.numPages--;
  }
  getField(name: string) { return this.fields.get(name) ?? null; }
  get numFields() { return this.list.length; }
  getNthFieldName(i: number) { return this.list[i].name; }
  get pageNum() { return this.page; }
  set pageNum(n: number) { this.page = n; this.onPage?.(n); }
  resetForm() { for (const f of this.list) f.reset(); }
  print(...args: unknown[]) { this.onPrint?.(...args); }
}

/** The fields of lc-form's PDF for a laid-out form: its questions' boxes, then what pdf_writer.add_scripts adds (the hidden
 *  re-check field, the QR code's text and its 2 x 177 rows, labels and frame, the buttons), in the same order. */
export function buildDoc(laid: Laid): Doc {
  const doc = new Doc();
  doc.numPages = laid.pages.length;
  const on = (page: number, f: Field) => ((f.page = page), f);
  for (const f of laid.fields) {
    const type = KINDS[f.type];
    if (f.name.endsWith("__list") && f.type === "choice") { // a date's drop-down of dates: only its box is used, so the list is a stub
      on(f.widgets[0]?.page ?? 0, doc.add(f.name, type, "Pick a date", ["Pick a date"]));
      continue;
    }
    const field = doc.add(f.name, type,
      f.type === "check" ? (f.value === true ? "Yes" : "Off") :
      f.type === "radio" ? (typeof f.value === "number" ? f.options![f.value] : "Off") :
      typeof f.value === "string" ? f.value : "", f.options ?? []);
    field.page = f.widgets[0]?.page ?? 0;
    if (f.widgets[0]?.hidden) field.display = display.hidden;
  }
  doc.dirty.clear();
  const hidden = (name: string, page: number) => (on(page, doc.add(name, "text")).display = display.hidden);
  hidden("__checks", 0);
  hidden("__qr", laid.qr.page);
  const row = (name: string, page = laid.qr.page) => on(page, doc.add(name, "text"));
  for (const k of [1, 2]) {
    row(`__qr${k}_label`);
    if (k > 1) hidden(`__qr${k}_frame`, laid.qr.page);
    for (let y = 0; y < QR_ROWS; y++) row(`__qr${k}_${y}`);
  }
  // the hidden page template "qrx" (codes 3 and up): label, frame (hidden) and rows of two codes, on no page
  const qrx: Field[] = [];
  for (const k of [1, 2]) {
    qrx.push(row(`__qrx_${k}_label`, -1));
    hidden(`__qrx_${k}_frame`, -1);
    qrx.push(doc.list[doc.list.length - 1]);
    for (let y = 0; y < QR_ROWS; y++) qrx.push(row(`__qrx_${k}_${y}`, -1));
  }
  doc.templates.set("qrx", qrx);
  for (const name of ["__check_form", "__reset_form", "__generate_qr", "__print_form"]) on(0, doc.add(name, "button"));
  doc.dirty.clear();
  return doc;
}

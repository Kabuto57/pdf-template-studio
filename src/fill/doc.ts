// A STAND-IN FOR ACROBAT'S DOCUMENT, with no page in it: the fields lc-form's PDF has, and the little of Acrobat's JavaScript
// API that lc-form's scripts use (getField, value, required, readonly, display, fillColor ..., calculate, numFields,
// resetForm, print, pageNum). The scripts run on this; view.ts shows what changes in it (`dirty`) on the page.
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
  onFocus?: (name: string) => void;
  onPrint?: () => void;
  onPage?: (n: number) => void;

  add(name: string, type: Kind, value = "", options: string[] = []) {
    const f = new Field(this, name, type, value);
    f.options = options;
    this.fields.set(name, f);
    this.list.push(f);
    return f;
  }
  getField(name: string) { return this.fields.get(name) ?? null; }
  get numFields() { return this.list.length; }
  getNthFieldName(i: number) { return this.list[i].name; }
  get pageNum() { return this.page; }
  set pageNum(n: number) { this.page = n; this.onPage?.(n); }
  resetForm() { for (const f of this.list) f.reset(); }
  print(..._args: unknown[]) { this.onPrint?.(); }
}

/** The fields of lc-form's PDF for a laid-out form: its questions' boxes, then what pdf_writer.add_scripts adds (the hidden
 *  re-check field, the QR code's text and its 2 x 177 rows, labels and frame, the buttons), in the same order. */
export function buildDoc(laid: Laid): Doc {
  const doc = new Doc();
  doc.numPages = laid.pages.length;
  for (const f of laid.fields) {
    const type = KINDS[f.type];
    if (f.name.endsWith("__list") && f.type === "choice") { // a date's drop-down of dates: only its box is used, so the list is a stub
      doc.add(f.name, type, "Pick a date", ["Pick a date"]);
      continue;
    }
    const field = doc.add(f.name, type,
      f.type === "check" ? (f.value === true ? "Yes" : "Off") :
      f.type === "radio" ? (typeof f.value === "number" ? f.options![f.value] : "Off") :
      typeof f.value === "string" ? f.value : "", f.options ?? []);
    if (f.widgets[0]?.hidden) field.display = display.hidden;
  }
  doc.dirty.clear();
  const hidden = (name: string) => (doc.add(name, "text").display = display.hidden);
  hidden("__checks");
  hidden("__qr");
  for (const k of [1, 2]) {
    doc.add(`__qr${k}_label`, "text");
    if (k > 1) hidden(`__qr${k}_frame`);
    for (let y = 0; y < QR_ROWS; y++) doc.add(`__qr${k}_${y}`, "text");
  }
  for (const name of ["__check_form", "__reset_form", "__generate_qr", "__print_form"]) doc.add(name, "button");
  doc.dirty.clear();
  return doc;
}

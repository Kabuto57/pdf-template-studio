// ONE FORM, RUNNING LC-FORM'S OWN SCRIPTS. The document script (rules, payload, QR encoder), the button scripts and the
// boxes' keystroke / validate scripts are lc-form's Acrobat JavaScript, copied by scripts/fill-engine.py (src/fill/gen/).
// They run here against doc.ts, the stand-in for Acrobat's document. This file only does what Acrobat does around them:
// when to call which script, and what `app.alert` and `this.print` do.
import { SMART_FORMS, type SmartForm } from "../canvas/forms";
import { layout, type Laid } from "../canvas/layout";
import { buttons, libNames, onCalc, onEvent } from "./gen/buttons";
import { Doc, buildDoc, color, display } from "./doc";

interface FormScripts {
  document: (app: App, color: unknown, display: unknown, console: unknown) => Library;
  keys: Record<string, { K?: (event: KeyEvent, app: App) => void; V?: (event: KeyEvent, app: App) => void }>;
  ruleEvents: Record<string, "U" | "Bl">;
  sectionButtons: Record<string, keyof typeof buttons>;
}
interface Library {
  lcRules: (d: Doc, src?: string | null) => string[] & { bad: string[]; first: string };
  lcPayload: (d: Doc) => string;
  lcDrawQr: (d: Doc, text: string) => number;
  lcDates: (d: Doc) => void;
  lcQrMatrix: (bytes: string, part: number[] | null) => boolean[][];
  [more: string]: unknown; // the others the button scripts call by name (libNames)
}
export interface App { viewerType: string; alert: (message: string, icon?: number, buttons?: number) => number; beep: (n?: number) => void }
/** Acrobat's `event` while a box's script runs. */
export interface KeyEvent { change: string; willCommit: boolean; value: string; rc: boolean; name?: string; target?: { name: string }; source?: { name: string } | null }

const FILES = import.meta.glob<FormScripts>("./gen/*_form.ts");
/** The scripts of one form file ("lc_form.py"), loaded when the form is opened. */
export const scriptsOf = (file: string) => FILES[`./gen/${file.replace(/\.py$/, "")}.ts`]();

export class Engine {
  readonly doc: Doc;
  readonly laid: Laid;
  private lib: Library;
  /** Messages the scripts show (app.alert), in order: the page shows them as message boxes. */
  alerts: string[] = [];
  onAlert?: (message: string) => void;
  /** What app.alert answers when a script asks yes / no (Acrobat: 4 = Yes). */
  answer = 1;
  private app: App;
  /** The scripts run for the person's changes, in order ("calc:name", "event:name"): for tests. */
  ran: string[] = [];

  constructor(readonly form: SmartForm, private scripts: FormScripts) {
    this.laid = layout(form.form, form.defaults);
    this.doc = buildDoc(this.laid);
    this.app = {
      viewerType: "Reader", // lc-form's script starts its rules only in Acrobat or Reader
      alert: (message, _icon, type) => { this.alerts.push(message); this.onAlert?.(message); return type === 2 ? this.answer : 1; },
      beep: () => {},
    };
    // The script's last line runs lcDates and lcRules on opening, as Acrobat does.
    this.lib = scripts.document.call(this.doc, this.app, color, display, { println: () => {} });
  }

  private event(more: Partial<KeyEvent> = {}): KeyEvent { return { change: "", willCommit: false, value: "", rc: true, ...more }; }

  /** A box was changed by the person: Acrobat's calculation runs first (any value changed), then the box's own click / blur event. */
  fire(name: string) {
    this.ran.push(`calc:${name}`);
    onCalc.call(this.doc, this.event({ source: { name } }), this.lib.lcRules);
    if (this.scripts.ruleEvents[name]) {
      this.ran.push(`event:${name}`);
      onEvent.call(this.doc, this.event({ target: { name } }), this.lib.lcRules);
    }
  }
  /** The box's keystroke script for `change` typed into it: the text to put in, or null to refuse it. */
  keystroke(name: string, change: string): string | null {
    const k = this.scripts.keys[name]?.K;
    if (!k) return change;
    const e = this.event({ change });
    k.call(this.doc, e, this.app);
    return e.rc ? e.change : null;
  }
  /** The box's validate script for the whole answer: false (and the message shown) when it is refused. */
  validate(name: string, value: string): boolean {
    const v = this.scripts.keys[name]?.V;
    if (!v) return true;
    const e = this.event({ value, willCommit: true });
    v.call(this.doc, e, this.app);
    return e.rc;
  }
  /** What Check form would list: the mandatory questions left blank, and the answers to correct. */
  check() { const m = this.lib.lcRules(this.doc); return { missing: [...m], bad: m.bad }; }
  /** The text lcPayload makes for the QR code (the answers as JSON, padded with spaces). */
  payload() { return this.lib.lcPayload(this.doc); }
  /** A button's script ("check-form", "generate-qr" ...). */
  press(script: keyof typeof buttons) { this.run(script, this.event()); }
  /** A pipe-format form (FORM["qrFormat"]) has its own Generate QR Code and Print Form scripts, as its PDF's buttons have. */
  private run(script: keyof typeof buttons, event: KeyEvent) {
    const pipe = (this.form.form as { qrFormat?: string }).qrFormat === "pipe" && (script === "generate-qr" || script === "print-form");
    (buttons[pipe ? `${script}-pipe` as keyof typeof buttons : script] as (...a: unknown[]) => void)
      .call(this.doc, this.app, event, ...libNames.map(n => this.lib[n]));
  }
  /** Runs a script whose own messages are not shown (the page asks, or says, in its own way); returns the messages. */
  private quietly(f: () => void) {
    const show = this.onAlert, before = this.alerts.length;
    this.onAlert = undefined;
    try { f(); } finally { this.onAlert = show; this.answer = 1; }
    return this.alerts.splice(before);
  }
  /** What the Reset form button asks (the script's own question, answered "no" so nothing changes). */
  resetQuestion() { return this.quietly(() => { this.answer = 0; this.press("reset-form"); })[0]; }
  /** Reset form, once the question is answered yes. */
  reset() { this.quietly(() => { this.answer = 4; this.press("reset-form"); }); }
  /** What the browser's own Print does first: the PDF's "Before printing" warning (shown when something is missing or wrong). */
  warnBeforePrint() { this.run("before-save", this.event({ name: "WillPrint" })); }
  /** Would Print Form print now? The Print Form script decides (a QR code made from these very answers): null when it would, else its message. */
  qrProblem(): string | null {
    let printed = false;
    const was = this.doc.onPrint;
    this.doc.onPrint = () => { printed = true; };
    try { return this.quietly(() => this.press("print-form"))[0] ?? (printed ? null : "No QR code: press Generate QR Code before printing."); } finally { this.doc.onPrint = was; }
  }
  /** The script of a button inside the form (a section's buttons=[...]). */
  sectionButton(name: string): keyof typeof buttons | undefined { return this.scripts.sectionButtons[name]; }
  /** The QR codes now in the form, in order: each a 177 x 177 grid (rows of "n" and " "), as lcDrawQr wrote them. Codes 1 and 2 are
   *  on the QR code page, then two to a spawned page (found as lcExtra finds them: by the field name's ending). */
  codes(): { rows: string[]; label: string }[] {
    const pages = this.doc.list.flatMap(f => { const m = /^(.*)__qrx_1_0$/.exec(f.name); return m && !/^([A-Z]+\.)?$/.test(m[1]) ? [{ p: m[1], page: f.page }] : []; })
      .sort((a, b) => a.page - b.page);
    const out = [];
    for (let j = 0; j < 2 + 2 * pages.length; j++) {
      const tag = j < 2 ? `__qr${j + 1}` : `${pages[(j - 2) >> 1].p}__qrx_${(j - 2) % 2 + 1}`;
      const rows = Array.from({ length: 177 }, (_, y) => this.doc.getField(`${tag}_${y}`)!.value);
      if (rows.some(r => r.includes("n"))) out.push({ rows, label: this.doc.getField(`${tag}_label`)!.value });
    }
    return out;
  }
}

/** What Acrobat's date format says to a date that is not a real DD/MM/YYYY ("" when it is, or blank). */
export function dateProblem(label: string, value: string): string {
  const m = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(value), d = m && new Date(+m[3], +m[2] - 1, +m[1]);
  return !value || (d && d.getDate() === +m![1] && d.getMonth() === +m![2] - 1) ? "" : `Invalid date/time: please ensure that the date/time exists. Field [ ${label} ] should match format dd/mm/yyyy`;
}

/** Opens a form of the smart forms by its form file name. */
export async function openForm(file: string): Promise<Engine> {
  const form = SMART_FORMS.find(f => f.file === file);
  if (!form) throw new Error(`no form ${file}`);
  return new Engine(form, await scriptsOf(file));
}

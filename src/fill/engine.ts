// ONE FORM, RUNNING LC-FORM'S OWN SCRIPTS. The document script (rules, payload, QR encoder), the button scripts and the
// boxes' keystroke / validate scripts are lc-form's Acrobat JavaScript, copied by scripts/fill-engine.py (src/fill/gen/).
// They run here against doc.ts, the stand-in for Acrobat's document. This file only does what Acrobat does around them:
// when to call which script, and what `app.alert` and `this.print` do.
import { SMART_FORMS, type SmartForm } from "../canvas/forms";
import { layout, type Laid } from "../canvas/layout";
import { buttons, onCalc, onEvent } from "./gen/buttons";
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
    onCalc.call(this.doc, this.event({ source: { name } }), this.lib.lcRules);
    if (this.scripts.ruleEvents[name]) onEvent.call(this.doc, this.event({ target: { name } }), this.lib.lcRules);
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
  press(script: keyof typeof buttons) {
    const l = this.lib;
    buttons[script].call(this.doc, this.app, this.event(), l.lcRules, l.lcPayload, l.lcDrawQr, l.lcDates);
  }
  /** What the Reset form button asks, then does when it is answered yes. */
  resetQuestion() {
    this.answer = 0;
    const before = this.alerts.length;
    this.press("reset-form");
    const q = this.alerts.splice(before)[0];
    this.answer = 1;
    return q;
  }
  reset() { this.answer = 4; try { this.press("reset-form"); } finally { this.answer = 1; this.alerts.pop(); } }
  /** The script of a button inside the form (a section's buttons=[...]). */
  sectionButton(name: string): keyof typeof buttons | undefined { return this.scripts.sectionButtons[name]; }
  /** The QR codes now in the form: each a 177 x 177 grid (rows of "n" and " "), as lcDrawQr wrote them. */
  codes(): { rows: string[]; label: string }[] {
    const out = [];
    for (const k of [1, 2]) {
      const rows = Array.from({ length: 177 }, (_, y) => this.doc.getField(`__qr${k}_${y}`)!.value);
      if (rows.some(r => r.includes("n"))) out.push({ rows, label: this.doc.getField(`__qr${k}_label`)!.value });
    }
    return out;
  }
}

/** Opens a form of the smart forms by its form file name. */
export async function openForm(file: string): Promise<Engine> {
  const form = SMART_FORMS.find(f => f.file === file);
  if (!form) throw new Error(`no form ${file}`);
  return new Engine(form, await scriptsOf(file));
}

// The browser form (src/fill) runs lc-form's own Acrobat scripts. These tests check that it behaves as the PDF does:
//  (a) random edits: the web stand-in (doc.ts + engine.ts) ends in the same state as the same scripts run in a plain mock of Acrobat;
//  (b) every form's valid answers make a QR code that zxing decodes to the answers the PDF's lcPayload gives;
//  (c) Generate QR Code refuses while a mandatory answer is missing; (d) the menu; and the generated scripts are up to date.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import FIELDS from "./fixtures/fill-fields.json";
import { SMART_FORMS } from "../src/canvas/forms";
import { solve } from "./fill-solve";
import { Engine, dateProblem, scriptsOf } from "../src/fill/engine";
import { choose, MENU_TEXT } from "../src/fill/menu";
import { codesIn, joinCodes, parsePayload } from "../src/qr-read";
import { sampleFor } from "../src/sample";
import { safe } from "../src/canvas/layout";

const gen = (file: string) => readFileSync(new URL(`../src/fill/gen/${file}`, import.meta.url), "utf8");
const buttonsText = gen("buttons.ts");
const body = (name: string) => new RegExp(`"${name}": function \\([^)]*\\) \\{\\n([\\s\\S]*?)\\n\\},?\\n(?="|export)`).exec(buttonsText)![1];
const colors = { red: ["RGB", 1, 0, 0], black: ["G", 0], white: ["G", 1], transparent: ["T"] };
const displays = { visible: 0, hidden: 1, noPrint: 2, noView: 3 };

// ---- the plain mock of Acrobat: the PDF's fields built on their own from lc-form's field list (tests/fixtures/fill-fields.json) and the
// form's starting answers, not from the page's code (doc.ts); the scripts are TEXT copied from the generated files, run for each event
interface Ref { name: string; type: string; value: string; options: string[]; required: boolean; readonly: boolean; display: number; lineWidth: number; strokeColor: unknown; fillColor: unknown; initial: string }
type Spec = { name: string; type: string; options?: string[] };
const KIND = { text: "text", choice: "combobox", check: "checkbox", radio: "radiobutton", button: "button" } as Record<string, string>;
const eventBody = (name: "onEvent" | "onCalc") => new RegExp(`export const ${name} = function \\(event, lcRules\\) \\{\\n([\\s\\S]*?)\\n\\};`).exec(buttonsText)![1];
function reference(file: string) {
  const form = SMART_FORMS.find(f => f.file === file)!, questions = form.form.sections.flatMap(s => s.fields);
  const spec = (FIELDS as Record<string, { fields: Spec[]; ruleEvents: Record<string, string> }>)[file];
  const answer = (id: string) => form.defaults[id];
  const alerts: string[] = [], hidden = new Set(["__checks", "__qr", "__qr2_frame", ...questions.filter(q => q.kind === "date").map(q => q.id)]);
  const startValue = (f: Spec) => {
    const g = /^(.+)__(\d+)$/.exec(f.name), group = g && questions.find(x => x.id === g[1] && x.kind === "checks");
    if (group) { const a = answer(group.id); return Array.isArray(a) && a.includes(group.options![+g![2]]) ? "Yes" : "Off"; }
    if (f.type === "check") return answer(f.name) === true ? "Yes" : "Off";
    if (f.type === "radio") return f.options!.includes(safe(String(answer(f.name)))) ? safe(String(answer(f.name))) : "Off";
    if (f.name.endsWith("__list")) return "Pick a date";
    const a = answer(f.name), q = questions.find(x => x.id === f.name);
    return q && typeof a === "string" ? safe(a).slice(0, q.max || undefined) : "";
  };
  const specs: Spec[] = [...spec.fields, ...[1, 2].flatMap(k => Array.from({ length: 177 }, (_, y) => ({ name: `__qr${k}_${y}`, type: "text" })))];
  const list: Ref[] = specs.map(f => {
    const value = startValue(f);
    return { name: f.name, type: KIND[f.type], value, initial: value, options: f.name.endsWith("__list") ? ["Pick a date"] : f.options ?? [], required: false, readonly: false, display: hidden.has(f.name) ? 1 : 0, lineWidth: 1, strokeColor: ["G", 0], fillColor: ["G", 1] };
  });
  const byName = new Map(list.map(f => [f.name, f]));
  for (const f of list) {
    Object.assign(f, { setFocus() {} });
    Object.defineProperty(f, "valueAsString", { get: () => f.value });
    Object.defineProperty(f, "currentValueIndices", { get: () => f.options.indexOf(f.value), set: (i: number) => { f.value = f.options[i] ?? ""; } });
  }
  const doc = {
    calculate: true, numPages: 1, pageNum: 0, getField: (n: string) => byName.get(n) ?? null, get numFields() { return list.length; },
    getNthFieldName: (i: number) => list[i].name, resetForm: () => list.forEach(f => (f.value = f.initial)), print() {},
  };
  const app = { viewerType: "Reader", alert: (m: string, _i?: number, t?: number) => (alerts.push(m), t === 2 ? 4 : 1), beep() {} };
  const text = gen(`${file.replace(/\.py$/, "")}.ts`);
  const script = text.slice(text.indexOf("{\n") + 2, text.indexOf("\nreturn { lcRules:"));
  const lib = new Function("app", "color", "display", "console", `${script}\nreturn { lcRules: lcRules, lcPayload: lcPayload, lcDrawQr: lcDrawQr, lcDates: lcDates };`)
    .call(doc, app, colors, displays, { println() {} });
  const press = (name: string) => new Function("app", "event", "lcRules", "lcPayload", "lcDrawQr", "lcDates", body(name)).call(doc, app, {}, lib.lcRules, lib.lcPayload, lib.lcDrawQr, lib.lcDates);
  /** A box changed: Acrobat runs the calculation script (any value changed), then the box's own event script when the PDF gives it one. */
  const fire = (name: string) => {
    new Function("event", "lcRules", eventBody("onCalc")).call(doc, { source: { name } }, lib.lcRules);
    if (spec.ruleEvents[name]) new Function("event", "lcRules", eventBody("onEvent")).call(doc, { target: { name } }, lib.lcRules);
  };
  return { doc, list, alerts, lib, press, byName, fire };
}
const snap = (list: { name: string; value: string; required: boolean; readonly: boolean; display: number; lineWidth: number; strokeColor: unknown; fillColor: unknown }[]) =>
  list.map(f => JSON.stringify([f.name, f.value, f.required, f.readonly, f.display, f.lineWidth, f.strokeColor, f.fillColor])).sort(); // order of fields: checked on its own

const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const POOL = ["", "A", "12", "1,250.50", "ABC DEF", "01/01/2030", "31/02/2026", "bad~", "0", "1234567", "USD", "+65 6123 4567", "15/06/2026", "553010012345", "100", "ABCDSGSG", "12345678"];

const engineOf = async (file: string) => new Engine(SMART_FORMS.find(f => f.file === file)!, await scriptsOf(file));
const FILES = SMART_FORMS.map(f => f.file);

describe("the browser form is the PDF's scripts on a stand-in for Acrobat", () => {
  it("has all 13 forms, and each has the fields lc-form's PDF has (same names, kinds, order)", async () => {
    expect(FILES).toHaveLength(13);
    for (const file of FILES) {
      const want = (FIELDS as Record<string, { fields: { name: string; type: string; options?: string[] }[] }>)[file].fields;
      const kind = { text: "text", choice: "combobox", check: "checkbox", radio: "radiobutton", button: "button" } as Record<string, string>;
      const eng = await engineOf(file);
      const got = eng.doc.list.filter(f => !/^__qr[12]_\d+$/.test(f.name));
      expect(got.map(f => [f.name, f.type]), file).toEqual(want.map(f => [f.name, kind[f.type]]));
      for (const f of want) if (f.options) expect(eng.doc.getField(f.name)!.options, f.name).toEqual(f.options);
    }
  });

  for (const file of FILES)
    it(`${file}: random edits end the same as in the mock Acrobat`, async () => {
      const eng = await engineOf(file), ref = reference(file), next = rng(7 + file.length);
      const names = eng.doc.list.filter(f => !f.name.startsWith("__") && !f.name.endsWith("__list") && f.type !== "button").map(f => f.name);
      const rules = (FIELDS as Record<string, { ruleEvents: Record<string, string> }>)[file].ruleEvents;
      expect(snap(eng.doc.list)).toEqual(snap(ref.list)); // the same look on opening
      for (let step = 0; step < 70; step++) {
        const name = names[Math.floor(next() * names.length)], a = eng.doc.getField(name)!, b = ref.byName.get(name)!;
        if (a.readonly !== b.readonly) throw new Error("states differ before the edit");
        if (a.readonly) continue; // the person can't change a locked box
        const v = a.type === "checkbox" ? (a.value === "Off" ? "Yes" : "Off") :
          a.type === "radiobutton" ? ["Off", ...a.options][Math.floor(next() * (a.options.length + 1))] :
          a.type === "combobox" ? ["", ...a.options][Math.floor(next() * (a.options.length + 1))] : POOL[Math.floor(next() * POOL.length)];
        a.value = v; b.value = v;
        eng.ran.length = 0;
        eng.fire(name);
        ref.fire(name);
        // the page ran the calculation, then the box's own event when the PDF gives it one (the scripts overlap: only this catches a missing one)
        expect(eng.ran, `${file} ${name}`).toEqual(rules[name] ? [`calc:${name}`, `event:${name}`] : [`calc:${name}`]);
        eng.doc.dirty.clear();
        expect(snap(eng.doc.list), `${file} step ${step} ${name}=${v}`).toEqual(snap(ref.list));
        if (step % 17 === 16) {
          eng.alerts.length = 0; ref.alerts.length = 0;
          eng.press("check-form"); ref.press("check-form");
          expect(eng.alerts).toEqual(ref.alerts);
          expect(snap(eng.doc.list)).toEqual(snap(ref.list));
        }
      }
      expect(eng.payload().replace(/"saved":"[^"]*"/, "")).toBe(ref.lib.lcPayload(ref.doc).replace(/"saved":"[^"]*"/, ""));
      // Reset form (after the question is answered yes) gives the opening state again
      eng.reset(); ref.press("reset-form");
      expect(snap(eng.doc.list)).toEqual(snap(ref.list));
    }, 60000);

  it("keystroke and validate scripts: letters refused in a number box, upper case made, a wrong whole answer refused with its message", async () => {
    const eng = await engineOf("lc_form.py");
    expect(eng.keystroke("applicant_name", "abc")).toBe("ABC");
    expect(eng.keystroke("applicant_name", "a~")).toBeNull();
    expect(eng.keystroke("contact_tel", "+65 12")).toBe("+65 12");
    expect(eng.keystroke("contact_tel", "1a")).toBeNull();
    expect(eng.validate("contact_tel", "+")).toBe(false);
    expect(eng.alerts.at(-1)).toMatch(/is not a phone number/);
    expect(eng.validate("contact_tel", "+65 6123 4567")).toBe(true);
  });
});

describe("Generate QR Code", () => {
  it("(c) refuses, with the problem list, while a mandatory answer is missing: no code is drawn", async () => {
    const eng = await engineOf("lc_form.py");
    eng.press("generate-qr");
    expect(eng.alerts.at(-1)).toMatch(/^The QR code cannot be generated yet\. The boxes concerned are outlined in red\.\n\n\d+ mandatory questions? (is|are) still blank:\n- /);
    expect(eng.codes()).toEqual([]);
    expect(eng.doc.getField("__qr")!.value).toBe("");
  });

  for (const file of FILES)
    it(`(b) ${file}: valid answers make a QR code that zxing reads back to the PDF's own lcPayload`, async () => {
      const eng = await engineOf(file), form = SMART_FORMS.find(f => f.file === file)!;
      solve(eng, form.form, sampleFor(form.form));
      expect(eng.check()).toEqual({ missing: [], bad: [] });
      eng.alerts.length = 0;
      eng.press("generate-qr");
      expect(eng.alerts.at(-1), file).toMatch(/has been generated|two codes have been generated/);
      const text = eng.doc.getField("__qr")!.value;
      // the same scripts in the mock Acrobat, given the same answers, say the same
      const ref = reference(file);
      for (const f of eng.doc.list) { const r = ref.byName.get(f.name)!; r.value = f.value; }
      ref.lib.lcRules(ref.doc);
      const pdfText = ref.lib.lcPayload(ref.doc);
      const strip = (s: string) => s.replace(/"saved":"[^"]*"/, "");
      expect(strip(text)).toBe(strip(pdfText));
      // ... and the pictures decode (zxing, as the workbench reads them) to exactly that
      const pics = eng.codes().map(c => picture(c.rows));
      const read = (await Promise.all(pics.map(p => codesIn({ data: p.data, width: p.w, height: p.w, colorSpace: "srgb" } as ImageData)))).flat();
      const joined = joinCodes(read);
      expect(joined, file).toEqual(parsePayload(text));
      expect(joined!.form).toBe(form.form.formCode!.match(/[A-Z]+-\d+/)![0]);
      expect(joined!.complete).toBe(true);
      // every answered box is in the code (the code may only be missing a long answer it cut: it then says so)
      for (const f of eng.doc.list)
        if (!f.name.startsWith("__") && !f.name.endsWith("__list") && f.type !== "button" && f.value !== "" && f.value !== "Off" && !/__\d+$/.test(f.name))
          expect(joined!.data[f.name] !== undefined || joined!.truncated, `${file} ${f.name}`).toBeTruthy();
    }, 60000);

  it("long answers make two codes (structured append), read back in either order", async () => {
    const eng = await engineOf("lc_form.py"), form = SMART_FORMS.find(f => f.file === "lc_form.py")!;
    const answers = { ...sampleFor(form.form) };
    for (const q of form.form.sections.flatMap(s => s.fields)) if (q.kind === "long") answers[q.id] = "STEEL FITTINGS, GRADE 316. ".repeat(200).slice(0, q.max || 3000);
    solve(eng, form.form, answers);
    eng.press("generate-qr");
    const codes = eng.codes();
    expect(codes).toHaveLength(2);
    expect(codes.map(c => c.label)).toEqual(["QR code 1 of 2 (scan both codes)", "QR code 2 of 2"]);
    const read = (await Promise.all(codes.map(c => picture(c.rows)).map(p => codesIn({ data: p.data, width: p.w, height: p.w, colorSpace: "srgb" } as ImageData)))).flat();
    expect(joinCodes([...read].reverse())).toEqual(parsePayload(eng.doc.getField("__qr")!.value));
  }, 60000);
});

/** The code as a picture: 4 pixels a square, 4 white squares around it (rows of "n" and " ", as lcDrawQr wrote them). */
function picture(rows: string[], px = 4) {
  const n = rows.length + 8, w = n * px, data = new Uint8ClampedArray(w * w * 4).fill(255);
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (c !== "n") return;
    for (let dy = 0; dy < px; dy++) for (let dx = 0; dx < px; dx++) data.fill(0, (((y + 4) * px + dy) * w + (x + 4) * px + dx) * 4, (((y + 4) * px + dy) * w + (x + 4) * px + dx) * 4 + 3);
  }));
  return { data, w };
}

describe("(d) the main menu", () => {
  it("lists every form, grouped as build_all.py groups them, with its terms wording", () => {
    expect(MENU_TEXT.groups.map(g => g.group)).toEqual(["Import", "Export", "Loans", "Guarantees"]);
    expect(MENU_TEXT.groups.flatMap(g => g.forms.map(f => f.file)).sort()).toEqual([...FILES].sort());
    expect(MENU_TEXT.terms).toBe("I have read and agree to the Bank's terms and conditions for trade applications.");
  });
  it("picking a form without the tick box gives build_all.py's message and opens nothing", () => {
    expect(choose(false, "lc_form.py")).toEqual({ message: "Please tick the box to agree to the Bank's terms and conditions before opening a form." });
  });
  it("with the tick box, opens exactly the form picked: its pages and fields only", async () => {
    expect(choose(true, "bg_form.py")).toEqual({ open: "bg_form.py" });
    const eng = await engineOf("bg_form.py"), other = await engineOf("lc_form.py");
    expect(eng.form.form.title).toBe("Banker's Guarantee Application");
    expect(eng.doc.getField("applicant_name")).not.toBeNull();
    expect(eng.doc.list.length).not.toBe(other.doc.list.length);
    expect(eng.doc.getField("amount")?.name).toBe("amount");
    expect(MENU_TEXT.back).toEqual(["Go back to the main menu? The answers in ", " will be cleared."]);
  });
  it("Reset form asks first, in the PDF's words, and clears only when answered yes", async () => {
    const eng = await engineOf("lc_form.py"), name = eng.doc.getField("applicant_name")!;
    name.value = "ACME";
    expect(eng.resetQuestion()).toBe("Are you sure you want to reset the form? All your answers will be cleared.");
    expect(name.value).toBe("ACME");
    eng.reset();
    expect(name.value).toBe("");
  });
});

describe("what the page asks and says", () => {
  it("Reset form's question and answer are not announced as messages (the page asks it as a yes / no question)", async () => {
    const eng = await engineOf("lc_form.py"), shown: string[] = [];
    eng.onAlert = m => shown.push(m);
    expect(eng.resetQuestion()).toMatch(/^Are you sure/);
    eng.reset();
    expect(shown).toEqual([]);
    eng.press("check-form");
    expect(shown).toHaveLength(1); // other messages still are
  });
  it("Print Form's own check says why a printout would lack a valid QR code: none yet, or answers changed since", async () => {
    const eng = await engineOf("lc_form.py"), form = SMART_FORMS.find(f => f.file === "lc_form.py")!;
    expect(eng.qrProblem()).toMatch(/press Generate QR Code first/);
    solve(eng, form.form, sampleFor(form.form));
    eng.press("generate-qr");
    expect(eng.qrProblem()).toBeNull();
    eng.doc.getField("applicant_name")!.value = "SOMEONE ELSE";
    expect(eng.qrProblem()).toMatch(/answers have changed/);
  });
  it("the PDF's 'Before printing' warning lists what is missing, once", async () => {
    const eng = await engineOf("lc_form.py");
    eng.warnBeforePrint();
    expect(eng.alerts.at(-1)).toMatch(/^Before printing: this form is not ready to send\./);
  });
  it("a date that does not exist gets Acrobat's date message; blank and real dates pass", () => {
    expect(dateProblem("Date", "31/02/2026")).toBe("Invalid date/time: please ensure that the date/time exists. Field [ Date ] should match format dd/mm/yyyy");
    expect(dateProblem("Date", "1/2/26")).toMatch(/^Invalid date/);
    expect(dateProblem("Date", "")).toBe("");
    expect(dateProblem("Date", "29/02/2028")).toBe("");
  });
});

describe("the generated scripts match lc-form", () => {
  const LC_FORM = process.env.LC_FORM ?? join(homedir(), "Documents/lc-form"), PY = join(LC_FORM, ".venv/bin/python");
  it.skipIf(!existsSync(PY))("scripts/fill-engine.py gives the same files again, byte for byte", () => {
    const dir = mkdtempSync(join(tmpdir(), "fill-"));
    execFileSync(PY, ["scripts/fill-engine.py", LC_FORM, "--out", dir], { encoding: "utf8" });
    const files = [...FILES.map(f => `src/fill/gen/${f.replace(/\.py$/, "")}.ts`), "src/fill/gen/buttons.ts", "src/fill/gen/menu.json", "tests/fixtures/fill-fields.json"];
    for (const f of files) expect(readFileSync(join(dir, f), "utf8"), f).toBe(readFileSync(f, "utf8"));
  }, 60000);
  it("negative: the byte comparison does bite", () => {
    expect(gen("buttons.ts").replace("Please correct them", "Please correct it")).not.toBe(gen("buttons.ts"));
  });
});

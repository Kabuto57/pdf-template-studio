// CHECKS INSIDE THE PDF, FOR WHEN ACROBAT RUNS JAVASCRIPT
// The same rules as rules.ts, written into the PDF as JavaScript for Adobe Acrobat / Reader (Chrome runs much of it too):
//   - after every change: each question's "required" flag, red outline when blank or wrong, locked (and cleared) when
//     it doesn't apply, and the checks across answers (dates in order, amount above zero, insurance against price basis)
//   - a "Check form" button that lists what is missing or wrong and puts the cursor on the first one
//   - a "Reset form" button (addToolbar)
//   - (JavaScript version) on a last page, a QR code of the answers as JSON, with "Generate QR Code" and "Print Form"
//   - a warning when saving or printing an incomplete form
//   - typing filters on amount / phone / account / number boxes, and upper case + SWIFT characters on the rest
// With JavaScript off, none of this runs; red-frames.ts and the workbench cover that case.
import { PDFDict, PDFDocument, PDFString, StandardFonts, PDFFont, PDFHexString, PDFName, PDFNumber, PDFObject, PDFPage } from "pdf-lib";
import { activeRules } from "./rules";
import { dateIds } from "./dates";
import { ACCENT, H, INK, M, W, WHITE } from "./look";
import { BAD_CHARS, FORMATS, safe, subId, type Field, type Kind, type Rule, type Template } from "./types";
// The scripts themselves are plain JavaScript files in pdfbuild/js/, shared with the Python builder (pdfbuild/build_form.py).
import RULES_JS from "../../pdfbuild/js/rules.js?raw";
import PAYLOAD_JS from "../../pdfbuild/js/payload.js?raw";
import QR_JS from "../../pdfbuild/js/qr.js?raw";
import CHECK_FORM_JS from "../../pdfbuild/js/check-form.js?raw";
import BEFORE_SAVE_JS from "../../pdfbuild/js/before-save.js?raw";
import RESET_FORM_JS from "../../pdfbuild/js/reset-form.js?raw";
import GENERATE_QR_JS from "../../pdfbuild/js/generate-qr.js?raw";
import PRINT_FORM_JS from "../../pdfbuild/js/print-form.js?raw";

/** A script file with its __PLACEHOLDERS__ filled in. */
const fill = (js: string, values: Record<string, string>) => Object.entries(values).reduce((s, [k, v]) => s.split(k).join(v), js);

type Form = ReturnType<PDFDocument["getForm"]>;
type JS = (code: string) => PDFObject;

/**
 * Typing filter for a box with a format (Acrobat, JavaScript on).
 *   K (keystroke): refuse wrong keys, e.g. letters in Amount
 *   V (validate):  refuse a wrong whole answer when leaving the box, e.g. "4,80,000.0.0"
 * Setting event.rc = false means "reject this".
 */
export const formatActions = (doc: PDFDocument, js: JS, f: Field) => {
  const format = FORMATS[f.format!];
  const message = JSON.stringify(`${safe(f.label)} ${format.say}.`);
  return doc.context.obj({
    K: js(`if (!event.willCommit && /${format.bad}/.test(event.change)) { event.rc = false; app.beep(0); }`),
    V: js(`if (event.value !== "" && !/${format.ok.source}/.test(event.value)) { app.alert(${message}); event.rc = false; }`),
  });
};

/** Typing filter for any other text box: letters upper-cased as typed (SWIFT messages are upper case), and
 *  characters the bank's SWIFT messages can't carry refused, as in the bank's smart form. */
export const swiftActions = (doc: PDFDocument, js: JS) => doc.context.obj({
  K: js(`if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/${BAD_CHARS}/.test(event.change)) { event.rc = false; app.beep(0); } }`),
});

/** What the script needs to know about one question. Short keys keep the script small. */
interface Model {
  kind: Kind;
  label: string;
  hasRule?: 1;                     // has a mandatory rule
  always?: 1;                      // always mandatory
  underlined?: 1;                  // drawn as a bottom line (original look): no outline once filled
  options?: string[];              // "tick any" options
  requiredIf?: [string, string[], 0 | 1][];  // [field, values, not]
  activeIf?: [string, string[], 0 | 1][];
  check?: [string, string] | 1;    // typed answer: [format pattern, message], or 1 = characters only
}

/** The QR code's text (lcPayload): every answered question as JSON, keyed by field name, so the next stage can check
 *  it with the form's JSON Schema. A QR code holds about 2,300 characters: longer paragraphs are shortened and listed
 *  in "truncated" (the full text stays in the PDF's fields). Also given word for word to the company AI
 *  (public/lc-ai-confirm-print-prompt.txt); tests/pdf.test.ts checks the two match. */
export function payloadScript(t: Template) {
  const all = t.sections.flatMap(s => s.fields);
  const groups = all.filter(f => f.kind === "checks").map(f => `${JSON.stringify(f.id)}: ${JSON.stringify(f.options ?? [])}`).join(", ");
  const long = JSON.stringify(all.filter(f => f.kind === "long").map(f => f.id));
  const form = JSON.stringify(/[A-Z]+-\d+/.exec(t.formCode ?? "")?.[0] ?? safe(t.title)), version = JSON.stringify(/v([\d.]+)/.exec(t.formCode ?? "")?.[1] ?? "1");
  return fill(PAYLOAD_JS, { __GROUPS__: groups, __LONG__: long, __FORM__: form, __VERSION__: version });
}

/** The QR code without Acrobat's barcode feature: lcQrMatrix makes a version 40 / error correction M code, lcDrawQr writes
 *  its rows into the 177 comb fields "__qr_0" ... "__qr_176" (ZapfDingbats "n" = a black square). */
export const qrScript = QR_JS;

/** "Generate QR Code": problems are listed and no code is made; otherwise the QR code is made from the answers and
 *  the form goes to its page. */
export const generateQr = GENERATE_QR_JS;

/** "Print Form": prints only once the QR code exists and still matches the answers. */
export const printForm = PRINT_FORM_JS;

export function addChecks(doc: PDFDocument, form: Form, page: PDFPage, font: PDFFont, t: Template, js: JS,
  underlined: Set<string> = new Set(), toolbar?: PDFPage[], qr?: { page: PDFPage; x: number; y: number; size: number; button: { x: number; y: number } }) {
  const all = t.sections.flatMap(s => s.fields), byId = new Map(all.map(f => [f.id, f]));
  const asList = (rules: Rule[]) => rules.map(r => [r.field, r.values.map(safe), r.not ? 1 : 0] as [string, string[], 0 | 1]);

  // 1. Describe every question the script must look at.
  const model: Record<string, Model> = {};
  const add = (f: Field) => model[f.id] ??= {
    kind: f.kind, label: safe(f.label),
    ...(f.kind === "checks" ? { options: (f.options ?? []).map(safe) } : {}),
    ...(underlined.has(f.id) ? { underlined: 1 as const } : {}),
  };
  for (const f of all.filter(f => f.required || f.requiredIf)) {      // mandatory questions (and what they depend on)
    Object.assign(add(f), { hasRule: 1 as const },
      f.required ? { always: 1 as const } : {},
      f.requiredIf ? { requiredIf: asList(f.requiredIf) } : {});
    for (const r of f.requiredIf ?? []) { const by = byId.get(r.field); if (by) add(by); }
  }
  for (const f of all.filter(f => activeRules(f).length)) {           // questions that only apply once something is ticked
    add(f).activeIf = asList(activeRules(f));
    for (const r of activeRules(f)) { const by = byId.get(r.field); if (by) add(by); }
  }
  for (const f of all.filter(f => f.kind === "text" || f.kind === "long" || f.kind === "date")) // typed answers
    add(f).check = f.format ? [FORMATS[f.format].ok.source, FORMATS[f.format].say] : 1;
  // In the form's order, so "Check form" lists the problems top to bottom and goes to the first one.
  const ordered = Object.fromEntries(all.filter(f => model[f.id]).map(f => [f.id, model[f.id]]));

  // 2. The rules engine, stored once in the PDF. Every box and button calls lcRules(this).
  //    (Acrobat's JavaScript is old-style: var, no arrow functions.)
  const script = fill(RULES_JS, { __MODEL__: JSON.stringify(ordered), __DATES__: JSON.stringify(all.filter(f => f.kind === "date").map(f => f.id)) });
  // Stored as a stream, not a string: no 32,767-byte limit however many rules a form has.
  const scriptRef = doc.context.register(doc.context.flateStream(Uint8Array.from(qr ? `${script}
${payloadScript(t)}
${qrScript}` : script, c => c.charCodeAt(0) & 0xff)));
  doc.catalog.set(PDFName.of("Names"), doc.context.obj({
    JavaScript: doc.context.obj({ Names: [PDFHexString.fromText("lcRules"), doc.context.obj({ S: "JavaScript", JS: scriptRef })] }),
  }));

  // 3. When to run it: the moment a box is ticked or an option picked (U = mouse up), and when leaving a box (Bl = blur).
  const run = () => js("lcRules(this);");
  for (const [id, m] of Object.entries(model)) {
    const names =
      m.kind === "checks" ? (m.options ?? []).map((_, i) => subId(id, i)) :
      m.kind === "date" && form.getFieldMaybe(dateIds(id)[0]) ? [...dateIds(id), id] :
      [id];
    for (const name of names) for (const w of form.getFieldMaybe(name)?.acroField.getWidgets() ?? []) {
      const clicked = m.kind === "check" || m.kind === "checks" || m.kind === "radio" || (m.kind === "date" && name !== id);
      const actions = w.dict.lookupMaybe(PDFName.of("AA"), PDFDict) ?? doc.context.obj({});
      actions.set(PDFName.of(clicked ? "U" : "Bl"), run());
      w.dict.set(PDFName.of("AA"), actions);
    }
  }
  // ... and after any value changes (Acrobat's recalculation), as a safety net: a hidden field that recalculates.
  const recalc = form.createTextField("__checks");
  recalc.addToPage(page, { x: -20, y: -20, width: 1, height: 1, borderWidth: 0 }); // off the page
  recalc.acroField.getWidgets()[0].dict.set(PDFName.of("F"), PDFNumber.of(2));    // hidden
  recalc.acroField.dict.set(PDFName.of("AA"), doc.context.obj({ C: run() }));      // C = calculate
  form.acroForm.dict.set(PDFName.of("CO"), doc.context.obj([recalc.ref]));

  // ... and the QR code (JavaScript version): an Acrobat barcode field (a text field with paper metadata, /PMD, as in
  // Adobe's Implementation Note E-7), filled only when "Generate QR Code" is pressed.
  if (qr) {
    // The QR code is drawn by the form's own script (lcDrawQr), not by Acrobat's barcode feature (which some
    // Acrobat installations don't have): 177 comb text fields, one per row of a version 40 code, dark modules as
    // ZapfDingbats "n" (a black square), inside the frame with a 4-module quiet zone. "__qr" (hidden) holds the JSON.
    const box = form.createTextField("__qr");
    box.addToPage(qr.page, { x: -20, y: -20, width: 1, height: 1, borderWidth: 0 });
    box.acroField.getWidgets()[0].dict.set(PDFName.of("F"), PDFNumber.of(2)); // hidden
    const zapf = doc.embedStandardFont(StandardFonts.ZapfDingbats), m = qr.size / 185; // zapf: only for the initial (empty) look
    for (let y = 0; y < 177; y++) {
      const row = form.createTextField(`__qr_${y}`);
      row.setMaxLength(177);
      row.enableCombing();
      row.enableReadOnly();
      row.addToPage(qr.page, { x: qr.x + 4 * m, y: qr.y + qr.size - (5 + y) * m, width: 177 * m, height: m, font: zapf, borderWidth: 0 });
      // The square is 0.692 em: one module. /ZaDb is the form's own ZapfDingbats entry (finishForm puts it in /DR);
      // with any other font name Acrobat falls back to Helvetica and draws the letter "n".
      const da = PDFString.of(`/ZaDb ${Math.round(m / 0.692 * 1000) / 1000} Tf 0 g`);
      row.acroField.dict.set(PDFName.of("DA"), da);
      row.acroField.getWidgets()[0].dict.set(PDFName.of("DA"), da);
      row.acroField.getWidgets()[0].dict.delete(PDFName.of("MK")); // no background, no border
    }
  }


  // 4. The "Check form" button, and the same report before saving or printing.
  const report = (always: boolean) => (always ? CHECK_FORM_JS : BEFORE_SAVE_JS);
  // "Reset form": asks first, then clears every answer back to how the form started, and re-checks.
  const reset = RESET_FORM_JS;
  // Each button is one field with a widget per page: at the top right of page 1, or (toolbar) at the top right of
  // every page, beside "Reset form", like the toolbar on the bank's smart form.
  const style = toolbar ? { font, textColor: WHITE, backgroundColor: ACCENT, borderColor: ACCENT } : { font, textColor: WHITE, backgroundColor: INK, borderColor: INK };
  // [name, caption, script, width]; laid out right to left, 4 pt apart, ending at the right margin.
  const buttons: [string, string, string, number][] = [
    ["__check_form", "Check form", report(true), 64],
    ...(toolbar ? [["__reset_form", "Reset form", reset, 64]] as [string, string, string, number][] : [])];
  buttons.forEach(([name, caption, code, width], i) => {
    const button = form.createButton(name);
    const x = W - M - buttons.slice(i).reduce((sum, b) => sum + b[3] + 4, 0) + 4;
    for (const p of toolbar ?? [page])
      button.addToPage(caption, p, toolbar ? { x, y: H - 25, width, height: 13, ...style } : { x: W - M - 84, y: H - 44, width: 84, height: 18, ...style });
    button.setFontSize(toolbar ? 8 : 9);
    for (const w of button.acroField.getWidgets()) {
      w.dict.set(PDFName.of("A"), js(code));         // A = on click
      w.dict.set(PDFName.of("F"), PDFNumber.of(0));  // shown on screen, not printed
    }
  });
  // "Generate QR Code" then "Print Form": once, at the end of the form, under the QR code.
  if (qr) ([["__generate_qr", "Generate QR Code", generateQr], ["__print_form", "Print Form", printForm]] as const).forEach(([name, caption, code], i) => {
    const button = form.createButton(name);
    button.addToPage(caption, qr.page, { x: qr.button.x + i * 162, y: qr.button.y, width: 150, height: 22, ...style });
    button.setFontSize(10);
    const w = button.acroField.getWidgets()[0];
    w.dict.set(PDFName.of("A"), js(code));
    w.dict.set(PDFName.of("F"), PDFNumber.of(0));
  });
  doc.catalog.set(PDFName.of("AA"), doc.context.obj({ WS: js(report(false)), WP: js(report(false)) })); // WS / WP = before save / print
}

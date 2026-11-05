// CHECKS INSIDE THE PDF, FOR WHEN ACROBAT RUNS JAVASCRIPT
// The same rules as rules.ts, written into the PDF as JavaScript for Adobe Acrobat / Reader (Chrome runs much of it too):
//   - after every change: each question's "required" flag, red outline when blank or wrong, locked (and cleared) when
//     it doesn't apply, and the checks across answers (dates in order, amount above zero, insurance against price basis)
//   - a "Check form" button that lists what is missing or wrong and puts the cursor on the first one
//   - a "Reset form" button (addToolbar)
//   - a warning when saving or printing an incomplete form
//   - typing filters on amount / phone / account / number boxes, and upper case + SWIFT characters on the rest
// With JavaScript off, none of this runs; red-frames.ts and the workbench cover that case.
import { PDFDict, PDFDocument, PDFFont, PDFHexString, PDFName, PDFNumber, PDFObject, PDFPage } from "pdf-lib";
import { activeRules } from "./rules";
import { dateIds } from "./dates";
import { ACCENT, H, INK, M, W, WHITE } from "./look";
import { BAD_CHARS, FORMATS, safe, subId, type Field, type Kind, type Rule, type Template } from "./types";

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

export function addChecks(doc: PDFDocument, form: Form, page: PDFPage, font: PDFFont, t: Template, js: JS,
  underlined: Set<string> = new Set(), toolbar?: PDFPage[]) {
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
  const script = `function lcRules(d) {
var M = ${JSON.stringify(ordered)};
function has(list, x) { for (var i = 0; i < list.length; i++) if (list[i] == x) return true; return false; }

// The answer to question id, read from the PDF's fields.
function val(id) {
  var m = M[id], f, a = [], i;
  if (m.kind == "checks") { for (i = 0; i < m.options.length; i++) { f = d.getField(id + "__" + i); if (f && f.value != "Off") a.push(m.options[i]); } return a; }
  if (m.kind == "date" && shown(id)) return d.getField(id).valueAsString;
  if (m.kind == "date" && d.getField(id + "__list")) { a = /^(\\d\\d) (\\w{3}) (\\d{4})$/.exec(d.getField(id + "__list").valueAsString);
    return a ? a[1] + "/" + ("0" + ("JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(a[2]) / 3 + 1)).slice(-2) + "/" + a[3] : ""; }
  f = d.getField(id); if (!f) return "";
  if (m.kind == "check") return f.value != "Off" ? "true" : "false";
  return f.value == "Off" ? "" : String(f.value);
}
function shown(id) { var f = d.getField(id); return !!f && f.display != 1; } // 1 = display.hidden
function empty(x) { return typeof x == "object" ? !x.length : x === ""; }

// Does any of these rules hold?
function any(rules) {
  var i, j, x, hit;
  for (i = 0; i < rules.length; i++) {
    x = val(rules[i][0]); hit = false;
    if (typeof x == "object") { for (j = 0; j < x.length; j++) if (has(rules[i][1], x[j])) hit = true; } else hit = has(rules[i][1], x);
    if (rules[i][2] ? !hit && !empty(x) : hit) return true;
  }
  return false;
}
function mandatory(id) { var m = M[id]; return m.always ? true : any(m.requiredIf || []); }

// What is wrong with a typed answer, or "".
function wrong(id) {
  var m = M[id], f = d.getField(id), s = m.kind == "date" ? val(id) : f ? f.valueAsString : "", x, k;
  if (!m.check || !s) return "";
  x = s.match(new RegExp(${JSON.stringify(BAD_CHARS)}, "g"));
  if (x) { k = []; for (var i = 0; i < x.length; i++) if (!has(k, x[i])) k.push(x[i]); return "remove " + k.join(" ") + " (letters, digits and . , - / ( ) ' : ? + # & @ % only)"; }
  if (m.kind == "date") { x = /^(\\d\\d)\\/(\\d\\d)\\/(\\d{4})$/.exec(s); k = x && new Date(+x[3], x[2] - 1, +x[1]); return k && k.getDate() == +x[1] && k.getMonth() == x[2] - 1 ? "" : "not a real date (DD/MM/YYYY)"; }
  return m.check.length && !new RegExp(m.check[0]).test(s) ? m.check[1] : "";
}

// A real DD/MM/YYYY date as a Date, or null.
function day(s) { var x = /^(\\d\\d)\\/(\\d\\d)\\/(\\d{4})$/.exec(s), k = x && new Date(+x[3], x[2] - 1, +x[1]); return k && k.getDate() == +x[1] && k.getMonth() == x[2] - 1 ? k : null; }
function v(id) { return M[id] ? val(id) : ""; }

// Checks across answers (the same as cross-checks in form/validate.ts). Skipped when a form doesn't have the fields.
function across() {
  var X = {}, A = day(v("application_date")), S = day(v("latest_shipment_date")), E = day(v("expiry_date")), a = v("amount"), pb = v("price_basis");
  if (S && E && E < S) X.expiry_date = "is before the latest shipment date";
  else if (A && E && E < A) X.expiry_date = "is before the application date";
  if (A && S && S < A) X.latest_shipment_date = "is before the application date";
  if (A && A.getTime() > new Date().getTime()) X.application_date = "is in the future";
  if (/^[\\d,]+(\\.\\d+)?$/.test(a) && !(Number(a.replace(/,/g, "")) > 0)) X.amount = "must be more than zero";
  if (v("insurance_arrangement") && (pb == "CIF" || pb == "CIP")) X.insurance_arrangement = "is only for FOB/CFR/FCA/CPT, but price basis is " + pb + " (the beneficiary insures)";
  return X;
}

// Clears a question's box, so an answer can't stay behind in a question that doesn't apply.
function clear(f, kind) {
  if (kind == "check" || kind == "checks" || kind == "radio") { if (f.value != "Off") f.value = "Off"; }
  else if (f.type == "combobox" && /__list$/.test(f["name"])) { if (f.currentValueIndices != 0) f.currentValueIndices = 0; } // a date list: back to "Pick a date"
  else if (f.value !== "" && f.value != null) f.value = "";
}

// Go through every question: work out its state, then colour (and lock) its boxes.
var missing = [], bad = [], first = "", id, m, applies, required, problem, whatsWrong, names, i, f, X;
try {
X = across();
for (id in M) {
  m = M[id]; if (!m.hasRule && !m.check && !m.activeIf) continue;
  applies = !m.activeIf || any(m.activeIf);
  required = m.hasRule && applies ? mandatory(id) : false;
  problem = required && (m.kind == "check" ? val(id) != "true" : empty(val(id)));
  if (problem) missing.push(m.label);
  whatsWrong = applies ? wrong(id) || X[id] || "" : ""; if (whatsWrong) { bad.push(m.label + ": " + whatsWrong); problem = true; }
  names = [id]; if (m.kind == "checks") { names = []; for (i = 0; i < m.options.length; i++) names.push(id + "__" + i); }
  if (m.kind == "date" && !shown(id) && d.getField(id + "__list")) names = [id + "__list"];
  if (problem && !first) first = names[0];
  for (i = 0; i < names.length; i++) {
    f = d.getField(names[i]); if (!f) continue;
    if (m.hasRule && m.kind != "checks") f.required = required;
    if (m.activeIf) f.readonly = !applies;                                                   // locked until it applies
    if (!applies) { clear(f, m.kind); f.lineWidth = 1; f.strokeColor = ["G", 0.6]; f.fillColor = ["G", 0.86]; continue; } // grey, cleared
    f.lineWidth = problem || !m.underlined ? 1 : 0;
    f.strokeColor = problem ? color.red : m.underlined ? color.transparent : color.black;    // red when blank or wrong
    f.fillColor = problem ? ["RGB", 1, 0.88, 0.88] : m.underlined ? color.transparent : color.white;
  }
}
} catch (e) { console.println("lcRules: " + e); }
missing.bad = bad;
missing.first = first; // the field of the first problem, for "Check form" to go to
return missing;
}

// Acrobat only: show each date's calendar box and hide its drop-down list.
function lcDates(d) {
  var D = ${JSON.stringify(all.filter(f => f.kind === "date").map(f => f.id))}, i, t, p;
  for (i = 0; i < D.length; i++) { t = d.getField(D[i]); if (!t) continue; t.display = display.visible;
    p = d.getField(D[i] + "__list"); if (p) p.display = display.hidden; }
}
// On opening in Acrobat: show the calendars, and set every box's colour and lock.
if (typeof app != "undefined" && /^(Exchange|Reader)/.test(app.viewerType)) { lcDates(this); lcRules(this); }`;
  // Stored as a stream, not a string: no 32,767-byte limit however many rules a form has.
  const scriptRef = doc.context.register(doc.context.flateStream(Uint8Array.from(script, c => c.charCodeAt(0) & 0xff)));
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

  // 4. The "Check form" button, and the same report before saving or printing.
  const report = (always: boolean) => `var m = typeof lcRules == "function" ? lcRules(this) : [], b = m.bad || [], t = [];
function list(a) { return "- " + a.slice(0, 15).join("\\n- ") + (a.length > 15 ? "\\n- ... and " + (a.length - 15) + " more" : ""); }
if (m.length) t.push(m.length + " mandatory question" + (m.length > 1 ? "s are" : " is") + " still blank:\\n" + list(m));
if (b.length) t.push(b.length + " answer" + (b.length > 1 ? "s need" : " needs") + " correcting:\\n" + list(b));
if (t.length) { app.alert("This form is not ready to send. The boxes concerned are outlined in red.\\n\\n" + t.join("\\n\\n") + "\\n\\nPlease correct them before you send the form.", 1);
  ${always ? "var g = m.first && this.getField(m.first); if (g) g.setFocus();" : ""} }
${always ? 'else app.alert("All mandatory questions are answered and every answer is in the right format. You can save the form and send it.", 3);' : ""}`;
  // "Reset form": asks first, then clears every answer back to how the form started, and re-checks.
  const reset = `if (app.alert("Are you sure you want to reset the form? All your answers will be cleared.", 2, 2) == 4) {
this.resetForm(); if (typeof lcDates == "function") lcDates(this); if (typeof lcRules == "function") lcRules(this); }`;
  // Each button is one field with a widget per page: at the top right of page 1, or (toolbar) at the top right of
  // every page, beside "Reset form", like the toolbar on the bank's smart form.
  const style = toolbar ? { font, textColor: WHITE, backgroundColor: ACCENT, borderColor: ACCENT } : { font, textColor: WHITE, backgroundColor: INK, borderColor: INK };
  const buttons: [string, string, string][] = [["__check_form", "Check form", report(true)], ...(toolbar ? [["__reset_form", "Reset form", reset]] as [string, string, string][] : [])];
  buttons.forEach(([name, caption, code], i) => {
    const button = form.createButton(name);
    for (const p of toolbar ?? [page])
      button.addToPage(caption, p, toolbar ? { x: W - M - 68 * (buttons.length - i) + 4, y: H - 25, width: 64, height: 13, ...style } : { x: W - M - 84, y: H - 44, width: 84, height: 18, ...style });
    button.setFontSize(toolbar ? 8 : 9);
    for (const w of button.acroField.getWidgets()) {
      w.dict.set(PDFName.of("A"), js(code));         // A = on click
      w.dict.set(PDFName.of("F"), PDFNumber.of(0));  // shown on screen, not printed
    }
  });
  doc.catalog.set(PDFName.of("AA"), doc.context.obj({ WS: js(report(false)), WP: js(report(false)) })); // WS / WP = before save / print
}

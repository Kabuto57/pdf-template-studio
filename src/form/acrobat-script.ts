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
  return String.raw`function lcPayload(d) {
var G = {${groups}}, LONG = ${long}, CAP = 2300;
var data = {}, i, n, f, k, v, g, m, out, cut = [], ok = true, t = new Date();
for (i = 0; i < d.numFields; i++) {
  n = d.getNthFieldName(i); if (/^__/.test(n) || /__list$/.test(n)) continue;
  f = d.getField(n); if (!f || f.type == "button" || f.type == "signature") continue;
  g = /^(.+)__(\d+)$/.exec(n);
  if (g && G[g[1]]) { if (f.value != "Off") { if (!data[g[1]]) data[g[1]] = []; data[g[1]].push(G[g[1]][+g[2]]); } continue; }
  if (f.type == "checkbox") { if (f.value != "Off") data[n] = true; continue; }
  v = f.type == "radiobutton" ? (f.value == "Off" ? "" : String(f.value)) : String(f.valueAsString).replace(/^\s+|\s+$/g, "");
  if (v !== "") data[n] = v;
}
if (typeof lcRules == "function") { m = lcRules(d); ok = !m.length && !(m.bad || []).length; }
function pad(x) { return ("0" + x).slice(-2); }
out = {"form": ${form}, "version": ${version}, "saved": t.getFullYear() + "-" + pad(t.getMonth() + 1) + "-" + pad(t.getDate()) + "T" + pad(t.getHours()) + ":" + pad(t.getMinutes()), "complete": ok, "data": data};
// A QR code holds about 2,300 characters: if the answers are longer, shorten the two long paragraphs and say so.
for (i = 0; i < LONG.length && JSON.stringify(out).length > CAP; i++) {
  k = LONG[i]; if (!data[k]) continue;
  cut.push(k); out.truncated = cut;
  v = JSON.stringify(out).length - CAP + 3;
  data[k] = v < data[k].length ? data[k].slice(0, data[k].length - v) + "..." : "...";
}
// Padded with spaces to the full length: the QR code is then always the same size (version 40) and fills its frame.
v = JSON.stringify(out); while (v.length < CAP) v += " ";
return v;
}`;
}

/** The QR code without Acrobat's barcode feature: lcQrMatrix makes a version 40 / error correction M code, lcDrawQr writes
 *  its rows into the 177 comb fields "__qr_0" ... "__qr_176" (ZapfDingbats "n" = a black square). */
export const qrScript = String.raw`// QR code (version 40, error correction M, byte mode, mask 0) drawn without Acrobat's barcode feature:
// one comb text field per row ("__qr_0" ... "__qr_176"), dark modules as ZapfDingbats "n" (a black square).
function lcQrMatrix(text) {
  var N = 177, i, j, x, y, m = [], f = [], bytes = [], s = unescape(encodeURIComponent(text));
  for (i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 255);
  for (y = 0; y < N; y++) { m.push([]); f.push([]); for (x = 0; x < N; x++) { m[y].push(false); f[y].push(false); } }
  function set(x, y, dark) { m[y][x] = dark; f[y][x] = true; }
  function mul(a, b) { var z = 0; for (var k = 7; k >= 0; k--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((b >>> k) & 1) * a; } return z; }
  // Function patterns: timing, finders, alignment, format area, version, dark module.
  for (i = 0; i < N; i++) { set(6, i, i % 2 == 0); set(i, 6, i % 2 == 0); }
  function finder(cx, cy) { for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
    var d = Math.max(Math.abs(dx), Math.abs(dy)), xx = cx + dx, yy = cy + dy;
    if (xx >= 0 && xx < N && yy >= 0 && yy < N) set(xx, yy, d != 2 && d != 4); } }
  finder(3, 3); finder(N - 4, 3); finder(3, N - 4);
  var A = [6, 30, 58, 86, 114, 142, 170];
  for (i = 0; i < A.length; i++) for (j = 0; j < A.length; j++) {
    if ((i == 0 && j == 0) || (i == 0 && j == A.length - 1) || (i == A.length - 1 && j == 0)) continue;
    for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(A[i] + dx, A[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) != 1);
  }
  var rem = 0, fmt; for (i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  fmt = ((0 << 10) | rem) ^ 0x5412; // error correction M (00), mask 0
  function bit(v, k) { return ((v >>> k) & 1) != 0; }
  for (i = 0; i <= 5; i++) set(8, i, bit(fmt, i));
  set(8, 7, bit(fmt, 6)); set(8, 8, bit(fmt, 7)); set(7, 8, bit(fmt, 8));
  for (i = 9; i < 15; i++) set(14 - i, 8, bit(fmt, i));
  for (i = 0; i < 8; i++) set(N - 1 - i, 8, bit(fmt, i));
  for (i = 8; i < 15; i++) set(8, N - 15 + i, bit(fmt, i));
  set(8, N - 8, true);
  rem = 40; for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
  var ver = (40 << 12) | rem;
  for (i = 0; i < 18; i++) { var a = N - 11 + i % 3, b = Math.floor(i / 3); set(a, b, bit(ver, i)); set(b, a, bit(ver, i)); }
  // Data: mode 0100, 16-bit length, the bytes, terminator, padding to 2,334 data codewords.
  var bits = [], cap = 2334 * 8;
  function put(v, n) { for (var k = n - 1; k >= 0; k--) bits.push((v >>> k) & 1); }
  put(4, 4); put(bytes.length, 16); for (i = 0; i < bytes.length; i++) put(bytes[i], 8);
  put(0, Math.min(4, cap - bits.length)); while (bits.length % 8) bits.push(0);
  var data = []; for (i = 0; i < bits.length; i += 8) { var v = 0; for (j = 0; j < 8; j++) v = (v << 1) | bits[i + j]; data.push(v); }
  for (i = 0; data.length < 2334; i++) data.push(i % 2 ? 0x11 : 0xEC);
  // Reed-Solomon: 49 blocks (18 of 47 + 31 of 48 data codewords), 28 error-correction codewords each.
  var div = [], root = 1; for (i = 0; i < 27; i++) div.push(0); div.push(1);
  for (i = 0; i < 28; i++) { for (j = 0; j < 28; j++) { div[j] = mul(div[j], root); if (j + 1 < 28) div[j] ^= div[j + 1]; } root = mul(root, 2); }
  var blocks = [], k = 0;
  for (i = 0; i < 49; i++) {
    var len = i < 18 ? 47 : 48, dat = data.slice(k, k + len), ecc = []; k += len;
    for (j = 0; j < 28; j++) ecc.push(0);
    for (j = 0; j < dat.length; j++) { var fct = dat[j] ^ ecc.shift(); ecc.push(0); for (var t = 0; t < 28; t++) ecc[t] ^= mul(div[t], fct); }
    if (i < 18) dat.push(-1);
    blocks.push(dat.concat(ecc));
  }
  var all = [];
  for (i = 0; i < blocks[0].length; i++) for (j = 0; j < 49; j++) if (blocks[j][i] != -1) all.push(blocks[j][i]);
  // Place the codewords in the zigzag, then mask 0 ((x + y) even flips).
  var n = 0;
  for (var right = N - 1; right >= 1; right -= 2) {
    if (right == 6) right = 5;
    for (var vert = 0; vert < N; vert++) for (j = 0; j < 2; j++) {
      x = right - j; var up = ((right + 1) & 2) == 0; y = up ? N - 1 - vert : vert;
      if (!f[y][x] && n < all.length * 8) { m[y][x] = ((all[n >>> 3] >>> (7 - (n & 7))) & 1) != 0; n++; }
    }
  }
  for (y = 0; y < N; y++) for (x = 0; x < N; x++) if (!f[y][x] && (x + y) % 2 == 0) m[y][x] = !m[y][x];
  return m;
}
function lcDrawQr(d, text) {
  var m = lcQrMatrix(text), y, x, s, calc = d.calculate;
  d.calculate = false; // 177 rows: don't re-run the checks after each one
  try { for (y = 0; y < m.length; y++) { s = ""; for (x = 0; x < m.length; x++) s += m[y][x] ? "n" : " "; d.getField("__qr_" + y).value = s; } }
  finally { d.calculate = calc; }
}`;

/** "Generate QR Code": problems are listed and no code is made; otherwise the QR code is made from the answers and
 *  the form goes to its page. */
export const generateQr = String.raw`var m = typeof lcRules == "function" ? lcRules(this) : [], b = m.bad || [], t = [];
function list(a) { return "- " + a.slice(0, 15).join("\n- ") + (a.length > 15 ? "\n- ... and " + (a.length - 15) + " more" : ""); }
if (m.length) t.push(m.length + " mandatory question" + (m.length > 1 ? "s are" : " is") + " still blank:\n" + list(m));
if (b.length) t.push(b.length + " answer" + (b.length > 1 ? "s need" : " needs") + " correcting:\n" + list(b));
if (t.length) { app.alert("The QR code cannot be generated yet. The boxes concerned are outlined in red.\n\n" + t.join("\n\n") + "\n\nPlease correct them, then press Generate QR Code again.", 1);
  var g = m.first && this.getField(m.first); if (g) g.setFocus(); }
else { try { var q = this.getField("__qr"); q.value = lcPayload(this); lcDrawQr(this, q.value); this.pageNum = this.numPages - 1;
  app.alert("The QR code has been generated from your answers (" + q.value.length + " characters). Press Print Form to print the form with the QR code.", 3); }
  catch (e) { app.alert("The QR code could not be generated: " + e + "\nPlease send this message to the form's maintainer.", 1); } }`;

/** "Print Form": prints only once the QR code exists and still matches the answers. */
export const printForm = String.raw`var q = this.getField("__qr"), now = typeof lcPayload == "function" ? lcPayload(this) : "", same = false;
try { same = JSON.stringify(JSON.parse(q.value).data) == JSON.stringify(JSON.parse(now).data); } catch (e) {}
if (!/\S/.test(q.value)) app.alert("Please press Generate QR Code first, so the printed form carries the QR code.", 1);
else if (!same) app.alert("Your answers have changed since the QR code was generated. Please press Generate QR Code again, then Print Form.", 1);
else this.print(true, 0, this.numPages - 1, false, true);`;

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
    if (m.hasRule && m.kind != "checks") f.required = !!(required && problem); // only while blank or wrong: Acrobat outlines Required boxes in red even when filled
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

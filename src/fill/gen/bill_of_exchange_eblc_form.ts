// @ts-nocheck: lc-form's Acrobat JavaScript, copied word for word by scripts/fill-engine.py (do not edit; rerun it)
export const document = function (app, color, display, console) {
// THE RULES ENGINE (runs inside Acrobat). Built into the PDF as the document script "lcRules".
// lcRules(doc) checks every question and colours its box:
//   blank or wrong mandatory answer -> red outline, pink fill, marked Required
//   answered and right              -> black outline, white fill
//   doesn't apply yet               -> greyed out, locked, and its answer cleared
// It returns the list of missing questions, plus .bad (wrong answers) and .first (where to put the cursor).
// lcDates(doc) shows each date's calendar box and hides its drop-down list (Acrobat only).
// {"bill_no":{"kind":"text","label":"No.","hasRule":1,"always":1,"check":1},"bill_date":{"kind":"date","label":"Singapore, (date)","hasRule":1,"always":1,"check":1},"currency":{"kind":"select","label":"For (currency)","hasRule":1,"always":1},"exchange_amount":{"kind":"text","label":"Exchange (amount)","hasRule":1,"always":1,"check":["^\\d{1,3}(,?\\d{3})*(\\.\\d{1,2})?$","is not an amount"]},"tenor":{"kind":"text","label":"At (e.g. SIGHT, or 30 DAYS AFTER SIGHT)","hasRule":1,"always":1,"check":1},"sum_in_words":{"kind":"text","label":"Of this FIRST OF EXCHANGE (second of the same tenor and date being unpaid) pay to the order of Demo Bank Ltd the sum of","words":["exchange_amount","currency"],"check":1},"value_received_1":{"kind":"text","label":"Value received \"drawn under\"","hasRule":1,"always":1,"check":1},"value_received_2":{"kind":"text","label":"Value received (line 2)","check":1},"value_received_3":{"kind":"text","label":"Value received (line 3)","check":1},"credit_no":{"kind":"text","label":"Documentary credit no.","hasRule":1,"always":1,"check":1},"credit_dated":{"kind":"date","label":"Dated","hasRule":1,"always":1,"check":1},"drawee_1":{"kind":"text","label":"To","hasRule":1,"always":1,"check":1},"drawee_2":{"kind":"text","label":"To (line 2)","check":1},"drawee_3":{"kind":"text","label":"To (line 3)","check":1},"drawee_4":{"kind":"text","label":"To (line 4)","check":1},"drawer_1":{"kind":"text","label":"For and on behalf of (drawer)","hasRule":1,"always":1,"check":1},"drawer_2":{"kind":"text","label":"For and on behalf of (line 2)","hasRule":1,"always":1,"check":1},"signatory_name":{"kind":"text","label":"Name of authorised signatory (drawer)","check":1}} is filled in by document_script (step 2) with the rules table built from the form; ["bill_date","credit_dated"] with the date
// question ids. Acrobat's JavaScript is old-style: var, no arrow functions.
// The rules table, the index "box -> the questions to re-check when it changes" (null = always check everything), and what
// the last run saw: v = each box's last-seen value, st = each box's last-written look (so unchanged boxes are not written again).
var lcModel = {"bill_no":{"kind":"text","label":"No.","hasRule":1,"always":1,"check":1},"bill_date":{"kind":"date","label":"Singapore, (date)","hasRule":1,"always":1,"check":1},"currency":{"kind":"select","label":"For (currency)","hasRule":1,"always":1},"exchange_amount":{"kind":"text","label":"Exchange (amount)","hasRule":1,"always":1,"check":["^\\d{1,3}(,?\\d{3})*(\\.\\d{1,2})?$","is not an amount"]},"tenor":{"kind":"text","label":"At (e.g. SIGHT, or 30 DAYS AFTER SIGHT)","hasRule":1,"always":1,"check":1},"sum_in_words":{"kind":"text","label":"Of this FIRST OF EXCHANGE (second of the same tenor and date being unpaid) pay to the order of Demo Bank Ltd the sum of","words":["exchange_amount","currency"],"check":1},"value_received_1":{"kind":"text","label":"Value received \"drawn under\"","hasRule":1,"always":1,"check":1},"value_received_2":{"kind":"text","label":"Value received (line 2)","check":1},"value_received_3":{"kind":"text","label":"Value received (line 3)","check":1},"credit_no":{"kind":"text","label":"Documentary credit no.","hasRule":1,"always":1,"check":1},"credit_dated":{"kind":"date","label":"Dated","hasRule":1,"always":1,"check":1},"drawee_1":{"kind":"text","label":"To","hasRule":1,"always":1,"check":1},"drawee_2":{"kind":"text","label":"To (line 2)","check":1},"drawee_3":{"kind":"text","label":"To (line 3)","check":1},"drawee_4":{"kind":"text","label":"To (line 4)","check":1},"drawer_1":{"kind":"text","label":"For and on behalf of (drawer)","hasRule":1,"always":1,"check":1},"drawer_2":{"kind":"text","label":"For and on behalf of (line 2)","hasRule":1,"always":1,"check":1},"signatory_name":{"kind":"text","label":"Name of authorised signatory (drawer)","check":1}};
var lcDeps = {"bill_no":["bill_no"],"bill_date":["bill_date"],"currency":["currency","sum_in_words"],"exchange_amount":["exchange_amount","sum_in_words"],"tenor":["tenor"],"sum_in_words":["sum_in_words"],"value_received_1":["value_received_1"],"value_received_2":["value_received_2"],"value_received_3":["value_received_3"],"credit_no":["credit_no"],"credit_dated":["credit_dated"],"drawee_1":["drawee_1"],"drawee_2":["drawee_2"],"drawee_3":["drawee_3"],"drawee_4":["drawee_4"],"drawer_1":["drawer_1"],"drawer_2":["drawer_2"],"signatory_name":["signatory_name"]};
var lcState = {v: {}, st: {}};
function lcRules(d, src) {
var M = lcModel, S = lcState, only = null, calc, pass, cleared = false, nm, g, sig;
// src = the name of the box that just changed (its blur, its click, or what the calculation says triggered it). Then only the
// questions that read that box are re-checked (lcDeps), and nothing at all if its value is what the last run saw.
// No src (opening, Reset form, Check form, saving ...): every question, and every look is written again.
if (src) {
  nm = String(src).replace(/^[A-Z]+\./, ""); g = /^(.+)__(\d+|list)$/.exec(nm);
  g = M[nm] ? nm : g && M[g[1]] ? g[1] : "";
  if (lcDeps) {
    g = g && lcDeps[g];
    sig = d.getField(nm); sig = sig ? String(sig.value) : "";
    if (!g || S.v[nm] === sig) { g = []; g.bad = []; g.first = ""; return g; }
    S.v[nm] = sig; only = {}; for (sig = 0; sig < g.length; sig++) only[g[sig]] = 1;
  }
}
if (!only) { S.v = {}; S.st = {}; }
function has(list, x) { for (var i = 0; i < list.length; i++) if (list[i] == x) return true; return false; }

// The answer to question id, read from the PDF's fields.
function val(id) {
  var m = M[id], f, a = [], i;
  if (m.kind == "checks") { for (i = 0; i < m.options.length; i++) { f = d.getField(id + "__" + i); if (f && f.value != "Off") a.push(m.options[i]); } return a; }
  if (m.kind == "date" && shown(id)) return d.getField(id).valueAsString;
  if (m.kind == "date" && d.getField(id + "__list")) { a = /^(\d\d) (\w{3}) (\d{4})$/.exec(d.getField(id + "__list").valueAsString);
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
  x = s.match(new RegExp("[^A-Za-z0-9 .,\\-/()':?+#&@%\\r\\n]", "g"));
  if (x) { k = []; for (var i = 0; i < x.length; i++) if (!has(k, x[i])) k.push(x[i]); return "remove " + k.join(" ") + " (letters, digits and . , - / ( ) ' : ? + # & @ % only)"; }
  if (m.kind == "date") { x = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(s); k = x && new Date(+x[3], x[2] - 1, +x[1]); return k && k.getDate() == +x[1] && k.getMonth() == x[2] - 1 ? "" : "not a real date (DD/MM/YYYY)"; }
  return m.check.length && !new RegExp(m.check[0]).test(s) ? m.check[1] : "";
}

// A real DD/MM/YYYY date as a Date, or null.
function day(s) { var x = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(s), k = x && new Date(+x[3], x[2] - 1, +x[1]); return k && k.getDate() == +x[1] && k.getMonth() == x[2] - 1 ? k : null; }
function v(id) { return M[id] ? val(id) : ""; }

// THE RULES ACROSS ANSWERS. Each rule: what it checks (one sentence), then its code. A rule that is broken puts its
// message on the question: the box turns red, and Check form lists "<question>: <message>".
// Rules 1-6 are the LC's own (the same as the cross-checks in pdf-template-studio's form/validate.ts); a form without
// those questions skips them. Rules 7-9 come from the form file (FORM["checks"]), so any form can add its own.
function isNumber(s) { return /^[\d,]+(\.\d+)?$/.test(s); }   // "1,250.50" yes, "abc" no
function toNumber(s) { return Number(s.replace(/,/g, "")); }   // "1,250.50" -> 1250.5
function across() {
  var X = {};                                     // what is wrong, by question id
  var applied  = day(v("application_date"));      // the dates as real dates (null while blank or not a date)
  var shipment = day(v("latest_shipment_date"));
  var expiry   = day(v("expiry_date"));
  var amount   = v("amount");
  var basis    = v("price_basis");

  // Rule 1: the LC must not expire before the latest shipment date.
  if (shipment && expiry && expiry < shipment) X.expiry_date = "is before the latest shipment date";
  // Rule 2: the LC must not expire before the application date (checked only when rule 1 is fine).
  else if (applied && expiry && expiry < applied) X.expiry_date = "is before the application date";

  // Rule 3: the latest shipment date must not be before the application date.
  if (applied && shipment && shipment < applied) X.latest_shipment_date = "is before the application date";

  // Rule 4: the application date must not be in the future.
  if (applied && applied.getTime() > new Date().getTime()) X.application_date = "is in the future";

  // Rule 5: the amount must be more than zero.
  if (isNumber(amount) && !(toNumber(amount) > 0)) X.amount = "must be more than zero";

  // Rule 6: "insurance for FOB/CFR/FCA/CPT" must be left blank when the price basis is CIF or CIP
  //         (with CIF and CIP the beneficiary arranges the insurance).
  if (v("insurance_arrangement") && (basis == "CIF" || basis == "CIP"))
    X.insurance_arrangement = "is only for FOB/CFR/FCA/CPT, but price basis is " + basis + " (the beneficiary insures)";

  // Rules 7-9: the form file's own checks. Each is {t: kind, a: question, m: message, ...}.
  var C = [], c, first, second, digits, allowed;
  for (var j = 0; j < C.length; j++) {
    c = C[j];
    // Rule 7 ("order"): date a must not be before date b (with s: true, it must be after b, not the same day).
    if (c.t == "order") {
      first = day(v(c.a)); second = day(v(c.b));
      if (first && second && (c.s ? first <= second : first < second)) X[c.a] = c.m;
    }
    // Rule 8 ("range"): number a must be between lo and hi.
    if (c.t == "range" && isNumber(v(c.a))) {
      if (toNumber(v(c.a)) < c.lo || toNumber(v(c.a)) > c.hi) X[c.a] = c.m;
    }
    // Rule 9 ("lengths"): a's digits must be one of the allowed lengths, which can depend on answer b
    //         (e.g. an account number's length by currency; "*" = any other answer).
    if (c.t == "lengths") {
      digits = v(c.a).replace(/\D/g, "");
      allowed = c.by.hasOwnProperty(v(c.b)) ? c.by[v(c.b)] : c.by["*"];
      if (digits && allowed && allowed.length && !has(allowed, digits.length)) X[c.a] = c.m;
    }
  }
  return X;
}

// Clears a question's box, so an answer can't stay behind in a question that doesn't apply.
function clear(f, kind, nm) {
  if (kind == "check" || kind == "checks" || kind == "radio") { if (f.value != "Off") { f.value = "Off"; cleared = true; } }
  else if (f.type == "combobox" && /__list$/.test(f["name"])) { if (f.currentValueIndices != 0) { f.currentValueIndices = 0; cleared = true; } } // a date list: back to "Pick a date"
  else if (f.value !== "" && f.value != null) { f.value = ""; cleared = true; }
  delete S.v[nm];   // the next change of this box is new to the next run
}

// GO THROUGH EVERY QUESTION, in 5 steps, and colour (and lock) its boxes.
var missing = [], bad = [], first = "", id, m, applies, required, problem, whatsWrong, names, i, f, X;
calc = d.calculate; d.calculate = false;   // every write below would otherwise run the calculation again
try {
for (pass = 0; pass < 3; pass++) {   // a second pass only if a box was cleared (a later question may read it)
missing = []; bad = []; first = ""; cleared = false;
X = across();
for (id in M) {
  m = M[id]; if (!m.hasRule && !m.check && !m.activeIf) continue;   // no rule, no format: nothing to do
  if (only && !only[id]) continue;                                    // this change can't affect it

  // Step 1: does the question apply? (activeIf in the form file, e.g. "only when Term is picked")
  applies = !m.activeIf || any(m.activeIf);

  // Step 2: is it mandatory now, and still blank? (required=True always, or requiredIf in the form file)
  required = m.hasRule && applies ? mandatory(id) : false;
  problem = required && (m.kind == "check" ? val(id) != "true" : empty(val(id)));
  if (problem) missing.push(m.label);

  // Step 3: is the answer wrong? (its format, or one of the rules across answers above)
  whatsWrong = applies ? wrong(id) || X[id] || "" : "";
  if (whatsWrong) { bad.push(m.label + ": " + whatsWrong); problem = true; }

  // Step 4: which boxes on the page are this question's (tick-any: one per option; a date: its list or its box)
  names = [id];
  if (m.kind == "checks") { names = []; for (i = 0; i < m.options.length; i++) names.push(id + "__" + i); }
  if (m.kind == "date" && !shown(id) && d.getField(id + "__list")) names = [id + "__list"];
  if (problem && !first) first = names[0];

  // Step 5: colour each box. Doesn't apply: grey, locked, answer cleared. Problem: red outline, pink fill.
  //         Fine: black outline (or just its underline), white fill.
  sig = (required && problem ? "r" : "-") + (applies ? (problem ? "p" : "o") : "g");   // required flag, then the look
  for (i = 0; i < names.length; i++) {
    f = d.getField(names[i]); if (!f) continue;
    if (S.st[names[i]] === sig) continue;   // already looks like this: every write to Acrobat is slow
    S.st[names[i]] = sig;
    if (m.hasRule && m.kind != "checks") f.required = !!(required && problem); // only while blank or wrong: Acrobat outlines Required boxes in red even when filled
    if (m.activeIf) f.readonly = !applies;                                                   // locked until it applies
    if (!applies) { clear(f, m.kind, names[i]); f.lineWidth = 1; f.strokeColor = ["G", 0.6]; f.fillColor = ["G", 0.86]; continue; } // grey, cleared
    f.lineWidth = problem || !m.underlined ? 1 : 0;
    f.strokeColor = problem ? color.red : m.underlined ? color.transparent : color.black;    // red when blank or wrong
    f.fillColor = problem ? ["RGB", 1, 0.88, 0.88] : m.underlined ? color.transparent : color.white;
  }
}
// Amounts in words (a question with words: [amount id, currency id]), as the old bill of exchange wrote them.
for (id in M) if (M[id].words && (!only || only[id]) && (f = d.getField(id))) { i = lcWords(v(M[id].words[0]), v(M[id].words[1] || "")); if (f.value != i) { f.value = i; delete S.v[id]; } }
if (!cleared) break;
}
} catch (e) { console.println("lcRules: " + e); }
d.calculate = calc;
missing.bad = bad;
missing.first = first; // the field of the first problem, for "Check form" to go to
return missing;
}

// "1,250.50", "USD" -> "USD One Thousand Two Hundred Fifty and Fifty cents only" ("" while the amount is blank).
function lcWords(a, ccy) {
  var D = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"],
      T = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"], G = ["", " Thousand", " Million", " Billion", " Trillion"];
  var s = String(a).replace(/[, ]/g, ""), m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s), out = [], n, g, k;
  if (!m) return "";
  function three(x) { var h = Math.floor(x / 100), r = x % 100, w = [];
    if (h) w.push(D[h] + " Hundred"); if (r >= 20) w.push(T[Math.floor(r / 10)] + (r % 10 ? " " + D[r % 10] : "")); else if (r) w.push(D[r]); return w.join(" "); }
  function words(t) { t = t.replace(/^0+/, ""); if (!t) return "Zero"; var parts = []; for (g = 0; t.length; g++) { n = +t.slice(-3); t = t.slice(0, -3); if (n) parts.unshift(three(n) + G[g]); } return parts.join(" "); }
  k = words(m[1]);
  if (m[2] && +m[2]) k += " and " + words(m[2].length == 1 ? m[2] + "0" : m[2]) + " cents";
  return (ccy ? ccy + " " : "") + k + " only";
}
// Acrobat only: show each date's calendar box and hide its drop-down list.
function lcDates(d) {
  var D = ["bill_date","credit_dated"], i, t, p;
  for (i = 0; i < D.length; i++) { t = d.getField(D[i]); if (!t) continue; t.display = display.visible;
    p = d.getField(D[i] + "__list"); if (p) p.display = display.hidden; }
}
// When the warning before saving / printing was last closed. Some Acrobat versions (seen on Windows) fire the
// save / print events several times in a row; the warning then shows once, not once per event.
var lcWarnedAt = 0;
// On opening in Acrobat: show the calendars, and set every box's colour and lock.
if (typeof app != "undefined" && /^(Exchange|Reader)/.test(app.viewerType)) { lcDates(this); lcRules(this); }
// THE QR CODES' TEXT. lcPayload(doc) returns every answered question as JSON:
//   {"form": "LC-01", "version": "1.0", "saved": "...", "complete": true, "data": {field id: answer, ...}}
// Tick boxes become true; "tick any" questions become lists of the ticked options. One QR code holds 2,300 bytes of it
// (LC_QR_CAP); longer answers take as many codes as they need, at most 16 (LC_QR_MAX, the most that "structured append"
// allows; lcDrawQr splits the text). The text is padded with spaces to fill the codes it needs: 2,300, 4,600 ... 36,800
// bytes. Only beyond 16 codes are the long paragraphs shortened (and listed in "truncated"). , [],
// "BEEBLC-01" and "1.0" are filled in by document_script (step 2).
var LC_QR_CAP = 2300, LC_QR_MAX = 16;
// The text as UTF-8 bytes, one character per byte (what goes into the codes).
function lcBytes(s) { return unescape(encodeURIComponent(s)); }
// How many codes this text needs (0 for no text).
function lcCodes(s) { return s ? Math.ceil(lcBytes(s).length / LC_QR_CAP) : 0; }
function lcPayload(d) {
var G = {}, LONG = [], CAP = LC_QR_CAP, BUDGET = LC_QR_MAX * LC_QR_CAP;
var data = {}, i, n, f, k, v, g, m, out, cut = [], ok = true, t = new Date();
for (i = 0; i < d.numFields; i++) {
  n = d.getNthFieldName(i); if (/^__/.test(n) || /__list$/.test(n) || /__qrx_/.test(n)) continue;
  f = d.getField(n); if (!f || f.type == "button" || f.type == "signature") continue;
  g = /^(.+)__(\d+)$/.exec(n);
  if (g && G[g[1]]) { if (f.value != "Off") { if (!data[g[1]]) data[g[1]] = []; data[g[1]].push(G[g[1]][+g[2]]); } continue; }
  if (f.type == "checkbox") { if (f.value != "Off") data[n] = true; continue; }
  v = f.type == "radiobutton" ? (f.value == "Off" ? "" : String(f.value)) : String(f.valueAsString).replace(/^\s+|\s+$/g, "");
  if (v !== "") data[n] = v;
}
if (typeof lcRules == "function") { m = lcRules(d); ok = !m.length && !(m.bad || []).length; }
function pad(x) { return ("0" + x).slice(-2); }
out = {"form": "BEEBLC-01", "version": "1.0", "saved": t.getFullYear() + "-" + pad(t.getMonth() + 1) + "-" + pad(t.getDate()) + "T" + pad(t.getHours()) + ":" + pad(t.getMinutes()), "complete": ok, "data": data};
// 16 codes hold 36,800 bytes: only if the answers are longer still, shorten the long paragraphs (in order) and say so.
for (i = 0; i < LONG.length && lcBytes(JSON.stringify(out)).length > BUDGET; i++) {
  k = LONG[i]; if (!data[k]) continue;
  cut.push(k); out.truncated = cut;
  v = lcBytes(JSON.stringify(out)).length - BUDGET + 3;
  data[k] = v < data[k].length ? data[k].slice(0, data[k].length - v) + "..." : "...";
}
// Padded with spaces to fill the codes it needs (2,300 bytes each).
v = JSON.stringify(out); n = lcBytes(v).length; m = Math.max(1, Math.ceil(n / CAP)) * CAP - (n - v.length);
while (v.length < m) v += " ";
return v;
}
// THE QR CODE ENCODER AND DRAWING (standard QR code, no library needed).
// lcQrMatrix(bytes, part) returns the 177 x 177 grid of a version 40 QR code (true = dark square). bytes is the
// text as UTF-8 bytes (one character per byte). part is null for a single code, or [index, total, parity] for
// one of several codes ("structured append", part of the QR standard: each code says it is code k of n, n at
// most 16, so a scanner that supports it joins them; any other scanner reads each code's text, and the texts are
// joined in order). Version 40, error correction M, byte mode, mask 0; at most 2,329 bytes per code.
function lcQrMatrix(s, part) {
  var N = 177, i, j, x, y, m = [], f = [], bytes = [];
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
  // Data: (for one of several codes: mode 0011, its index, the total - 1, the parity of all the text), then mode
  // 0100, 16-bit length, the bytes, terminator, padding to 2,334 data codewords.
  var bits = [], cap = 2334 * 8;
  function put(v, n) { for (var k = n - 1; k >= 0; k--) bits.push((v >>> k) & 1); }
  if (part) { put(3, 4); put(part[0], 4); put(part[1] - 1, 4); put(part[2], 8); }
  put(4, 4); put(bytes.length, 16); for (i = 0; i < bytes.length; i++) put(bytes[i], 8);
  if (bits.length > cap) throw new Error("too much text for one QR code (" + bytes.length + " bytes)");
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
// THE PAGES THE CODES GO ON. Codes 1 and 2 sit on the form's QR code page (rows "__qr1_0" ... "__qr1_176", "__qr2_..."),
// each row a read-only text box holding the letter "n" in the ZapfDingbats font (which prints as a black square) for each
// dark square. Codes 3 to 16 go two to a page on extra pages, which exist only while needed: lcDrawQr copies the hidden page
// template "qrx" (rows "__qrx_1_0" ... "__qrx_2_176") after the last page with Template.spawn, and deletes the pages it no
// longer needs (when the viewer refuses to delete one, the page stays, empty and marked "not used", and is left out of
// printing: lcLastPage). A spawned page's fields are renamed by the viewer (bRename: true) but still end in the template's
// name, so lcExtra finds them by that ending. Don't write "getField(" for those fields: build_all.py rewrites it
// to add the form's code in the joined PDF; d["getField"](name) is left alone, and the names found are already complete.
// lcExtra(doc) returns the spawned pages' field-name prefixes, in page order: [{p: prefix, page: page number}].
function lcExtra(d) {
  var out = [], i, nm, m, f, q = d.getField("__qr"), first = q && typeof q.page == "number" ? q.page : -1;
  for (i = 0; i < d.numFields; i++) {
    nm = d.getNthFieldName(i); m = /^(.*)__qrx_1_0$/.exec(nm);
    if (!m || /^([A-Z]+\.)?$/.test(m[1])) continue;     // not a row, or the template's own row ("" or the form's code)
    f = d["getField"](nm);
    if (f && typeof f.page == "number" && f.page > first && f.page < d.numPages) out.push({p: m[1], page: f.page});
  }
  out.sort(function (a, b) { return a.page - b.page; });
  return out;
}
// Code j (0 = first) as a function: x -> the field "<row>" or "label" or "frame" of its slot.
function lcSlot(d, pg, j) {
  var t = j < 2 ? "__qr" + (j + 1) : "__qrx_" + ((j - 2) % 2 + 1), p = j < 2 ? null : pg[(j - 2) >> 1] && pg[(j - 2) >> 1].p;
  return function (x) { return p === null ? d.getField(t + "_" + x) : p === undefined ? null : d["getField"](p + t + "_" + x); };
}
// Extra pages that n codes need.
function lcPagesFor(n) { return n > 2 ? Math.ceil((n - 2) / 2) : 0; }
// The last page of the form as printed: the QR code page, plus the extra pages the codes of this text use.
function lcLastPage(d, text) { return d.getField("__qr").page + lcPagesFor(lcCodes(text)); }
// "" when the codes on the pages are exactly those of this text (every code in use has its first row drawn, every other
// slot is empty); otherwise what is wrong. Used before printing.
function lcQrCheck(d, text) {
  var n = lcCodes(text), pg = lcExtra(d), j, f;
  if (pg.length < lcPagesFor(n)) return "the extra QR code pages are missing";
  for (j = 0; j < 2 + 2 * pg.length || j < n; j++) {
    f = lcSlot(d, pg, j)("0");
    if (!f) return "QR code " + (j + 1) + " is missing";
    if ((f.value !== "") != (j < n)) return j < n ? "QR code " + (j + 1) + " is blank" : "QR code " + (j + 1) + " is left over";
  }
  return "";
}
// lcDrawQr(doc, text) draws text as one QR code, or as many as it needs (at most 16, one per 2,300 bytes), and returns how
// many (0 for ""; lcDrawQr(doc, "") clears everything and removes the extra pages). The text is cut into consecutive
// equal slices; each code carries the structured-append header (its index, the total, the parity of the whole text), so a
// scanner that supports it joins them, and any other scanner reads each slice and the slices are joined in order. The
// frames, and the labels "QR code 1 of 3 (scan all 3 codes)", show only for codes in use.
function lcDrawQr(d, text) {
  var s = lcBytes(text), n = lcCodes(text), size = n ? Math.ceil(s.length / n) : 0, codes = [], parity = 0, i, k, j, y, x, row, pg, f, g, put, calc = d.calculate, more;
  if (n > LC_QR_MAX) throw new Error("the answers are too long for " + LC_QR_MAX + " QR codes (" + s.length + " bytes, at most " + LC_QR_MAX * LC_QR_CAP + ")");
  for (i = 0; i < s.length; i++) parity ^= s.charCodeAt(i) & 255;
  for (k = 0; k < n; k++) codes.push(lcQrMatrix(s.slice(k * size, (k + 1) * size), n > 1 ? [k, n, parity] : null));   // all made before anything is touched
  d.calculate = false; // thousands of rows: don't re-run the checks after each one
  try {
    pg = lcExtra(d);
    for (more = lcPagesFor(n); pg.length < more; ) {                // add the pages that are needed
      d.getTemplate("qrx").spawn({nPage: d.numPages, bRename: true, bOverlay: false});
      g = lcExtra(d); if (g.length <= pg.length) throw new Error("the viewer did not add the page for QR code " + (2 * pg.length + 3));
      pg = g;
    }
    while (pg.length > more) {                                      // take away the pages that are not
      try { d.deletePages(pg[pg.length - 1].page); } catch (e) { break; }
      g = lcExtra(d); if (g.length >= pg.length) break;
      pg = g;
    }
    for (j = 0; j < 2 + 2 * pg.length; j++) {                       // every slot: its code, or empty
      put = lcSlot(d, pg, j);
      for (y = 0; y < 177; y++) { row = ""; if (codes[j]) for (x = 0; x < 177; x++) row += codes[j][y][x] ? "n" : " ";
        put(y).value = row; }
      if (f = put("label")) f.value = !codes[j] ? (j % 2 == 0 && j >= 2 + 2 * more ? "(this page is not used)" : "") : n < 2 ? "" : "QR code " + (j + 1) + " of " + n + (j == 0 ? (n == 2 ? " (scan both codes)" : " (scan all " + n + " codes)") : "");
      if (f = put("frame")) f.display = codes[j] ? display.visible : display.hidden;
    }
  } finally { d.calculate = calc; }
  return n;
}
return { lcRules: lcRules, lcPayload: lcPayload, lcDrawQr: lcDrawQr, lcDates: lcDates, lcQrMatrix: lcQrMatrix, lcWords: lcWords, lcLastPage: typeof lcLastPage == "function" ? lcLastPage : undefined, lcPagesFor: typeof lcPagesFor == "function" ? lcPagesFor : undefined, lcPipeText: typeof lcPipeText == "function" ? lcPipeText : undefined, lcQrCheck: typeof lcQrCheck == "function" ? lcQrCheck : undefined };
};
export const keys = {
"bill_no": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"exchange_amount": { K: function (event, app) {
if (!event.willCommit && /[^0-9.,]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d{1,3}(,?\d{3})*(\.\d{1,2})?$/.test(event.value)) { app.alert("Exchange (amount) is not an amount."); event.rc = false; }
} },
"tenor": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"sum_in_words": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"value_received_1": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"value_received_2": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"value_received_3": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"credit_no": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"drawee_1": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"drawee_2": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"drawee_3": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"drawee_4": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"drawer_1": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"drawer_2": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"signatory_name": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} }
};
export const ruleEvents = {"bill_no": "Bl", "bill_date__list": "U", "bill_date": "Bl", "currency": "Bl", "exchange_amount": "Bl", "tenor": "Bl", "sum_in_words": "Bl", "value_received_1": "Bl", "value_received_2": "Bl", "value_received_3": "Bl", "credit_no": "Bl", "credit_dated__list": "U", "credit_dated": "Bl", "drawee_1": "Bl", "drawee_2": "Bl", "drawee_3": "Bl", "drawee_4": "Bl", "drawer_1": "Bl", "drawer_2": "Bl", "signatory_name": "Bl"};
export const sectionButtons = {};

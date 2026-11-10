function lcRules(d) {
var M = __MODEL__;
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

// Checks across answers (the same as cross-checks in form/validate.ts). Skipped when a form doesn't have the fields.
function across() {
  var X = {}, A = day(v("application_date")), S = day(v("latest_shipment_date")), E = day(v("expiry_date")), a = v("amount"), pb = v("price_basis");
  if (S && E && E < S) X.expiry_date = "is before the latest shipment date";
  else if (A && E && E < A) X.expiry_date = "is before the application date";
  if (A && S && S < A) X.latest_shipment_date = "is before the application date";
  if (A && A.getTime() > new Date().getTime()) X.application_date = "is in the future";
  if (/^[\d,]+(\.\d+)?$/.test(a) && !(Number(a.replace(/,/g, "")) > 0)) X.amount = "must be more than zero";
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
  var D = __DATES__, i, t, p;
  for (i = 0; i < D.length; i++) { t = d.getField(D[i]); if (!t) continue; t.display = display.visible;
    p = d.getField(D[i] + "__list"); if (p) p.display = display.hidden; }
}
// On opening in Acrobat: show the calendars, and set every box's colour and lock.
if (typeof app != "undefined" && /^(Exchange|Reader)/.test(app.viewerType)) { lcDates(this); lcRules(this); }
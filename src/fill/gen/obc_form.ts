// @ts-nocheck: lc-form's Acrobat JavaScript, copied word for word by scripts/fill-engine.py (do not edit; rerun it)
export const document = function (app, color, display, console) {
// THE RULES ENGINE (runs inside Acrobat). Built into the PDF as the document script "lcRules".
// lcRules(doc) checks every question and colours its box:
//   blank or wrong mandatory answer -> red outline, pink fill, marked Required
//   answered and right              -> black outline, white fill
//   doesn't apply yet               -> greyed out, locked, and its answer cleared
// It returns the list of missing questions, plus .bad (wrong answers) and .first (where to put the cursor).
// lcDates(doc) shows each date's calendar box and hides its drop-down list (Acrobat only).
// {"application_date":{"kind":"date","label":"Date","hasRule":1,"always":1,"check":1},"drawer_name":{"kind":"text","label":"Drawer / seller name","hasRule":1,"always":1,"check":1},"drawer_address_1":{"kind":"text","label":"Drawer / seller address","hasRule":1,"always":1,"check":1},"drawer_address_2":{"kind":"text","label":"Drawer / seller address (line 2)","check":1},"drawer_address_3":{"kind":"text","label":"Drawer / seller address (line 3)","check":1},"contact_name":{"kind":"text","label":"Contact person","hasRule":1,"always":1,"check":1},"contact_tel":{"kind":"text","label":"Tel","hasRule":1,"always":1,"check":["^\\+?[\\d ()-]*\\d[\\d ()-]*$","is not a phone number (digits, spaces, + - ( ) only)"]},"currency":{"kind":"select","label":"Currency","hasRule":1,"always":1},"amount":{"kind":"text","label":"Amount","hasRule":1,"always":1,"check":["^\\d{1,3}(,?\\d{3})*(\\.\\d{1,2})?$","is not an amount"]},"drawee_bank_name":{"kind":"text","label":"Name","hasRule":1,"always":1,"check":1},"drawee_bank_address_1":{"kind":"text","label":"Address","hasRule":1,"always":1,"check":1},"drawee_bank_address_2":{"kind":"text","label":"Address (line 2)","check":1},"drawee_bank_address_3":{"kind":"text","label":"Address (line 3)","check":1},"drawee":{"kind":"text","label":"Drawee / buyer","hasRule":1,"always":1,"check":1},"invoice_no":{"kind":"text","label":"Invoice / reference no.","hasRule":1,"always":1,"check":1},"tenor":{"kind":"radio","label":"Tenor","hasRule":1,"always":1},"term_days":{"kind":"text","label":"Term: days","hasRule":1,"requiredIf":[["tenor",["Term"],0]],"activeIf":[["tenor",["Term"],0]],"check":["^\\d+$","should be a whole number"]},"term_days_after":{"kind":"text","label":"Days after","hasRule":1,"requiredIf":[["tenor",["Term"],0]],"activeIf":[["tenor",["Term"],0]],"check":1},"vessel_flight_no":{"kind":"text","label":"Vessel / flight no.","check":1},"transport_document_no":{"kind":"text","label":"Transport document number","check":1},"goods_description":{"kind":"text","label":"Brief description of goods","check":1},"departure_date":{"kind":"date","label":"Departure date","hasRule":1,"always":1,"check":1},"port_of_loading":{"kind":"text","label":"Port of loading / airport of departure","check":1},"port_of_discharge":{"kind":"text","label":"Port of discharge / airport of destination","check":1},"drafts_originals":{"kind":"text","label":"Drafts (not applicable for sight bills): no. of original(s)","check":["^\\d+$","should be a whole number"]},"drafts_copies":{"kind":"text","label":"Drafts (not applicable for sight bills): no. of copy(ies)","check":["^\\d+$","should be a whole number"]},"invoice_originals":{"kind":"text","label":"Invoice: no. of original(s)","check":["^\\d+$","should be a whole number"]},"invoice_copies":{"kind":"text","label":"Invoice: no. of copy(ies)","check":["^\\d+$","should be a whole number"]},"packing_list_originals":{"kind":"text","label":"Packing list: no. of original(s)","check":["^\\d+$","should be a whole number"]},"packing_list_copies":{"kind":"text","label":"Packing list: no. of copy(ies)","check":["^\\d+$","should be a whole number"]},"cert_of_origin_originals":{"kind":"text","label":"Certificate of origin: no. of original(s)","check":["^\\d+$","should be a whole number"]},"cert_of_origin_copies":{"kind":"text","label":"Certificate of origin: no. of copy(ies)","check":["^\\d+$","should be a whole number"]},"insurance_policy_originals":{"kind":"text","label":"Insurance policy: no. of original(s)","check":["^\\d+$","should be a whole number"]},"insurance_policy_copies":{"kind":"text","label":"Insurance policy: no. of copy(ies)","check":["^\\d+$","should be a whole number"]},"bl_originals_originals":{"kind":"text","label":"B/L (originals): no. of original(s)","check":["^\\d+$","should be a whole number"]},"bl_originals_copies":{"kind":"text","label":"B/L (originals): no. of copy(ies)","check":["^\\d+$","should be a whole number"]},"bl_non_negotiable_originals":{"kind":"text","label":"B/L (non-negotiable): no. of original(s)","check":["^\\d+$","should be a whole number"]},"bl_non_negotiable_copies":{"kind":"text","label":"B/L (non-negotiable): no. of copy(ies)","check":["^\\d+$","should be a whole number"]},"weight_note_originals":{"kind":"text","label":"Weight note: no. of original(s)","check":["^\\d+$","should be a whole number"]},"weight_note_copies":{"kind":"text","label":"Weight note: no. of copy(ies)","check":["^\\d+$","should be a whole number"]},"airway_bill_originals":{"kind":"text","label":"Airway bill: no. of original(s)","check":["^\\d+$","should be a whole number"]},"airway_bill_copies":{"kind":"text","label":"Airway bill: no. of copy(ies)","check":["^\\d+$","should be a whole number"]},"beneficiary_certificate_originals":{"kind":"text","label":"Beneficiary's certificate: no. of original(s)","check":["^\\d+$","should be a whole number"]},"beneficiary_certificate_copies":{"kind":"text","label":"Beneficiary's certificate: no. of copy(ies)","check":["^\\d+$","should be a whole number"]},"other_document_1":{"kind":"text","label":"Other document 1","check":1},"other_document_1_originals":{"kind":"text","label":"Originals","check":["^\\d+$","should be a whole number"]},"other_document_1_copies":{"kind":"text","label":"Copies","check":["^\\d+$","should be a whole number"]},"other_document_2":{"kind":"text","label":"Other document 2","check":1},"other_document_2_originals":{"kind":"text","label":"Originals","check":["^\\d+$","should be a whole number"]},"other_document_2_copies":{"kind":"text","label":"Copies","check":["^\\d+$","should be a whole number"]},"other_document_3":{"kind":"text","label":"Other document 3","check":1},"other_document_3_originals":{"kind":"text","label":"Originals","check":["^\\d+$","should be a whole number"]},"other_document_3_copies":{"kind":"text","label":"Copies","check":["^\\d+$","should be a whole number"]},"other_document_4":{"kind":"text","label":"Other document 4","check":1},"other_document_4_originals":{"kind":"text","label":"Originals","check":["^\\d+$","should be a whole number"]},"other_document_4_copies":{"kind":"text","label":"Copies","check":["^\\d+$","should be a whole number"]},"collect_interest":{"kind":"check","label":"Collect interest from drawee"},"interest_rate":{"kind":"text","label":"Interest (% p.a.)","hasRule":1,"requiredIf":[["collect_interest",["true"],0]],"activeIf":[["collect_interest",["true"],0]],"check":["^\\d+$","should be a whole number"]},"interest_from":{"kind":"text","label":"From (interest start date)","hasRule":1,"requiredIf":[["collect_interest",["true"],0]],"activeIf":[["collect_interest",["true"],0]],"check":1},"interest_to":{"kind":"text","label":"To (if blank, up to payment by drawee)","activeIf":[["collect_interest",["true"],0]],"check":1},"finance":{"kind":"check","label":"Please finance us for"},"finance_percent":{"kind":"text","label":"% of the collection amount","hasRule":1,"requiredIf":[["finance",["true"],0]],"activeIf":[["finance",["true"],0]],"check":["^\\d+$","should be a whole number"]},"credit_proceeds":{"kind":"check","label":"Please credit financing / payment proceeds to our account with you"},"credit_account_no":{"kind":"text","label":"Account no.","hasRule":1,"requiredIf":[["credit_proceeds",["true"],0]],"activeIf":[["credit_proceeds",["true"],0]],"check":["^\\d[\\d-]*\\d$|^\\d$","is not an account number (digits and - only)"]},"use_fx_contract":{"kind":"check","label":"Please use FX contract ref."},"fx_contract_ref":{"kind":"text","label":"FX contract ref.","hasRule":1,"requiredIf":[["use_fx_contract",["true"],0]],"activeIf":[["use_fx_contract",["true"],0]],"check":1},"other_instructions":{"kind":"check","label":"Other special instructions"},"other_instructions_text":{"kind":"long","label":"Other special instructions","hasRule":1,"requiredIf":[["other_instructions",["true"],0]],"activeIf":[["other_instructions",["true"],0]],"check":1},"signatory_name":{"kind":"text","label":"Name of authorised signatory","check":1}} is filled in by document_script (step 2) with the rules table built from the form; ["application_date","departure_date"] with the date
// question ids. Acrobat's JavaScript is old-style: var, no arrow functions.
// The rules table, the index "box -> the questions to re-check when it changes" (null = always check everything), and what
// the last run saw: v = each box's last-seen value, st = each box's last-written look (so unchanged boxes are not written again).
var lcModel = {"application_date":{"kind":"date","label":"Date","hasRule":1,"always":1,"check":1},"drawer_name":{"kind":"text","label":"Drawer / seller name","hasRule":1,"always":1,"check":1},"drawer_address_1":{"kind":"text","label":"Drawer / seller address","hasRule":1,"always":1,"check":1},"drawer_address_2":{"kind":"text","label":"Drawer / seller address (line 2)","check":1},"drawer_address_3":{"kind":"text","label":"Drawer / seller address (line 3)","check":1},"contact_name":{"kind":"text","label":"Contact person","hasRule":1,"always":1,"check":1},"contact_tel":{"kind":"text","label":"Tel","hasRule":1,"always":1,"check":["^\\+?[\\d ()-]*\\d[\\d ()-]*$","is not a phone number (digits, spaces, + - ( ) only)"]},"currency":{"kind":"select","label":"Currency","hasRule":1,"always":1},"amount":{"kind":"text","label":"Amount","hasRule":1,"always":1,"check":["^\\d{1,3}(,?\\d{3})*(\\.\\d{1,2})?$","is not an amount"]},"drawee_bank_name":{"kind":"text","label":"Name","hasRule":1,"always":1,"check":1},"drawee_bank_address_1":{"kind":"text","label":"Address","hasRule":1,"always":1,"check":1},"drawee_bank_address_2":{"kind":"text","label":"Address (line 2)","check":1},"drawee_bank_address_3":{"kind":"text","label":"Address (line 3)","check":1},"drawee":{"kind":"text","label":"Drawee / buyer","hasRule":1,"always":1,"check":1},"invoice_no":{"kind":"text","label":"Invoice / reference no.","hasRule":1,"always":1,"check":1},"tenor":{"kind":"radio","label":"Tenor","hasRule":1,"always":1},"term_days":{"kind":"text","label":"Term: days","hasRule":1,"requiredIf":[["tenor",["Term"],0]],"activeIf":[["tenor",["Term"],0]],"check":["^\\d+$","should be a whole number"]},"term_days_after":{"kind":"text","label":"Days after","hasRule":1,"requiredIf":[["tenor",["Term"],0]],"activeIf":[["tenor",["Term"],0]],"check":1},"vessel_flight_no":{"kind":"text","label":"Vessel / flight no.","check":1},"transport_document_no":{"kind":"text","label":"Transport document number","check":1},"goods_description":{"kind":"text","label":"Brief description of goods","check":1},"departure_date":{"kind":"date","label":"Departure date","hasRule":1,"always":1,"check":1},"port_of_loading":{"kind":"text","label":"Port of loading / airport of departure","check":1},"port_of_discharge":{"kind":"text","label":"Port of discharge / airport of destination","check":1},"drafts_originals":{"kind":"text","label":"Drafts (not applicable for sight bills): no. of original(s)","check":["^\\d+$","should be a whole number"]},"drafts_copies":{"kind":"text","label":"Drafts (not applicable for sight bills): no. of copy(ies)","check":["^\\d+$","should be a whole number"]},"invoice_originals":{"kind":"text","label":"Invoice: no. of original(s)","check":["^\\d+$","should be a whole number"]},"invoice_copies":{"kind":"text","label":"Invoice: no. of copy(ies)","check":["^\\d+$","should be a whole number"]},"packing_list_originals":{"kind":"text","label":"Packing list: no. of original(s)","check":["^\\d+$","should be a whole number"]},"packing_list_copies":{"kind":"text","label":"Packing list: no. of copy(ies)","check":["^\\d+$","should be a whole number"]},"cert_of_origin_originals":{"kind":"text","label":"Certificate of origin: no. of original(s)","check":["^\\d+$","should be a whole number"]},"cert_of_origin_copies":{"kind":"text","label":"Certificate of origin: no. of copy(ies)","check":["^\\d+$","should be a whole number"]},"insurance_policy_originals":{"kind":"text","label":"Insurance policy: no. of original(s)","check":["^\\d+$","should be a whole number"]},"insurance_policy_copies":{"kind":"text","label":"Insurance policy: no. of copy(ies)","check":["^\\d+$","should be a whole number"]},"bl_originals_originals":{"kind":"text","label":"B/L (originals): no. of original(s)","check":["^\\d+$","should be a whole number"]},"bl_originals_copies":{"kind":"text","label":"B/L (originals): no. of copy(ies)","check":["^\\d+$","should be a whole number"]},"bl_non_negotiable_originals":{"kind":"text","label":"B/L (non-negotiable): no. of original(s)","check":["^\\d+$","should be a whole number"]},"bl_non_negotiable_copies":{"kind":"text","label":"B/L (non-negotiable): no. of copy(ies)","check":["^\\d+$","should be a whole number"]},"weight_note_originals":{"kind":"text","label":"Weight note: no. of original(s)","check":["^\\d+$","should be a whole number"]},"weight_note_copies":{"kind":"text","label":"Weight note: no. of copy(ies)","check":["^\\d+$","should be a whole number"]},"airway_bill_originals":{"kind":"text","label":"Airway bill: no. of original(s)","check":["^\\d+$","should be a whole number"]},"airway_bill_copies":{"kind":"text","label":"Airway bill: no. of copy(ies)","check":["^\\d+$","should be a whole number"]},"beneficiary_certificate_originals":{"kind":"text","label":"Beneficiary's certificate: no. of original(s)","check":["^\\d+$","should be a whole number"]},"beneficiary_certificate_copies":{"kind":"text","label":"Beneficiary's certificate: no. of copy(ies)","check":["^\\d+$","should be a whole number"]},"other_document_1":{"kind":"text","label":"Other document 1","check":1},"other_document_1_originals":{"kind":"text","label":"Originals","check":["^\\d+$","should be a whole number"]},"other_document_1_copies":{"kind":"text","label":"Copies","check":["^\\d+$","should be a whole number"]},"other_document_2":{"kind":"text","label":"Other document 2","check":1},"other_document_2_originals":{"kind":"text","label":"Originals","check":["^\\d+$","should be a whole number"]},"other_document_2_copies":{"kind":"text","label":"Copies","check":["^\\d+$","should be a whole number"]},"other_document_3":{"kind":"text","label":"Other document 3","check":1},"other_document_3_originals":{"kind":"text","label":"Originals","check":["^\\d+$","should be a whole number"]},"other_document_3_copies":{"kind":"text","label":"Copies","check":["^\\d+$","should be a whole number"]},"other_document_4":{"kind":"text","label":"Other document 4","check":1},"other_document_4_originals":{"kind":"text","label":"Originals","check":["^\\d+$","should be a whole number"]},"other_document_4_copies":{"kind":"text","label":"Copies","check":["^\\d+$","should be a whole number"]},"collect_interest":{"kind":"check","label":"Collect interest from drawee"},"interest_rate":{"kind":"text","label":"Interest (% p.a.)","hasRule":1,"requiredIf":[["collect_interest",["true"],0]],"activeIf":[["collect_interest",["true"],0]],"check":["^\\d+$","should be a whole number"]},"interest_from":{"kind":"text","label":"From (interest start date)","hasRule":1,"requiredIf":[["collect_interest",["true"],0]],"activeIf":[["collect_interest",["true"],0]],"check":1},"interest_to":{"kind":"text","label":"To (if blank, up to payment by drawee)","activeIf":[["collect_interest",["true"],0]],"check":1},"finance":{"kind":"check","label":"Please finance us for"},"finance_percent":{"kind":"text","label":"% of the collection amount","hasRule":1,"requiredIf":[["finance",["true"],0]],"activeIf":[["finance",["true"],0]],"check":["^\\d+$","should be a whole number"]},"credit_proceeds":{"kind":"check","label":"Please credit financing / payment proceeds to our account with you"},"credit_account_no":{"kind":"text","label":"Account no.","hasRule":1,"requiredIf":[["credit_proceeds",["true"],0]],"activeIf":[["credit_proceeds",["true"],0]],"check":["^\\d[\\d-]*\\d$|^\\d$","is not an account number (digits and - only)"]},"use_fx_contract":{"kind":"check","label":"Please use FX contract ref."},"fx_contract_ref":{"kind":"text","label":"FX contract ref.","hasRule":1,"requiredIf":[["use_fx_contract",["true"],0]],"activeIf":[["use_fx_contract",["true"],0]],"check":1},"other_instructions":{"kind":"check","label":"Other special instructions"},"other_instructions_text":{"kind":"long","label":"Other special instructions","hasRule":1,"requiredIf":[["other_instructions",["true"],0]],"activeIf":[["other_instructions",["true"],0]],"check":1},"signatory_name":{"kind":"text","label":"Name of authorised signatory","check":1}};
var lcDeps = {"application_date":["application_date"],"drawer_name":["drawer_name"],"drawer_address_1":["drawer_address_1"],"drawer_address_2":["drawer_address_2"],"drawer_address_3":["drawer_address_3"],"contact_name":["contact_name"],"contact_tel":["contact_tel"],"currency":["currency"],"amount":["amount"],"drawee_bank_name":["drawee_bank_name"],"drawee_bank_address_1":["drawee_bank_address_1"],"drawee_bank_address_2":["drawee_bank_address_2"],"drawee_bank_address_3":["drawee_bank_address_3"],"drawee":["drawee"],"invoice_no":["invoice_no"],"tenor":["tenor","term_days","term_days_after"],"term_days":["term_days"],"term_days_after":["term_days_after"],"vessel_flight_no":["vessel_flight_no"],"transport_document_no":["transport_document_no"],"goods_description":["goods_description"],"departure_date":["departure_date"],"port_of_loading":["port_of_loading"],"port_of_discharge":["port_of_discharge"],"drafts_originals":["drafts_originals"],"drafts_copies":["drafts_copies"],"invoice_originals":["invoice_originals"],"invoice_copies":["invoice_copies"],"packing_list_originals":["packing_list_originals"],"packing_list_copies":["packing_list_copies"],"cert_of_origin_originals":["cert_of_origin_originals"],"cert_of_origin_copies":["cert_of_origin_copies"],"insurance_policy_originals":["insurance_policy_originals"],"insurance_policy_copies":["insurance_policy_copies"],"bl_originals_originals":["bl_originals_originals"],"bl_originals_copies":["bl_originals_copies"],"bl_non_negotiable_originals":["bl_non_negotiable_originals"],"bl_non_negotiable_copies":["bl_non_negotiable_copies"],"weight_note_originals":["weight_note_originals"],"weight_note_copies":["weight_note_copies"],"airway_bill_originals":["airway_bill_originals"],"airway_bill_copies":["airway_bill_copies"],"beneficiary_certificate_originals":["beneficiary_certificate_originals"],"beneficiary_certificate_copies":["beneficiary_certificate_copies"],"other_document_1":["other_document_1"],"other_document_1_originals":["other_document_1_originals"],"other_document_1_copies":["other_document_1_copies"],"other_document_2":["other_document_2"],"other_document_2_originals":["other_document_2_originals"],"other_document_2_copies":["other_document_2_copies"],"other_document_3":["other_document_3"],"other_document_3_originals":["other_document_3_originals"],"other_document_3_copies":["other_document_3_copies"],"other_document_4":["other_document_4"],"other_document_4_originals":["other_document_4_originals"],"other_document_4_copies":["other_document_4_copies"],"collect_interest":["collect_interest","interest_rate","interest_from","interest_to"],"interest_rate":["interest_rate"],"interest_from":["interest_from"],"interest_to":["interest_to"],"finance":["finance","finance_percent"],"finance_percent":["finance_percent"],"credit_proceeds":["credit_proceeds","credit_account_no"],"credit_account_no":["credit_account_no"],"use_fx_contract":["use_fx_contract","fx_contract_ref"],"fx_contract_ref":["fx_contract_ref"],"other_instructions":["other_instructions","other_instructions_text"],"other_instructions_text":["other_instructions_text"],"signatory_name":["signatory_name"]};
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
  var C = [{"t":"range","a":"finance_percent","lo":1,"hi":100,"m":"Please provide a valid number between 1 and 100."}], c, first, second, digits, allowed;
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
  var D = ["application_date","departure_date"], i, t, p;
  for (i = 0; i < D.length; i++) { t = d.getField(D[i]); if (!t) continue; t.display = display.visible;
    p = d.getField(D[i] + "__list"); if (p) p.display = display.hidden; }
}
// When the warning before saving / printing was last closed. Some Acrobat versions (seen on Windows) fire the
// save / print events several times in a row; the warning then shows once, not once per event.
var lcWarnedAt = 0;
// On opening in Acrobat: show the calendars, and set every box's colour and lock.
if (typeof app != "undefined" && /^(Exchange|Reader)/.test(app.viewerType)) { lcDates(this); lcRules(this); }
// THE QR CODE'S TEXT. lcPayload(doc) returns every answered question as JSON:
//   {"form": "LC-01", "version": "1.0", "saved": "...", "complete": true, "data": {field id: answer, ...}}
// Tick boxes become true; "tick any" questions become lists of the ticked options. One QR code holds 2,300
// characters of it; longer answers take two codes (lcDrawQr splits the text). The text is padded with spaces to
// 2,300 (or 4,600 for two codes). , ["other_instructions_text"], "OBC-01" and "1.0" are filled in by document_script
// (step 2).
function lcPayload(d) {
var G = {}, LONG = ["other_instructions_text"], CAP = 2300;
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
out = {"form": "OBC-01", "version": "1.0", "saved": t.getFullYear() + "-" + pad(t.getMonth() + 1) + "-" + pad(t.getDate()) + "T" + pad(t.getHours()) + ":" + pad(t.getMinutes()), "complete": ok, "data": data};
// Two QR codes hold 4,600 characters: if the answers are longer still, shorten the two long paragraphs and say so.
for (i = 0; i < LONG.length && JSON.stringify(out).length > 2 * CAP; i++) {
  k = LONG[i]; if (!data[k]) continue;
  cut.push(k); out.truncated = cut;
  v = JSON.stringify(out).length - 2 * CAP + 3;
  data[k] = v < data[k].length ? data[k].slice(0, data[k].length - v) + "..." : "...";
}
// Padded with spaces to fill one code (2,300) or, when it doesn't fit in one, two codes (4,600).
v = JSON.stringify(out); n = v.length > CAP ? 2 * CAP : CAP; while (v.length < n) v += " ";
return v;
}
// THE QR CODE ENCODER AND DRAWING (standard QR code, no library needed).
// lcQrMatrix(bytes, part) returns the 177 x 177 grid of a version 40 QR code (true = dark square). bytes is the
// text as UTF-8 bytes (one character per byte). part is null for a single code, or [index, total, parity] for
// one of several codes ("structured append", part of the QR standard: each code says it is code 1 or 2 of 2,
// so a scanner that supports it joins them; any other scanner reads each code's text, and the two texts are
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
// lcDrawQr(doc, text) draws text as one QR code, or as two when it is too long for one, and returns how many.
// Each code's rows go into the read-only text boxes "__qr1_0" ... "__qr1_176" (and "__qr2_..."), as the letter
// "n" in the ZapfDingbats font (which prints as a black square) for each dark square. The second code's frame
// and the "QR code 1 of 2" labels appear only when there are two. lcDrawQr(doc, "") clears both.
function lcDrawQr(d, text) {
  var ONE = 2329, s = unescape(encodeURIComponent(text)), parts = [], codes = [], parity = 0, i, k, y, x, row, calc = d.calculate;
  if (s.length > 2 * ONE) throw new Error("the answers are too long for two QR codes (" + s.length + " characters, at most " + 2 * ONE + ")");
  for (i = 0; i < s.length; i++) parity ^= s.charCodeAt(i) & 255;
  if (s.length > ONE) parts = [s.slice(0, Math.ceil(s.length / 2)), s.slice(Math.ceil(s.length / 2))];
  else if (s.length) parts = [s];
  for (k = 0; k < parts.length; k++) codes.push(lcQrMatrix(parts[k], parts.length > 1 ? [k, parts.length, parity] : null));
  d.calculate = false; // 354 rows: don't re-run the checks after each one
  try {
    for (k = 1; k <= 2; k++) {
      for (y = 0; y < 177; y++) { row = ""; if (codes[k - 1]) for (x = 0; x < 177; x++) row += codes[k - 1][y][x] ? "n" : " ";
        d.getField("__qr" + k + "_" + y).value = row; }
      d.getField("__qr" + k + "_label").value = codes.length > 1 ? "QR code " + k + " of 2" + (k == 1 ? " (scan both codes)" : "") : "";
    }
    d.getField("__qr2_frame").display = codes.length > 1 ? display.visible : display.hidden;
  } finally { d.calculate = calc; }
  return codes.length;
}
return { lcRules: lcRules, lcPayload: lcPayload, lcDrawQr: lcDrawQr, lcDates: lcDates, lcQrMatrix: lcQrMatrix, lcWords: lcWords };
};
export const keys = {
"drawer_name": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"drawer_address_1": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"drawer_address_2": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"drawer_address_3": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"contact_name": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"contact_tel": { K: function (event, app) {
if (!event.willCommit && /[^0-9+() -]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\+?[\d ()-]*\d[\d ()-]*$/.test(event.value)) { app.alert("Tel is not a phone number (digits, spaces, + - ( ) only)."); event.rc = false; }
} },
"amount": { K: function (event, app) {
if (!event.willCommit && /[^0-9.,]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d{1,3}(,?\d{3})*(\.\d{1,2})?$/.test(event.value)) { app.alert("Amount is not an amount."); event.rc = false; }
} },
"drawee_bank_name": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"drawee_bank_address_1": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"drawee_bank_address_2": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"drawee_bank_address_3": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"drawee": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"invoice_no": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"term_days": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Term: days should be a whole number."); event.rc = false; }
} },
"term_days_after": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"vessel_flight_no": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"transport_document_no": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"goods_description": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"port_of_loading": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"port_of_discharge": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"drafts_originals": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Drafts (not applicable for sight bills): no. of original(s) should be a whole number."); event.rc = false; }
} },
"drafts_copies": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Drafts (not applicable for sight bills): no. of copy(ies) should be a whole number."); event.rc = false; }
} },
"invoice_originals": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Invoice: no. of original(s) should be a whole number."); event.rc = false; }
} },
"invoice_copies": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Invoice: no. of copy(ies) should be a whole number."); event.rc = false; }
} },
"packing_list_originals": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Packing list: no. of original(s) should be a whole number."); event.rc = false; }
} },
"packing_list_copies": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Packing list: no. of copy(ies) should be a whole number."); event.rc = false; }
} },
"cert_of_origin_originals": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Certificate of origin: no. of original(s) should be a whole number."); event.rc = false; }
} },
"cert_of_origin_copies": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Certificate of origin: no. of copy(ies) should be a whole number."); event.rc = false; }
} },
"insurance_policy_originals": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Insurance policy: no. of original(s) should be a whole number."); event.rc = false; }
} },
"insurance_policy_copies": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Insurance policy: no. of copy(ies) should be a whole number."); event.rc = false; }
} },
"bl_originals_originals": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("B/L (originals): no. of original(s) should be a whole number."); event.rc = false; }
} },
"bl_originals_copies": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("B/L (originals): no. of copy(ies) should be a whole number."); event.rc = false; }
} },
"bl_non_negotiable_originals": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("B/L (non-negotiable): no. of original(s) should be a whole number."); event.rc = false; }
} },
"bl_non_negotiable_copies": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("B/L (non-negotiable): no. of copy(ies) should be a whole number."); event.rc = false; }
} },
"weight_note_originals": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Weight note: no. of original(s) should be a whole number."); event.rc = false; }
} },
"weight_note_copies": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Weight note: no. of copy(ies) should be a whole number."); event.rc = false; }
} },
"airway_bill_originals": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Airway bill: no. of original(s) should be a whole number."); event.rc = false; }
} },
"airway_bill_copies": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Airway bill: no. of copy(ies) should be a whole number."); event.rc = false; }
} },
"beneficiary_certificate_originals": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Beneficiary's certificate: no. of original(s) should be a whole number."); event.rc = false; }
} },
"beneficiary_certificate_copies": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Beneficiary's certificate: no. of copy(ies) should be a whole number."); event.rc = false; }
} },
"other_document_1": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"other_document_1_originals": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Originals should be a whole number."); event.rc = false; }
} },
"other_document_1_copies": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Copies should be a whole number."); event.rc = false; }
} },
"other_document_2": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"other_document_2_originals": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Originals should be a whole number."); event.rc = false; }
} },
"other_document_2_copies": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Copies should be a whole number."); event.rc = false; }
} },
"other_document_3": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"other_document_3_originals": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Originals should be a whole number."); event.rc = false; }
} },
"other_document_3_copies": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Copies should be a whole number."); event.rc = false; }
} },
"other_document_4": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"other_document_4_originals": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Originals should be a whole number."); event.rc = false; }
} },
"other_document_4_copies": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Copies should be a whole number."); event.rc = false; }
} },
"interest_rate": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Interest (% p.a.) should be a whole number."); event.rc = false; }
} },
"interest_from": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"interest_to": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"finance_percent": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("% of the collection amount should be a whole number."); event.rc = false; }
} },
"credit_account_no": { K: function (event, app) {
if (!event.willCommit && /[^0-9-]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d[\d-]*\d$|^\d$/.test(event.value)) { app.alert("Account no. is not an account number (digits and - only)."); event.rc = false; }
} },
"fx_contract_ref": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"other_instructions_text": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"signatory_name": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} }
};
export const ruleEvents = {"application_date__list": "U", "application_date": "Bl", "drawer_name": "Bl", "drawer_address_1": "Bl", "drawer_address_2": "Bl", "drawer_address_3": "Bl", "contact_name": "Bl", "contact_tel": "Bl", "currency": "Bl", "amount": "Bl", "drawee_bank_name": "Bl", "drawee_bank_address_1": "Bl", "drawee_bank_address_2": "Bl", "drawee_bank_address_3": "Bl", "drawee": "Bl", "invoice_no": "Bl", "tenor": "U", "term_days": "Bl", "term_days_after": "Bl", "vessel_flight_no": "Bl", "transport_document_no": "Bl", "goods_description": "Bl", "departure_date__list": "U", "departure_date": "Bl", "port_of_loading": "Bl", "port_of_discharge": "Bl", "drafts_originals": "Bl", "drafts_copies": "Bl", "invoice_originals": "Bl", "invoice_copies": "Bl", "packing_list_originals": "Bl", "packing_list_copies": "Bl", "cert_of_origin_originals": "Bl", "cert_of_origin_copies": "Bl", "insurance_policy_originals": "Bl", "insurance_policy_copies": "Bl", "bl_originals_originals": "Bl", "bl_originals_copies": "Bl", "bl_non_negotiable_originals": "Bl", "bl_non_negotiable_copies": "Bl", "weight_note_originals": "Bl", "weight_note_copies": "Bl", "airway_bill_originals": "Bl", "airway_bill_copies": "Bl", "beneficiary_certificate_originals": "Bl", "beneficiary_certificate_copies": "Bl", "other_document_1": "Bl", "other_document_1_originals": "Bl", "other_document_1_copies": "Bl", "other_document_2": "Bl", "other_document_2_originals": "Bl", "other_document_2_copies": "Bl", "other_document_3": "Bl", "other_document_3_originals": "Bl", "other_document_3_copies": "Bl", "other_document_4": "Bl", "other_document_4_originals": "Bl", "other_document_4_copies": "Bl", "collect_interest": "U", "interest_rate": "Bl", "interest_from": "Bl", "interest_to": "Bl", "finance": "U", "finance_percent": "Bl", "credit_proceeds": "U", "credit_account_no": "Bl", "use_fx_contract": "U", "fx_contract_ref": "Bl", "other_instructions": "U", "other_instructions_text": "Bl", "signatory_name": "Bl"};
export const sectionButtons = {};

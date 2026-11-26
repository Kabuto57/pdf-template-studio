// @ts-nocheck: lc-form's Acrobat JavaScript, copied word for word by scripts/fill-engine.py (do not edit; rerun it)
let lcWarnedAt = 0;
export const libNames = ["lcRules", "lcPayload", "lcDrawQr", "lcDates", "lcLastPage", "lcPagesFor", "lcPipeText", "lcQrCheck"];
export const buttons = {
"check-form": function (app, event, lcRules, lcPayload, lcDrawQr, lcDates, lcLastPage, lcPagesFor, lcPipeText, lcQrCheck) {
// "CHECK FORM" BUTTON: lists what is missing or wrong (at most 15 of each) and puts the cursor on the first
// problem; otherwise says the form is ready.
if (typeof lcRules != "function") app.alert("The form's checks did not start, so nothing has been checked yet. Open the form in Adobe Acrobat or Acrobat Reader and allow JavaScript (the yellow bar's Options, or Preferences > JavaScript > Enable Acrobat JavaScript), then close and reopen the form. If it still happens, the form was built from damaged files: build it again.", 1);
else {
var m = lcRules(this), b = m.bad || [], t = [];
var list = function (a) { return "- " + a.slice(0, 15).join("\n- ") + (a.length > 15 ? "\n- ... and " + (a.length - 15) + " more" : ""); }
if (m.length) t.push(m.length + " mandatory question" + (m.length > 1 ? "s are" : " is") + " still blank:\n" + list(m));
if (b.length) t.push(b.length + " answer" + (b.length > 1 ? "s need" : " needs") + " correcting:\n" + list(b));
if (t.length) { app.alert("This form is not ready to send. The boxes concerned are outlined in red.\n\n" + t.join("\n\n") + "\n\nPlease correct them before you send the form.", 1);
  var g = m.first && this.getField(m.first); if (g) g.setFocus(); }
else app.alert("All mandatory questions are answered and every answer is in the right format. You can save the form and send it.", 3);
}
},
"reset-form": function (app, event, lcRules, lcPayload, lcDrawQr, lcDates, lcLastPage, lcPagesFor, lcPipeText, lcQrCheck) {
// "RESET FORM" BUTTON: asks first, then sets every answer back to how the form started, and re-checks.
if (app.alert("Are you sure you want to reset the form? All your answers will be cleared.", 2, 2) == 4) {
this.resetForm(); if (typeof lcDrawQr == "function") try { lcDrawQr(this, ""); } catch (e) {} if (typeof lcDates == "function") lcDates(this); if (typeof lcRules == "function") lcRules(this); }
},
"generate-qr": function (app, event, lcRules, lcPayload, lcDrawQr, lcDates, lcLastPage, lcPagesFor, lcPipeText, lcQrCheck) {
// "GENERATE QR CODE" BUTTON: refuses while anything is missing or wrong; otherwise makes the QR code from the
// answers (lcPayload, lcDrawQr): one code, or as many as the answers need (at most 16; codes 3 and up go on extra pages
// after the QR code page, two to a page). Then it goes to the QR code page.
if (typeof lcRules != "function") app.alert("The form's checks did not start, so nothing has been checked yet. Open the form in Adobe Acrobat or Acrobat Reader and allow JavaScript (the yellow bar's Options, or Preferences > JavaScript > Enable Acrobat JavaScript), then close and reopen the form. If it still happens, the form was built from damaged files: build it again.", 1);
else {
var m = lcRules(this), b = m.bad || [], t = [];
var list = function (a) { return "- " + a.slice(0, 15).join("\n- ") + (a.length > 15 ? "\n- ... and " + (a.length - 15) + " more" : ""); }
if (m.length) t.push(m.length + " mandatory question" + (m.length > 1 ? "s are" : " is") + " still blank:\n" + list(m));
if (b.length) t.push(b.length + " answer" + (b.length > 1 ? "s need" : " needs") + " correcting:\n" + list(b));
if (t.length) { app.alert("The QR code cannot be generated yet. The boxes concerned are outlined in red.\n\n" + t.join("\n\n") + "\n\nPlease correct them, then press Generate QR Code again.", 1);
  var g = m.first && this.getField(m.first); if (g) g.setFocus(); }
else { try { var q = this.getField("__qr"); q.value = lcPayload(this); var n = lcDrawQr(this, q.value), cut = [];
  try { this.pageNum = q.page; } catch (e) {}   // a viewer may refuse to change page inside a click that added pages: the codes are drawn all the same
  try { cut = JSON.parse(q.value).truncated || []; } catch (e) {}
  if (n == 1) app.alert("The QR code has been generated from your answers (" + q.value.length + " characters). Press Print Form to print the form with the QR code.", 3);
  else app.alert("Your answers (" + q.value.length + " characters) need " + n + " QR codes, so " + n + " codes have been generated: " + (n > 2 ? "two on the QR code page and the rest, two to a page, on the " + lcPagesFor(n) + " page" + (lcPagesFor(n) > 1 ? "s" : "") + " after it" : "one under the other") + ". The Bank scans all " + n + " codes. Press Print Form to print the form with the QR codes." +
    (cut.length ? "\n\nEven " + n + " codes are too small for everything you typed, so these long answers were shortened in the QR codes (the form itself is unchanged): " + cut.join(", ") + "." : ""), cut.length ? 1 : 3); }
  catch (e) { app.alert("The QR code could not be generated: " + e + "\nPlease send this message to the form's maintainer.", 1); } }
}
},
"print-form": function (app, event, lcRules, lcPayload, lcDrawQr, lcDates, lcLastPage, lcPagesFor, lcPipeText, lcQrCheck) {
// "PRINT FORM" BUTTON: prints only once the QR code exists and still matches the current answers, so the
// printed codes always carry the answers on the paper: every code needed is on its page, none is left over, and the
// pages after the last code in use are not printed.
var q = this.getField("__qr"), now = typeof lcPayload == "function" ? lcPayload(this) : "", same = false, bad = "";
try { same = JSON.stringify(JSON.parse(q.value).data) == JSON.stringify(JSON.parse(now).data); } catch (e) {}
try { bad = lcQrCheck(this, q.value); } catch (e) { bad = String(e); }
if (!/\S/.test(q.value)) app.alert("Please press Generate QR Code first, so the printed form carries the QR code.", 1);
else if (!same) app.alert("Your answers have changed since the QR code was generated. Please press Generate QR Code again, then Print Form.", 1);
else if (bad) app.alert("The QR codes in the form do not match your answers (" + bad + "). Please press Generate QR Code again, then Print Form.", 1);
else this.print(true, 0, lcLastPage(this, q.value), false, true);   // the form to the last QR code page in use
},
"generate-qr-pipe": function (app, event, lcRules, lcPayload, lcDrawQr, lcDates, lcLastPage, lcPagesFor, lcPipeText, lcQrCheck) {
// "GENERATE QR CODE" BUTTON (pipe-format form): as the ordinary one, but the QR codes hold the old smart form's 4 pipe-delimited
// records (lcPipeText, a newline between records) instead of the JSON. lcDrawQr does not pad or change the text; as many codes
// as the text needs (at most 16), the same pages as the ordinary form.
if (typeof lcRules != "function") app.alert("The form's checks did not start, so nothing has been checked yet. Open the form in Adobe Acrobat or Acrobat Reader and allow JavaScript (the yellow bar's Options, or Preferences > JavaScript > Enable Acrobat JavaScript), then close and reopen the form. If it still happens, the form was changed after it was built: ask the form's maintainer.", 1);
else {
var m = lcRules(this), b = m.bad || [], t = [];
var list = function (a) { return "- " + a.slice(0, 15).join("\n- ") + (a.length > 15 ? "\n- ... and " + (a.length - 15) + " more" : ""); }
if (m.length) t.push(m.length + " mandatory question" + (m.length > 1 ? "s are" : " is") + " still blank:\n" + list(m));
if (b.length) t.push(b.length + " answer" + (b.length > 1 ? "s need" : " needs") + " correcting:\n" + list(b));
if (t.length) { app.alert("The QR code cannot be generated yet. The boxes concerned are outlined in red.\n\n" + t.join("\n\n") + "\n\nPlease correct them, then press Generate QR Code again.", 1);
  var g = m.first && this.getField(m.first); if (g) g.setFocus(); }
else { try { var q = this.getField("__qr"), x = lcPipeText(this); q.value = x; var n = lcDrawQr(this, x);
  try { this.pageNum = q.page; } catch (e) {}   // a viewer may refuse to change page inside a click that added pages: the codes are drawn all the same
  if (n == 1) app.alert("The QR code has been generated from your answers (" + x.length + " characters). Press Print Form to print the form with the QR code.", 3);
  else app.alert("Your answers (" + x.length + " characters) need " + n + " QR codes, so " + n + " codes have been generated" + (n > 2 ? ": two on the QR code page and the rest, two to a page, on the " + lcPagesFor(n) + " page" + (lcPagesFor(n) > 1 ? "s" : "") + " after it" : ", one under the other") + ". The Bank scans all " + n + " codes. Press Print Form to print the form with the QR codes.", 3); }
  catch (e) { app.alert("The QR code could not be generated: " + e + "\nPlease send this message to the form's maintainer.", 1); } }
}
},
"print-form-pipe": function (app, event, lcRules, lcPayload, lcDrawQr, lcDates, lcLastPage, lcPagesFor, lcPipeText, lcQrCheck) {
// "PRINT FORM" BUTTON (pipe-format form): prints only once the QR codes exist and still carry the current records, every code
// needed is on its page and none is left over. The hidden box may keep, change or drop the newlines between records (the records
// hold none), so the comparison, and the code count, use the current records, not the stored text.
var q = this.getField("__qr"), now = typeof lcPipeText == "function" ? lcPipeText(this) : "", same = false, bad = "";
try { same = String(q.value).replace(/[\r\n]/g, "") == now.replace(/[\r\n]/g, ""); } catch (e) {}
try { bad = lcQrCheck(this, now); } catch (e) { bad = String(e); }
if (!/\S/.test(q.value)) app.alert("Please press Generate QR Code first, so the printed form carries the QR code.", 1);
else if (!same) app.alert("Your answers have changed since the QR code was generated. Please press Generate QR Code again, then Print Form.", 1);
else if (bad) app.alert("The QR codes in the form do not match your answers (" + bad + "). Please press Generate QR Code again, then Print Form.", 1);
else this.print(true, 0, lcLastPage(this, now), false, true);   // the form to the last QR code page in use
},
"before-save": function (app, event, lcRules, lcPayload, lcDrawQr, lcDates, lcLastPage, lcPagesFor, lcPipeText, lcQrCheck) {
// BEFORE SAVING OR PRINTING: the same list as Check form, shown only if something is missing or wrong, plus a warning
// when QR codes were generated and the pages no longer hold them all (lcQrCheck). It warns but doesn't stop the save or print.
if (typeof lcRules != "function") app.alert("The form's checks did not start, so nothing has been checked yet. Open the form in Adobe Acrobat or Acrobat Reader and allow JavaScript (the yellow bar's Options, or Preferences > JavaScript > Enable Acrobat JavaScript), then close and reopen the form. If it still happens, the form was built from damaged files: build it again.", 1);
else {
var m = lcRules(this), b = m.bad || [], t = [];
var list = function (a) { return "- " + a.slice(0, 15).join("\n- ") + (a.length > 15 ? "\n- ... and " + (a.length - 15) + " more" : ""); }
if (m.length) t.push(m.length + " mandatory question" + (m.length > 1 ? "s are" : " is") + " still blank:\n" + list(m));
if (b.length) t.push(b.length + " answer" + (b.length > 1 ? "s need" : " needs") + " correcting:\n" + list(b));
try { var qf = this.getField("__qr"), qb = qf && /\S/.test(qf.value) && typeof lcQrCheck == "function" ? lcQrCheck(this, qf.value) : ""; if (qb) t.push("The QR codes in the form are not complete (" + qb + "). Press Generate QR Code again."); } catch (e) {}
// Shown once: an event that fires again within 3 seconds of the warning closing is a repeat, not a new save / print.
if (t.length && new Date().getTime() - lcWarnedAt > 3000) {
  app.alert((event.name == "WillPrint" ? "Before printing: " : "Before saving: ") + "this form is not ready to send. The boxes concerned are outlined in red.\n\n" + t.join("\n\n") + "\n\nPlease correct them before you send the form.", 1);
  lcWarnedAt = new Date().getTime(); }

}
}
};
export const onEvent = function (event, lcRules) {
lcRules(this, event.target.name);
};
export const onCalc = function (event, lcRules) {
/*calc*/lcRules(this, event.source ? event.source.name : null);
};

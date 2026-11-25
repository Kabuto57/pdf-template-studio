// @ts-nocheck: lc-form's Acrobat JavaScript, copied word for word by scripts/fill-engine.py (do not edit; rerun it)
let lcWarnedAt = 0;
export const buttons = {
"check-form": function (app, event, lcRules, lcPayload, lcDrawQr, lcDates) {
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
"reset-form": function (app, event, lcRules, lcPayload, lcDrawQr, lcDates) {
// "RESET FORM" BUTTON: asks first, then sets every answer back to how the form started, and re-checks.
if (app.alert("Are you sure you want to reset the form? All your answers will be cleared.", 2, 2) == 4) {
this.resetForm(); if (typeof lcDrawQr == "function") lcDrawQr(this, ""); if (typeof lcDates == "function") lcDates(this); if (typeof lcRules == "function") lcRules(this); }
},
"generate-qr": function (app, event, lcRules, lcPayload, lcDrawQr, lcDates) {
// "GENERATE QR CODE" BUTTON: refuses while anything is missing or wrong; otherwise makes the QR code from the
// answers (lcPayload, lcDrawQr), or two codes if the answers don't fit in one, and goes to the QR code page.
if (typeof lcRules != "function") app.alert("The form's checks did not start, so nothing has been checked yet. Open the form in Adobe Acrobat or Acrobat Reader and allow JavaScript (the yellow bar's Options, or Preferences > JavaScript > Enable Acrobat JavaScript), then close and reopen the form. If it still happens, the form was built from damaged files: build it again.", 1);
else {
var m = lcRules(this), b = m.bad || [], t = [];
var list = function (a) { return "- " + a.slice(0, 15).join("\n- ") + (a.length > 15 ? "\n- ... and " + (a.length - 15) + " more" : ""); }
if (m.length) t.push(m.length + " mandatory question" + (m.length > 1 ? "s are" : " is") + " still blank:\n" + list(m));
if (b.length) t.push(b.length + " answer" + (b.length > 1 ? "s need" : " needs") + " correcting:\n" + list(b));
if (t.length) { app.alert("The QR code cannot be generated yet. The boxes concerned are outlined in red.\n\n" + t.join("\n\n") + "\n\nPlease correct them, then press Generate QR Code again.", 1);
  var g = m.first && this.getField(m.first); if (g) g.setFocus(); }
else { try { var q = this.getField("__qr"); q.value = lcPayload(this); var n = lcDrawQr(this, q.value); this.pageNum = this.numPages - 1;
  if (n == 1) app.alert("The QR code has been generated from your answers (" + q.value.length + " characters). Press Print Form to print the form with the QR code.", 3);
  else app.alert("Your answers (" + q.value.length + " characters) are too long for one QR code, so two codes have been generated, one under the other. The Bank scans both. Press Print Form to print the form with the QR codes.", 3); }
  catch (e) { app.alert("The QR code could not be generated: " + e + "\nPlease send this message to the form's maintainer.", 1); } }
}
},
"print-form": function (app, event, lcRules, lcPayload, lcDrawQr, lcDates) {
// "PRINT FORM" BUTTON: prints only once the QR code exists and still matches the current answers, so the
// printed code always carries the answers on the paper.
var q = this.getField("__qr"), now = typeof lcPayload == "function" ? lcPayload(this) : "", same = false;
try { same = JSON.stringify(JSON.parse(q.value).data) == JSON.stringify(JSON.parse(now).data); } catch (e) {}
if (!/\S/.test(q.value)) app.alert("Please press Generate QR Code first, so the printed form carries the QR code.", 1);
else if (!same) app.alert("Your answers have changed since the QR code was generated. Please press Generate QR Code again, then Print Form.", 1);
else this.print(true, 0, this.numPages - 1, false, true);
},
"before-save": function (app, event, lcRules, lcPayload, lcDrawQr, lcDates) {
// BEFORE SAVING OR PRINTING: the same list as Check form, shown only if something is missing or wrong.
// It warns but doesn't stop the save or print.
if (typeof lcRules != "function") app.alert("The form's checks did not start, so nothing has been checked yet. Open the form in Adobe Acrobat or Acrobat Reader and allow JavaScript (the yellow bar's Options, or Preferences > JavaScript > Enable Acrobat JavaScript), then close and reopen the form. If it still happens, the form was built from damaged files: build it again.", 1);
else {
var m = lcRules(this), b = m.bad || [], t = [];
var list = function (a) { return "- " + a.slice(0, 15).join("\n- ") + (a.length > 15 ? "\n- ... and " + (a.length - 15) + " more" : ""); }
if (m.length) t.push(m.length + " mandatory question" + (m.length > 1 ? "s are" : " is") + " still blank:\n" + list(m));
if (b.length) t.push(b.length + " answer" + (b.length > 1 ? "s need" : " needs") + " correcting:\n" + list(b));
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

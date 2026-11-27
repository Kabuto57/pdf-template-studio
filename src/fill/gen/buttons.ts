// @ts-nocheck: lc-form's Acrobat JavaScript, copied word for word by scripts/fill-engine.py (do not edit; rerun it)
let lcWarnedAt = 0;
export const libNames = ["lcRules", "lcPayload", "lcDrawQr", "lcDates", "lcLastPage", "lcPagesFor", "lcPipeStoredMatches", "lcPipeText", "lcQrCheck"];
export const buttons = {
"check-form": function (app, event, lcRules, lcPayload, lcDrawQr, lcDates, lcLastPage, lcPagesFor, lcPipeStoredMatches, lcPipeText, lcQrCheck) {
// "CHECK FORM" BUTTON.
// What this does: lists what is still blank or wrong (at most 15 of each) and puts the cursor on the first problem.
// If there is nothing to fix, it says the form is ready.
// Example: 2 mandatory questions are blank and 1 answer is wrong -> one message that lists all 3 and says the red boxes
// are the ones to fix.
if (typeof lcRules != "function") {
  // The document script did not run (JavaScript is off, or the form is damaged), so nothing can be checked.
  app.alert("The form's checks did not start, so nothing has been checked yet. Open the form in Adobe Acrobat or Acrobat Reader and allow JavaScript (the yellow bar's Options, or Preferences > JavaScript > Enable Acrobat JavaScript), then close and reopen the form. If it still happens, the form was built from damaged files: build it again.", 1);
} else {
  var missing = lcRules(this);         // labels of the mandatory questions that are blank (it also has .bad and .first)
  var wrong = missing.bad || [];       // "<question>: <what is wrong>" for each wrong answer
  var messages = [];                   // the parts of the message to show

  // "- first\n- second ..." with at most 15 lines; if there are more: "- ... and 3 more".
  var bulletList = function (items) {
    var text = "- " + items.slice(0, 15).join("\n- ");
    if (items.length > 15) text += "\n- ... and " + (items.length - 15) + " more";
    return text;
  };

  if (missing.length) {
    messages.push(missing.length + " mandatory question" + (missing.length > 1 ? "s are" : " is") + " still blank:\n" + bulletList(missing));
  }
  if (wrong.length) {
    messages.push(wrong.length + " answer" + (wrong.length > 1 ? "s need" : " needs") + " correcting:\n" + bulletList(wrong));
  }

  if (messages.length) {
    app.alert("This form is not ready to send. The boxes concerned are outlined in red.\n\n" + messages.join("\n\n") + "\n\nPlease correct them before you send the form.", 1);
    // Put the cursor in the first box with a problem.
    var firstBox = missing.first && this.getField(missing.first);
    if (firstBox) firstBox.setFocus();
  } else {
    app.alert("All mandatory questions are answered and every answer is in the right format. You can save the form and send it.", 3);
  }
}
},
"reset-form": function (app, event, lcRules, lcPayload, lcDrawQr, lcDates, lcLastPage, lcPagesFor, lcPipeStoredMatches, lcPipeText, lcQrCheck) {
// "RESET FORM" BUTTON.
// What this does: asks "are you sure?" first. If yes: sets every answer back to how the form started, wipes the QR codes,
// and checks the form again (so the boxes get their starting colours).
// (app.alert returns 4 when the person presses Yes.)
if (app.alert("Are you sure you want to reset the form? All your answers will be cleared.", 2, 2) == 4) {
  this.resetForm();
  if (typeof lcDrawQr == "function") {
    try { lcDrawQr(this, ""); } catch (e) {}   // "" = draw no codes and remove the extra pages; a failure here does not matter
  }
  if (typeof lcDates == "function") lcDates(this);
  if (typeof lcRules == "function") lcRules(this);
}
},
"generate-qr": function (app, event, lcRules, lcPayload, lcDrawQr, lcDates, lcLastPage, lcPagesFor, lcPipeStoredMatches, lcPipeText, lcQrCheck) {
// "GENERATE QR CODE" BUTTON.
// What this does: refuses while anything is missing or wrong. Otherwise it makes the QR code from the answers (lcPayload
// makes the text, lcDrawQr draws the codes): one code, or as many as the answers need (at most 16; codes 3 and up go on
// extra pages after the QR code page, two to a page). Then it goes to the QR code page and says what it did.
if (typeof lcRules != "function") {
  app.alert("The form's checks did not start, so nothing has been checked yet. Open the form in Adobe Acrobat or Acrobat Reader and allow JavaScript (the yellow bar's Options, or Preferences > JavaScript > Enable Acrobat JavaScript), then close and reopen the form. If it still happens, the form was built from damaged files: build it again.", 1);
} else {
  var missing = lcRules(this);         // labels of the mandatory questions that are blank (it also has .bad and .first)
  var wrong = missing.bad || [];       // "<question>: <what is wrong>" for each wrong answer
  var messages = [];                   // the parts of the message to show

  // "- first\n- second ..." with at most 15 lines; if there are more: "- ... and 3 more".
  var bulletList = function (items) {
    var text = "- " + items.slice(0, 15).join("\n- ");
    if (items.length > 15) text += "\n- ... and " + (items.length - 15) + " more";
    return text;
  };

  if (missing.length) {
    messages.push(missing.length + " mandatory question" + (missing.length > 1 ? "s are" : " is") + " still blank:\n" + bulletList(missing));
  }
  if (wrong.length) {
    messages.push(wrong.length + " answer" + (wrong.length > 1 ? "s need" : " needs") + " correcting:\n" + bulletList(wrong));
  }

  if (messages.length) {
    // Something to fix: no code is made.
    app.alert("The QR code cannot be generated yet. The boxes concerned are outlined in red.\n\n" + messages.join("\n\n") + "\n\nPlease correct them, then press Generate QR Code again.", 1);
    var firstBox = missing.first && this.getField(missing.first);
    if (firstBox) firstBox.setFocus();
  } else {
    try {
      var qrBox = this.getField("__qr");          // the hidden box that keeps the text of the codes
      qrBox.value = lcPayload(this);
      var codeCount = lcDrawQr(this, qrBox.value);
      var shortened = [];                         // long answers that had to be cut to fit 16 codes
      try { this.pageNum = qrBox.page; } catch (e) {}   // a viewer may refuse to change page inside a click that added pages: the codes are drawn all the same
      try { shortened = JSON.parse(qrBox.value).truncated || []; } catch (e) {}
      if (codeCount == 1) {
        app.alert("The QR code has been generated from your answers (" + qrBox.value.length + " characters). Press Print Form to print the form with the QR code.", 3);
      } else {
        // Where the codes are: two on the QR code page and the rest, two to a page, on the extra pages after it.
        var whereAreThey;
        if (codeCount > 2) {
          whereAreThey = "two on the QR code page and the rest, two to a page, on the " + lcPagesFor(codeCount) + " page" + (lcPagesFor(codeCount) > 1 ? "s" : "") + " after it";
        } else {
          whereAreThey = "one under the other";
        }
        var cutNote = "";
        if (shortened.length) {
          cutNote = "\n\nEven " + codeCount + " codes are too small for everything you typed, so these long answers were shortened in the QR codes (the form itself is unchanged): " + shortened.join(", ") + ".";
        }
        app.alert("Your answers (" + qrBox.value.length + " characters) need " + codeCount + " QR codes, so " + codeCount + " codes have been generated: " + whereAreThey + ". The Bank scans all " + codeCount + " codes. Press Print Form to print the form with the QR codes." + cutNote, shortened.length ? 1 : 3);
      }
    } catch (e) {
      app.alert("The QR code could not be generated: " + e + "\nPlease send this message to the form's maintainer.", 1);
    }
  }
}
},
"print-form": function (app, event, lcRules, lcPayload, lcDrawQr, lcDates, lcLastPage, lcPagesFor, lcPipeStoredMatches, lcPipeText, lcQrCheck) {
// "PRINT FORM" BUTTON.
// What this does: prints only once the QR code exists and still matches the current answers, so the printed codes always
// carry the answers that are on the paper. That means: every code needed is on its page, none is left over, and the
// pages after the last code in use are not printed.
// Example: answers were changed after Generate QR Code was pressed -> "Your answers have changed ... press Generate QR Code again".
var qrBox = this.getField("__qr");
var textNow = typeof lcPayload == "function" ? lcPayload(this) : "";   // what the codes should say, with today's answers
var sameAnswers = false;      // do the codes on the form carry these answers?
var codesProblem = "";        // what is wrong with the codes on the pages ("" = nothing)
try { sameAnswers = JSON.stringify(JSON.parse(qrBox.value).data) == JSON.stringify(JSON.parse(textNow).data); } catch (e) {}
try { codesProblem = lcQrCheck(this, qrBox.value); } catch (e) { codesProblem = String(e); }
if (!/\S/.test(qrBox.value)) {
  app.alert("Please press Generate QR Code first, so the printed form carries the QR code.", 1);
} else if (!sameAnswers) {
  app.alert("Your answers have changed since the QR code was generated. Please press Generate QR Code again, then Print Form.", 1);
} else if (codesProblem) {
  app.alert("The QR codes in the form do not match your answers (" + codesProblem + "). Please press Generate QR Code again, then Print Form.", 1);
} else {
  this.print(true, 0, lcLastPage(this, qrBox.value), false, true);   // the form up to the last QR code page in use
}
},
"generate-qr-pipe": function (app, event, lcRules, lcPayload, lcDrawQr, lcDates, lcLastPage, lcPagesFor, lcPipeStoredMatches, lcPipeText, lcQrCheck) {
// "GENERATE QR CODE" BUTTON (pipe-format form).
// What this does: the same as the ordinary Generate QR Code button, but the QR codes hold the old smart form's 4
// pipe-delimited records (lcPipeText, a new line between records) instead of the JSON text. lcDrawQr does not pad or
// change that text. As many codes as the text needs (at most 16), on the same pages as the ordinary form.
if (typeof lcRules != "function") {
  app.alert("The form's checks did not start, so nothing has been checked yet. Open the form in Adobe Acrobat or Acrobat Reader and allow JavaScript (the yellow bar's Options, or Preferences > JavaScript > Enable Acrobat JavaScript), then close and reopen the form. If it still happens, the form was changed after it was built: ask the form's maintainer.", 1);
} else {
  var missing = lcRules(this);         // labels of the mandatory questions that are blank (it also has .bad and .first)
  var wrong = missing.bad || [];       // "<question>: <what is wrong>" for each wrong answer
  var messages = [];                   // the parts of the message to show

  // "- first\n- second ..." with at most 15 lines; if there are more: "- ... and 3 more".
  var bulletList = function (items) {
    var text = "- " + items.slice(0, 15).join("\n- ");
    if (items.length > 15) text += "\n- ... and " + (items.length - 15) + " more";
    return text;
  };

  if (missing.length) {
    messages.push(missing.length + " mandatory question" + (missing.length > 1 ? "s are" : " is") + " still blank:\n" + bulletList(missing));
  }
  if (wrong.length) {
    messages.push(wrong.length + " answer" + (wrong.length > 1 ? "s need" : " needs") + " correcting:\n" + bulletList(wrong));
  }

  if (messages.length) {
    // Something to fix: no code is made.
    app.alert("The QR code cannot be generated yet. The boxes concerned are outlined in red.\n\n" + messages.join("\n\n") + "\n\nPlease correct them, then press Generate QR Code again.", 1);
    var firstBox = missing.first && this.getField(missing.first);
    if (firstBox) firstBox.setFocus();
  } else {
    try {
      var qrBox = this.getField("__qr");          // the hidden box that keeps the text of the codes
      var recordsText = lcPipeText(this);
      qrBox.value = recordsText;
      var codeCount = lcDrawQr(this, recordsText);
      try { this.pageNum = qrBox.page; } catch (e) {}   // a viewer may refuse to change page inside a click that added pages: the codes are drawn all the same
      if (codeCount == 1) {
        app.alert("The QR code has been generated from your answers (" + recordsText.length + " characters). Press Print Form to print the form with the QR code.", 3);
      } else {
        // Where the codes are: two on the QR code page and the rest, two to a page, on the extra pages after it.
        var whereAreThey;
        if (codeCount > 2) {
          whereAreThey = ": two on the QR code page and the rest, two to a page, on the " + lcPagesFor(codeCount) + " page" + (lcPagesFor(codeCount) > 1 ? "s" : "") + " after it";
        } else {
          whereAreThey = ", one under the other";
        }
        app.alert("Your answers (" + recordsText.length + " characters) need " + codeCount + " QR codes, so " + codeCount + " codes have been generated" + whereAreThey + ". The Bank scans all " + codeCount + " codes. Press Print Form to print the form with the QR codes.", 3);
      }
    } catch (e) {
      app.alert("The QR code could not be generated: " + e + "\nPlease send this message to the form's maintainer.", 1);
    }
  }
}
},
"print-form-pipe": function (app, event, lcRules, lcPayload, lcDrawQr, lcDates, lcLastPage, lcPagesFor, lcPipeStoredMatches, lcPipeText, lcQrCheck) {
// "PRINT FORM" BUTTON (pipe-format form).
// What this does: prints only once the QR codes exist and still carry the current records, every code needed is on its
// page and none is left over. The hidden box may keep, change (Acrobat makes each a space) or drop the new lines between
// records (the records hold none themselves), so lcPipeStoredMatches accepts exactly those; the count of codes uses the current records.
var qrBox = this.getField("__qr");
var recordsNow = typeof lcPipeText == "function" ? lcPipeText(this) : "";   // what the codes should say, with today's answers
var sameAnswers = false;      // do the codes on the form carry these records?
var codesProblem = "";        // what is wrong with the codes on the pages ("" = nothing)
try { sameAnswers = lcPipeStoredMatches(qrBox.value, this); } catch (e) {}
try { codesProblem = lcQrCheck(this, recordsNow); } catch (e) { codesProblem = String(e); }
if (!/\S/.test(qrBox.value)) {
  app.alert("Please press Generate QR Code first, so the printed form carries the QR code.", 1);
} else if (!sameAnswers) {
  app.alert("Your answers have changed since the QR code was generated. Please press Generate QR Code again, then Print Form.", 1);
} else if (codesProblem) {
  app.alert("The QR codes in the form do not match your answers (" + codesProblem + "). Please press Generate QR Code again, then Print Form.", 1);
} else {
  this.print(true, 0, lcLastPage(this, recordsNow), false, true);   // the form up to the last QR code page in use
}
},
"before-save": function (app, event, lcRules, lcPayload, lcDrawQr, lcDates, lcLastPage, lcPagesFor, lcPipeStoredMatches, lcPipeText, lcQrCheck) {
// BEFORE SAVING OR PRINTING.
// What this does: shows the same list as Check form, but only if something is missing or wrong. It adds a warning when QR
// codes were generated and the pages no longer hold them all (lcQrCheck). It only warns: it does not stop the save or print.
if (typeof lcRules != "function") {
  app.alert("The form's checks did not start, so nothing has been checked yet. Open the form in Adobe Acrobat or Acrobat Reader and allow JavaScript (the yellow bar's Options, or Preferences > JavaScript > Enable Acrobat JavaScript), then close and reopen the form. If it still happens, the form was built from damaged files: build it again.", 1);
} else {
  var missing = lcRules(this);         // labels of the mandatory questions that are blank (it also has .bad and .first)
  var wrong = missing.bad || [];       // "<question>: <what is wrong>" for each wrong answer
  var messages = [];                   // the parts of the message to show

  // "- first\n- second ..." with at most 15 lines; if there are more: "- ... and 3 more".
  var bulletList = function (items) {
    var text = "- " + items.slice(0, 15).join("\n- ");
    if (items.length > 15) text += "\n- ... and " + (items.length - 15) + " more";
    return text;
  };

  if (missing.length) {
    messages.push(missing.length + " mandatory question" + (missing.length > 1 ? "s are" : " is") + " still blank:\n" + bulletList(missing));
  }
  if (wrong.length) {
    messages.push(wrong.length + " answer" + (wrong.length > 1 ? "s need" : " needs") + " correcting:\n" + bulletList(wrong));
  }

  // If QR codes were generated: are they all still on the pages?
  try {
    var qrBox = this.getField("__qr");
    var codesProblem = qrBox && /\S/.test(qrBox.value) && typeof lcQrCheck == "function" ? lcQrCheck(this, qrBox.value) : "";
    if (codesProblem) messages.push("The QR codes in the form are not complete (" + codesProblem + "). Press Generate QR Code again.");
  } catch (e) {}

  // Shown once: an event that fires again within 3 seconds of the warning closing is a repeat, not a new save / print.
  if (messages.length && new Date().getTime() - lcWarnedAt > 3000) {
    app.alert((event.name == "WillPrint" ? "Before printing: " : "Before saving: ") + "this form is not ready to send. The boxes concerned are outlined in red.\n\n" + messages.join("\n\n") + "\n\nPlease correct them before you send the form.", 1);
    lcWarnedAt = new Date().getTime();
  }
}
}
};
export const onEvent = function (event, lcRules) {
lcRules(this, event.target.name);
};
export const onCalc = function (event, lcRules) {
/*calc*/lcRules(this, event.source ? event.source.name : null);
};

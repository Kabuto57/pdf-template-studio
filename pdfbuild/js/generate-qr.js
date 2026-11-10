var m = typeof lcRules == "function" ? lcRules(this) : [], b = m.bad || [], t = [];
function list(a) { return "- " + a.slice(0, 15).join("\n- ") + (a.length > 15 ? "\n- ... and " + (a.length - 15) + " more" : ""); }
if (m.length) t.push(m.length + " mandatory question" + (m.length > 1 ? "s are" : " is") + " still blank:\n" + list(m));
if (b.length) t.push(b.length + " answer" + (b.length > 1 ? "s need" : " needs") + " correcting:\n" + list(b));
if (t.length) { app.alert("The QR code cannot be generated yet. The boxes concerned are outlined in red.\n\n" + t.join("\n\n") + "\n\nPlease correct them, then press Generate QR Code again.", 1);
  var g = m.first && this.getField(m.first); if (g) g.setFocus(); }
else { try { var q = this.getField("__qr"); q.value = lcPayload(this); lcDrawQr(this, q.value); this.pageNum = this.numPages - 1;
  app.alert("The QR code has been generated from your answers (" + q.value.length + " characters). Press Print Form to print the form with the QR code.", 3); }
  catch (e) { app.alert("The QR code could not be generated: " + e + "\nPlease send this message to the form's maintainer.", 1); } }
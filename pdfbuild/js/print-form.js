var q = this.getField("__qr"), now = typeof lcPayload == "function" ? lcPayload(this) : "", same = false;
try { same = JSON.stringify(JSON.parse(q.value).data) == JSON.stringify(JSON.parse(now).data); } catch (e) {}
if (!/\S/.test(q.value)) app.alert("Please press Generate QR Code first, so the printed form carries the QR code.", 1);
else if (!same) app.alert("Your answers have changed since the QR code was generated. Please press Generate QR Code again, then Print Form.", 1);
else this.print(true, 0, this.numPages - 1, false, true);
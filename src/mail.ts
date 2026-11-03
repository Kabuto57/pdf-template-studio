// The customer's own email (fictional): attach the completed LC application and send it to the bank's Trade Ops.
import "./mail.css";
import { $, h } from "./dom";
import { OPS_ADDRESS, sendMail } from "./mailbox";

function composer() {
  const file = h("input", { type: "file", accept: "application/pdf,.pdf", id: "attachment", className: "sr" }) as HTMLInputElement;
  const chosen = h("span", { className: "muted small" }, "No file attached");
  const subject = h("input", { value: "LC application - Tan Engineering Pte Ltd", "aria-label": "Subject" }) as HTMLInputElement;
  const body = h("textarea", { rows: 7, "aria-label": "Message" }, "Dear Trade Services,\n\nPlease find attached our application for an irrevocable documentary credit.\n\nRegards,\nTan Wei Ming\nTan Engineering Pte Ltd") as HTMLTextAreaElement;
  const error = h("p", { className: "small err", role: "alert" });
  const FROM = "finance@tan-eng.com.sg";
  file.onchange = () => { chosen.textContent = file.files?.[0]?.name ?? "No file attached"; error.textContent = ""; };
  const box = h("div", { className: "mail" },
    h("div", { className: "mail-bar" }, "New message"),
    h("div", { className: "mail-line" }, h("span", {}, "To"), h("input", { value: OPS_ADDRESS, readOnly: true, "aria-label": "To" })),
    h("div", { className: "mail-line" }, h("span", {}, "Subject"), subject),
    h("div", { className: "attach" }, h("label", { className: "btn", for: "attachment" }, "📎 Attach the completed PDF"), file, chosen),
    body, error,
    h("div", { className: "send" }, h("button", { type: "button", className: "primary", onclick: async () => {
      const f = file.files?.[0];
      if (!f) { error.textContent = "Attach the completed PDF first."; return; }
      if (!/\.pdf$/i.test(f.name)) { error.textContent = "The attachment must be a PDF."; return; }
      await sendMail({ from: FROM, to: OPS_ADDRESS, subject: subject.value, body: body.value, file: { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } });
      box.replaceChildren(h("div", { className: "sent" },
        h("div", { className: "tick" }, "✓"), h("h2", {}, "Message sent"),
        h("p", { className: "muted" }, `${f.name} was sent to ${OPS_ADDRESS}.`),
        h("p", { className: "next" }, "Next in the demo: ", h("a", { href: "../trade-ops/" }, "open the Trade Ops workbench"), " to see it arrive.")));
    } }, "Send")));
  return box;
}

$("#app").replaceChildren(composer());

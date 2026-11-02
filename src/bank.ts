// The bank's website (fictional "Demo Bank"): the customer downloads the LC application and emails it back.
import "./site.css";
import { $, download, h } from "./dom";
import { LC } from "./lc";
import { buildLcPdf } from "./lc-pdf";
import { OPS_ADDRESS, sendMail } from "./mailbox";

const FILE = "Irrevocable-Documentary-Credit-Application.pdf";
const OTHER_FORMS = ["Amendment to Documentary Credit", "Banker's Guarantee Application", "Banker's Guarantee Amendment",
  "Standby Letter of Credit Application", "Export Documentary Collection", "Import Financing", "Export Financing"];

function page() {
  $("#app").replaceChildren(
    h("div", { className: "crumbs" }, "Business  ›  Trade Finance  ›  Forms"),
    h("div", { className: "page-title" },
      h("h1", {}, "Trade finance forms"),
      h("p", { className: "muted" }, "Download a form, fill it in on your computer, then email it to our Trade Services team.")),
    h("div", { className: "howto" },
      h("div", {}, h("b", {}, "1. Download"), "Choose the form below."),
      h("div", {}, h("b", {}, "2. Fill in"), "Open it in Adobe Acrobat Reader (free). Fields outlined in red are mandatory."),
      h("div", {}, h("b", {}, "3. Check and save"), "Click ", h("i", {}, "Check form"), " at the top, then save the PDF."),
      h("div", {}, h("b", {}, "4. Email"), `Send it to ${OPS_ADDRESS}, or use the form below.`)),
    h("h2", {}, "Import"),
    h("div", { className: "form-row" },
      h("span", { className: "doc", "aria-hidden": "true" }, "PDF"),
      h("div", { className: "what" }, h("b", {}, "Irrevocable Documentary Credit Application"), h("span", { className: "new-tag" }, "UPDATED"),
        h("small", {}, "Apply for an import letter of credit. Checks your entries as you fill in, in Adobe Acrobat Reader.")),
      h("button", { type: "button", className: "primary", onclick: async () => download(await buildLcPdf(LC.defaults) as BlobPart, FILE, "application/pdf") }, "Download PDF")),
    ...OTHER_FORMS.map(t => h("div", { className: "form-row" },
      h("span", { className: "doc", "aria-hidden": "true" }, "PDF"),
      h("div", { className: "what" }, h("b", {}, t), h("small", {}, "Not part of this demo")),
      h("button", { type: "button", disabled: true }, "Download PDF"))),
    h("h2", { id: "send", className: "gap-top" }, "Send your completed form"),
    h("p", { className: "muted" }, "In this demo, email is simulated: the message goes straight to the Trade Operations workbench in this browser."),
    composer(),
  );
  if (location.hash === "#send") $("#send").scrollIntoView();
}

function composer() {
  const file = h("input", { type: "file", accept: "application/pdf,.pdf", id: "attachment", className: "sr" }) as HTMLInputElement;
  const chosen = h("span", { className: "muted small" }, "No file attached");
  const from = h("input", { type: "email", value: "finance@tan-eng.com.sg", "aria-label": "From" }) as HTMLInputElement;
  const subject = h("input", { value: "LC application - Tan Engineering Pte Ltd", "aria-label": "Subject" }) as HTMLInputElement;
  const body = h("textarea", { rows: 4, "aria-label": "Message" }, "Dear Trade Services,\n\nPlease find attached our application for an irrevocable documentary credit.\n\nRegards,\nTan Wei Ming") as HTMLTextAreaElement;
  const error = h("p", { className: "small err", role: "alert" });
  file.onchange = () => { chosen.textContent = file.files?.[0]?.name ?? "No file attached"; error.textContent = ""; };
  const box = h("div", { className: "mail" },
    h("div", { className: "mail-bar" }, "New message", h("span", { className: "muted small" }, "Demo")),
    h("div", { className: "mail-body" },
      h("div", { className: "mail-line" }, h("span", {}, "From"), from),
      h("div", { className: "mail-line" }, h("span", {}, "To"), h("input", { value: OPS_ADDRESS, readOnly: true, "aria-label": "To" })),
      h("div", { className: "mail-line" }, h("span", {}, "Subject"), subject),
      h("div", { className: "attach" }, h("label", { className: "btn flush", for: "attachment" }, "📎 Attach the saved PDF"), file, chosen),
      body, error,
      h("div", { className: "gap-top-s" }, h("button", { type: "button", className: "primary", onclick: async () => {
        const f = file.files?.[0];
        if (!f) { error.textContent = "Attach the completed PDF first."; return; }
        if (!/\.pdf$/i.test(f.name)) { error.textContent = "The attachment must be a PDF."; return; }
        await sendMail({ from: from.value, to: OPS_ADDRESS, subject: subject.value, body: body.value, file: { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } });
        box.replaceChildren(h("div", { className: "sent" },
          h("div", { className: "tick" }, "✓"), h("h3", {}, "Sent to Trade Services"),
          h("p", { className: "muted" }, `${f.name} was emailed to ${OPS_ADDRESS}. We will contact you if anything is missing.`),
          h("p", {}, h("a", { className: "btn primary", href: "ops.html" }, "Switch to the Trade Ops workbench (demo) →"))));
      } }, "Send"))));
  return box;
}

page();

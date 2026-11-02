// Demo Bank's public website (fictional): the customer downloads the LC application and emails it back.
import "./bank.css";
import { $, download, h } from "./dom";
import { LC } from "./lc";
import { buildLcPdf } from "./lc-pdf";
import { buildPdf } from "./pdf";
import { OPS_ADDRESS, sendMail } from "./mailbox";

const FILE = "Irrevocable-Documentary-Credit-Application.pdf";
const CATEGORIES: [string, string[]][] = [
  ["Import", ["Irrevocable Documentary Credit (LC)", "Amendment to Original Documentary Credit"]],
  ["Export", ["Handling / Financing of Documents Under Export Documentary Credit (EBLC)", "Application for Export Documentary Collection"]],
  ["Loans", ["Import Financing", "Export Financing"]],
  ["Guarantees", ["Banker's Guarantee (BG)", "Standby Letter of Credit (SBLC)", "BG Amendment", "SBLC Amendment"]],
];

const lcRow = () => h("li", {},
  h("span", { className: "name" }, h("b", {}, "Irrevocable Documentary Credit (LC)"), h("span", { className: "tag" }, "UPDATED"),
    h("small", {}, "Checks your entries as you fill it in. PDF, 3 pages.")),
  h("span", { className: "dl" },
    h("button", { type: "button", className: "primary", onclick: async () => download(await buildLcPdf(LC.defaults) as BlobPart, FILE, "application/pdf") }, "Download Form"),
    h("button", { type: "button", onclick: async () => download(await buildPdf(LC.template, LC.defaults) as BlobPart, FILE.replace(".pdf", "-new-design.pdf"), "application/pdf") }, "New design")));

function page() {
  $("#app").replaceChildren(
    h("div", { className: "crumbs" }, h("a", { href: "#" }, "Corporate Banking"), "  ›  ", h("a", { href: "#" }, "Forms & Guides"), "  ›  Trade Application Form"),
    h("div", { className: "title" }, h("h1", {}, "Trade Application Form")),
    h("div", { className: "layout" },
      h("div", {},
        ...CATEGORIES.map(([cat, forms]) => h("section", { className: "cat" }, h("h3", {}, cat),
          h("ul", {}, ...forms.map(f => f.startsWith("Irrevocable") ? lcRow()
            : h("li", {}, h("span", { className: "name" }, f, h("small", {}, "Not part of this demonstration")), h("button", { type: "button", disabled: true }, "Download Form")))))),
        h("div", { className: "steps" },
          h("h4", {}, "To fill in the form"),
          h("ol", {},
            h("li", {}, "Save the PDF to your computer."),
            h("li", {}, "Open it with Adobe Acrobat Reader (free)."),
            h("li", {}, "If a yellow bar says ", h("i", {}, "Protected View"), ", click ", h("b", {}, "Enable All Features"), ". Until you do, the fields cannot be filled in."),
            h("li", {}, "Fields outlined in red are mandatory. Click ", h("b", {}, "Check form"), " at the top before you save."))),
        h("section", { className: "cat", id: "send" },
          h("h3", {}, "Submit your completed form"),
          h("p", { className: "muted" }, `Email the saved PDF to ${OPS_ADDRESS}, or attach it below.`),
          composer())),
      h("aside", { className: "side" },
        h("div", { className: "box" }, h("h5", {}, "Need help?"), h("p", { className: "small" }, "Call Trade Services on 1800 000 0000, 8.30am to 6.00pm, Monday to Friday (excluding public holidays).")),
        h("div", { className: "box" }, h("h5", {}, "Submitting by email"), h("p", { className: "small muted" }, "Send one application per email. We will contact you if anything is missing or unclear.")))),
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
    h("div", { className: "mail-bar" }, "New message", h("span", { className: "muted small" }, "To Trade Services")),
    h("div", { className: "mail-body" },
      h("div", { className: "mail-line" }, h("span", {}, "From"), from),
      h("div", { className: "mail-line" }, h("span", {}, "To"), h("input", { value: OPS_ADDRESS, readOnly: true, "aria-label": "To" })),
      h("div", { className: "mail-line" }, h("span", {}, "Subject"), subject),
      h("div", { className: "attach" }, h("label", { className: "btn flush", for: "attachment" }, "Attach the saved PDF"), file, chosen),
      body, error,
      h("div", { className: "gap-top-s" }, h("button", { type: "button", className: "primary", onclick: async () => {
        const f = file.files?.[0];
        if (!f) { error.textContent = "Attach the completed PDF first."; return; }
        if (!/\.pdf$/i.test(f.name)) { error.textContent = "The attachment must be a PDF."; return; }
        await sendMail({ from: from.value, to: OPS_ADDRESS, subject: subject.value, body: body.value, file: { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } });
        box.replaceChildren(h("div", { className: "sent" },
          h("div", { className: "tick" }, "✓"), h("h3", {}, "Sent to Trade Services"),
          h("p", { className: "muted" }, `${f.name} was emailed to ${OPS_ADDRESS}. We will contact you if anything is missing.`),
          h("p", { className: "muted small" }, `Reference ${Date.now().toString(36).toUpperCase()}`)));
      } }, "Send"))));
  return box;
}

page();

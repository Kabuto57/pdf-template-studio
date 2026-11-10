// Demo Bank's public website (fictional): the customer downloads the LC application (they email it from their own mail: customer-mail/).
import "./bank.css";
import { $, download, h } from "./dom";
import { LC } from "./lc";
import { buildPdf } from "./pdf";
import { OPS_ADDRESS } from "./mailbox";

const CATEGORIES: [string, string[]][] = [
  ["Import", ["Irrevocable Documentary Credit Application", "Amendment to Original Documentary Credit"]],
  [
    "Export",
    [
      "Handling / Financing of Documents Under Export Documentary Credit (EBLC)",
      "Application for Export Documentary Collection",
    ],
  ],
  ["Loans", ["Import Financing", "Export Financing"]],
  ["Guarantees", ["Banker's Guarantee (BG)", "Standby Letter of Credit (SBLC)", "BG Amendment", "SBLC Amendment"]],
];

const pdf = (mode: "javascript" | "no-javascript", name: string) => async () =>
  download((await buildPdf(LC.template, LC.defaults, mode)) as BlobPart, name, "application/pdf");

function page() {
  $("#app").replaceChildren(
    h("div", { className: "title" }, h("h1", {}, "Trade application forms")),
    h(
      "ol",
      { className: "steps" },
      h("li", {}, h("b", {}, "Fill in"), " the form online, or download the PDF."),
      h("li", {}, h("b", {}, "Fix"), " anything marked in red."),
      h("li", {}, h("b", {}, "Save"), " the completed PDF."),
      h("li", {}, h("b", {}, "Email"), " it to Trade Ops."),
    ),
    h("p", { className: "send" }, "Trade Ops email: ", h("span", { className: "addr" }, OPS_ADDRESS)),
    h(
      "section",
      { className: "feature" },
      h("h2", {}, "Irrevocable Documentary Credit Application"),
      h("p", { className: "muted flush" }, "Every answer is checked as you fill it in."),
      h(
        "div",
        { className: "dl" },
        h("a", { className: "btn primary", href: "apply.html" }, "Fill online"),
        h("button", { type: "button", onclick: pdf("javascript", "LC-Application-JavaScript.pdf") }, "Download PDF"),
      ),
      h(
        "p",
        { className: "small muted flush" },
        "The PDF works in Adobe Acrobat or Reader. Using another PDF viewer? ",
        h("a", { href: "#", onclick: (e: Event) => { e.preventDefault(); void pdf("no-javascript", "LC-Application-no-JavaScript.pdf")(); } }, "Download the simple version"),
        ".",
      ),
    ),
    ...CATEGORIES.map(([cat, forms]) =>
      h(
        "section",
        { className: "cat" },
        h("h3", {}, cat),
        h("ul", {}, ...forms.filter(f => !f.startsWith("Irrevocable")).map(f => h("li", {}, h("span", {}, f), h("span", {}, "Coming soon")))),
      ),
    ),
  );
}

page();

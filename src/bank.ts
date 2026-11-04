// Demo Bank's public website (fictional): the customer downloads the LC application (they email it from their own mail: customer-mail/).
import "./bank.css";
import { $, download, h } from "./dom";
import { LC } from "./lc";
import { buildPdf } from "./pdf";
import { OPS_ADDRESS } from "./mailbox";

const FILE = "Irrevocable-Documentary-Credit-Application.pdf";
const CATEGORIES: [string, string[]][] = [
  ["Import", ["Irrevocable Documentary Credit (LC)", "Amendment to Original Documentary Credit"]],
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

const lcRow = () =>
  h(
    "li",
    {},
    h(
      "span",
      { className: "name" },
      h("b", {}, "Irrevocable Documentary Credit (LC)"),
      h("span", { className: "tag" }, "UPDATED"),
      h("small", {}, "Checks your entries as you fill it in. PDF, 6 pages."),
    ),
    h(
      "span",
      { className: "dl" },
      h(
        "button",
        {
          type: "button",
          className: "primary",
          onclick: async () =>
            download((await buildPdf(LC.template, LC.defaults)) as BlobPart, FILE, "application/pdf"),
        },
        "Download Form",
      ),
    ),
  );

function page() {
  $("#app").replaceChildren(
    h(
      "div",
      { className: "crumbs" },
      h("a", { href: "#" }, "Corporate Banking"),
      "  ›  ",
      h("a", { href: "#" }, "Forms & Guides"),
      "  ›  Trade Application Form",
    ),
    h("div", { className: "title" }, h("h1", {}, "Trade Application Form")),
    h(
      "div",
      { className: "layout" },
      h(
        "div",
        {},
        h(
          "div",
          { className: "steps" },
          h("h4", {}, "How to apply"),
          h(
            "ol",
            {},
            h("li", {}, h("b", {}, "Download"), " the form below and save it to your computer."),
            h(
              "li",
              {},
              h("b", {}, "Fill it in"),
              " with Adobe Acrobat Reader (free). Boxes outlined in red are mandatory; click ",
              h("b", {}, "Check form"),
              " at the top to see anything missing.",
            ),
            h("li", {}, h("b", {}, "Save"), " the completed PDF."),
            h(
              "li",
              {},
              h("b", {}, "Email"),
              " it as an attachment from your company email to ",
              h("b", {}, OPS_ADDRESS),
              ". One application per email.",
            ),
          ),
        ),
        ...CATEGORIES.map(([cat, forms]) =>
          h(
            "section",
            { className: "cat" },
            h("h3", {}, cat),
            h(
              "ul",
              {},
              ...forms.map(f =>
                f.startsWith("Irrevocable")
                  ? lcRow()
                  : h(
                      "li",
                      {},
                      h("span", { className: "name" }, f, h("small", {}, "Not part of this demonstration")),
                      h("button", { type: "button", disabled: true }, "Download Form"),
                    ),
              ),
            ),
          ),
        ),
      ),
      h(
        "aside",
        { className: "side" },
        h(
          "div",
          { className: "box" },
          h("h5", {}, "Send your completed form to"),
          h("p", { className: "addr" }, OPS_ADDRESS),
          h("p", { className: "small muted" }, "We will contact you if anything is missing or unclear."),
        ),
        h(
          "div",
          { className: "box" },
          h("h5", {}, "Need help?"),
          h(
            "p",
            { className: "small" },
            "Call Trade Services on 1800 000 0000, 8.30am to 6.00pm, Monday to Friday (excluding public holidays).",
          ),
        ),
      ),
    ),
  );
}

page();

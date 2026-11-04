// Demo Bank's public website (fictional): the customer downloads the LC application (they email it from their own mail: customer-mail/).
import "./bank.css";
import { $, download, h } from "./dom";
import { LC } from "./lc";
import { buildPdf } from "./pdf";
import { OPS_ADDRESS } from "./mailbox";

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
      h("small", {}, "Fill online (every answer checked as you type), or download the PDF: the JavaScript version checks everything in Acrobat; the no-JavaScript version works in any viewer."),
    ),
    h(
      "span",
      { className: "dl" },
      h("a", { className: "btn primary", href: "apply.html" }, "Fill online"),
      h(
        "button",
        {
          type: "button",
          title: "For Adobe Acrobat / Reader with JavaScript on: checks everything as you fill it in, like the old smart form",
          onclick: async () =>
            download((await buildPdf(LC.template, LC.defaults, "javascript")) as BlobPart, "LC-Application-JavaScript.pdf", "application/pdf"),
        },
        "PDF (JavaScript)",
      ),
      h(
        "button",
        {
          type: "button",
          title: "For any PDF viewer, JavaScript off: no scripts; red frames and drop-down lists guide you",
          onclick: async () =>
            download((await buildPdf(LC.template, LC.defaults, "no-javascript")) as BlobPart, "LC-Application-no-JavaScript.pdf", "application/pdf"),
        },
        "PDF (no JavaScript)",
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
              ". Easiest: ",
              h("b", {}, "Fill online"),
              ", which checks every answer as you go. Or download a PDF: the JavaScript version (Adobe Acrobat / Reader with JavaScript on) checks everything and has a ",
              h("b", {}, "Check form"),
              " button; the no-JavaScript version works in any viewer and outlines mandatory boxes in red.",
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

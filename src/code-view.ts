// "VIEW CODE": the Python code that builds the current form's PDF (pdfbuild/build_form.py, with pikepdf + PyMuPDF,
// the company AI's libraries), the form's description it reads, and the Acrobat scripts it puts inside the PDF.
// "Download builder" gives one .py file with everything embedded: `python build_<form>.py out.pdf` makes the PDF.
import BUILD_PY from "../pdfbuild/build_form.py?raw";
import METRICS from "../pdfbuild/helvetica-metrics.json?raw";
import { download, h } from "./dom";
import { slug, type Template, type Values } from "./pdf";

const JS_FILES = import.meta.glob("../pdfbuild/js/*.js", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const scripts = Object.fromEntries(Object.entries(JS_FILES).map(([path, text]) => [`js/${path.split("/").pop()}`, text]));

/** The form as build_form.py reads it: the description plus its starting answers ("defaults"). */
export const formJson = (t: Template, values: Values) => {
  const { base: _base, design: _design, ...rest } = t;
  return JSON.stringify({ ...rest, defaults: values }, null, 1);
};

/** build_form.py with the helper files and this form embedded: one file that builds this one form. */
export const oneFile = (t: Template, values: Values) =>
  BUILD_PY
    .replace("EMBEDDED = {}", () => `EMBEDDED = ${JSON.stringify({ "helvetica-metrics.json": METRICS, ...scripts })}`)
    .replace("FORM = None", () => `FORM = json.loads(${JSON.stringify(formJson(t, values))})`);

export function showCode(t: Template, values: Values) {
  const name = slug(t.title);
  const tabs: [string, string][] = [
    ["How to run", [
      `# 1. The libraries (the company AI already has them):`,
      `pip install pikepdf pymupdf`,
      ``,
      `# 2. Build the PDF (the one-file builder has this form inside it):`,
      `python build_${name}.py ${name}.pdf`,
      ``,
      `# Without JavaScript (red frames and grey shading that work with JavaScript off):`,
      `python build_${name}.py ${name}-simple.pdf --mode no-javascript`,
      ``,
      `# Or with the separate files (pdfbuild/ in the project):`,
      `python pdfbuild/build_form.py form.json ${name}.pdf`,
      ``,
      `# What each library does:`,
      `#   PyMuPDF  draws the pages: header, numbered sections, labels, footers, the QR code frame`,
      `#   pikepdf  adds the fields and their looks, Check form / Reset form, Generate QR Code / Print Form,`,
      `#            the page links, the Acrobat scripts (js/*.js) and the form's description`,
      `#   QR code  no library: the form's own JavaScript (js/qr.js) draws it inside Acrobat`,
    ].join("\n")],
    ["build_form.py", BUILD_PY],
    ["Form (form.json)", formJson(t, values)],
    ...Object.entries(scripts).sort().map(([file, text]) => [file, text] as [string, string]),
  ];
  const code = h("pre", { className: "code" });
  const show = (i: number) => {
    code.textContent = tabs[i][1];
    bar.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-selected", String(i === j)));
  };
  const bar = h("div", { className: "code-tabs", role: "tablist" },
    ...tabs.map(([label], i) => h("button", { type: "button", role: "tab", onclick: () => show(i) }, label)));
  const dialog = h("dialog", { className: "code-dialog", "aria-label": "Code that builds this PDF" },
    h("div", { className: "code-head" },
      h("div", {},
        h("h2", {}, "Code that builds this PDF"),
        h("p", { className: "muted" }, `Python with PyMuPDF and pikepdf builds "${t.title}" exactly as you see it in the preview.`),
      ),
      h("div", { className: "code-actions" },
        h("button", { type: "button", onclick: () => navigator.clipboard.writeText(code.textContent ?? "").catch(() => undefined) }, "Copy"),
        h("button", { type: "button", className: "primary", onclick: () => download(oneFile(t, values), `build_${name}.py`, "text/x-python") }, "Download builder (.py)"),
        h("button", { type: "button", onclick: () => dialog.close(), "aria-label": "Close" }, "Close"),
      ),
    ),
    t.base ? h("p", { className: "error" }, "This form is an uploaded PDF: the studio fills its own fields, so it isn't built by this code.") : "",
    bar, code,
  );
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  show(0);
  dialog.showModal();
}

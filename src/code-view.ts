// "VIEW CODE": the Python code that builds the current form's PDF (pdfbuild/build_form.py, with pikepdf + PyMuPDF,
// the company AI's libraries), the form's description it reads, and the Acrobat scripts it puts inside the PDF.
// "Download builder" gives one .py file with everything embedded: `python build_<form>.py out.pdf` makes the PDF.
import BUILD_PY from "../pdfbuild/build_form.py?raw";
import METRICS from "../pdfbuild/helvetica-metrics.json?raw";
import { download, h } from "./dom";
import { slug, type Field, type Rule, type Section, type Template, type Values } from "./pdf";

const JS_FILES = import.meta.glob("../pdfbuild/js/*.js", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const scripts = Object.fromEntries(Object.entries(JS_FILES).map(([path, text]) => [`js/${path.split("/").pop()}`, text]));

/** A value as Python source. */
const py = (v: unknown): string =>
  typeof v === "string" ? JSON.stringify(v) :
  typeof v === "boolean" ? (v ? "True" : "False") :
  typeof v === "number" ? String(v) :
  Array.isArray(v) ? `[${v.map(py).join(", ")}]` :
  v && typeof v === "object" ? `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${py(x)}`).join(", ")}}` :
  "None";

/** A rule as Python: when("drafts", "true"). */
const rule = (r: Rule) => `when(${[r.field, ...r.values].map(py).join(", ")}${r.not ? ", not_=True" : ""})`;

/** One question as one line of Python: text("applicant_name", "Applicant name", half=True, required=True, max=35). */
const question = (f: Field) => {
  const { id, label, kind, options, ...more } = f;
  const args = [py(id), py(label), ...(options ? [py(options)] : []),
    ...Object.entries(more).map(([k, v]) => `${k}=${k === "requiredIf" || k === "activeIf" ? `[${(v as Rule[]).map(rule).join(", ")}]` : py(v)}`)];
  return `${kind}(${args.join(", ")})`;
};

/** The form written in Python with build_form.py's functions: one line per question, so every edit shows. */
export function formPython(t: Template, values: Values) {
  const { base: _base, design: _design, title, note, sections, ...more } = t;
  return [
    `# ${t.title}: the form, in Python. build_form.py turns it into the PDF (python build_${slug(t.title)}.py out.pdf).`,
    `FORM = form(`,
    `    title=${py(title)},`,
    `    note=${py(note ?? "")},`,
    ...Object.entries(more).map(([k, v]) => `    ${k}=${py(v)},`),
    `    defaults=${py(values)},`,
    `    sections=[`,
    ...sections.flatMap((s: Section) => {
      const { title: st, fields, ...extra } = s;
      return [
        `        section(${py(st)},`,
        ...fields.map(f => `            ${question(f)},`),
        ...Object.entries(extra).map(([k, v]) => `            ${k}=${py(v)},`), // note, signoff, bankOnly
        `        ),`,
      ];
    }),
    `    ],`,
    `)`,
  ].join("\n");
}

/** build_form.py with the helper files and this form embedded: one file that builds this one form. */
export const oneFile = (t: Template, values: Values) =>
  BUILD_PY
    .replace("EMBEDDED = {}", () => `EMBEDDED = ${JSON.stringify({ "helvetica-metrics.json": METRICS, ...scripts })}`)
    .replace(/^FORM = None.*$/m, () => formPython(t, values));

/** The code view's tabs for this form: [label, text]. */
function tabsFor(t: Template, values: Values): [string, string][] {
  const name = slug(t.title);
  return [
    ["This form (Python)", formPython(t, values)],
    ["build_form.py", BUILD_PY],
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
    ...Object.entries(scripts).sort().map(([file, text]) => [file, text] as [string, string]),
  ];
}

// The open code panel (one at a time): it stays open beside the form and follows every edit.
let panel: { dialog: HTMLDialogElement; code: HTMLElement; bar: HTMLElement; title: HTMLElement; tab: number; texts: string[]; t: Template; values: Values } | undefined;

/** Shows tab i; lines that changed since the last time are highlighted (and the first one scrolled to). */
function render(i: number, before?: string) {
  if (!panel) return;
  panel.tab = i;
  const text = panel.texts[i], old = new Set((before ?? text).split("\n"));
  panel.code.replaceChildren(...text.split("\n").map(line => h("span", { className: old.has(line) ? "" : "chg" }, line + "\n")));
  panel.code.querySelector(".chg")?.scrollIntoView({ block: "center" });
  panel.bar.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-selected", String(i === j)));
}

/** Called after every edit in the studio: the code follows the form. */
export function liveCode(t: Template, values: Values) {
  if (!panel?.dialog.open) return;
  const before = panel.texts[panel.tab];
  panel.t = t;
  panel.values = values;
  panel.texts = tabsFor(t, values).map(([, text]) => text);
  panel.title.textContent = `Python with PyMuPDF and pikepdf builds "${t.title}" as in the preview. Edit the form: the code follows.`;
  render(panel.tab, before);
}

export function showCode(t: Template, values: Values) {
  if (panel?.dialog.open) return panel.dialog.close();
  const tabs = tabsFor(t, values);
  const code = h("pre", { className: "code" });
  const bar = h("div", { className: "code-tabs", role: "tablist" },
    ...tabs.map(([label], i) => h("button", { type: "button", role: "tab", onclick: () => render(i) }, label)));
  const title = h("p", { className: "muted" });
  const dialog = h("dialog", { className: "code-dialog", "aria-label": "Code that builds this PDF" },
    h("div", { className: "code-head" },
      h("div", {}, h("h2", {}, "Code that builds this PDF"), title),
      h("div", { className: "code-actions" },
        h("button", { type: "button", onclick: () => navigator.clipboard.writeText(code.textContent ?? "").catch(() => undefined) }, "Copy"),
        h("button", { type: "button", className: "primary", onclick: () => panel && download(oneFile(panel.t, panel.values), `build_${slug(panel.t.title)}.py`, "text/x-python") }, "Download builder (.py)"),
        h("button", { type: "button", onclick: () => dialog.close(), "aria-label": "Close" }, "Close"),
      ),
    ),
    t.base ? h("p", { className: "error" }, "This form is an uploaded PDF: the studio fills its own fields, so it isn't built by this code.") : "",
    bar, code,
  );
  dialog.addEventListener("close", () => { dialog.remove(); panel = undefined; });
  document.body.append(dialog);
  panel = { dialog, code, bar, title, tab: 0, texts: [], t, values };
  // Over the preview, under the studio's header: the form on the left stays editable (not modal), the buttons on top usable.
  const top = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
  Object.assign(dialog.style, { top: `${top}px`, height: `calc(100vh - ${top}px)` });
  dialog.show();
  liveCode(t, values);
}

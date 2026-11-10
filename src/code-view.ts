// "CODE": the Python code that builds the current form's PDF (pdfbuild/build_form.py, with pikepdf + PyMuPDF,
// the company AI's libraries), the form's description it reads, and the Acrobat scripts it puts inside the PDF.
// "Download builder" gives one .py file with everything embedded: `python build_<form>.py out.pdf` makes the PDF.
import BUILD_PY from "../pdfbuild/build_form.py?raw";
import METRICS from "../pdfbuild/helvetica-metrics.json?raw";
import { download, h } from "./dom";
import { readPythonForm } from "./py-form";
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

// THE CODE COLUMN (Overleaf-style): form builder | code | PDF. "This form (Python)" is editable: change the code and
// the form and its PDF follow; change the form in the builder and the code follows. The other tabs are read-only.
type OnEdit = (t: Template, values: Values) => void;
let col: { el: HTMLElement; bar: HTMLElement; body: HTMLElement; status: HTMLElement; title: HTMLElement; editor: HTMLTextAreaElement;
  gutter: HTMLElement; tab: number; texts: string[]; t: Template; values: Values } | undefined;

const lineNumbers = (text: string) => text.split("\n").map((_, i) => i + 1).join("\n");

/** Shows tab i: the editor (tab 0) or a read-only file, with the lines that changed since last time highlighted. */
function render(i: number, before?: string) {
  if (!col) return;
  const c = col;
  c.tab = i;
  c.bar.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-selected", String(i === j)));
  if (i === 0) {
    if (document.activeElement !== c.editor && c.editor.value !== c.texts[0]) { // never overwrite what's being typed
      const top = c.editor.scrollTop;
      c.editor.value = c.texts[0];
      c.editor.scrollTop = top;
    }
    c.gutter.textContent = lineNumbers(c.editor.value);
    c.gutter.scrollTop = c.editor.scrollTop;
    if (!c.body.contains(c.editor)) c.body.replaceChildren(h("div", { className: "editor" }, c.gutter, c.editor));
    return;
  }
  const text = c.texts[i], old = new Set((before ?? text).split("\n"));
  const pre = h("pre", { className: "code" }, ...text.split("\n").map(line => h("span", { className: old.has(line) ? "" : "chg" }, line + "\n")));
  c.body.replaceChildren(pre);
  pre.querySelector(".chg")?.scrollIntoView({ block: "center" });
}

/** Called after every edit in the studio's form builder: the code follows the form. */
export function liveCode(t: Template, values: Values) {
  if (!col) return;
  const before = col.texts[col.tab];
  col.t = t;
  col.values = values;
  col.texts = tabsFor(t, values).map(([, text]) => text);
  col.title.textContent = t.base ? "This form is an uploaded PDF: the studio fills its own fields, so this code doesn't build it." :
    "Edit the Python or the form builder: the other follows, and the PDF is rebuilt.";
  render(col.tab, before);
}

/** Opens or closes the code column. onEdit receives the form whenever the edited code reads correctly. */
export function toggleCode(t: Template, values: Values, onEdit: OnEdit) {
  const pane = document.querySelector<HTMLElement>("#codePane")!, split = document.querySelector<HTMLElement>("#codeSplit")!;
  if (col) { col.el.remove(); col = undefined; pane.hidden = split.hidden = true; window.dispatchEvent(new Event("resize")); return false; }
  const editor = h("textarea", { className: "code-input", spellcheck: false, "aria-label": "This form in Python", wrap: "off" });
  const gutter = h("pre", { className: "gutter", "aria-hidden": "true" });
  const status = h("p", { className: "code-status", role: "status" });
  const title = h("p", { className: "muted small" });
  const bar = h("div", { className: "code-tabs", role: "tablist" },
    ...tabsFor(t, values).map(([label], i) => h("button", { type: "button", role: "tab", onclick: () => render(i) }, label)));
  const body = h("div", { className: "code-body" });
  const el = h("div", { className: "code-col", "aria-label": "Code that builds this PDF" },
    h("div", { className: "code-head" },
      title,
      h("div", { className: "code-actions" },
        h("button", { type: "button", onclick: () => navigator.clipboard.writeText(col?.tab === 0 ? editor.value : col?.texts[col.tab] ?? "").catch(() => undefined) }, "Copy"),
        h("button", { type: "button", className: "primary", onclick: () => col && download(oneFile(col.t, col.values), `build_${slug(col.t.title)}.py`, "text/x-python") }, "Download builder (.py)"),
      ),
    ),
    bar, status, body,
  );
  // Typing: read the code half a second after the last key; show where a mistake is, and keep the last good PDF.
  let timer = 0;
  editor.addEventListener("input", () => {
    gutter.textContent = lineNumbers(editor.value);
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      try {
        const { template, values: v } = readPythonForm(editor.value);
        status.textContent = "";
        status.className = "code-status";
        onEdit(template, v);
      } catch (e) {
        status.textContent = (e as Error).message;
        status.className = "code-status bad";
      }
    }, 500);
  });
  editor.addEventListener("scroll", () => { gutter.scrollTop = editor.scrollTop; });
  editor.addEventListener("keydown", e => { // Tab indents (4 spaces), as in a code editor
    if (e.key !== "Tab") return;
    e.preventDefault();
    editor.setRangeText("    ", editor.selectionStart, editor.selectionEnd, "end");
    editor.dispatchEvent(new Event("input"));
  });
  document.querySelector("#code")!.replaceChildren(el);
  pane.hidden = split.hidden = false;
  pane.classList.remove("collapsed");
  window.dispatchEvent(new Event("resize"));
  col = { el, bar, body, status, title, editor, gutter, tab: 0, texts: [], t, values };
  liveCode(t, values);
  return true;
}

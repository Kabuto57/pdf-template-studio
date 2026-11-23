// THE ONE-FILE LC BUILDER (public/build_lc_application.py): pdfbuild/build_form.py with its helper files and the LC
// embedded, so the LC can be built on a machine with only Python (tests/onefile.test.ts keeps it up to date).
// The studio's own export is the lc-form form file (src/canvas/form-file.ts).
import BUILD_PY from "../pdfbuild/build_form.py?raw";
import METRICS from "../pdfbuild/helvetica-metrics.json?raw";
import { slug, type Field, type Rule, type Section, type Template, type Values } from "../src/pdf";

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

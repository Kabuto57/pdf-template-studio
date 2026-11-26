// THE FORM AS AN lc-form FORM FILE: forms/<name>_form.py, built with `python build.py <name>_form.py`.
// Written the way the hand-made form files are: one line per question, the rule helpers (ticked, when, answered),
// and lc_form.py's CURRENCIES / COUNTRIES named instead of written out.
import { slug, type Check, type Field, type Rule, type Section, type Template, type Values } from "../pdf";
import { LISTS } from "./forms";

/** A value as Python source. JSON strings are valid Python strings. */
const py = (v: unknown): string =>
  typeof v === "string" ? JSON.stringify(v)
  : typeof v === "boolean" ? (v ? "True" : "False")
  : typeof v === "number" ? String(v)
  : Array.isArray(v) ? list(v)
  : v && typeof v === "object" ? `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${py(x)}`).join(", ")}}`
  : "None";
const list = (v: unknown[]) => {
  for (const [name, items] of Object.entries(LISTS)) if (v.length === items.length && v.every((x, i) => x === items[i])) return name;
  return `[${v.map(py).join(", ")}]`;
};

/** One rule with the form files' helpers: ticked("x"), answered("x"), when("x", "A", "B"). */
const rule = (r: Rule) =>
  !r.not && r.values.length === 1 && r.values[0] === "true" ? `ticked(${py(r.field)})`
  : r.not && r.values.length === 1 && r.values[0] === "" ? `answered(${py(r.field)})`
  : !r.not ? `when(${[r.field, ...r.values].map(py).join(", ")})`
  : py([r]); // "anything but these values": no helper, written as the rule itself
/** Several rules ("any one is enough"): the helpers return lists, so they join with +. */
const rules = (rs: Rule[]) => (rs.length ? rs.map(rule).join(" + ") : "[]");

const ORDER = ["required", "requiredIf", "activeIf", "max", "format", "cols", "beside", "words", "height"] as const;
/** The question options lc-form knows; studio-only ones (placed-by-hand spots) are left out. */
function question(f: Field) {
  const args = [py(f.id), py(f.label)];
  if (f.kind === "radio") args.push(py(f.options ?? []));
  else if (f.options && (f.kind === "checks" || f.kind === "select")) args.push(`options=${py(f.options)}`);
  for (const k of ORDER) {
    const v = f[k];
    if (v === undefined || v === false) continue;
    args.push(`${k}=${k === "requiredIf" || k === "activeIf" ? rules(v as Rule[]) : py(v)}`);
  }
  // text() sets half=True itself; anything else keeps the half flag only when it was set
  if (f.kind === "text" ? f.half === false : f.half !== undefined) args.push(`half=${py(f.half)}`);
  return `${f.kind}(${args.join(", ")})`;
}

function section(s: Section) {
  const opts: string[] = [];
  if (s.note) opts.push(`note=${py(s.note)}`);
  if (s.width) opts.push(`width=${py(s.width)}`);
  if (s.new_page) opts.push("new_page=True");
  if (s.bankOnly) opts.push("bankOnly=True");
  if (s.signoff) opts.push("signoff=True");
  if (s.buttons?.length) opts.push(`buttons=${py(s.buttons)}`);
  return [`        section(${[py(s.title), ...opts, "fields=["].join(", ")}`, ...s.fields.map(f => `            ${question(f)},`), "        ]),"];
}

const check = (c: Check) =>
  c.t === "order" ? `${c.s ? "after" : "not_before"}(${[c.a, c.b, c.m].map(py).join(", ")})`
  : c.t === "range" ? `in_range(${[c.a, c.lo, c.hi, c.m].map(py).join(", ")})`
  : `account_length(${[c.a, c.b, c.by, c.m].map(py).join(", ")})`;

/** The file's name: "Irrevocable Documentary Credit Application" -> irrevocable_documentary_credit_application_form.py */
export const formFileName = (t: Template) => `${slug(t.title).slice(0, 48).replace(/_$/, "")}_form.py`;

/** The whole form file. `pdfName`: the PDF's file name in out/ (default: from the title). */
export function formFile(t: Template, defaults: Values = {}, pdfName?: string, file = formFileName(t)): string {
  const body = [
    "FORM = {",
    `    "title": ${py(t.title)},`,
    `    "note": ${py(t.note ?? "")},`,
    ...(t.issuer ? [`    "issuer": ${py(t.issuer)},`] : []),
    ...(t.formCode ? [`    "formCode": ${py(t.formCode)},`] : []),
    `    "sections": [`,
    ...t.sections.flatMap(section),
    "    ],",
    ...(t.qrFormat ? [`    "qrFormat": ${py(t.qrFormat)},`] : []),
    ...(t.pipe ? [`    "pipe": ${py(t.pipe)},`] : []),
    ...(t.checks?.length ? [`    "checks": [`, ...t.checks.map(c => `        ${check(c)},`), "    ],"] : []),
    "}",
    "",
    `DEFAULTS = {${Object.entries(defaults).filter(([, v]) => v !== "" && v !== undefined).map(([k, v]) => `\n    ${py(k)}: ${py(v)},`).join("")}${Object.keys(defaults).length ? "\n" : ""}}`,
    "",
    ...(pdfName ? [`PDF_NAME = ${py(pdfName)}`] : []),
  ].join("\n");

  const used = (name: string) => new RegExp(`\\b${name}\\(`).test(body);
  const helpers = ["section", "text", "long", "date", "radio", "checks", "check", "select", "when", "ticked", "answered",
    "not_before", "after", "in_range", "account_length"].filter(used).sort();
  const lists = Object.keys(LISTS).filter(n => new RegExp(`\\b${n}\\b`).test(body));
  const self = file === "lc_form.py"; // lc_form.py is where the lists live (the other forms import both)
  const header = [
    `"""${t.title.toUpperCase()}${t.formCode ? ` (${t.formCode.split(" · ")[0]})` : ""}.`,
    "",
    `Build it:   python build.py ${file}${pdfName ? `     -> out/${pdfName}` : ""}`,
    "",
    "Made in PDF Template Studio (canvas). Every option a form file can use is listed in build.py, section 1.",
    '"""',
    `from build import ${helpers.join(", ")}`,
    ...(lists.length && !self ? [`from lc_form import ${lists.join(", ")}`] : []),
    ...(self ? Object.keys(LISTS).map(n => `${n} = [${LISTS[n as keyof typeof LISTS].map(py).join(", ")}]`) : []),
    "",
  ];
  return `${[...header, body].join("\n")}\n`;
}

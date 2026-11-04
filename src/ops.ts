// Trade Ops workbench (demo): open an emailed application PDF, read every answer exactly, check it, show it.
import "./ops.css";
import { PDFDocument, PDFName, PDFNumber } from "pdf-lib";
import { $, download, h } from "./dom";
import {
  BAD_CHARS,
  FORMATS,
  activeRules,
  extractPdf,
  isActive,
  isRequired,
  slug,
  type Extracted,
  type Row,
  type Template,
  type Value,
  type Values,
} from "./pdf";
import { clearInbox, deleteMail, inbox, saveMail, type Mail } from "./mailbox";
import { date, validateLc } from "./form/validate";
import { compare, find } from "./customers";

const text = () => import("./text"); // pdf.js: only for the original-PDF view and old smart forms

interface Box {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  pw: number;
  ph: number;
}
/** Where each field's boxes are on its page (PDF points), skipping the red-frame / shade copies (read-only widgets). */
async function fieldBoxes(bytes: Uint8Array) {
  const out = new Map<string, Box[]>();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true }),
    pages = doc.getPages();
  for (const f of doc.getForm().getFields())
    for (const w of f.acroField.getWidgets()) {
      const flags = w.dict.lookup(PDFName.of("F"));
      if (flags instanceof PDFNumber && flags.asNumber() & 64) continue;
      const page = pages.findIndex(p => p.ref === w.P());
      if (page < 0) continue;
      const { x, y, width, height } = w.getRectangle(),
        { width: pw, height: ph } = pages[page].getSize();
      out.set(f.getName(), [...(out.get(f.getName()) ?? []), { page, x, y, w: width, h: height, pw, ph }]);
    }
  return out;
}

interface Opened {
  result: Extracted;
  name: string;
  bytes: Uint8Array;
  mail?: Mail;
  vendor?: string;
}
let current: Opened | undefined,
  showEmpty = false,
  showPdf = innerWidth >= 1200; // wide screens: the PDF beside the data
let pane: { el: HTMLElement; pages: HTMLElement[] } | undefined; // the rendered PDF, kept while the same application is open
let boxes = new Map<string, Box[]>(),
  sel = "",
  nums = new Map<string, number>(); // nums: the answer numbers pinned on the PDF // where each answer sits in the PDF; the row being shown
let checked = new Set<string>(); // rows the ops officer has ticked as checked
let editing = false;                       // "Edit answers" on: every answer is a box the officer can correct
let original: Values = {};                 // the answers as read from the PDF, to show what was corrected
let decision: "" | "approve" | "reject" = "",
  reason = ""; // the officer's decision, before it is submitted

const show = (v: Value | undefined) =>
  v === true ? "Yes" : v === false || v === undefined ? "" : Array.isArray(v) ? v.join(", ") : v;
const when = (t: number) =>
  new Date(t).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const toast = (msg: string) => {
  const t = h("div", { className: "toast", role: "status" }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 3500);
};

// ---- Inbox ----
async function renderInbox() {
  const mails = await inbox().catch(() => [] as Mail[]);
  $("#count").textContent = `${mails.filter(m => m.status === "new").length} new`;
  $("#inbox").replaceChildren(
    ...(mails.length
      ? mails.map(m =>
          h(
            "button",
            {
              type: "button",
              className: `mail-item${current?.mail?.id === m.id ? " on" : ""}`,
              onclick: () => open(m.file.bytes, m.file.name, m),
            },
            h(
              "div",
              { className: "from" },
              h("span", {}, m.from),
              h(
                "span",
                { className: `badge ${m.status === "new" ? "new" : m.decision === "reject" ? "bad" : "ok"}` },
                m.status === "new" ? "New" : m.decision === "reject" ? "Rejected" : "Approved",
              ),
            ),
            h("div", { className: "subj" }, m.subject),
            h("div", { className: "meta" }, h("span", {}, m.file.name), h("span", {}, when(m.sent))),
          ),
        )
      : [
          h(
            "p",
            { className: "muted small pad" },
            "No emails yet. Applications emailed to Trade Ops appear here. Drop PDFs below (sample PDFs are in the Template Studio).",
          ),
        ]),
  );
}

// ---- Reading ----
async function open(bytes: Uint8Array, name: string, mail?: Mail) {
  $("#work").replaceChildren(h("p", { className: "muted" }, `Reading ${name}…`));
  try {
    let result = await extractPdf(bytes).catch(() => undefined),
      vendor: string | undefined;
    if (!result?.template) {
      // An application filled in the current vendor smart form (Adobe XFA): read it too.
      const m = await text(),
        x = await m.readXfa(bytes).catch(() => undefined);
      if (x) {
        const forms = m
          .xfaForms(x)
          .filter(f => f.count > 1)
          .sort((a, b) => b.answered - a.answered);
        const { template, values } = m.xfaTemplate(x, forms[0].code);
        const rows = template.sections.flatMap(s =>
          s.fields.map(q => ({
            section: s.title,
            id: q.id,
            label: q.label,
            value: values[q.id] ?? "",
            required: isRequired(q, values),
          })),
        );
        result = { template, rows, data: values };
        vendor = forms[0].title;
      }
    }
    if (!result?.rows.length) {
      const lines = await text()
        .then(m => m.readText(bytes))
        .catch(() => []);
      throw new Error(
        lines.length
          ? 'its form fields were removed. This happens when a form is printed or "Saved as PDF" (for example from Chrome or Edge). Ask the customer to save the form with Save in Acrobat or Preview, not Print, and send that file.'
          : "this PDF has no form fields and no text. It looks like a scan, which would need OCR.",
      );
    }
    current = { result, name, bytes, mail, vendor };
    checked = new Set();
    original = structuredClone(result.data) as Values;
    editing = false;
    // Corrections made before (kept with the email when it was submitted): apply them again.
    for (const c of mail?.corrections ?? []) {
      const row = result.rows.find(r => r.id === c.id);
      if (row) { row.value = c.to; result.data[c.id] = c.to; }
    }
    const fields = new Map(result.template?.sections.flatMap(s => s.fields).map(f => [f.id, f]) ?? []);
    for (const r of result.rows) { const f = fields.get(r.id); if (f && mail?.corrections?.length) r.required = isRequired(f, result.data as Values) || undefined; }
    pane = undefined;
    sel = "";
    decision = "";
    reason = "";
    boxes = await fieldBoxes(bytes).catch(() => new Map());
    render();
    renderInbox();
  } catch (err) {
    $("#work").replaceChildren(
      h("div", { className: "banner bad", role: "alert" }, `Could not read ${name}: ${(err as Error).message}`),
    );
  }
}

// ---- Checks ----
// An LC is checked against its JSON Schema (Ajv) plus the checks across answers (form/validate.ts). Mandatory
// answers are listed separately (rows marked required), so they're left out here.
function problems(t: Template | undefined, data: Record<string, unknown>) {
  if ("doc_bill_of_lading" in data) return validateLc(data).filter(i => i.kind !== "missing").map(i => ({ id: i.id, msg: i.msg }));
  // Any other form: answers to questions that don't apply, formats, characters and lengths.
  const out: { id: string; msg: string }[] = [];
  const push = (id: string, msg: string) => out.push({ id, msg });
  for (const f of t?.sections.flatMap(s => s.fields) ?? []) {
    if (!isActive(f, data as Values) && show(data[f.id] as Value)) {
      const r = activeRules(f)[0],
        by = t!.sections.flatMap(s => s.fields).find(x => x.id === r.field);
      push(
        f.id,
        `answered, but only applies when "${by?.label ?? r.field}" ${r.values[0] === "true" ? "is ticked" : `is "${r.values.join('" or "')}"`}`,
      );
    }
    const v = typeof data[f.id] === "string" ? (data[f.id] as string) : "";
    if (!v) continue;
    if (f.kind === "date" && !date(v)) push(f.id, `"${v}" is not a valid DD/MM/YYYY date`);
    if (f.format && !FORMATS[f.format].ok.test(v)) push(f.id, `"${v}" ${FORMATS[f.format].say}`);
    const odd = [...new Set(v.match(new RegExp(BAD_CHARS, "g")))];
    if (odd.length) push(f.id, `unusual characters ${odd.join(" ")}`);
    if (f.max && v.length > f.max) push(f.id, `longer than ${f.max} characters`);
  }
  return out;
}

// ---- Correcting an answer ----
// The officer can fix what the customer wrote (a typo, a wrong format). The checks, the customer comparison and the
// JSON all use the corrected answers at once; each correction is listed with what the PDF said, and kept on submit.
const same = (a: Value | undefined, b: Value | undefined) => JSON.stringify(a ?? "") === JSON.stringify(b ?? "");
const corrections = () =>
  current!.result.rows.filter(r => !same(r.value, original[r.id])).map(r => ({ id: r.id, label: r.label, from: original[r.id], to: r.value }));

function correct(id: string, value: Value) {
  const { result } = current!;
  const row = result.rows.find(r => r.id === id)!;
  row.value = value;
  result.data[id] = value;
  // Mandatory or not can depend on this answer, so judge every question again.
  const fields = new Map(result.template?.sections.flatMap(s => s.fields).map(f => [f.id, f]) ?? []);
  for (const r of result.rows) { const f = fields.get(r.id); if (f) r.required = isRequired(f, result.data as Values) || undefined; }
  render();
}

/** The box for correcting one answer, matching its kind of question. */
function editor(r: Row): HTMLElement {
  const f = current!.result.template?.sections.flatMap(s => s.fields).find(q => q.id === r.id);
  const label = `Correct ${r.label}`;
  if (typeof r.value === "boolean" || f?.kind === "check")
    return h("input", { type: "checkbox", checked: r.value === true, "aria-label": label, onchange: (e: Event) => correct(r.id, (e.target as HTMLInputElement).checked) });
  if (f?.kind === "checks")
    return h("div", { className: "edit-choices" }, ...(f.options ?? []).map(o => h("label", {}, h("input", {
      type: "checkbox", checked: Array.isArray(r.value) && r.value.includes(o),
      onchange: (e: Event) => { const now = new Set(Array.isArray(r.value) ? r.value : []); (e.target as HTMLInputElement).checked ? now.add(o) : now.delete(o);
        correct(r.id, (f.options ?? []).filter(x => now.has(x))); },
    }), ` ${o}`)));
  if (f?.kind === "radio" || f?.kind === "select")
    return h("select", { "aria-label": label, onchange: (e: Event) => correct(r.id, (e.target as HTMLSelectElement).value) },
      h("option", { value: "" }, "—"), ...(f.options ?? []).map(o => h("option", { value: o, selected: r.value === o }, o)));
  return h(f?.kind === "long" ? "textarea" : "input", {
    value: typeof r.value === "string" ? r.value : "", "aria-label": label, className: "edit-box",
    ...(f?.kind === "date" ? { placeholder: "DD/MM/YYYY" } : {}),
    onchange: (e: Event) => correct(r.id, (e.target as HTMLInputElement).value),
  });
}

// ---- The application ----
function render() {
  const { result, name, mail, vendor } = current!,
    { rows, data, template } = result;
  const missing = rows.filter(r => r.required && !show(r.value));
  const issues = problems(template, data);
  const label = (id: string) => rows.find(r => r.id === id)?.label ?? id;
  // Applicant details against the bank's customer record.
  const cust = "applicant_name" in data && v0(data.applicant_name) ? find(data.applicant_name) : undefined;
  const matches = cust ? compare(cust, data) : [];
  for (const m of matches) if (!m.ok) issues.push({ id: m.id, msg: `differs from customer record (${m.record})` });
  const noRecord = "applicant_name" in data && v0(data.applicant_name) && !cust;
  const flags = (id: string) => issues.filter(i => i.id === id).map(i => i.msg);
  const v = (id: string) => show(data[id] as Value);
  const isLc = "doc_bill_of_lading" in data;
  const facts: [string, string][] = isLc
    ? [
        ["Applicant", v("applicant_name")],
        ["Beneficiary", [v("beneficiary_name"), v("beneficiary_address_3")].filter(Boolean).join(", ")],
        ["Amount", [v("currency"), v("amount")].filter(Boolean).join(" ")],
        ["Expiry", v("expiry_date")],
        ["Latest shipment", v("latest_shipment_date")],
        ["Price basis", v("price_basis")],
        [
          "Drafts",
          data.drafts
            ? v("drafts_at") === "Term"
              ? `Term: ${v("term_days")} days after ${v("term_after")}`
              : v("drafts_at")
            : "None",
        ],
        ["Documents", `${rows.filter(r => r.id.startsWith("doc_") && r.value === true).length} required`],
      ]
    : rows
        .filter(r => r.required && show(r.value))
        .slice(0, 6)
        .map(r => [r.label, show(r.value)]);

  // With the PDF beside it, list the answers in the PDF's own order (page, then top to bottom, left to right) and number
  // them; the same numbers are pinned on the PDF. Otherwise, by the form's sections.
  const visible = (r: Row) => showEmpty || editing || !!show(r.value) || !!r.required || !same(r.value, original[r.id]);
  const sections = new Map<string, Row[]>();
  nums = new Map();
  if (showPdf && boxes.size) {
    const at = (r: Row) => {
      const b = where(r.id)[0];
      return b ? [b.page, Math.round((b.ph - b.y - b.h) / 6), b.x] : [Infinity, 0, 0];
    };
    const sorted = rows
      .filter(visible)
      .map(r => ({ r, k: at(r) }))
      .sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.k[2] - b.k[2]);
    for (const { r, k } of sorted) {
      if (k[0] !== Infinity) nums.set(r.id, nums.size + 1);
      const title = k[0] === Infinity ? "Not found in the PDF's boxes" : `Page ${k[0] + 1}`;
      sections.set(title, [...(sections.get(title) ?? []), r]);
    }
  } else
    for (const r of rows) sections.set(r.section || "Answers", [...(sections.get(r.section || "Answers") ?? []), r]);

  const pdfTop = pane?.el.scrollTop ?? 0; // moving the PDF pane into the new layout would reset its scroll
  $("#work").replaceChildren(
    h(
      "div",
      { className: "app-head" },
      h(
        "div",
        { className: "t" },
        h("h2", {}, template?.title ?? name),
        h(
          "div",
          { className: "src" },
          mail ? `From ${mail.from} · Received ${when(mail.sent)} · Attachment: ${name}` : `Uploaded file · ${name}`,
          vendor ? ` · read from the current smart form (${vendor})` : "",
        ),
      ),
      h(
        "div",
        { className: "actions" },
        h(
          "button",
          {
            type: "button",
            onclick: () => {
              showPdf = !showPdf;
              render();
            },
          },
          showPdf ? "Hide PDF" : "View PDF",
        ),
        h(
          "button",
          {
            type: "button",
            onclick: () =>
              download(JSON.stringify(data, null, 2), `${slug(template?.title ?? name)}.json`, "application/json"),
          },
          "JSON",
        ),
        h(
          "button",
          { type: "button", onclick: () => download(csv(rows), `${slug(template?.title ?? name)}.csv`, "text/csv") },
          "CSV",
        ),
        h("button", { type: "button", className: "danger", onclick: () => remove() }, "Delete"),
      ),
    ),
    decide(
      missing.length + issues.length,
      missing.map(r => `${r.label} is blank`).concat(issues.map(i => `${label(i.id)}: ${i.msg}`)),
    ),
    missing.length || issues.length
      ? h(
          "div",
          { className: "banner bad", role: "alert" },
          h(
            "b",
            {},
            `Needs attention: ${missing.length} mandatory field${missing.length === 1 ? "" : "s"} blank${issues.length ? `, ${issues.length} issue${issues.length > 1 ? "s" : ""} to check` : ""}`,
          ),
          h(
            "ul",
            {},
            ...missing.map(r => h("li", {}, `${r.section ? `${r.section}: ` : ""}${r.label} is blank`)),
            ...issues.map(i => h("li", {}, `${label(i.id)}: ${i.msg}`)),
          ),
        )
      : h(
          "div",
          { className: "banner ok", role: "status" },
          h("b", {}, "Complete. "),
          `All ${rows.filter(r => r.required).length} mandatory fields are filled and every value is in the right format. Read directly from the PDF's fields: no OCR, nothing retyped.`,
        ),
    did(rows, template, matches.length, cust?.cif),
    corrections().length
      ? h(
          "div",
          { className: "banner corrected", role: "status" },
          h("b", {}, `${corrections().length} answer${corrections().length > 1 ? "s" : ""} corrected by ops. `),
          "The checks, the customer comparison and the JSON use the corrected answers; the PDF stays as received.",
          h("ul", {}, ...corrections().map(c => h("li", {}, `${c.label}: "${show(c.from) || "(blank)"}" → "${show(c.to) || "(blank)"}"`))),
        )
      : "",
    h(
      "div",
      { className: showPdf ? "split" : "" },
      h(
        "div",
        { className: "data" },
        h(
          "div",
          { className: "facts" },
          ...facts.map(([k, val]) => h("div", {}, h("span", {}, k), h("b", {}, val || "—"))),
        ),
        cust
          ? h(
              "div",
              { className: "sec cust" },
              h("h3", {}, `Customer verification · ${cust.cif}`),
              h(
                "table",
                {},
                h(
                  "thead",
                  {},
                  h(
                    "tr",
                    {},
                    h("th", {}, ""),
                    h("th", {}, "Per application"),
                    h("th", {}, "Per customer record"),
                    h("th", {}, "Result"),
                  ),
                ),
                h(
                  "tbody",
                  {},
                  ...matches.map(m =>
                    h(
                      "tr",
                      { className: m.ok ? "" : "missing" },
                      h("th", { scope: "row" }, m.label),
                      h("td", {}, m.form),
                      h("td", {}, m.record),
                      h("td", {}, h("span", { className: `chip ${m.ok ? "ok" : "bad"}` }, m.ok ? "Match" : "Differs")),
                    ),
                  ),
                ),
              ),
            )
          : noRecord
            ? h(
                "div",
                { className: "banner bad", role: "alert" },
                h("b", {}, "Not an existing customer. "),
                `No customer record for "${v("applicant_name")}": check the name, or start customer onboarding (KYC).`,
              )
            : "",
        h(
          "div",
          { className: "toggles" },
          h(
            "button",
            { type: "button", className: editing ? "primary" : "", "aria-pressed": String(editing), onclick: () => { editing = !editing; render(); } },
            editing ? "Done editing" : "Edit answers",
          ),
          h(
            "label",
            {},
            h("input", {
              type: "checkbox",
              checked: showEmpty,
              onchange: (e: Event) => {
                showEmpty = (e.target as HTMLInputElement).checked;
                render();
              },
            }),
            "Show empty fields",
          ),
          h(
            "span",
            { className: "muted small" },
            `${rows.filter(r => show(r.value)).length} of ${rows.length} fields answered`,
          ),
          h(
            "span",
            { className: "muted small" },
            `${rows.filter(r => checked.has(r.id) && show(r.value)).length} of ${rows.filter(r => show(r.value)).length} answers checked by you`,
          ),
          h(
            "button",
            {
              type: "button",
              onclick: () => {
                rows.filter(r => show(r.value) && !flags(r.id).length).forEach(r => checked.add(r.id));
                render();
              },
            },
            "Tick all with no flags",
          ),
        ),
        ...[...sections].map(([title, rs]) => {
          const shown = rs.filter(visible);
          return shown.length
            ? h(
                "div",
                { className: "sec" },
                h("h3", {}, title),
                h(
                  "table",
                  {},
                  h(
                    "tbody",
                    {},
                    ...shown.map(r => {
                      const val = show(r.value),
                        blank = !val && r.required;
                      const why = flags(r.id);
                      const at = where(r.id);
                      return h(
                        "tr",
                        {
                          className: `${blank || why.length ? "missing" : ""}${at.length ? " findable" : ""}${sel === r.id ? " sel" : ""}`,
                          title: at.length ? "Click to show it in the PDF" : "",
                          onclick: (e: Event) => {
                            if (at.length && !editing && !(e.target as HTMLElement).matches("input")) locate(r.id);
                          },
                        },
                        h(
                          "th",
                          { scope: "row" },
                          nums.has(r.id) ? h("span", { className: "num" }, String(nums.get(r.id))) : "",
                          r.label,
                          r.required ? " *" : "",
                          nums.size && r.section ? h("span", { className: "in-sec" }, r.section) : "",
                        ),
                        h(
                          "td",
                          {},
                          editing ? editor(r) : blank ? "Missing" : r.value === true ? "Yes" : val || h("span", { className: "muted" }, "—"),
                          same(r.value, original[r.id]) ? "" : h("div", { className: "was" }, `Corrected by ops · PDF said: ${show(original[r.id]) || "(blank)"}`),
                          ...why.map(w => h("div", { className: "flag" }, w)),
                        ),
                        h(
                          "td",
                          { className: "tick" },
                          val
                            ? h("input", {
                                type: "checkbox",
                                title: "Checked",
                                "aria-label": `${r.label} checked`,
                                checked: checked.has(r.id),
                                onchange: (e: Event) => {
                                  (e.target as HTMLInputElement).checked ? checked.add(r.id) : checked.delete(r.id);
                                  render();
                                },
                              })
                            : "",
                        ),
                      );
                    }),
                  ),
                ),
              )
            : "";
        }),
      ),
      showPdf ? pdfPane() : "",
    ),
  );
  if (pane) pane.el.scrollTop = pdfTop;
  if (showPdf) pins();
  if (showPdf && !pane!.pages.length) {
    const open = current!;
    text()
      .then(m => m.renderPages(open.bytes, Math.min(pane!.el.clientWidth - 24, 860)))
      .then(cs => {
        if (current !== open || !pane) return;
        pane.pages = cs.map((c, i) => h("div", { className: "pg", "aria-label": `Page ${i + 1}` }, c));
        pane.el.replaceChildren(...pane.pages);
        pins();
        if (sel) locate(sel);
      });
  }
}

// ---- The PDF beside the data: click an answer to see it in the PDF ----
const where = (id: string) => [...boxes].filter(([n]) => n === id || n.startsWith(`${id}__`)).flatMap(([, b]) => b);
function pdfPane() {
  pane ??= {
    el: h(
      "div",
      { className: "pdf-view", role: "region", "aria-label": "The PDF as received" },
      h("p", { className: "muted" }, "Loading the PDF…"),
    ),
    pages: [],
  };
  return pane.el;
}
/** Numbered pins on the PDF, one per listed answer; clicking one finds its row. */
function pins() {
  if (!pane?.pages.length) return;
  pane.el.querySelectorAll(".pin").forEach(e => e.remove());
  for (const [id, n] of nums) {
    const b = where(id)[0];
    if (!b) continue;
    pane.pages[b.page]?.append(
      h(
        "button",
        {
          type: "button",
          className: `pin${id === sel ? " on" : ""}`,
          title: `Answer ${n}: show it in the list`,
          "aria-label": `Answer ${n}`,
          style: `left:${(b.x / b.pw) * 100}%;top:${((b.ph - b.y - b.h) / b.ph) * 100}%`,
          onclick: () => {
            locate(id, false);
            document.querySelector(".sec tr.sel")?.scrollIntoView({ block: "center", behavior: "smooth" });
          },
        },
        String(n),
      ),
    );
  }
}
function locate(id: string, scrollPdf = true) {
  sel = id;
  if (!showPdf) {
    showPdf = true;
    render();
    return;
  }
  document.querySelectorAll(".sec tr.sel").forEach(e => e.classList.remove("sel"));
  render(); // marks the row
  if (!pane?.pages.length) return; // shown once the pages are drawn
  pane.el.querySelectorAll(".hl").forEach(e => e.remove());
  const marks = where(id).map(b => {
    const m = h("div", {
      className: "hl",
      style: `left:${(b.x / b.pw) * 100}%;top:${((b.ph - b.y - b.h) / b.ph) * 100}%;width:${(b.w / b.pw) * 100}%;height:${(b.h / b.ph) * 100}%`,
    });
    pane!.pages[b.page]?.append(m);
    return m;
  });
  const first = marks[0];
  if (first && scrollPdf)
    pane.el.scrollTo({
      top: first.offsetTop + (first.parentElement as HTMLElement).offsetTop - pane.el.clientHeight / 3,
      behavior: "smooth",
    });
}

// ---- Decision: approve or reject, then submit (simulated: the real one would create an iBPM case) ----
/** What the workbench did for this application, in numbers: the work an officer no longer does by hand. */
function did(rows: Row[], template: Template | undefined, compared: number, cif?: string) {
  const fields = template?.sections.flatMap(s => s.fields) ?? [];
  const answered = rows.filter(r => !!show(r.value)).length;
  const typed = fields.filter(f => typeof current!.result.data[f.id] === "string" && current!.result.data[f.id] !== "").length;
  const conditional = fields.filter(f => f.requiredIf || f.activeIf).length;
  const item = (n: number | string, what: string) => h("li", {}, h("b", {}, String(n)), ` ${what}`);
  return h(
    "div",
    { className: "did" },
    h("span", { className: "q" }, "Done automatically"),
    h(
      "ul",
      {},
      item(answered, "answers read from the PDF's fields: none retyped, no OCR"),
      item(rows.filter(r => r.required).length, "mandatory questions checked"),
      item(conditional, "conditional rules applied"),
      item(typed, "typed answers checked for format, real dates, length and characters"),
      "doc_bill_of_lading" in current!.result.data
        ? h("li", {}, "Checked against ", h("a", { href: "../lc-application.schema.json", target: "_blank" }, "lc-application.schema.json"), " (JSON Schema standard, Ajv)")
        : "",
      "expiry_date" in current!.result.data ? item(6, "cross-answer checks (dates in order, date not in the future, amount, insurance vs price basis)") : "",
      cif ? item(compared, `details compared with customer record ${cif}`) : item("KYC", "applicant not found in customer records"),
    ),
  );
}

function decide(open: number, items: string[]) {
  const mail = current!.mail;
  if (mail?.caseId)
    return h(
      "div",
      { className: `decision done ${mail.decision ?? "approve"}` },
      h("b", {}, mail.decision === "reject" ? "Rejected" : "Approved"),
      ` and submitted to the workflow as case ${mail.caseId}`,
      mail.reason ? h("span", {}, ` · Reason: ${mail.reason}`) : "",
    );
  const pick = (d: typeof decision, text: string) =>
    h(
      "label",
      { className: `opt ${d}${decision === d ? " on" : ""}` },
      h("input", {
        type: "radio",
        name: "decision",
        checked: decision === d,
        onchange: () => {
          decision = d;
          if (d === "reject" && !reason) reason = items.join("; ");
          render();
        },
      }),
      text,
    );
  return h(
    "div",
    { className: "decision" },
    h("span", { className: "q" }, "Decision"),
    pick("approve", "Approve"),
    pick("reject", "Reject"),
    decision === "reject"
      ? h("input", {
          type: "text",
          className: "reason",
          placeholder: "Reason (sent to the customer)",
          value: reason,
          "aria-label": "Reason for rejecting",
          oninput: (e: Event) => {
            reason = (e.target as HTMLInputElement).value;
            (document.querySelector("#submitBtn") as HTMLButtonElement).disabled = !reason.trim();
          },
        })
      : "",
    decision === "approve" && open
      ? h("span", { className: "warn" }, `${open} open item${open > 1 ? "s" : ""} above`)
      : "",
    h(
      "button",
      {
        type: "button",
        id: "submitBtn",
        className: "primary",
        disabled: !decision || (decision === "reject" && !reason.trim()),
        onclick: () => submit(open),
      },
      "Submit",
    ),
  );
}

async function submit(open: number) {
  const o = current!;
  if (
    decision === "approve" &&
    open &&
    !(await ask(
      "Approve with open items?",
      `${open} item${open > 1 ? "s are" : " is"} still flagged on this application. Approve it anyway?`,
      "Approve and submit",
    ))
  )
    return;
  const mail = o.mail ?? {
    id: crypto.randomUUID(),
    from: "Uploaded file",
    to: "",
    subject: o.result.template?.title ?? o.name,
    body: "",
    sent: Date.now(),
    file: { name: o.name, bytes: o.bytes },
    status: "new" as const,
  };
  mail.corrections = corrections().map(({ id, from, to }) => ({ id, from, to }));
  mail.caseId = `TS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;
  mail.status = "processed";
  mail.decision = decision || "approve";
  mail.reason = decision === "reject" ? reason.trim() : undefined;
  await saveMail(mail);
  o.mail = mail;
  toast(
    mail.decision === "reject"
      ? `Rejected: case ${mail.caseId} submitted; the reason goes back to ${mail.from === "Uploaded file" ? "the customer" : mail.from}.`
      : `Approved: submitted to the workflow (iBPM) as case ${mail.caseId}.`,
  );
  render();
  renderInbox();
}

// ---- Delete ----
async function remove() {
  const { name, mail } = current!;
  if (
    !(await ask(
      "Delete this application?",
      `${mail ? `The email from ${mail.from} and its case, if any, will be removed from the mailbox` : `${name} will be closed`}. This cannot be undone.`,
      "Delete",
      "danger",
    ))
  )
    return;
  if (mail) await deleteMail(mail.id);
  current = undefined;
  $("#work").replaceChildren(
    h(
      "div",
      { className: "empty-state" },
      h("h2", {}, "Application deleted"),
      h("p", {}, "Select another email in the mailbox, or drop a PDF."),
    ),
  );
  renderInbox();
  toast(`${name} deleted.`);
}

/** A small modal (native <dialog>): resolves true when the main button is pressed. */
function ask(title: string, text: string | Node, ok: string, cls = "primary", body: Node[] = []) {
  return new Promise<boolean>(done => {
    const d = h(
      "dialog",
      { className: "modal" },
      h(
        "form",
        { method: "dialog" },
        h("h2", {}, title),
        typeof text === "string" ? h("p", {}, text) : text,
        ...body,
        h(
          "div",
          { className: "modal-btns" },
          h("button", { value: "cancel", formNoValidate: true }, "Cancel"),
          h("button", { value: "ok", className: cls }, ok),
        ),
      ),
    ) as HTMLDialogElement;
    d.onclose = () => {
      done(d.returnValue === "ok");
      d.remove();
    };
    document.body.append(d);
    d.showModal();
  });
}

const v0 = (x: unknown) => typeof x === "string" && x.trim() !== "";
const csv = (rows: Row[]) =>
  [
    "section,question,key,value",
    ...rows.map(r =>
      [r.section, r.label, r.id, show(r.value)].map(c => `"${String(c).replace(/"/g, '""')}"`).join(","),
    ),
  ].join("\n");

// ---- Upload: one or many PDFs; each goes into the mailbox, and the first one opens ----
const take = async (files: FileList | File[] | undefined) => {
  const pdfs = [...(files ?? [])].filter(f => /\.pdf$/i.test(f.name) || f.type === "application/pdf");
  if (!pdfs.length) return;
  let first: Mail | undefined;
  for (const [i, f] of pdfs.entries()) {
    const mail: Mail = {
      id: crypto.randomUUID(), from: "Uploaded file", to: "", subject: f.name.replace(/\.pdf$/i, ""), body: "",
      sent: Date.now() + i, file: { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }, status: "new",
    };
    await saveMail(mail);
    first ??= mail;
  }
  if (pdfs.length > 1) toast(`${pdfs.length} PDFs added to the mailbox.`);
  open(first!.file.bytes, first!.file.name, first);
};
$<HTMLInputElement>("#pdfIn").onchange = e => {
  const el = e.target as HTMLInputElement;
  take(el.files ?? undefined);
  el.value = ""; // so the same file can be chosen again
};

$("#clear").onclick = async () => {
  if (!(await ask("Empty the mailbox?", "Every email and its decision will be removed from this browser.", "Empty mailbox", "danger"))) return;
  await clearInbox();
  current = undefined;
  $("#work").replaceChildren(h("div", { className: "empty-state" }, h("h2", {}, "No application open"), h("p", {}, "Drop PDFs into the mailbox.")));
  renderInbox();
};
const drop = $("#drop");
addEventListener("dragover", e => {
  e.preventDefault();
  drop.classList.add("over");
});
addEventListener("dragleave", () => drop.classList.remove("over"));
addEventListener("drop", e => {
  e.preventDefault();
  drop.classList.remove("over");
  take(e.dataTransfer?.files);
});

renderInbox();

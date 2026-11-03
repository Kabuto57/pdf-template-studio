// Trade Ops workbench (demo): open an emailed application PDF, read every answer exactly, check it, show it.
import "./ops.css";
import { $, download, h } from "./dom";
import { BAD_CHARS, FORMATS, extractPdf, isRequired, slug, type Extracted, type Row, type Template, type Value } from "./pdf";
import { inbox, saveMail, type Mail } from "./mailbox";
import { compare, find } from "./customers";

const text = () => import("./text"); // pdf.js: only for the original-PDF view and old smart forms

interface Opened { result: Extracted; name: string; bytes: Uint8Array; mail?: Mail; vendor?: string }
let current: Opened | undefined, showEmpty = false, showPdf = false;
let checked = new Set<string>(); // rows the ops officer has ticked as checked

const show = (v: Value | undefined) => v === true ? "Yes" : v === false || v === undefined ? "" : Array.isArray(v) ? v.join(", ") : v;
const when = (t: number) => new Date(t).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const toast = (msg: string) => { const t = h("div", { className: "toast", role: "status" }, msg); document.body.append(t); setTimeout(() => t.remove(), 3500); };

// ---- Inbox ----
async function renderInbox() {
  const mails = await inbox().catch(() => [] as Mail[]);
  $("#count").textContent = `${mails.filter(m => m.status === "new").length} new`;
  $("#inbox").replaceChildren(...(mails.length ? mails.map(m => h("button", { type: "button", className: `mail-item${current?.mail?.id === m.id ? " on" : ""}`, onclick: () => open(m.file.bytes, m.file.name, m) },
    h("div", { className: "from" }, h("span", {}, m.from), h("span", { className: `badge ${m.status === "new" ? "new" : "ok"}` }, m.status === "new" ? "New" : "Processed")),
    h("div", { className: "subj" }, m.subject),
    h("div", { className: "meta" }, h("span", {}, `📎 ${m.file.name}`), h("span", {}, when(m.sent))))) :
    [h("p", { className: "muted small pad" }, "No emails yet. Applications emailed to Trade Ops appear here; you can also drop a PDF below.")]));
}

// ---- Reading ----
async function open(bytes: Uint8Array, name: string, mail?: Mail) {
  $("#work").replaceChildren(h("p", { className: "muted" }, `Reading ${name}…`));
  try {
    let result = await extractPdf(bytes).catch(() => undefined), vendor: string | undefined;
    if (!result?.template) {
      // An application filled in the current vendor smart form (Adobe XFA): read it too.
      const m = await text(), x = await m.readXfa(bytes).catch(() => undefined);
      if (x) {
        const forms = m.xfaForms(x).filter(f => f.count > 1).sort((a, b) => b.answered - a.answered);
        const { template, values } = m.xfaTemplate(x, forms[0].code);
        const rows = template.sections.flatMap(s => s.fields.map(q => ({ section: s.title, id: q.id, label: q.label, value: values[q.id] ?? "", required: isRequired(q, values) })));
        result = { template, rows, data: values }; vendor = forms[0].title;
      }
    }
    if (!result?.rows.length) throw new Error("this PDF has no form fields. A scanned form would need OCR.");
    current = { result, name, bytes, mail, vendor }; checked = new Set();
    render(); renderInbox();
  } catch (err) {
    $("#work").replaceChildren(h("div", { className: "banner bad", role: "alert" }, `Could not read ${name}: ${(err as Error).message}`));
  }
}

// ---- Checks ----
const date = (s: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s); const d = m && new Date(+m[3], +m[2] - 1, +m[1]); return d && d.getDate() === +m![1] ? d : undefined; };
function problems(t: Template | undefined, data: Record<string, unknown>) {
  const out: { id: string; msg: string }[] = [];
  const push = (id: string, msg: string) => out.push({ id, msg });
  for (const f of t?.sections.flatMap(s => s.fields) ?? []) {
    const v = typeof data[f.id] === "string" ? data[f.id] as string : "";
    if (!v) continue;
    if (f.kind === "date" && !date(v)) push(f.id, `"${v}" is not a valid DD/MM/YYYY date`);
    if (f.format && !FORMATS[f.format].ok.test(v)) push(f.id, `"${v}" ${FORMATS[f.format].say}`);
    const odd = [...new Set(v.match(new RegExp(BAD_CHARS, "g")))];
    if (odd.length) push(f.id, `unusual characters ${odd.join(" ")}`);
    if (f.max && v.length > f.max) push(f.id, `longer than ${f.max} characters`);
  }
  const ship = date(String(data.latest_shipment_date ?? "")), expiry = date(String(data.expiry_date ?? ""));
  if (ship && expiry && expiry < ship) push("expiry_date", "before the latest shipment date");
  return out;
}

// ---- The application ----
function render() {
  const { result, name, mail, vendor } = current!, { rows, data, template } = result;
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
  const facts: [string, string][] = isLc ? [
    ["Applicant", v("applicant_name")], ["Beneficiary", [v("beneficiary_name"), v("beneficiary_address_3")].filter(Boolean).join(", ")],
    ["Amount", [v("currency"), v("amount")].filter(Boolean).join(" ")], ["Expiry", v("expiry_date")],
    ["Latest shipment", v("latest_shipment_date")], ["Price basis", v("price_basis")],
    ["Drafts", data.drafts ? (v("drafts_at") === "Term" ? `Term: ${v("term_days")} days after ${v("term_after")}` : v("drafts_at")) : "None"],
    ["Documents", `${rows.filter(r => r.id.startsWith("doc_") && r.value === true).length} required`],
  ] : rows.filter(r => r.required && show(r.value)).slice(0, 6).map(r => [r.label, show(r.value)]);

  const sections = new Map<string, Row[]>();
  for (const r of rows) sections.set(r.section || "Answers", [...sections.get(r.section || "Answers") ?? [], r]);
  const pdfBox = h("div", { className: "pdf-view", hidden: !showPdf });

  $("#work").replaceChildren(
    h("div", { className: "app-head" },
      h("div", { className: "t" },
        h("h2", {}, template?.title ?? name),
        h("div", { className: "src" }, mail ? `From ${mail.from} · ${when(mail.sent)} · 📎 ${name}` : `Uploaded file · ${name}`,
          vendor ? ` · read from the current smart form (${vendor})` : "")),
      h("div", { className: "actions" },
        h("button", { type: "button", onclick: () => { showPdf = !showPdf; render(); } }, showPdf ? "Hide PDF" : "View PDF"),
        h("button", { type: "button", onclick: () => download(JSON.stringify(data, null, 2), `${slug(template?.title ?? name)}.json`, "application/json") }, "JSON"),
        h("button", { type: "button", onclick: () => download(csv(rows), `${slug(template?.title ?? name)}.csv`, "text/csv") }, "CSV"),
        missing.length ? h("button", { type: "button", onclick: () => toast(`Email to ${mail?.from ?? "the customer"} drafted, listing ${missing.length} missing item${missing.length > 1 ? "s" : ""}.`) }, "Return to customer") : "",
        h("button", { type: "button", className: "primary", disabled: mail?.status === "processed", onclick: async () => {
          const caseId = `TS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;
          if (mail) { mail.status = "processed"; mail.caseId = caseId; await saveMail(mail); }
          toast(`Sent to the workflow (BPM) as case ${caseId}.`); render(); renderInbox();
        } }, mail?.status === "processed" ? `In workflow: ${mail.caseId}` : "Send to workflow"))),
    missing.length || issues.length
      ? h("div", { className: "banner bad", role: "alert" }, h("b", {}, `Needs attention: ${missing.length} mandatory field${missing.length === 1 ? "" : "s"} blank${issues.length ? `, ${issues.length} issue${issues.length > 1 ? "s" : ""} to check` : ""}`),
        h("ul", {}, ...missing.map(r => h("li", {}, `${r.section ? `${r.section}: ` : ""}${r.label} is blank`)), ...issues.map(i => h("li", {}, `${label(i.id)}: ${i.msg}`))))
      : h("div", { className: "banner ok", role: "status" }, h("b", {}, "Complete. "), `All ${rows.filter(r => r.required).length} mandatory fields are filled and every value is in the right format. Read directly from the PDF's fields: no OCR, nothing retyped.`),
    pdfBox,
    h("div", { className: "facts" }, ...facts.map(([k, val]) => h("div", {}, h("span", {}, k), h("b", {}, val || "—")))),
    cust ? h("div", { className: "sec cust" }, h("h3", {}, `Customer record · ${cust.cif} · ${cust.name}`),
      h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, ""), h("th", {}, "In the form"), h("th", {}, "Bank's record"), h("th", {}, ""))),
        h("tbody", {}, ...matches.map(m => h("tr", { className: m.ok ? "" : "missing" }, h("th", { scope: "row" }, m.label), h("td", {}, m.form), h("td", {}, m.record),
          h("td", {}, m.ok ? h("span", { className: "yes" }, "✓ Matches") : "✗ Differs"))))))
      : noRecord ? h("div", { className: "banner bad", role: "alert" }, h("b", {}, "Not an existing customer. "), `No customer record for "${v("applicant_name")}": check the name, or start customer onboarding (KYC).`) : "",
    h("div", { className: "toggles" },
      h("label", {}, h("input", { type: "checkbox", checked: showEmpty, onchange: (e: Event) => { showEmpty = (e.target as HTMLInputElement).checked; render(); } }), "Show empty fields"),
      h("span", { className: "muted small" }, `${rows.filter(r => show(r.value)).length} of ${rows.length} fields answered`),
      h("span", { className: "muted small" }, `${rows.filter(r => checked.has(r.id) && show(r.value)).length} of ${rows.filter(r => show(r.value)).length} answers checked by you`),
      h("button", { type: "button", onclick: () => { rows.filter(r => show(r.value) && !flags(r.id).length).forEach(r => checked.add(r.id)); render(); } }, "Tick all with no flags")),
    ...[...sections].map(([title, rs]) => {
      const shown = rs.filter(r => showEmpty || show(r.value) || r.required);
      return shown.length ? h("div", { className: "sec" }, h("h3", {}, title), h("table", {}, h("tbody", {}, ...shown.map(r => {
        const val = show(r.value), blank = !val && r.required;
        const why = flags(r.id);
        return h("tr", { className: blank || why.length ? "missing" : "" }, h("th", { scope: "row" }, r.label, r.required ? " *" : ""),
          h("td", {}, blank ? "Missing" : r.value === true ? h("span", { className: "yes" }, "✓ Yes") : val || h("span", { className: "muted" }, "—"),
            ...why.map(w => h("div", { className: "flag" }, `⚠ ${w}`))),
          h("td", { className: "tick" }, val ? h("input", { type: "checkbox", title: "Checked", "aria-label": `${r.label} checked`, checked: checked.has(r.id),
            onchange: (e: Event) => { (e.target as HTMLInputElement).checked ? checked.add(r.id) : checked.delete(r.id); render(); } }) : ""));
      })))) : "";
    }),
  );
  if (showPdf) text().then(m => m.renderPages(current!.bytes, Math.min(pdfBox.clientWidth - 28, 860))).then(pages => pdfBox.replaceChildren(...pages));
}

const v0 = (x: unknown) => typeof x === "string" && x.trim() !== "";
const csv = (rows: Row[]) => ["section,question,key,value", ...rows.map(r => [r.section, r.label, r.id, show(r.value)].map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");

// ---- Upload ----
const take = async (f?: File) => { if (f) open(new Uint8Array(await f.arrayBuffer()), f.name); };
$<HTMLInputElement>("#pdfIn").onchange = e => take((e.target as HTMLInputElement).files?.[0]);
const drop = $("#drop");
addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
addEventListener("dragleave", () => drop.classList.remove("over"));
addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); take(e.dataTransfer?.files[0]); });

renderInbox();

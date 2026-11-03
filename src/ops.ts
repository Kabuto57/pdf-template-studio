// Trade Ops workbench (demo): open an emailed application PDF, read every answer exactly, check it, show it.
import "./ops.css";
import { PDFDocument, PDFName, PDFNumber } from "pdf-lib";
import { $, download, h } from "./dom";
import { BAD_CHARS, FORMATS, activeRules, extractPdf, isActive, isRequired, slug, type Extracted, type Row, type Template, type Value, type Values } from "./pdf";
import { deleteMail, inbox, saveMail, type Mail } from "./mailbox";
import { compare, find } from "./customers";

const text = () => import("./text"); // pdf.js: only for the original-PDF view and old smart forms

interface Box { page: number; x: number; y: number; w: number; h: number; pw: number; ph: number }
/** Where each field's boxes are on its page (PDF points), skipping the red-frame / shade copies (read-only widgets). */
async function fieldBoxes(bytes: Uint8Array) {
  const out = new Map<string, Box[]>();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true }), pages = doc.getPages();
  for (const f of doc.getForm().getFields()) for (const w of f.acroField.getWidgets()) {
    const flags = w.dict.lookup(PDFName.of("F"));
    if (flags instanceof PDFNumber && flags.asNumber() & 64) continue;
    const page = pages.findIndex(p => p.ref === w.P());
    if (page < 0) continue;
    const { x, y, width, height } = w.getRectangle(), { width: pw, height: ph } = pages[page].getSize();
    out.set(f.getName(), [...out.get(f.getName()) ?? [], { page, x, y, w: width, h: height, pw, ph }]);
  }
  return out;
}

interface Opened { result: Extracted; name: string; bytes: Uint8Array; mail?: Mail; vendor?: string }
let current: Opened | undefined, showEmpty = false, showPdf = innerWidth >= 1200; // wide screens: the PDF beside the data
let pane: { el: HTMLElement; pages: HTMLElement[] } | undefined; // the rendered PDF, kept while the same application is open
let boxes = new Map<string, Box[]>(), sel = ""; // where each answer sits in the PDF; the row being shown
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
    h("div", { className: "meta" }, h("span", {}, m.file.name), h("span", {}, when(m.sent))))) :
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
    if (!result?.rows.length) {
      const lines = await text().then(m => m.readText(bytes)).catch(() => []);
      throw new Error(lines.length
        ? "its form fields were removed. This happens when a form is printed or \"Saved as PDF\" (for example from Chrome or Edge). Ask the customer to save the form with Save in Acrobat or Preview, not Print, and send that file."
        : "this PDF has no form fields and no text. It looks like a scan, which would need OCR.");
    }
    current = { result, name, bytes, mail, vendor }; checked = new Set(); pane = undefined; sel = "";
    boxes = await fieldBoxes(bytes).catch(() => new Map());
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
    if (!isActive(f, data as Values) && show(data[f.id] as Value)) {
      const r = activeRules(f)[0], by = t!.sections.flatMap(s => s.fields).find(x => x.id === r.field);
      push(f.id, `answered, but only applies when "${by?.label ?? r.field}" ${r.values[0] === "true" ? "is ticked" : `is "${r.values.join('" or "')}"`}`);
    }
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

  $("#work").replaceChildren(
    h("div", { className: "app-head" },
      h("div", { className: "t" },
        h("h2", {}, template?.title ?? name),
        h("div", { className: "src" }, mail ? `From ${mail.from} · Received ${when(mail.sent)} · Attachment: ${name}` : `Uploaded file · ${name}`,
          vendor ? ` · read from the current smart form (${vendor})` : "")),
      h("div", { className: "actions" },
        h("button", { type: "button", onclick: () => { showPdf = !showPdf; render(); } }, showPdf ? "Hide PDF" : "View PDF"),
        h("button", { type: "button", onclick: () => download(JSON.stringify(data, null, 2), `${slug(template?.title ?? name)}.json`, "application/json") }, "JSON"),
        h("button", { type: "button", onclick: () => download(csv(rows), `${slug(template?.title ?? name)}.csv`, "text/csv") }, "CSV"),
        missing.length ? h("button", { type: "button", onclick: () => toast(`Email to ${mail?.from ?? "the customer"} drafted, listing ${missing.length} missing item${missing.length > 1 ? "s" : ""}.`) }, "Return to customer") : "",
        h("button", { type: "button", className: "danger", onclick: () => remove() }, "Delete"),
        h("button", { type: "button", className: "primary", disabled: !!mail?.caseId, onclick: () => submit() }, mail?.caseId ? `Submitted: ${mail.caseId}` : "Submit to workflow"))),
    missing.length || issues.length
      ? h("div", { className: "banner bad", role: "alert" }, h("b", {}, `Needs attention: ${missing.length} mandatory field${missing.length === 1 ? "" : "s"} blank${issues.length ? `, ${issues.length} issue${issues.length > 1 ? "s" : ""} to check` : ""}`),
        h("ul", {}, ...missing.map(r => h("li", {}, `${r.section ? `${r.section}: ` : ""}${r.label} is blank`)), ...issues.map(i => h("li", {}, `${label(i.id)}: ${i.msg}`))))
      : h("div", { className: "banner ok", role: "status" }, h("b", {}, "Complete. "), `All ${rows.filter(r => r.required).length} mandatory fields are filled and every value is in the right format. Read directly from the PDF's fields: no OCR, nothing retyped.`),
    h("div", { className: showPdf ? "split" : "" }, h("div", { className: "data" },
    h("div", { className: "facts" }, ...facts.map(([k, val]) => h("div", {}, h("span", {}, k), h("b", {}, val || "—")))),
    cust ? h("div", { className: "sec cust" }, h("h3", {}, `Customer verification · ${cust.cif}`),
      h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, ""), h("th", {}, "Per application"), h("th", {}, "Per customer record"), h("th", {}, "Result"))),
        h("tbody", {}, ...matches.map(m => h("tr", { className: m.ok ? "" : "missing" }, h("th", { scope: "row" }, m.label), h("td", {}, m.form), h("td", {}, m.record),
          h("td", {}, h("span", { className: `chip ${m.ok ? "ok" : "bad"}` }, m.ok ? "Match" : "Differs")))))))
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
        const at = where(r.id);
        return h("tr", { className: `${blank || why.length ? "missing" : ""}${at.length ? " findable" : ""}${sel === r.id ? " sel" : ""}`, title: at.length ? "Click to show it in the PDF" : "",
          onclick: (e: Event) => { if (at.length && !(e.target as HTMLElement).matches("input")) locate(r.id); } },
          h("th", { scope: "row" }, r.label, r.required ? " *" : ""),
          h("td", {}, blank ? "Missing" : r.value === true ? "Yes" : val || h("span", { className: "muted" }, "—"),
            ...why.map(w => h("div", { className: "flag" }, w))),
          h("td", { className: "tick" }, val ? h("input", { type: "checkbox", title: "Checked", "aria-label": `${r.label} checked`, checked: checked.has(r.id),
            onchange: (e: Event) => { (e.target as HTMLInputElement).checked ? checked.add(r.id) : checked.delete(r.id); render(); } }) : ""));
      })))) : "";
    })),
    showPdf ? pdfPane() : ""),
  );
  if (showPdf && !pane!.pages.length) {
    const open = current!;
    text().then(m => m.renderPages(open.bytes, Math.min(pane!.el.clientWidth - 24, 860))).then(cs => {
      if (current !== open || !pane) return;
      pane.pages = cs.map((c, i) => h("div", { className: "pg", "aria-label": `Page ${i + 1}` }, c));
      pane.el.replaceChildren(...pane.pages);
      if (sel) locate(sel);
    });
  }
}

// ---- The PDF beside the data: click an answer to see it in the PDF ----
const where = (id: string) => [...boxes].filter(([n]) => n === id || n.startsWith(`${id}__`)).flatMap(([, b]) => b);
function pdfPane() {
  pane ??= { el: h("div", { className: "pdf-view", role: "region", "aria-label": "The PDF as received" }, h("p", { className: "muted" }, "Loading the PDF…")), pages: [] };
  return pane.el;
}
function locate(id: string) {
  sel = id;
  if (!showPdf) { showPdf = true; render(); return; }
  document.querySelectorAll(".sec tr.sel").forEach(e => e.classList.remove("sel"));
  render(); // marks the row
  if (!pane?.pages.length) return; // shown once the pages are drawn
  pane.el.querySelectorAll(".hl").forEach(e => e.remove());
  const marks = where(id).map(b => {
    const m = h("div", { className: "hl", style: `left:${(b.x / b.pw) * 100}%;top:${((b.ph - b.y - b.h) / b.ph) * 100}%;width:${(b.w / b.pw) * 100}%;height:${(b.h / b.ph) * 100}%` });
    pane!.pages[b.page]?.append(m);
    return m;
  });
  const first = marks[0];
  if (first) pane.el.scrollTo({ top: first.offsetTop + (first.parentElement as HTMLElement).offsetTop - pane.el.clientHeight / 3, behavior: "smooth" });
}

// ---- Submit to workflow (simulated: the real one would create an iBPM case) ----
async function submit() {
  const o = current!;
  const mail = o.mail ?? { id: crypto.randomUUID(), from: "Uploaded file", to: "", subject: o.result.template?.title ?? o.name, body: "", sent: Date.now(), file: { name: o.name, bytes: o.bytes }, status: "new" as const };
  mail.caseId = `TS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;
  mail.status = "processed";
  await saveMail(mail); o.mail = mail;
  toast(`Submitted to the workflow (iBPM) as case ${mail.caseId}.`); render(); renderInbox();
}

// ---- Delete ----
async function remove() {
  const { name, mail } = current!;
  if (!await ask("Delete this application?", `${mail ? `The email from ${mail.from} and its case, if any, will be removed from the mailbox` : `${name} will be closed`}. This cannot be undone.`, "Delete", "danger")) return;
  if (mail) await deleteMail(mail.id);
  current = undefined;
  $("#work").replaceChildren(h("div", { className: "empty-state" }, h("h2", {}, "Application deleted"), h("p", {}, "Select another email in the mailbox, or drop a PDF.")));
  renderInbox(); toast(`${name} deleted.`);
}

/** A small modal (native <dialog>): resolves true when the main button is pressed. */
function ask(title: string, text: string | Node, ok: string, cls = "primary", body: Node[] = []) {
  return new Promise<boolean>(done => {
    const d = h("dialog", { className: "modal" }, h("form", { method: "dialog" },
      h("h2", {}, title), typeof text === "string" ? h("p", {}, text) : text, ...body,
      h("div", { className: "modal-btns" }, h("button", { value: "cancel", formNoValidate: true }, "Cancel"), h("button", { value: "ok", className: cls }, ok)))) as HTMLDialogElement;
    d.onclose = () => { done(d.returnValue === "ok"); d.remove(); };
    document.body.append(d); d.showModal();
  });
}

const v0 = (x: unknown) => typeof x === "string" && x.trim() !== "";
const csv = (rows: Row[]) => ["section,question,key,value", ...rows.map(r => [r.section, r.label, r.id, show(r.value)].map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");

// ---- Upload ----
const take = async (f?: File) => { if (f) open(new Uint8Array(await f.arrayBuffer()), f.name); };
$<HTMLInputElement>("#pdfIn").onchange = e => { const el = e.target as HTMLInputElement; take(el.files?.[0]); el.value = ""; }; // so the same file can be chosen again
const drop = $("#drop");
addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
addEventListener("dragleave", () => drop.classList.remove("over"));
addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); take(e.dataTransfer?.files[0]); });

renderInbox();

import "./styles.css";
import { KINDS, buildPdf, extractPdf, hasOptions, importPdf, slug } from "./pdf";
import type { Extracted, Field, Kind, Template, Value, Values } from "./pdf";
import { GUARANTEE, SAMPLE } from "./sample";
import type { Line, Xfa } from "./text";

const text = () => import("./text"); // pdf.js is big: load it only when a PDF without fields needs reading

type View = "design" | "fill" | "extract";
const STORE = "pdf-template-studio";
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;

let t: Template = clone(GUARANTEE);
let values: Values = {};
let view: View = "design";
let filled: Uint8Array | undefined; // the last "Save filled PDF", so Extract can use it straight away
const auto = new WeakSet<Field>(); // fields whose key still follows their label
try { const s = localStorage.getItem(STORE); if (s) t = JSON.parse(s); } catch { /* storage blocked: start from the sample */ }

function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: (Node | string | false | undefined)[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v as EventListener);
    else if (k.includes("-") || k === "for") el.setAttribute(k, String(v));
    else (el as unknown as Record<string, unknown>)[k] = v;
  }
  el.append(...kids.filter((k): k is Node | string => !!k));
  return el;
}

function download(bytes: BlobPart, name: string, type: string) {
  const a = h("a", { href: URL.createObjectURL(new Blob([bytes], { type })), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---- Preview ----
let timer = 0, url = "";
function refresh(now = false) {
  try { localStorage.setItem(STORE, JSON.stringify(t)); } catch { /* fine: just not remembered */ }
  clearTimeout(timer);
  timer = window.setTimeout(async () => {
    const bytes = await buildPdf(t, view === "fill" ? values : {});
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
    $<HTMLIFrameElement>("#preview").src = url + "#toolbar=0&navpanes=0&view=FitH";
  }, now ? 0 : 450);
}

// ---- 1. Design ----
const unique = (base: string, self?: Field) => {
  const taken = new Set(t.sections.flatMap(s => s.fields).filter(f => f !== self).map(f => f.id));
  let id = base, n = 2;
  while (taken.has(id)) id = `${base}_${n++}`;
  return id;
};
function move<T>(list: T[], i: number, by: number) {
  const j = i + by;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
}

function fieldCard(list: Field[], f: Field, i: number): HTMLElement {
  if (t.base) return h("div", { className: "card" },
    h("input", { className: "label wide", value: f.label, "aria-label": "Question",
      oninput: (e: Event) => { f.label = (e.target as HTMLInputElement).value; refresh(); } }),
    h("div", { className: "row small" }, h("span", {}, KINDS[f.kind], f.options ? `: ${f.options.join(", ")}` : ""), h("code", { className: "key-ro" }, f.id)));
  const key = h("input", { className: "key", value: f.id, "aria-label": "JSON key", spellcheck: false,
    oninput: (e: Event) => { auto.delete(f); f.id = slug((e.target as HTMLInputElement).value); refresh(); },
    onchange: () => { f.id = unique(f.id, f); key.value = f.id; } });
  const opts = hasOptions(f.kind) && h("textarea", { className: "opts", rows: Math.max(2, f.options?.length ?? 2),
    value: (f.options ?? []).join("\n"), "aria-label": "Options, one per line", placeholder: "One option per line",
    oninput: (e: Event) => { f.options = (e.target as HTMLTextAreaElement).value.split("\n").map(s => s.trim()).filter(Boolean); refresh(); } });
  return h("div", { className: "card" },
    h("div", { className: "row" },
      h("input", { className: "label", value: f.label, "aria-label": "Question", placeholder: "Question",
        oninput: (e: Event) => {
          f.label = (e.target as HTMLInputElement).value;
          if (auto.has(f)) { f.id = unique(slug(f.label), f); key.value = f.id; }
          refresh();
        } }),
      h("select", { "aria-label": "Answer type", onchange: (e: Event) => {
        f.kind = (e.target as HTMLSelectElement).value as Kind;
        if (hasOptions(f.kind) && !f.options?.length) f.options = ["Yes", "No"];
        renderDesign(); refresh();
      } }, ...Object.entries(KINDS).map(([k, v]) => h("option", { value: k, selected: k === f.kind }, v))),
    ),
    opts,
    h("div", { className: "row small" },
      h("label", { className: "key-wrap" }, "Key ", key),
      h("label", { className: "half" }, h("input", { type: "checkbox", checked: !!f.half,
        onchange: (e: Event) => { f.half = (e.target as HTMLInputElement).checked; refresh(); } }), " Half width"),
      h("span", { className: "tools" },
        h("button", { type: "button", title: "Move up", "aria-label": "Move up", onclick: () => { move(list, i, -1); renderDesign(); refresh(); } }, "↑"),
        h("button", { type: "button", title: "Move down", "aria-label": "Move down", onclick: () => { move(list, i, 1); renderDesign(); refresh(); } }, "↓"),
        h("button", { type: "button", title: "Delete question", "aria-label": "Delete question", onclick: () => { list.splice(i, 1); renderDesign(); refresh(); } }, "✕"),
      ),
    ),
  );
}

function renderDesign() {
  const panel = $("#panel");
  const base = !!t.base;
  panel.replaceChildren(
    h("div", { className: "upload" },
      h("label", { className: "btn primary", for: "templateIn" }, "Upload your PDF template…"),
      h("span", {}, "Use a form you already have. Its fields are kept; on a printed-style form, fields are added over the blanks (____ and ☐)."),
    ),
    h("p", { className: "lead" }, base
      ? "Fields come from your PDF. Rename the questions so the answers are easy to read; the keys come from the PDF."
      : "Or build a form here: sections, then questions. Each answer gets a key, so you can pull it back out later."),
    h("label", { className: "lbl" }, "Form title", h("input", { value: t.title, oninput: (e: Event) => { t.title = (e.target as HTMLInputElement).value; refresh(); } })),
    base ? "" : h("label", { className: "lbl" }, "Instructions under the title", h("textarea", { rows: 2, value: t.note, oninput: (e: Event) => { t.note = (e.target as HTMLTextAreaElement).value; refresh(); } })),
    ...t.sections.map((s, si) => h("section", { className: "sec" },
      h("div", { className: "sec-head" },
        h("span", { className: "num" }, String(si + 1)),
        h("input", { value: s.title, "aria-label": "Section title", oninput: (e: Event) => { s.title = (e.target as HTMLInputElement).value; refresh(); } }),
        !base && h("span", { className: "tools" },
          h("button", { type: "button", title: "Move section up", "aria-label": "Move section up", onclick: () => { move(t.sections, si, -1); renderDesign(); refresh(); } }, "↑"),
          h("button", { type: "button", title: "Move section down", "aria-label": "Move section down", onclick: () => { move(t.sections, si, 1); renderDesign(); refresh(); } }, "↓"),
          h("button", { type: "button", title: "Delete section", "aria-label": "Delete section", onclick: () => { t.sections.splice(si, 1); renderDesign(); refresh(); } }, "✕"),
        ),
      ),
      ...s.fields.map((f, i) => fieldCard(s.fields, f, i)),
      !base && h("button", { type: "button", className: "add", onclick: () => {
        const f: Field = { id: unique("question"), label: "New question", kind: "text", half: true };
        auto.add(f); s.fields.push(f); renderDesign(); refresh();
        ($("#panel").querySelectorAll<HTMLInputElement>(".sec")[si].querySelectorAll<HTMLInputElement>(".label")[s.fields.length - 1]).select();
      } }, "+ Add question"),
    )),
    base ? "" : h("button", { type: "button", className: "add big", onclick: () => { t.sections.push({ title: "New section", fields: [] }); renderDesign(); refresh(); } }, "+ Add section"),
  );
}

// ---- 2. Fill ----
const toIso = (d: string) => { const m = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(d); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };
const fromIso = (d: string) => d ? d.split("-").reverse().join("/") : "";

function input(f: Field): HTMLElement {
  const v = values[f.id];
  const set = (x: Value) => { values[f.id] = x; refresh(); };
  const val = (e: Event) => (e.target as HTMLInputElement).value;
  switch (f.kind) {
    case "long": return h("textarea", { id: f.id, rows: 3, value: (v as string) ?? "", oninput: (e: Event) => set(val(e)) });
    case "date": return h("input", { id: f.id, type: "date", value: toIso((v as string) ?? ""), oninput: (e: Event) => set(fromIso(val(e))) });
    case "check": return h("input", { id: f.id, type: "checkbox", checked: v === true, onchange: (e: Event) => set((e.target as HTMLInputElement).checked) });
    case "select": return h("select", { id: f.id, onchange: (e: Event) => set((e.target as HTMLSelectElement).value) },
      h("option", { value: "" }, "Choose…"), ...(f.options ?? []).map(o => h("option", { value: o, selected: v === o }, o)));
    case "radio": case "checks": return h("div", { className: "choices", role: f.kind === "radio" ? "radiogroup" : "group", "aria-label": f.label },
      ...(f.options ?? []).map(o => h("label", {},
        h("input", { type: f.kind === "radio" ? "radio" : "checkbox", name: f.id, value: o,
          checked: Array.isArray(v) ? v.includes(o) : v === o,
          onchange: () => set(f.kind === "radio" ? o : (f.options ?? []).filter((_, i) =>
            document.querySelectorAll<HTMLInputElement>(`input[name="${f.id}"]`)[i].checked)) }), " ", o)));
    default: return h("input", { id: f.id, type: f.id.includes("email") ? "email" : "text", value: (v as string) ?? "", oninput: (e: Event) => set(val(e)) });
  }
}

function renderFill() {
  $("#panel").replaceChildren(
    h("p", { className: "lead" }, "Fill in the form as an applicant would. The preview is the real PDF. You can also download the blank PDF and fill it in Acrobat or Preview."),
    h("div", { className: "btns" },
      Object.keys(SAMPLE).some(k => t.sections.some(s => s.fields.some(f => f.id === k))) && h("button", { type: "button", onclick: () => { values = Object.fromEntries(Object.entries(SAMPLE).filter(([k]) => t.sections.some(s => s.fields.some(f => f.id === k)))); renderFill(); refresh(true); } }, "Fill with sample"),
      h("button", { type: "button", onclick: () => { values = {}; renderFill(); refresh(true); } }, "Clear"),
    ),
    ...t.sections.map((s, si) => h("fieldset", { className: "sec" },
      h("legend", {}, h("span", { className: "num" }, String(si + 1)), s.title),
      h("div", { className: "grid" }, ...s.fields.map(f => f.kind === "check"
        ? h("label", { className: "full tick" }, input(f), " ", f.label)
        : h(hasOptions(f.kind) ? "div" : "label", { className: f.half ? "q" : "q full", ...(hasOptions(f.kind) ? {} : { for: f.id }) },
          h("span", { className: "q-label" }, f.label), input(f)))),
    )),
  );
}

// ---- 3. Extract ----
const show = (v: Value) => v === true ? "Yes" : v === false ? "No" : Array.isArray(v) ? v.join(", ") : v;

function renderExtract(result?: Extracted, name?: string, lines?: Line[], note?: string) {
  const open = h("input", { type: "file", accept: "application/pdf,.pdf", id: "pdfIn", className: "sr", onchange: async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) read(new Uint8Array(await file.arrayBuffer()), file.name);
  } });
  const panel = $("#panel");
  panel.replaceChildren(
    h("p", { className: "lead" }, "Open any filled PDF, including your old ones, to pull every answer out, matched to its question."),
    h("div", { className: "btns" },
      h("label", { className: "btn primary", for: "pdfIn" }, "Open filled PDF…"), open,
      filled && h("button", { type: "button", onclick: () => read(filled!, "the form you just saved") }, "Use the form I just saved"),
    ),
    h("div", { className: "drop", id: "drop" }, "or drop a PDF here"),
  );
  if (!result) return;
  if (lines && !lines.length) {
    panel.append(h("p", { className: "error", role: "alert" }, `${name} has no form fields and no text. It looks like a scan, which would need OCR to read.`));
    return;
  }
  const json = JSON.stringify(result.data, null, 2);
  const bySection = new Map<string, Extracted["rows"]>();
  for (const r of result.rows) bySection.set(r.section, [...bySection.get(r.section) ?? [], r]);
  panel.append(
    h("p", { className: "note" }, `${result.rows.filter(r => show(r.value)).length} of ${result.rows.length} questions answered in ${name}. `,
      note ? note : lines ? "This PDF has no form fields, so answers were read from its text (\u201cLabel: value\u201d and ticked boxes). Check them against the PDF."
        : result.template ? "Questions matched using the template inside the PDF." : "Read from the PDF's form fields; their names or tooltips are used as questions."),
    ...[...bySection].map(([sec, rows]) => h("table", { className: "result" },
      sec && h("caption", {}, sec),
      h("tbody", {}, ...rows.map(r => h("tr", {}, h("th", { scope: "row" }, r.label), h("td", { className: show(r.value) ? "" : "empty" }, show(r.value) || "(blank)")))))),
    h("div", { className: "btns" },
      h("button", { type: "button", className: "primary", onclick: () => download(json, `${slug(result.template?.title ?? "form")}-answers.json`, "application/json") }, "Download JSON"),
      h("button", { type: "button", onclick: (e: Event) => { navigator.clipboard.writeText(json); (e.target as HTMLElement).textContent = "Copied"; } }, "Copy JSON"),
    ),
    h("pre", { className: "json" }, json),
    lines ? h("details", {}, h("summary", {}, "All text in the PDF"),
      h("pre", { className: "json" }, lines.map(l => l.segs.map(g => g.text).join("    ")).join("\n"))) : "",
  );
}

async function read(bytes: Uint8Array, name: string) {
  try {
    let r = await extractPdf(bytes).catch(() => undefined), lines: Line[] | undefined;
    const xfa = r?.rows.length ? undefined : await (await text()).readXfa(bytes);
    if (xfa) return showXfa(xfa, name, bytes);
    if (!r?.rows.length) {
      const { readText, pairs } = await text();
      lines = await readText(bytes);
      const seen = new Map<string, number>();
      r = { rows: pairs(lines).map(p => {
        const base = slug(p.label), n = (seen.get(base) ?? 0) + 1;
        seen.set(base, n);
        return { section: `Page ${p.page}`, id: n > 1 ? `${base}_${n}` : base, label: p.label, value: p.value };
      }), data: {} };
      for (const row of r.rows) r.data[row.id] = row.value;
    }
    renderExtract(r!, name, lines);
    showPdf(bytes);
  } catch (err) {
    renderExtract();
    $("#panel").append(h("p", { className: "error", role: "alert" }, `Could not read ${name}: ${(err as Error).message}`));
  }
}

function showPdf(bytes: Uint8Array) {
  if (url) URL.revokeObjectURL(url);
  url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  $<HTMLIFrameElement>("#preview").src = url + "#toolbar=0&navpanes=0&view=FitH";
}

// ---- Shell ----
function go(v: View) {
  view = v;
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.view === v)));
  ({ design: renderDesign, fill: renderFill, extract: () => renderExtract() })[v]();
  $("#panel").scrollTop = 0;
  refresh(true);
}

document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(b => b.onclick = () => go(b.dataset.view as View));
$("#blankBtn").onclick = async () => download(await buildPdf(t) as BlobPart, `${slug(t.title)}.pdf`, "application/pdf");
$("#saveBtn").onclick = async () => {
  filled = await buildPdf(t, values);
  download(filled as BlobPart, `${slug(t.title)}-filled.pdf`, "application/pdf");
};
$("#templateSel").onchange = async e => {
  const v = (e.target as HTMLSelectElement).value;
  (e.target as HTMLSelectElement).value = "";
  if (v === "open") return $("#templateIn").click();
  if (v && !confirmReplace()) return;
  if (v === "guarantee") t = clone(GUARANTEE);
  if (v === "blank") t = { title: "Untitled form", note: "", sections: [{ title: "Details", fields: [] }] };
  values = {};
  go("design");
};
$<HTMLInputElement>("#templateIn").onchange = async e => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  (e.target as HTMLInputElement).value = "";
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const m = await text(), xfa = await m.readXfa(bytes).catch(() => undefined);
    if (xfa) return pickXfaForm(xfa, file.name);
    const r = await importPdf(bytes, file.name, async () => { const m = await text(); return m.blanks(await m.readText(bytes)); });
    t = r.template; values = r.values; go("design");
    const n = t.sections.reduce((a, s) => a + s.fields.length, 0);
    if (r.found === "none") alertBox(`${file.name} has no form fields and no blanks (____ or ☐) to fill. Use Extract to read its text instead.`);
    else infoBox(r.found === "blanks"
      ? `${file.name} had no form fields, so ${n} were added over its blanks. Check the questions below, then Fill.`
      : `Read ${n} fields from ${file.name}. Any answers already in it are in Fill.`);
  } catch (err) {
    alertBox(`Could not read ${file.name}: ${(err as Error).message}`);
  }
};
/** Extract from an XFA bundle: one form at a time, the most filled-in first. */
async function showXfa(xfa: Xfa, name: string, bytes: Uint8Array, code?: string) {
  const m = await text(), forms = m.xfaForms(xfa).filter(f => f.count > 1).sort((a, b) => b.answered - a.answered);
  const pick = forms.find(f => f.code === code) ?? forms[0];
  const { template, values: v } = m.xfaTemplate(xfa, pick.code);
  const rows = template.sections.flatMap(s => s.fields.map(q => ({ section: s.title, id: q.id, label: q.label, value: v[q.id] })));
  renderExtract({ template, rows, data: v }, name, undefined,
    `Adobe smart form (XFA) with ${forms.length} forms. Showing ${pick.title}. Answers include any defaults built into the form.`);
  $("#panel").querySelector(".note")!.after(h("label", { className: "lbl" }, "Form in this file",
    h("select", { onchange: (e: Event) => showXfa(xfa, name, bytes, (e.target as HTMLSelectElement).value) },
      ...forms.map(f => h("option", { value: f.code, selected: f === pick }, `${f.title} (${f.answered} of ${f.count} filled)`)))));
  showPdf(bytes);
}

/** An XFA bundle holds many forms: let the person pick which one to rebuild here. */
async function pickXfaForm(xfa: Xfa, name: string) {
  const m = await text();
  go("design");
  $("#panel").replaceChildren(
    h("p", { className: "info", role: "status" }, `${name} is an Adobe smart form (XFA) with ${m.xfaForms(xfa).length} forms. Pick one to rebuild as a plain fillable PDF. Its questions, choices and drop-downs are kept; the layout is redrawn.`),
    h("div", { className: "picks" }, ...m.xfaForms(xfa).filter(f => f.count > 1).map(f => h("button", { type: "button", className: "pick", onclick: () => {
      const { template, values: v } = m.xfaTemplate(xfa, f.code);
      t = template; values = v; go("design");
      infoBox(`Rebuilt ${f.title}: ${f.count} questions. Rename questions or drop the ones you don't need, then Fill.`);
    } }, h("strong", {}, f.title), h("span", {}, `${f.count} questions${f.answered ? `, ${f.answered} answered` : ""}`)))),
  );
}

const confirmReplace = () => window.confirm("Replace the current form? Your changes to it will be lost.");
const alertBox = (msg: string) => $("#panel").prepend(h("p", { className: "error", role: "alert" }, msg));
const infoBox = (msg: string) => $("#panel").prepend(h("p", { className: "info", role: "status" }, msg));

// Drag a PDF anywhere onto Extract.
addEventListener("dragover", e => e.preventDefault());
addEventListener("drop", async e => {
  e.preventDefault();
  const file = e.dataTransfer?.files[0];
  if (file && view === "extract") read(new Uint8Array(await file.arrayBuffer()), file.name);
});

go("design");

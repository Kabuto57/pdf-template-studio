import "./styles.css";
import { KINDS, buildPdf, extractPdf, hasOptions, slug } from "./pdf";
import type { Extracted, Field, Kind, Template, Value, Values } from "./pdf";
import { GUARANTEE, SAMPLE } from "./sample";

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
  panel.replaceChildren(
    h("p", { className: "lead" }, "Build the form: sections, then questions. Each answer gets a key, so you can pull it back out later."),
    h("label", { className: "lbl" }, "Form title", h("input", { value: t.title, oninput: (e: Event) => { t.title = (e.target as HTMLInputElement).value; refresh(); } })),
    h("label", { className: "lbl" }, "Instructions under the title", h("textarea", { rows: 2, value: t.note, oninput: (e: Event) => { t.note = (e.target as HTMLTextAreaElement).value; refresh(); } })),
    ...t.sections.map((s, si) => h("section", { className: "sec" },
      h("div", { className: "sec-head" },
        h("span", { className: "num" }, String(si + 1)),
        h("input", { value: s.title, "aria-label": "Section title", oninput: (e: Event) => { s.title = (e.target as HTMLInputElement).value; refresh(); } }),
        h("span", { className: "tools" },
          h("button", { type: "button", title: "Move section up", "aria-label": "Move section up", onclick: () => { move(t.sections, si, -1); renderDesign(); refresh(); } }, "↑"),
          h("button", { type: "button", title: "Move section down", "aria-label": "Move section down", onclick: () => { move(t.sections, si, 1); renderDesign(); refresh(); } }, "↓"),
          h("button", { type: "button", title: "Delete section", "aria-label": "Delete section", onclick: () => { t.sections.splice(si, 1); renderDesign(); refresh(); } }, "✕"),
        ),
      ),
      ...s.fields.map((f, i) => fieldCard(s.fields, f, i)),
      h("button", { type: "button", className: "add", onclick: () => {
        const f: Field = { id: unique("question"), label: "New question", kind: "text", half: true };
        auto.add(f); s.fields.push(f); renderDesign(); refresh();
        ($("#panel").querySelectorAll<HTMLInputElement>(".sec")[si].querySelectorAll<HTMLInputElement>(".label")[s.fields.length - 1]).select();
      } }, "+ Add question"),
    )),
    h("button", { type: "button", className: "add big", onclick: () => { t.sections.push({ title: "New section", fields: [] }); renderDesign(); refresh(); } }, "+ Add section"),
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
      h("button", { type: "button", onclick: () => { values = Object.fromEntries(Object.entries(SAMPLE).filter(([k]) => t.sections.some(s => s.fields.some(f => f.id === k)))); renderFill(); refresh(true); } }, "Fill with sample"),
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

function renderExtract(result?: Extracted, name?: string) {
  const open = h("input", { type: "file", accept: "application/pdf,.pdf", id: "pdfIn", className: "sr", onchange: async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) read(new Uint8Array(await file.arrayBuffer()), file.name);
  } });
  const panel = $("#panel");
  panel.replaceChildren(
    h("p", { className: "lead" }, "Open a filled PDF to pull every answer out, matched to its question."),
    h("div", { className: "btns" },
      h("label", { className: "btn primary", for: "pdfIn" }, "Open filled PDF…"), open,
      filled && h("button", { type: "button", onclick: () => read(filled!, "the form you just saved") }, "Use the form I just saved"),
    ),
    h("div", { className: "drop", id: "drop" }, "or drop a PDF here"),
  );
  if (!result) return;
  const json = JSON.stringify(result.data, null, 2);
  const bySection = new Map<string, Extracted["rows"]>();
  for (const r of result.rows) bySection.set(r.section, [...bySection.get(r.section) ?? [], r]);
  panel.append(
    h("p", { className: "note" }, `${result.rows.length} answers from ${name}. `,
      result.template ? "Questions matched using the template inside the PDF." : "No template inside this PDF, so the field tooltips are used as questions."),
    ...[...bySection].map(([sec, rows]) => h("table", { className: "result" },
      sec && h("caption", {}, sec),
      h("tbody", {}, ...rows.map(r => h("tr", {}, h("th", { scope: "row" }, r.label), h("td", { className: show(r.value) ? "" : "empty" }, show(r.value) || "(blank)")))))),
    h("div", { className: "btns" },
      h("button", { type: "button", className: "primary", onclick: () => download(json, `${slug(result.template?.title ?? "form")}-answers.json`, "application/json") }, "Download JSON"),
      h("button", { type: "button", onclick: (e: Event) => { navigator.clipboard.writeText(json); (e.target as HTMLElement).textContent = "Copied"; } }, "Copy JSON"),
    ),
    h("pre", { className: "json" }, json),
  );
}

async function read(bytes: Uint8Array, name: string) {
  try {
    const r = await extractPdf(bytes);
    renderExtract(r, name);
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
    $<HTMLIFrameElement>("#preview").src = url + "#toolbar=0&navpanes=0&view=FitH";
  } catch (err) {
    renderExtract();
    $("#panel").append(h("p", { className: "error", role: "alert" }, `Could not read ${name}: ${(err as Error).message}`));
  }
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
  const r = await extractPdf(await file.arrayBuffer()).catch(() => undefined);
  if (!r?.template) return alertBox("That PDF was not made here, so it has no template to edit. Use Extract to read its answers.");
  t = r.template; values = r.data; go("design");
};
const confirmReplace = () => window.confirm("Replace the current form? Your changes to it will be lost.");
const alertBox = (msg: string) => $("#panel").prepend(h("p", { className: "error", role: "alert" }, msg));

// Drag a PDF anywhere onto Extract.
addEventListener("dragover", e => e.preventDefault());
addEventListener("drop", async e => {
  e.preventDefault();
  const file = e.dataTransfer?.files[0];
  if (file && view === "extract") read(new Uint8Array(await file.arrayBuffer()), file.name);
});

go("design");

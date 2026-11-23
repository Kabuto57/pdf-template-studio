// THE CANVAS (studio, Design step, for every form drawn in the smart-form layout)
//   left    Add: drag a kind of question (or a section) onto the page, or click it to add after the selection.
//           Outline: the sections, to jump to one.
//   middle  The pages, drawn exactly as lc-form builds them (layout.ts). Click a question or a section heading to
//           select it; drag to move it. The questions a selection depends on, and those depending on it, are
//           joined by blue lines.
//           The selection gets handles: drag a question's right edge to set its width (it snaps to the 12-column
//           grid), a paragraph box's bottom edge to set its height, a section's right edge for half or full width.
//           Its small toolbar adds a condition by clicking, on the page, the question it waits on (conditions.ts).
//   code    "Code" opens the form file beside the pages (code-pane.ts): each follows the other.
//   right   Properties of the selection (wording, answer type, width, mandatory and locking rules), or of the
//           form when nothing is selected. Review: what lc-form would refuse, and tips, most with a fix.
//           The code and the right-hand panel are resized by dragging their edge.
// The layout keeps to the smart forms' grid: a question's width is a share of 12 columns, a section is auto, full
// or half width, and may start a new page. That is all that can be changed, so every form stays in the house style.
// Keys: Delete removes, Esc deselects, Alt+Up/Down moves, Ctrl/Cmd+D duplicates, Ctrl/Cmd+Z undoes (Shift: redoes).
import { h } from "../dom";
import { BUTTONS, FORMATS, KINDS, hasOptions, type ButtonName, type Check, type Field, type Kind, type Rule, type Section, type Template, type Values } from "../pdf";
import { codePane, markLine, showCode } from "./code-pane";
import { conditionPopup, sayRule, type Effect } from "./conditions";
import { formFile, formFileName } from "./form-file";
import { readFormFile } from "./read-form-file";
import { allFields, dependents, locate, moveField, removeField, renameField, rulesOf, uniqueId } from "./edit";
import { LISTS } from "./forms";
import { BAND, COLUMN_GAP, H, M, PAD, SECTION_GAP, W, layout, type Laid } from "./layout";
import { pagesSvg } from "./render";
import { review, type Issue } from "./review";

export interface CanvasHost {
  form(): Template;
  /** The form's starting answers (the form file's DEFAULTS). */
  values(): Values;
  setValues(v: Values): void;
  /** The form changed (save it). */
  changed(): void;
}

type Sel = { si: number; id?: string } | undefined;
type Drop = { si: number; qi: number; page: number; x: number; y: number; h: number; vertical: boolean } | undefined;
type Dragged = { kind: "field"; id: string } | { kind: "new"; make: () => Field | Section } | { kind: "section"; si: number } | { kind: "button" };

const WIDTHS: [string, number | undefined][] = [["Auto", undefined], ["1/4", 3], ["1/3", 4], ["1/2", 6], ["2/3", 8], ["3/4", 9], ["Full", 12]];
const FORMAT_NAMES: Record<string, string> = { number: "Whole number", amount: "Amount", phone: "Phone", account: "Account no.", cif: "C.I.F. (7 digits)", ref12: "Reference (12 digits)", fx8: "FX contract (8 digits)", fx2: "FX sequence (2 digits)", swift: "SWIFT address" };
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

let host: CanvasHost, root: HTMLElement, laid: Laid | undefined, sel: Sel, zoom = 1, tab: "props" | "review" = "props", showAllLogic = false;
const undo: string[] = [], redo: string[] = [];
let typing = false; // an inspector box is being typed in: one undo step for the whole edit
const autoKey = new WeakSet<Field>(); // new questions whose key follows their wording until the key is edited
let picking: string | undefined; // adding a condition to this question: waiting for a click on the question it waits on
const remembered = (key: string) => { try { return localStorage.getItem(`cv-${key}`); } catch { return null; } };
const remember = (key: string, v: string) => { try { localStorage.setItem(`cv-${key}`, v); } catch { /* not remembered */ } };
let codeOpen = remembered("code") === "1";

const t = () => host.form();
const num = (id: string) => { const at = locate(t(), id); return at ? `${at.si + 1}.${at.qi + 1}` : "?"; };

// ---- history
function snapshot() {
  undo.push(JSON.stringify(t()));
  if (undo.length > 100) undo.shift();
  redo.length = 0;
}
/** Every change goes through here: remember the form for Undo, change it, redraw. */
function edit(change: (f: Template) => void, keepPanel = false) {
  if (!typing) snapshot();
  change(t());
  host.changed();
  render(keepPanel);
}
function restore(from: string[], to: string[]) {
  const prev = from.pop();
  if (!prev) return;
  to.push(JSON.stringify(t()));
  const form = t() as unknown as Record<string, unknown>; // changed in place: the studio holds this object
  for (const k of Object.keys(form)) delete form[k];
  Object.assign(form, JSON.parse(prev));
  if (sel && !t().sections[sel.si]) sel = undefined;
  if (sel?.id && !locate(t(), sel.id)) sel = { si: sel.si };
  host.changed();
  render();
}

// ---- new things
const SAMPLE_OPTIONS = ["Yes", "No"];
function newField(kind: Kind): Field {
  const label = { text: "New question", long: "Details", date: "Date", radio: "Choose one", checks: "Tick all that apply", check: "Tick if it applies", select: "Choose from the list" }[kind];
  const f: Field = { id: uniqueId(t(), label), label, kind };
  if (kind === "text") Object.assign(f, { half: true, max: 35 });
  if (hasOptions(kind)) f.options = [...SAMPLE_OPTIONS];
  autoKey.add(f);
  return f;
}
const NEW_SECTIONS: [string, () => Section][] = [
  ["Section", () => ({ title: "New section", fields: [newField("text")] })],
  ["Bank use section", () => ({ title: "For Bank Use Only", bankOnly: true, fields: [{ id: uniqueId(t(), "bank_reference"), label: "Bank reference", kind: "text", half: true, max: 35 }] })],
  ["Signature section", () => ({ title: "Authorised Signature(s)", signoff: true, fields: [{ id: uniqueId(t(), "signatory_name"), label: "Name of authorised signatory", kind: "text", half: true, max: 35 }] })],
];
/** Where an added question goes: after the selected question, else at the end of the selected (or last) section. */
function addField(f: Field) {
  edit(form => {
    if (!form.sections.length) form.sections.push({ title: "Details", fields: [] });
    const at = sel?.id ? locate(form, sel.id) : undefined;
    const si = at?.si ?? sel?.si ?? form.sections.length - 1;
    form.sections[si].fields.splice(at ? at.qi + 1 : form.sections[si].fields.length, 0, f);
    sel = { si, id: f.id };
  });
  focusLabel();
}
function addSection(s: Section, at = sel ? sel.si + 1 : t().sections.length) {
  edit(form => { form.sections.splice(at, 0, s); sel = { si: at }; });
}
/** Adds the first button the section doesn't have yet (Check form, then Reset form, ...). */
function addButton(si = sel?.si ?? t().sections.length - 1) {
  const s = t().sections[si];
  const next = (Object.keys(BUTTONS) as ButtonName[]).find(b => !s?.buttons?.includes(b));
  if (!s || !next) return;
  edit(() => { (s.buttons ??= []).push(next); sel = { si }; });
}

// ---- mount
export function mountCanvas(el: HTMLElement, h_: CanvasHost) {
  host = h_;
  root = el;
  addEventListener("keydown", keys);
  new ResizeObserver(() => sizePages()).observe(el);
}

/** Selects nothing (a different form was opened). */
export function resetCanvas() { sel = undefined; undo.length = redo.length = 0; }

export function render(keepPanel = false) {
  laid = layout(t());
  const issues = review(t(), laid);
  if (!root.firstChild) build();
  drawPages();
  drawOutline();
  if (!keepPanel) drawPanel(issues);
  else updateReviewCount(issues);
  if (codeOpen) { showCode(codeText()); markSelection(); }
}

const codeText = () => formFile(t(), host.values(), t().pdfName, t().file ?? formFileName(t()));
/** The code was edited and reads: it becomes the form (changed in place: the studio holds this object). */
function applyCode(code: string) {
  const read = readFormFile(code);
  snapshot();
  const form = t() as unknown as Record<string, unknown>, keep = { file: t().file };
  for (const k of Object.keys(form)) delete form[k];
  Object.assign(form, read.template, keep, read.pdfName ? { pdfName: read.pdfName } : {});
  host.setValues(read.defaults);
  if (sel && !t().sections[sel.si]) sel = undefined;
  if (sel?.id && !locate(t(), sel.id)) sel = { si: sel.si };
  host.changed();
  render();
}
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function markSelection() {
  if (!codeOpen) return;
  if (sel?.id) markLine(new RegExp(`^\\s*\\w+\\(${escapeRe(JSON.stringify(sel.id))}`));
  else if (sel) markLine(new RegExp(`^\\s*section\\(${escapeRe(JSON.stringify(t().sections[sel.si]?.title ?? ""))}`));
  else markLine();
}
function toggleCode(open = !codeOpen) {
  codeOpen = open;
  remember("code", open ? "1" : "0");
  root.classList.toggle("code-open", open);
  document.getElementById("cvCodeBtn")!.setAttribute("aria-pressed", String(open));
  if (open) { showCode(codeText()); markSelection(); }
  sizePages();
}

/** A bar between two panes: dragging it sets the CSS width `name` on the canvas (and remembers it). */
function splitter(name: string, min: number, max: number, grow: 1 | -1) {
  const bar = h("div", { className: `cv-split ${name}`, role: "separator", "aria-label": "Drag to resize", tabIndex: 0 });
  const saved = remembered(name);
  if (saved) root.style.setProperty(`--${name}`, `${saved}px`);
  const set = (w: number) => { w = Math.round(Math.min(max, Math.max(min, w))); root.style.setProperty(`--${name}`, `${w}px`); remember(name, String(w)); sizePages(); };
  const pane = () => (grow > 0 ? bar.previousElementSibling : bar.nextElementSibling) as HTMLElement;
  bar.onpointerdown = e => {
    e.preventDefault();
    const x0 = e.clientX, w0 = pane().getBoundingClientRect().width;
    bar.setPointerCapture(e.pointerId);
    bar.onpointermove = ev => set(w0 + grow * (ev.clientX - x0));
    bar.onpointerup = () => { bar.onpointermove = bar.onpointerup = null; };
  };
  bar.onkeydown = e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") set(pane().getBoundingClientRect().width + (e.key === "ArrowRight" ? 20 : -20) * grow); };
  return bar;
}

function build() {
  const palette = h("div", { className: "cv-palette" },
    h("h2", {}, "Add"),
    h("div", { className: "cv-kinds" }, ...(Object.keys(KINDS) as Kind[]).map(k => paletteItem(KINDS[k], glyph(k), () => newField(k), f => addField(f as Field)))),
    h("div", { className: "cv-kinds" }, ...NEW_SECTIONS.map(([name, make]) => paletteItem(name, glyph(name), make, s => addSection(s as Section))), buttonItem()),
  );
  root.classList.toggle("code-open", codeOpen);
  root.replaceChildren(
    h("aside", { className: "cv-left", "aria-label": "Add and outline" }, palette, h("h2", {}, "Outline"), h("ol", { className: "cv-outline", id: "cvOutline" })),
    h("div", { className: "cv-code" }, codePane({
      apply: applyCode,
      pick: ({ id, title }) => {
        const at = id ? locate(t(), id) : undefined, si = at?.si ?? t().sections.findIndex(s => s.title === title);
        if (si < 0) return;
        select(at ? { si, id } : { si });
        scrollTo(si, at ? id : undefined);
      },
    })),
    splitter("code-w", 280, 1100, 1),
    h("div", { className: "cv-stage" },
      h("div", { className: "cv-bar" },
        h("button", { type: "button", id: "cvCodeBtn", className: "cv-code-btn", "aria-pressed": String(codeOpen), title: "Show the form file beside the pages", onclick: () => toggleCode() }, "Code"),
        h("span", { className: "cv-sep" }),
        h("button", { type: "button", id: "cvUndo", title: "Undo (Ctrl/Cmd+Z)", onclick: () => restore(undo, redo) }, "Undo"),
        h("button", { type: "button", id: "cvRedo", title: "Redo (Shift+Ctrl/Cmd+Z)", onclick: () => restore(redo, undo) }, "Redo"),
        h("span", { className: "cv-sep" }),
        h("button", { type: "button", title: "Zoom out", "aria-label": "Zoom out", onclick: () => setZoom(zoom / 1.2) }, "−"),
        h("span", { id: "cvZoom", className: "cv-zoom" }, "100%"),
        h("button", { type: "button", title: "Zoom in", "aria-label": "Zoom in", onclick: () => setZoom(zoom * 1.2) }, "+"),
        h("button", { type: "button", onclick: () => setZoom(1) }, "Fit width"),
        h("span", { className: "cv-sep" }),
        h("label", { className: "cv-toggle" }, h("input", { type: "checkbox", onchange: (e: Event) => { showAllLogic = (e.target as HTMLInputElement).checked; drawLogic(); } }), "Show all conditions"),
        h("span", { id: "cvPages", className: "cv-meta" }),
      ),
      h("div", { className: "cv-pickbar", id: "cvPickBar", hidden: true }),
      h("div", { className: "cv-scroll", id: "cvScroll", onpointerdown: (e: PointerEvent) => { if ((e.target as HTMLElement).closest(".cv-hit, .cv-pop, .cv-float")) return; if (picking) return stopPick(); select(undefined); } }),
    ),
    splitter("panel-w", 280, 720, -1),
    h("aside", { className: "cv-right" },
      h("div", { className: "cv-tabs", role: "tablist" },
        h("button", { type: "button", role: "tab", id: "cvTabProps", onclick: () => { tab = "props"; render(); } }, "Properties"),
        h("button", { type: "button", role: "tab", id: "cvTabReview", onclick: () => { tab = "review"; render(); } }, "Review ", h("span", { className: "cv-count", id: "cvCount" })),
      ),
      h("div", { className: "cv-panel", id: "cvPanel", role: "tabpanel" }),
    ),
  );
}

/** The Button item: drop it on a section (or click it) to add a button row to that section. */
function buttonItem() {
  const b = h("button", { type: "button", className: "cv-kind", title: "Add a button (Check form, Reset form, Generate QR Code or Print Form) to a section. Drag it onto a section, or click it to add it to the selected one." }, glyph("Button"), h("span", {}, "Button"));
  b.onpointerdown = e => startDrag(e, b, { kind: "button" }, "Button", () => addButton());
  return b;
}

function paletteItem(name: string, icon: SVGElement, make: () => Field | Section, add: (x: Field | Section) => void) {
  const b = h("button", { type: "button", className: "cv-kind", title: `Add: ${name}. Or drag it onto the page.` }, icon, h("span", {}, name));
  b.onpointerdown = e => startDrag(e, b, { kind: "new", make }, name, () => add(make()));
  return b;
}

/** Small pictures of each kind, drawn like the form itself. */
function glyph(kind: string): SVGElement {
  const paths: Record<string, string> = {
    text: '<rect x="1.5" y="6" width="17" height="8"/>',
    long: '<rect x="1.5" y="2.5" width="17" height="15"/><path d="M4 7h10M4 10h12M4 13h7"/>',
    date: '<rect x="1.5" y="4" width="17" height="13"/><path d="M1.5 8h17M6 2v4M14 2v4"/>',
    radio: '<circle cx="5" cy="10" r="3.5"/><circle cx="5" cy="10" r="1.2" fill="currentColor"/><circle cx="14" cy="10" r="3.5"/>',
    checks: '<rect x="1.5" y="6.5" width="7" height="7"/><path d="M3 10l1.6 1.6L7.5 8"/><rect x="11.5" y="6.5" width="7" height="7"/>',
    check: '<rect x="5.5" y="5.5" width="9" height="9"/><path d="M7.5 10l2 2 3.5-4"/>',
    select: '<rect x="1.5" y="6" width="17" height="8"/><path d="M12.5 9l2 2 2-2"/>',
    Section: '<rect x="1.5" y="3" width="17" height="14"/><path d="M1.5 6.5h17" stroke-width="2.5"/>',
    "Bank use section": '<rect x="1.5" y="3" width="17" height="14" fill="#e6e6e6"/><path d="M1.5 6.5h17" stroke-width="2.5"/>',
    Button: '<rect x="1.5" y="6" width="17" height="8" rx="1" fill="currentColor"/><path d="M6 10h8" stroke="#fff"/>',
    "Signature section": '<path d="M2 14c2-5 3-5 4 0s2 0 3-2 2 2 3 2M2 16.5h9"/><rect x="13" y="9" width="5.5" height="8" stroke-dasharray="1.5 1.2"/>',
  };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `<g fill="none" stroke="currentColor" stroke-width="1.3">${paths[kind] ?? ""}</g>`;
  return svg;
}

// ---- the pages
function drawPages() {
  const scroll = document.getElementById("cvScroll")!;
  const svgs = pagesSvg(laid!);
  scroll.replaceChildren(...svgs.map((svg, p) => {
    const page = h("div", { className: "cv-page", "data-page": String(p) });
    page.innerHTML = svg;
    const ov = h("div", { className: "cv-ov" });
    for (const s of laid!.sections.filter(s => s.page === p)) {
      const box = hit("cv-sec", s.x, s.y, s.w, s.h, { "data-si": String(s.si), title: t().sections[s.si]?.title ?? "" });
      const band = hit("cv-band", s.x, s.y + s.h - BAND, s.w, BAND, { "data-si": String(s.si), title: `Section ${s.si + 1}: drag to move` });
      box.onpointerdown = e => { if (e.target === box) { e.stopPropagation(); select({ si: s.si }); } };
      band.onpointerdown = e => startDrag(e, band, { kind: "section", si: s.si }, t().sections[s.si].title, () => select({ si: s.si }));
      ov.append(box, band);
    }
    for (const q of laid!.questions.filter(q => q.page === p)) {
      const f = locate(t(), q.id)?.field;
      const box = hit("cv-q", q.x - 2, q.y - 1, q.w + 4, q.h + 2, { "data-id": q.id, title: `${num(q.id)} ${f?.label ?? ""}` });
      if (f && rulesOf(f).length) box.classList.add("cond");
      box.onpointerdown = e => {
        if (picking) { e.stopPropagation(); return pickTrigger(q.id); }
        startDrag(e, box, { kind: "field", id: q.id }, f?.label ?? q.id, () => select({ si: q.si, id: q.id }));
      };
      box.ondblclick = () => focusLabel();
      ov.append(box);
    }
    for (const f of laid!.fields.filter(f => f.type === "button" && f.name.startsWith("__s"))) // a section's buttons
      for (const w of f.widgets.filter(w => w.page === p)) {
        const si = parseInt(f.name.slice(3), 10) - 1, [x1, y1, x2, y2] = w.rect;
        const b = hit("cv-btn", x1, y1, x2 - x1, y2 - y1, { title: `${w.caption}: a button of section ${si + 1}. Click to change the section's buttons.` });
        b.onpointerdown = e => { e.stopPropagation(); select({ si }); requestAnimationFrame(() => document.getElementById("cvButtons")?.scrollIntoView({ block: "center" })); };
        ov.append(b);
      }
    if (p >= laid!.lastQuestionPage + 1) page.classList.add("cv-qr");
    page.append(ov);
    return page;
  }));
  document.getElementById("cvPages")!.textContent = `${laid!.pages.length} pages, the last for the QR code`;
  root.classList.toggle("picking", !!picking);
  sizePages();
  paintSelection();
}

const hit = (cls: string, x: number, y: number, w: number, hh: number, props: Record<string, string>) => {
  const el = h("div", { className: `cv-hit ${cls}`, ...props });
  Object.assign(el.style, { left: pct(x, W), top: pct(H - y - hh, H), width: pct(w, W), height: pct(hh, H) });
  return el;
};

function sizePages() {
  const scroll = document.getElementById("cvScroll");
  if (!scroll) return;
  const fit = Math.min(900, scroll.clientWidth - 48);
  scroll.style.setProperty("--page-w", `${Math.max(240, fit * zoom)}px`);
  document.getElementById("cvZoom")!.textContent = `${Math.round(zoom * 100)}%`;
  drawLogic();
}
const setZoom = (z: number) => { zoom = Math.min(3, Math.max(0.4, z)); sizePages(); };

/** Selecting changes no layout: only the highlights, the outline and the panel. */
function select(s: Sel) {
  sel = s;
  if (s) tab = "props";
  paintSelection();
  drawOutline();
  drawPanel(review(t(), laid));
  markSelection();
}

function paintSelection() {
  document.querySelectorAll(".cv-hit.sel, .cv-hit.rel").forEach(el => el.classList.remove("sel", "rel"));
  if (sel?.id) {
    document.querySelectorAll(`.cv-q[data-id="${CSS.escape(sel.id)}"]`).forEach(el => el.classList.add("sel"));
    const f = locate(t(), sel.id)?.field;
    const related = new Set([...(f ? rulesOf(f).map(r => r.field) : []), ...dependents(t(), sel.id).map(d => d.id)]);
    for (const id of related) document.querySelectorAll(`.cv-q[data-id="${CSS.escape(id)}"]`).forEach(el => el.classList.add("rel"));
  } else if (sel) document.querySelectorAll(`.cv-sec[data-si="${sel.si}"]`).forEach(el => el.classList.add("sel"));
  document.querySelectorAll<HTMLElement>("#cvOutline li").forEach((li, i) => li.classList.toggle("on", sel?.si === i));
  drawLogic();
  drawHandles();
}

/** Blue lines from each condition's question to the question it switches on (the selection's, or all). */
function drawLogic() {
  document.querySelectorAll(".cv-logic").forEach(el => el.remove());
  if (!laid) return;
  const pairs = new Set<string>(); // "trigger>follow-up" (keys never hold ">")
  for (const f of allFields(t())) for (const r of rulesOf(f))
    if (showAllLogic || (sel?.id && (sel.id === f.id || sel.id === r.field))) pairs.add(`${r.field}>${f.id}`);
  const byPage = new Map<number, string[]>();
  for (const pair of pairs) {
    const [a, b] = pair.split(">");
    const qa = laid.questions.find(q => q.id === a), qb = laid.questions.find(q => q.id === b);
    if (!qa || !qb || qa.page !== qb.page) continue;
    // from the trigger's left edge, curving out into the margin, to the follow-up's left edge
    const ax = qa.x - 3, ay = H - (qa.y + qa.h / 2), bx = qb.x - 3, by = H - (qb.y + qb.h / 2);
    const bend = Math.min(30, 10 + Math.abs(by - ay) / 6);
    (byPage.get(qa.page) ?? byPage.set(qa.page, []).get(qa.page)!).push(
      `<path d="M${ax} ${ay}C${ax - bend} ${ay} ${bx - bend} ${by} ${bx} ${by}" marker-end="url(#cvArrow)"/>`);
  }
  for (const [p, paths] of byPage) {
    const page = document.querySelector(`.cv-page[data-page="${p}"]`);
    if (!page) continue;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "cv-logic");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = `<defs><marker id="cvArrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L6 3 0 6z" fill="currentColor"/></marker></defs>${paths.join("")}`;
    page.append(svg);
  }
}

// ---- the selection's handles and toolbar
/** The page overlay and box (PDF points) of the selection, on the first page it is on. */
function selectionBox() {
  if (!laid || !sel) return undefined;
  const box = sel.id ? laid.questions.find(q => q.id === sel!.id) : laid.sections.find(s => s.si === sel!.si);
  const ov = box && document.querySelector<HTMLElement>(`.cv-page[data-page="${box.page}"] .cv-ov`);
  return box && ov ? { box, ov } : undefined;
}

function drawHandles() {
  document.querySelectorAll(".cv-handle, .cv-float").forEach(el => el.remove());
  const at = selectionBox();
  if (!at || picking) return;
  const { box, ov } = at;
  const f = sel!.id ? locate(t(), sel!.id)?.field : undefined;
  const handle = (edge: "e" | "s", label: string) => {
    const x = edge === "e" ? box.x + box.w : box.x + box.w / 2, y = edge === "e" ? box.y + box.h / 2 : box.y;
    const el = hit(`cv-handle ${edge}`, x, y, 0, 0, { title: label, "aria-label": label }); // sized in CSS: the same at any zoom
    el.onpointerdown = e => resize(e, el, edge);
    ov.append(el);
  };
  if (f) {
    handle("e", "Drag to set the width (snaps to the 12-column grid)");
    if (f.kind === "long") handle("s", "Drag to set the box's height");
    // the small toolbar above the question
    const bar = h("div", { className: "cv-float" },
      h("button", { type: "button", onclick: () => startPick(f.id), title: "Click, on the page, the question this one waits on" }, "Add condition"),
      h("button", { type: "button", "aria-pressed": String(!!f.required), onclick: () => edit(() => { if (f.required) delete f.required; else { f.required = true; delete f.requiredIf; } }) }, "Mandatory"),
      h("button", { type: "button", onclick: duplicate, title: "Duplicate (Ctrl/Cmd+D)" }, "Duplicate"),
      h("button", { type: "button", className: "danger", onclick: deleteSelection, title: "Delete (Delete key)" }, "Delete"));
    Object.assign(bar.style, { left: pct(box.x, W), bottom: pct(box.y + box.h + 3, H) });
    bar.onpointerdown = e => e.stopPropagation();
    ov.append(bar);
  } else if (!t().sections[sel!.si]?.signoff) handle("e", "Drag to make the section half or full width"); // signature blocks stay full width
}

/** Dragging a handle: a question's width in grid columns, a paragraph box's height, a section's half / full width. */
function resize(e: PointerEvent, el: HTMLElement, edge: "e" | "s") {
  e.preventDefault();
  e.stopPropagation();
  const at = selectionBox()!, { box, ov } = at, page = ov.parentElement!;
  const f = sel!.id ? locate(t(), sel!.id)!.field : undefined, s = t().sections[sel!.si];
  const scale = () => page.getBoundingClientRect().width / W;
  const ghost = hit("cv-ghostbox", box.x, box.y, box.w, box.h, {}), tag = h("span", { className: "cv-tag" });
  ghost.append(tag);
  ov.append(ghost);
  const place = (x: number, y: number, w: number, hh: number, say: string) => {
    Object.assign(ghost.style, { left: pct(x, W), top: pct(H - y - hh, H), width: pct(w, W), height: pct(hh, H) });
    tag.textContent = say;
  };

  // the grid of the question's row: columns from the row's left edge to the section's inner right edge
  const row = f && laid!.rows.find(r => r.ids.includes(f.id));
  const sec = laid!.sections.find(x => x.si === sel!.si && x.page === box.page)!;
  const rowLeft = row ? laid!.questions.find(q => q.id === row.ids[0] && q.page === box.page)?.x ?? box.x : box.x;
  const of = row?.of ?? 12, colW = (sec.x + sec.w - PAD - rowLeft - (of - 1) * COLUMN_GAP) / of;
  if (f && edge === "e") ov.append(...Array.from({ length: of }, (_, i) => hit("cv-col", rowLeft + i * (colW + COLUMN_GAP), sec.y, colW, sec.h, {})));
  const halfW = (W - 2 * M - SECTION_GAP) / 2;

  let result: () => void = () => {};
  const x0 = e.clientX, y0 = e.clientY;
  el.setPointerCapture(e.pointerId);
  el.onpointermove = ev => {
    const dx = (ev.clientX - x0) / scale(), dy = (ev.clientY - y0) / scale();
    if (f && edge === "e") {
      const n = Math.max(1, Math.min(of, Math.round((box.w + dx + COLUMN_GAP) / (colW + COLUMN_GAP))));
      place(box.x, box.y, n * colW + (n - 1) * COLUMN_GAP, box.h, `${n} of ${of} columns`);
      result = () => edit(() => { f.cols = n; });
    } else if (f && edge === "s") {
      const base = f.height || 50, hh = Math.round(Math.max(20, Math.min(600, base + dy)));
      const tall = box.h - base + hh; // the top stays; the box (and any extra room the layout gave it) grows from it
      place(box.x, box.y + box.h - tall, box.w, tall, `${hh} pt tall`);
      result = () => edit(() => { if (hh === 50) delete f.height; else f.height = hh; });
    } else {
      const half = box.w + dx < (W - 2 * M) * 0.75;
      place(box.x, box.y, half ? halfW : W - 2 * M, box.h, half ? "Half width" : "Full width");
      result = () => edit(() => { s.width = half ? "half" : "full"; if (half && s.signoff) delete s.width; });
    }
  };
  el.onpointerup = el.onpointercancel = ev => {
    el.onpointermove = el.onpointerup = el.onpointercancel = null;
    ov.querySelectorAll(".cv-ghostbox, .cv-col").forEach(x => x.remove());
    if (ev.type === "pointerup") result();
  };
}

// ---- adding a condition by clicking on the page
function startPick(id: string) {
  picking = id;
  const f = locate(t(), id)!.field;
  const bar = document.getElementById("cvPickBar")!;
  bar.replaceChildren(h("span", {}, `Click the question that ${num(id)} "${f.label.length > 50 ? `${f.label.slice(0, 48)}…` : f.label}" waits on.`),
    h("button", { type: "button", onclick: stopPick }, "Cancel"));
  bar.hidden = false;
  root.classList.add("picking");
  drawHandles();
}
function stopPick() {
  picking = undefined;
  document.getElementById("cvPickBar")!.hidden = true;
  document.querySelectorAll(".cv-pop").forEach(el => el.remove());
  root.classList.remove("picking");
  drawHandles();
}
function pickTrigger(triggerId: string) {
  const target = picking && locate(t(), picking)?.field, trigger = locate(t(), triggerId)?.field;
  const box = laid?.questions.find(q => q.id === triggerId);
  if (!target || !trigger || !box || triggerId === target.id) return;
  document.querySelectorAll(".cv-pop").forEach(el => el.remove());
  const pop = conditionPopup(trigger, target, num(triggerId), (rule: Rule, effect: Effect) => {
    const id = target.id;
    stopPick();
    edit(() => {
      if (effect === "mandatory") { delete target.required; (target.requiredIf ??= []).push(rule); }
      else (target.activeIf ??= []).push(rule);
      sel = { si: locate(t(), id)!.si, id };
    });
  }, stopPick);
  // beside the clicked question, kept inside the canvas (fixed, so no pane cuts it off); scrolling closes it
  const r = document.querySelector(`.cv-q[data-id="${CSS.escape(triggerId)}"]`)!.getBoundingClientRect();
  const stage = document.getElementById("cvScroll")!.getBoundingClientRect();
  pop.onpointerdown = e => e.stopPropagation();
  document.body.append(pop);
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  const left = r.right + 8 + pw <= stage.right ? r.right + 8 : Math.max(stage.left + 8, r.left - 8 - pw);
  Object.assign(pop.style, { left: `${left}px`, top: `${Math.max(stage.top + 8, Math.min(r.top, innerHeight - ph - 8))}px` });
  document.getElementById("cvScroll")!.addEventListener("scroll", () => pop.remove(), { once: true });
  pop.querySelector<HTMLButtonElement>(".primary")?.focus();
}

// ---- dragging (questions, sections, and new things from the palette)
function startDrag(e: PointerEvent, el: HTMLElement, what: Dragged, name: string, click: () => void) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const x0 = e.clientX, y0 = e.clientY;
  let ghost: HTMLElement | undefined, drop: Drop | number | undefined;
  el.setPointerCapture(e.pointerId);
  el.onpointermove = ev => {
    if (!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
    ghost ??= document.body.appendChild(h("div", { className: "cv-ghost" }, name.length > 40 ? `${name.slice(0, 38)}…` : name));
    Object.assign(ghost.style, { left: `${ev.clientX + 12}px`, top: `${ev.clientY + 10}px` });
    if (what.kind === "button") { // onto a section: outline the section it would go to
      const at = pointAt(ev), s = at && laid!.sections.find(x => x.page === at.page && at.x >= x.x && at.x <= x.x + x.w && at.y >= x.y && at.y <= x.y + x.h);
      document.querySelectorAll(".cv-sec.target").forEach(x => x.classList.remove("target"));
      if (s) document.querySelectorAll(`.cv-sec[data-si="${s.si}"]`).forEach(x => x.classList.add("target"));
      drop = s ? { si: s.si, qi: 0, page: s.page, x: 0, y: 0, h: 0, vertical: false } : undefined;
      autoScroll(ev);
      return;
    }
    const section = what.kind === "section" || (what.kind === "new" && isSectionMaker(what.make));
    drop = section ? sectionDropAt(ev) : fieldDropAt(ev);
    showDrop(drop);
    autoScroll(ev);
  };
  el.onpointerup = el.onpointercancel = ev => {
    el.onpointermove = el.onpointerup = el.onpointercancel = null;
    ghost?.remove();
    showDrop(undefined);
    document.querySelectorAll(".cv-sec.target").forEach(x => x.classList.remove("target"));
    if (!ghost) return click();
    if (ev.type === "pointercancel" || drop === undefined) return;
    finishDrop(what, drop);
  };
}
const isSectionMaker = (make: () => unknown) => NEW_SECTIONS.some(([, m]) => m === make);

/** The page and point (PDF points) under the pointer. */
function pointAt(ev: PointerEvent) {
  const page = (document.elementsFromPoint(ev.clientX, ev.clientY).find(el => el.classList.contains("cv-page")) as HTMLElement | undefined);
  if (!page) return undefined;
  const r = page.getBoundingClientRect();
  return { page: +page.dataset.page!, x: ((ev.clientX - r.left) / r.width) * W, y: H - ((ev.clientY - r.top) / r.height) * H };
}

/** Where a question would land: before or after the nearest question in reading order, or at a section's end. */
function fieldDropAt(ev: PointerEvent): Drop {
  const at = pointAt(ev);
  if (!at || !laid) return undefined;
  const qs = laid.questions.filter(q => q.page === at.page);
  const inRow = qs.filter(q => at.y >= q.y - 2 && at.y <= q.y + q.h + 2);
  const near = (inRow.length ? inRow : qs).reduce<(typeof qs)[number] | undefined>((best, q) => {
    const d = (q2: typeof q) => Math.hypot(Math.max(q2.x - at.x, 0, at.x - q2.x - q2.w), Math.max(q2.y - at.y, 0, at.y - q2.y - q2.h));
    return !best || d(q) < d(best) ? q : best;
  }, undefined);
  if (!near) {
    const s = laid.sections.find(s => s.page === at.page && at.x >= s.x && at.x <= s.x + s.w && at.y >= s.y && at.y <= s.y + s.h);
    return s ? { si: s.si, qi: t().sections[s.si].fields.length, page: at.page, x: s.x + 6, y: s.y + 4, h: 12, vertical: false } : undefined;
  }
  const where = locate(t(), near.id)!;
  const after = inRow.length ? at.x > near.x + near.w / 2 : at.y < near.y + near.h / 2;
  return inRow.length
    ? { si: where.si, qi: where.qi + (after ? 1 : 0), page: at.page, x: after ? near.x + near.w + 1 : near.x - 2, y: near.y, h: near.h, vertical: true }
    : { si: where.si, qi: where.qi + (after ? 1 : 0), page: at.page, x: near.x, y: after ? near.y - 2 : near.y + near.h + 1, h: near.w, vertical: false };
}

/** Where a section would land: before or after the section under the pointer. */
function sectionDropAt(ev: PointerEvent): number | undefined {
  const at = pointAt(ev);
  if (!at || !laid) return undefined;
  const s = laid.sections.find(s => s.page === at.page && at.x >= s.x && at.x <= s.x + s.w && at.y >= s.y - 3 && at.y <= s.y + s.h + 3);
  if (!s) return undefined;
  return s.si + (at.y < s.y + s.h / 2 ? 1 : 0);
}

function showDrop(drop: Drop | number | undefined) {
  document.querySelectorAll(".cv-drop").forEach(el => el.remove());
  if (drop === undefined || !laid) return;
  let page: number, x: number, y: number, w: number, hh: number;
  if (typeof drop === "number") { // a section: a line above the section now at that place (or under the last)
    const s = laid.sections.find(s => s.si === drop) ?? laid.sections.filter(s => s.si === drop - 1).at(-1);
    if (!s) return;
    page = s.page; x = s.x; w = s.w; hh = 2.5;
    y = s.si === drop ? s.y + s.h + 1.5 : s.y - 4;
  } else {
    page = drop.page;
    [x, y, w, hh] = drop.vertical ? [drop.x - 1, drop.y, 2.5, drop.h] : [drop.x, drop.y, drop.h, 2.5];
  }
  document.querySelector(`.cv-page[data-page="${page}"] .cv-ov`)?.append(hit("cv-drop", x, y, w, hh, {}));
}

function finishDrop(what: Dragged, drop: Drop | number) {
  if (what.kind === "button") { if (typeof drop === "object") addButton(drop.si); return; }
  if (what.kind === "section" && typeof drop === "number") {
    if (drop === what.si || drop === what.si + 1) return;
    edit(f => { const [s] = f.sections.splice(what.si, 1); const to = drop > what.si ? drop - 1 : drop; f.sections.splice(to, 0, s); sel = { si: to }; });
  } else if (what.kind === "new" && typeof drop === "number") addSection(what.make() as Section, drop);
  else if (typeof drop === "object") {
    if (what.kind === "field") edit(f => { moveField(f, what.id, drop.si, drop.qi); sel = { si: locate(f, what.id)!.si, id: what.id }; });
    else if (what.kind === "new") {
      const f = what.make() as Field;
      edit(form => { form.sections[drop.si].fields.splice(drop.qi, 0, f); sel = { si: drop.si, id: f.id }; });
      focusLabel();
    }
  }
}

function autoScroll(ev: PointerEvent) {
  const scroll = document.getElementById("cvScroll")!, r = scroll.getBoundingClientRect();
  if (ev.clientY < r.top + 40) scroll.scrollTop -= 14;
  else if (ev.clientY > r.bottom - 40) scroll.scrollTop += 14;
}

// ---- outline
function drawOutline() {
  document.getElementById("cvOutline")!.replaceChildren(...t().sections.map((s, si) =>
    h("li", { className: sel?.si === si ? "on" : "" },
      h("button", { type: "button", onclick: () => { select({ si }); scrollTo(si); } },
        h("span", { className: "cv-no" }, String(si + 1)), h("span", { className: "cv-name" }, s.title || "Untitled"), h("span", { className: "cv-n" }, String(s.fields.length))))));
}
function scrollTo(si: number, id?: string) {
  const el = document.querySelector(id ? `.cv-q[data-id="${CSS.escape(id)}"]` : `.cv-sec[data-si="${si}"]`);
  el?.scrollIntoView({ block: "center", behavior: "smooth" });
}

// ---- the right-hand panel
function updateReviewCount(issues: Issue[]) {
  const n = issues.filter(i => i.level === "problem").length, tips = issues.length - n;
  const count = document.getElementById("cvCount")!;
  count.textContent = String(issues.length || "");
  count.classList.toggle("bad", n > 0);
  count.title = `${n} problem${n === 1 ? "" : "s"}, ${tips} tip${tips === 1 ? "" : "s"}`;
}

function drawPanel(issues: Issue[]) {
  document.getElementById("cvTabProps")!.setAttribute("aria-selected", String(tab === "props"));
  document.getElementById("cvTabReview")!.setAttribute("aria-selected", String(tab === "review"));
  updateReviewCount(issues);
  const panel = document.getElementById("cvPanel")!;
  const scrollTop = panel.scrollTop;
  const f = sel?.id ? locate(t(), sel.id)?.field : undefined;
  panel.replaceChildren(...(tab === "review" ? reviewPanel(issues) : f ? questionPanel(f) : sel ? sectionPanel(t().sections[sel.si], sel.si) : formPanel()));
  panel.scrollTop = scrollTop;
}

/** A labelled box that edits a value as it is typed (one undo step per edit). */
function textBox(label: string, value: string, set: (v: string) => void, opts: { long?: boolean; hint?: string; id?: string; mono?: boolean } = {}) {
  const input = h(opts.long ? "textarea" : "input", {
    value, id: opts.id ?? "", className: opts.mono ? "mono" : "", spellcheck: !opts.mono, ...(opts.long ? { rows: 3 } : {}),
    onfocus: () => { typing = false; },
    oninput: (e: Event) => { if (!typing) { snapshot(); typing = true; } set((e.target as HTMLInputElement).value); host.changed(); render(true); },
    onblur: () => { typing = false; },
  });
  return h("label", { className: "cv-field" }, h("span", {}, label), input, opts.hint ? h("small", {}, opts.hint) : "");
}
/** A row of buttons, one pressed: picks one of a few values. */
function segmented<V>(label: string, choices: [string, V][], value: V, set: (v: V) => void, hint?: string) {
  return h("div", { className: "cv-field" }, h("span", {}, label),
    h("div", { className: "cv-seg", role: "radiogroup", "aria-label": label }, ...choices.map(([name, v]) =>
      h("button", { type: "button", role: "radio", "aria-checked": String(v === value), onclick: () => v !== value && set(v) }, name))),
    hint ? h("small", {}, hint) : "");
}
const tickBox = (label: string, on: boolean, set: (v: boolean) => void, hint?: string) =>
  h("label", { className: "cv-tick" }, h("input", { type: "checkbox", checked: on, onchange: (e: Event) => set((e.target as HTMLInputElement).checked) }), h("span", {}, label, hint ? h("small", {}, hint) : ""));
const group = (title: string, ...kids: (Node | string)[]) => h("section", { className: "cv-group" }, h("h3", {}, title), ...kids);

function formPanel(): Node[] {
  const f = t();
  return [
    h("p", { className: "cv-lead" }, "Nothing selected: these are the form's own settings. Click a question or a section heading on the page to change it."),
    group("Form",
      textBox("Title", f.title, v => { f.title = v; }),
      textBox("Instructions under the title", f.note ?? "", v => { f.note = v; }, { long: true }),
      textBox("Issuer, at the top of every page", f.issuer ?? "", v => { f.issuer = v || undefined; }),
      textBox("Form code, in the header and footer", f.formCode ?? "", v => { f.formCode = v || undefined; }, { hint: "e.g. Form LC-01 · v1.0 · Nov 2026. The code and version also go into the QR code." }),
    ),
    group("Checks across answers", ...checksEditor()),
  ];
}

function checksEditor(): Node[] {
  const f = t(), fields = allFields(f);
  const name = (id: string) => `${num(id)} ${fields.find(q => q.id === id)?.label ?? id}`;
  const say = (c: Check) => c.t === "order" ? `${name(c.a)} ${c.s ? "is after" : "is not before"} ${name(c.b)}`
    : c.t === "range" ? `${name(c.a)} is from ${c.lo} to ${c.hi}` : `${name(c.a)} has the length set for ${name(c.b)}`;
  const list = (f.checks ?? []).map((c, i) => h("div", { className: "cv-rule" },
    h("div", {}, h("strong", {}, say(c)), h("small", {}, `Otherwise: "${c.m}"`)),
    h("button", { type: "button", className: "cv-x", title: "Remove this check", "aria-label": "Remove this check", onclick: () => edit(x => { x.checks!.splice(i, 1); if (!x.checks!.length) delete x.checks; }) }, "×")));
  const dates = fields.filter(q => q.kind === "date"), numbers = fields.filter(q => q.kind === "text" && q.format && /amount|number/.test(q.format));
  const pick = (qs: Field[]) => h("select", {}, ...qs.map(q => h("option", { value: q.id }, `${num(q.id)} ${q.label}`)));
  const kind = h("select", {}, h("option", { value: "after" }, "Date is after"), h("option", { value: "not_before" }, "Date is not before"), h("option", { value: "range" }, "Number is from … to …"));
  const a = pick(dates), b = pick(dates), lo = h("input", { type: "number", value: "0", "aria-label": "From" }), hi = h("input", { type: "number", value: "100", "aria-label": "To" });
  const msg = h("input", { placeholder: "Message when it fails", "aria-label": "Message" });
  const extra = h("div", { className: "cv-inline" }, b);
  kind.onchange = () => {
    const range = kind.value === "range";
    a.replaceChildren(...[...pick(range ? numbers : dates).children]);
    extra.replaceChildren(...(range ? [lo, h("span", {}, "to"), hi] : [b]));
  };
  const add = h("button", { type: "button", onclick: () => {
    if (!a.value) return;
    const m = msg.value.trim() || "Please check this answer.";
    const c: Check = kind.value === "range" ? { t: "range", a: a.value, lo: +lo.value, hi: +hi.value, m } : { t: "order", a: a.value, b: b.value, s: kind.value === "after" ? 1 : 0, m };
    edit(x => { (x.checks ??= []).push(c); });
  } }, "Add check");
  const none = h("p", { className: "cv-lead" }, "None. A check compares answers when the person presses Check form, e.g. an expiry date after the issue date.");
  return [...(list.length ? list : [none]), h("div", { className: "cv-new-rule" }, kind, a, extra, msg, add)];
}

function sectionPanel(s: Section, si: number): Node[] {
  const kind = s.signoff ? "sign" : s.bankOnly ? "bank" : "plain";
  return [
    h("p", { className: "cv-crumb" }, `Section ${si + 1}`),
    group("Section",
      textBox("Title", s.title, v => { s.title = v; }),
      textBox("Note under the heading", s.note ?? "", v => { s.note = v || undefined; }, { long: true, hint: "A note makes the section full width." }),
      segmented("Kind", [["Questions", "plain"], ["Bank use only", "bank"], ["Signature block", "sign"]], kind, v => edit(() => {
        delete s.bankOnly; delete s.signoff;
        if (v === "bank") s.bankOnly = true;
        if (v === "sign") { s.signoff = true; if (s.width === "half") delete s.width; }
      })),
    ),
    group("Layout",
      segmented("Width", [["Auto", undefined], ["Full", "full"], ["Half", "half"]] as [string, Section["width"]][], s.width, v => edit(() => { if (v) s.width = v; else delete s.width; }),
        "Auto: two short sections of similar height sit side by side. Half: always half the page (two halves in a row pair up)."),
      tickBox("Start on a new page", !!s.new_page, v => edit(() => { if (v) s.new_page = true; else delete s.new_page; })),
    ),
    h("section", { className: "cv-group", id: "cvButtons" }, h("h3", {}, "Buttons"),
      h("p", { className: "cv-lead" }, "A row at the bottom right of the section, on screen only. Each does what the form's own button of that name does."),
      ...(Object.entries(BUTTONS) as [ButtonName, string][]).map(([name, caption]) => tickBox(caption, !!s.buttons?.includes(name), on => edit(() => {
        const next = (Object.keys(BUTTONS) as ButtonName[]).filter(b => (b === name ? on : s.buttons?.includes(b)));
        if (next.length) s.buttons = next; else delete s.buttons;
      })))),
    h("div", { className: "cv-actions" },
      h("button", { type: "button", onclick: () => addField(newField("text")) }, "Add a question"),
      h("button", { type: "button", disabled: si === 0, onclick: () => edit(f => { [f.sections[si - 1], f.sections[si]] = [f.sections[si], f.sections[si - 1]]; sel = { si: si - 1 }; }) }, "Move up"),
      h("button", { type: "button", disabled: si === t().sections.length - 1, onclick: () => edit(f => { [f.sections[si + 1], f.sections[si]] = [f.sections[si], f.sections[si + 1]]; sel = { si: si + 1 }; }) }, "Move down"),
      h("button", { type: "button", className: "danger", onclick: () => deleteSelection() }, "Delete section"),
    ),
  ];
}

function questionPanel(f: Field): Node[] {
  const at = locate(t(), f.id)!, row = laid?.rows.find(r => r.ids.includes(f.id));
  const autoCols = row?.cols[row.ids.indexOf(f.id)], of = row?.of ?? 12;
  const opts = hasOptions(f.kind) ? textBox("Options, one per line", (f.options ?? []).join("\n"), v => { f.options = v.split("\n").map(o => o.trim()).filter(Boolean); }, { long: true }) : "";
  return [
    h("p", { className: "cv-crumb" }, h("button", { type: "button", className: "cv-link", onclick: () => select({ si: at.si }) }, `Section ${at.si + 1}: ${t().sections[at.si].title}`), ` / question ${num(f.id)}`),
    group("Question",
      textBox("Wording", f.label, v => {
        f.label = v;
        if (!autoKey.has(f)) return;
        renameField(t(), f, uniqueId(t(), v || "question", f));
        sel = { si: at.si, id: f.id };
        const key = document.getElementById("cvKey") as HTMLInputElement | null;
        if (key) key.value = f.id;
      }, { long: f.label.length > 60, id: "cvLabel" }),
      h("label", { className: "cv-field" }, h("span", {}, "Answer type"),
        h("select", { onchange: (e: Event) => edit(() => {
          f.kind = (e.target as HTMLSelectElement).value as Kind;
          if (hasOptions(f.kind) && !f.options?.length) f.options = [...SAMPLE_OPTIONS];
          if (!hasOptions(f.kind)) delete f.options;
        }) }, ...(Object.keys(KINDS) as Kind[]).map(k => h("option", { value: k, selected: k === f.kind }, KINDS[k])))),
      opts,
      f.kind === "select" ? h("div", { className: "cv-inline" }, h("small", {}, "Fill with:"),
        ...Object.keys(LISTS).map(n => h("button", { type: "button", className: "cv-small", onclick: () => edit(() => { f.options = [...LISTS[n as keyof typeof LISTS]]; }) }, n === "CURRENCIES" ? "Currencies" : "Countries"))) : "",
      keyBox(f),
    ),
    group("Rules", ...mandatoryEditor(f), ...lockEditor(f)),
    group("Answer",
      f.kind === "text" || f.kind === "long" ? h("div", { className: "cv-inline cv-two" },
        h("label", { className: "cv-field" }, h("span", {}, "Most characters"), h("input", { type: "number", min: "1", value: f.max ?? "", placeholder: "35",
          onchange: (e: Event) => edit(() => { const v = parseInt((e.target as HTMLInputElement).value, 10); if (v > 0) f.max = v; else delete f.max; }) })),
        f.kind === "text" ? h("label", { className: "cv-field" }, h("span", {}, "Format"), h("select", { onchange: (e: Event) => edit(() => { const v = (e.target as HTMLSelectElement).value; if (v) f.format = v as Field["format"]; else delete f.format; }) },
          h("option", { value: "" }, "Any text"), ...Object.keys(FORMATS).map(k => h("option", { value: k, selected: f.format === k }, FORMAT_NAMES[k] ?? k)))) : "",
      ) : h("p", { className: "cv-lead" }, "Nothing to limit for this answer type."),
    ),
    group("Layout",
      segmented("Width", WIDTHS, f.cols, v => edit(() => { if (v) f.cols = v; else delete f.cols; }),
        `Share of the row, out of ${of} columns${of < 12 ? " (a half-width section)" : ""}. ${f.cols ? "" : `Auto gives it ${autoCols ?? "?"} now, from its wording and most characters, and widens text boxes to fill the row.`}`),
    ),
    h("div", { className: "cv-actions" },
      h("button", { type: "button", onclick: () => duplicate() }, "Duplicate"),
      h("button", { type: "button", className: "danger", onclick: () => deleteSelection() }, "Delete question"),
    ),
  ];
}

function keyBox(f: Field) {
  const input = h("input", { value: f.id, id: "cvKey", className: "mono", spellcheck: false, "aria-describedby": "cvKeyHint",
    onchange: (e: Event) => {
      const want = (e.target as HTMLInputElement).value.trim();
      const id = uniqueId(t(), want || f.label, f);
      autoKey.delete(f);
      if (id !== f.id) edit(form => { renameField(form, f, id); sel = { si: sel!.si, id }; });
      else input.value = f.id;
    } });
  return h("label", { className: "cv-field" }, h("span", {}, "Key"), input, h("small", { id: "cvKeyHint" }, "The answer's name in the QR code and the extracted data. Rules that name it follow a change."));
}

/** The questions a rule can wait on: every other one, numbered. */
const triggerOptions = (self: Field) => allFields(t()).filter(q => q.id !== self.id).map(q => h("option", { value: q.id }, `${num(q.id)} ${q.label.length > 50 ? `${q.label.slice(0, 48)}…` : q.label}`));

function ruleRows(f: Field, key: "requiredIf" | "activeIf"): Node[] {
  const rules = f[key] ?? [];
  const rows = rules.map((r, i) => {
    const other = locate(t(), r.field)?.field;
    const set = (next: Rule) => edit(() => { f[key]![i] = next; });
    const trigger = h("select", { "aria-label": "Question", onchange: (e: Event) => set(defaultRule((e.target as HTMLSelectElement).value)) }, ...triggerOptions(f));
    trigger.value = r.field;
    const mode = r.not ? "answered" : r.values.length === 1 && r.values[0] === "true" ? "ticked" : r.values.length === 1 && r.values[0] === "false" ? "unticked" : "is";
    const modes: [string, string][] = other?.kind === "check" ? [["is ticked", "ticked"], ["is not ticked", "unticked"]]
      : other && hasOptions(other.kind) ? [["is", "is"], ["has any answer", "answered"]] : [["has any answer", "answered"]];
    const how = h("select", { "aria-label": "Condition", onchange: (e: Event) => {
      const v = (e.target as HTMLSelectElement).value;
      set(v === "ticked" ? { field: r.field, values: ["true"] } : v === "unticked" ? { field: r.field, values: ["false"] } : v === "answered" ? { field: r.field, values: [""], not: true } : { field: r.field, values: [other?.options?.[0] ?? ""] });
    } }, ...modes.map(([name, v]) => h("option", { value: v, selected: v === mode }, name)));
    const values = mode === "is" && other?.options ? h("div", { className: "cv-chips" }, ...other.options.map(o =>
      h("button", { type: "button", "aria-pressed": String(r.values.includes(o)), onclick: () => {
        const vs = r.values.includes(o) ? r.values.filter(v => v !== o) : [...r.values, o];
        if (vs.length) set({ field: r.field, values: other.options!.filter(x => vs.includes(x)) });
      } }, o))) : "";
    return h("div", { className: "cv-rule" },
      h("div", { className: "cv-rule-q" }, i ? h("small", {}, "or when") : "", trigger, how, values),
      h("button", { type: "button", className: "cv-x", title: "Remove this condition", "aria-label": "Remove this condition", onclick: () => edit(() => { f[key]!.splice(i, 1); if (!f[key]!.length && key === "requiredIf") delete f.requiredIf; }) }, "×"));
  });
  return [...rows, h("button", { type: "button", className: "cv-small", onclick: () => edit(() => { (f[key] ??= []).push(defaultRule(nearestTrigger(f))); }) }, rules.length ? "Add another condition (any one is enough)" : "Add a condition")];
}

/** A sensible first condition on a question: ticked, its first option, or answered. */
function defaultRule(id: string): Rule {
  const q = locate(t(), id)?.field;
  return q?.kind === "check" ? { field: id, values: ["true"] } : q?.options?.length ? { field: id, values: [q.options[0]] } : { field: id, values: [""], not: true };
}
/** The tick box or choice just above a question: what a new condition most likely waits on. */
function nearestTrigger(f: Field) {
  const list = allFields(t()), i = list.findIndex(q => q.id === f.id);
  for (let k = i - 1; k >= 0; k--) if (list[k].kind === "check" || hasOptions(list[k].kind)) return list[k].id;
  return list.find(q => q.id !== f.id)!.id;
}

/** The conditions as sentences, each with ×; "Add a condition" picks the question on the page. The lists editor
 *  (ruleRows) stays under "Edit with lists" for the keyboard and for fine changes. */
function conditionList(f: Field): Node[] {
  const items = (["requiredIf", "activeIf"] as const).flatMap(key => (f[key] ?? []).map((r, i) =>
    h("li", {},
      h("span", {}, h("strong", {}, key === "requiredIf" ? "Mandatory when " : "Unlocked when "), sayRule(r, locate(t(), r.field)?.field, num(r.field))),
      h("button", { type: "button", className: "cv-x", title: "Remove this condition", "aria-label": "Remove this condition", onclick: () => edit(() => {
        f[key]!.splice(i, 1);
        if (!f[key]!.length && key === "requiredIf") delete f.requiredIf;
        if (!f[key]?.length && key === "activeIf") delete f.activeIf;
      }) }, "×"))));
  return [
    items.length ? h("ul", { className: "cv-conds" }, ...items) : h("p", { className: "cv-lead" }, f.required ? "Always mandatory." : "No conditions: always optional and open."),
    h("button", { type: "button", className: "primary cv-pick", disabled: allFields(t()).length < 2, onclick: () => startPick(f.id) }, "Add a condition: click the question on the page"),
  ];
}

function mandatoryEditor(f: Field): Node[] {
  const mode = f.required ? "always" : f.requiredIf?.length ? "when" : "no";
  return [
    ...conditionList(f),
    segmented("Mandatory", [["No", "no"], ["Always", "always"], ["When…", "when"]], mode, v => edit(() => {
      delete f.required;
      if (v !== "when") delete f.requiredIf;
      if (v === "always") f.required = true;
      if (v === "when" && !f.requiredIf?.length && allFields(t()).length > 1) f.requiredIf = [defaultRule(nearestTrigger(f))];
    }), mode === "when" ? "Mandatory, outlined in red, only while a condition holds." : mode === "always" ? "Marked * and outlined in red until answered." : undefined),
    ...(mode === "when" ? [h("details", { className: "cv-lists" }, h("summary", {}, "Edit with lists"), ...ruleRows(f, "requiredIf"))] : []),
  ];
}

function lockEditor(f: Field): Node[] {
  const lockedByRule = !!f.requiredIf?.some(r => !r.not);
  const mode = f.activeIf === undefined ? (lockedByRule ? "rule" : "open") : f.activeIf.length ? "when" : "open";
  const choices: [string, string][] = lockedByRule ? [["Until mandatory", "rule"], ["Always open", "open"], ["Until…", "when"]] : [["Always open", "open"], ["Until…", "when"]];
  return [
    segmented("Locked", choices, mode, v => edit(() => {
      if (v === "rule") delete f.activeIf;
      if (v === "open") { if (lockedByRule) f.activeIf = []; else delete f.activeIf; }
      if (v === "when") f.activeIf = [defaultRule(nearestTrigger(f))];
    }), mode === "rule" ? "Greyed out and locked until its mandatory condition holds." : mode === "when" ? "Greyed out and locked until a condition holds; optional once open." : undefined),
    ...(mode === "when" ? [h("details", { className: "cv-lists" }, h("summary", {}, "Edit with lists"), ...ruleRows(f, "activeIf"))] : []),
  ];
}

function reviewPanel(issues: Issue[]): Node[] {
  if (!issues.length) return [h("p", { className: "cv-lead cv-clear" }, "Nothing to fix. The form builds with lc-form and reads well.")];
  const fixable = issues.filter(i => i.level === "tip" && i.fix);
  const item = (i: Issue) => h("li", { className: i.level },
    h("button", { type: "button", className: "cv-issue", onclick: () => { sel = { si: i.si, id: i.id }; render(); scrollTo(i.si, i.id); } },
      h("span", { className: "cv-dot", "aria-label": i.level }), i.say),
    i.fix ? h("button", { type: "button", className: "cv-small", onclick: () => edit(f => { i.fix!.apply(f); if (sel && !f.sections[sel.si]) sel = undefined; }) }, i.fix.label) : "");
  const problems = issues.filter(i => i.level === "problem"), tips = issues.filter(i => i.level === "tip");
  return [
    problems.length ? group(`Problems (${problems.length})`, h("p", { className: "cv-lead" }, "lc-form would refuse to build the form until these are fixed."), h("ul", { className: "cv-issues" }, ...problems.map(item))) : "",
    tips.length ? group(`Tips (${tips.length})`, h("ul", { className: "cv-issues" }, ...tips.map(item)),
      fixable.length > 1 ? h("button", { type: "button", onclick: () => edit(f => { for (const i of review(f, layout(f)).filter(i => i.level === "tip" && i.fix)) i.fix!.apply(f); }) }, `Apply all ${fixable.length} fixes`) : "") : "",
  ].filter((x): x is HTMLElement => !!x);
}

// ---- actions on the selection
function deleteSelection() {
  if (!sel) return;
  const s = sel;
  edit(f => {
    if (s.id) removeField(f, s.id);
    else f.sections.splice(s.si, 1);
    sel = s.id && f.sections[s.si] ? { si: s.si } : undefined;
  });
}
function duplicate() {
  if (!sel?.id) return;
  const at = locate(t(), sel.id)!;
  const copy: Field = { ...structuredClone(at.field), id: uniqueId(t(), at.field.id) };
  edit(f => { f.sections[at.si].fields.splice(at.qi + 1, 0, copy); sel = { si: at.si, id: copy.id }; });
}
/** Moves the selection one place up or down (a question can move into the next section). */
function nudge(by: 1 | -1) {
  if (!sel) return;
  if (!sel.id) {
    const j = sel.si + by;
    if (j < 0 || j >= t().sections.length) return;
    const si = sel.si;
    return edit(f => { [f.sections[si], f.sections[j]] = [f.sections[j], f.sections[si]]; sel = { si: j }; });
  }
  const id = sel.id, at = locate(t(), id)!;
  const len = t().sections[at.si].fields.length;
  edit(f => {
    if (by < 0 && at.qi === 0 && at.si > 0) moveField(f, id, at.si - 1, f.sections[at.si - 1].fields.length);
    else if (by > 0 && at.qi === len - 1 && at.si < f.sections.length - 1) moveField(f, id, at.si + 1, 0);
    else moveField(f, id, at.si, at.qi + (by > 0 ? 2 : -1));
    sel = { si: locate(f, id)!.si, id };
  });
}
function focusLabel() {
  tab = "props";
  requestAnimationFrame(() => { const el = document.getElementById("cvLabel") as HTMLInputElement | null; el?.focus(); el?.select(); });
}

function keys(e: KeyboardEvent) {
  if (root.hidden || !root.isConnected) return;
  const typingIn = (e.target as HTMLElement).closest("input, textarea, select, [contenteditable]");
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === "z" && !typingIn) { e.preventDefault(); return e.shiftKey ? restore(redo, undo) : restore(undo, redo); }
  if (e.key === "Escape" && picking) return stopPick();
  if (typingIn) return;
  if (e.key === "Escape") select(undefined);
  else if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); deleteSelection(); }
  else if (mod && e.key.toLowerCase() === "d" && sel?.id) { e.preventDefault(); duplicate(); }
  else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown") && sel) { e.preventDefault(); nudge(e.key === "ArrowUp" ? -1 : 1); }
}

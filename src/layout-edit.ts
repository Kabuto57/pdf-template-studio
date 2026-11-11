// THE LAYOUT EDITOR (studio, Design step): arrange the form right on the PDF preview.
//   - Click a section or a question to select it (and find it in the Form builder). The bar above the PDF then
//     offers its settings: title, columns, add questions, auto-arrange, delete.
//   - "Arrange by hand" pins every section where the automatic layout put it (each whole on one page). Sections
//     and questions can then be dragged and resized; they snap to the margins, the page's half and third lines,
//     the section's column grid and each other's edges (pink guide lines), so things stay lined up.
//   - "New section": draw a box on a page, say how many questions and in how many columns; they are set out in
//     the box with their labels and boxes lined up, and the box fits its questions' height.
//   - Keys: Delete removes the selection, arrows nudge it (Shift: 10 pt), Ctrl/Cmd+Z undoes.
// Positions are PDF points. In here a rectangle's `t` counts DOWN from the page top (as on screen); the form
// stores the PDF's way (y up from the page bottom).
import { h } from "./dom";
import { H, M, W } from "./form/look";
import { KINDS, type Field, type Geometry, type Kind, type Section, type Template } from "./pdf";

const GAP = 5;      // between sections (as in build.ts)
const BOTTOM = 39;  // the lowest a section may reach (the footer is under it)
const HEAD = 17;    // a section's heading band and the space under it
const PAD = 6;      // inside a section, around its questions
const CGAP = 4;     // between columns
const TOL = 6;      // snapping distance

type R = { x: number; t: number; w: number; h: number };
type Sel = { si: number; id?: string };

export interface Host {
  form(): Template;
  /** Lays the form out; `whole`: no section carried over a page. */
  measure(whole: boolean): Promise<Geometry>;
  /** The form changed: redraw the builder and the PDF (`now`: without waiting for more typing). */
  changed(now?: boolean): void;
  replace(t: Template): void;
  /** Shows the section or question in the Form builder. */
  pick(si: number, id?: string): void;
  newField(kind: Kind): Field;
}

let host: Host, geo: Geometry | undefined, sel: Sel | undefined, drawing = false;
let pending: { page: number; r: R } | undefined; // a new section's box, drawn and waiting for its questions
let message = "";
const history: string[] = [];
const bar = h("div", { className: "lx-bar", id: "lxBar" });

const form = () => host.form();
const free = () => form().sections.some(s => s.frame);
const remember = () => { history.push(JSON.stringify(form())); if (history.length > 60) history.shift(); };
const rectOf = (g: { x: number; y: number; w: number; h: number }): R => ({ x: g.x, t: H - g.y, w: g.w, h: g.h });
const secGeo = (si: number) => geo?.sections.find(g => g.si === si);
const fieldGeo = (id: string) => geo?.fields.find(g => g.id === id);
const fieldOf = (s: Sel) => form().sections[s.si]?.fields.find(f => f.id === s.id);
const px = (el: HTMLElement, r: R, s: number) => Object.assign(el.style, { left: `${r.x * s}px`, top: `${r.t * s}px`, width: `${r.w * s}px`, height: `${r.h * s}px` });

export function setupLayout(h_: Host): HTMLElement {
  host = h_;
  addEventListener("keydown", key);
  renderBar();
  return bar;
}

/** Selects from the Form builder's side. */
export function select(si: number, id?: string) {
  sel = { si, id };
  paint();
  renderBar();
}

/** Puts the editing layer over the rendered pages (Design step). */
export function decorate(canvases: HTMLCanvasElement[], g: Geometry): HTMLElement[] {
  geo = g;
  if (sel && !form().sections[sel.si]) sel = undefined;
  // A section pushed down by one above it (build.ts) stays where it was drawn.
  for (const r of g.sections) { const f = form().sections[r.si]?.frame; if (f && !r.split && Math.abs(f.y - r.y) > 0.5) f.y = r.y; }
  const editable = free();
  document.getElementById("preview")?.classList.toggle("lx-free", editable);
  return canvases.map((canvas, p) => {
    if (p >= g.pages) return canvas; // the QR code page
    const s = parseFloat(canvas.style.width) / W;
    const ov = h("div", { className: `lx-ov${drawing ? " drawing" : ""}`, "data-page": String(p) });
    for (const r of g.sections.filter(x => x.page === p)) {
      const box = h("div", { className: "lx-sec", "data-si": String(r.si), title: form().sections[r.si]?.title ?? "" });
      if (editable && !r.split) for (const e of ["n", "s", "e", "w", "ne", "nw", "se", "sw"]) box.append(handle(e, ev => resizeSection(ev, box, r.si, e, s)));
      box.onpointerdown = ev => pressSection(ev, box, r.si, p, s);
      px(box, rectOf(r), s);
      ov.append(box);
    }
    for (const r of g.fields.filter(x => x.page === p)) {
      const f = form().sections[r.si]?.fields.find(q => q.id === r.id);
      if (!f) continue;
      const box = h("div", { className: "lx-fld", "data-id": r.id, title: f.label });
      if (editable && form().sections[r.si].frame) {
        box.append(handle("e", ev => resizeField(ev, box, r.si, f, "e", s)), handle("w", ev => resizeField(ev, box, r.si, f, "w", s)));
        if (f.kind === "long") box.append(handle("s", ev => resizeField(ev, box, r.si, f, "s", s)));
      }
      box.onpointerdown = ev => pressField(ev, box, r.si, f, s);
      px(box, rectOf(r), s);
      ov.append(box);
    }
    if (pending?.page === p) { const n = h("div", { className: "lx-new" }); px(n, pending.r, s); ov.append(n); }
    ov.onpointerdown = ev => {
      if (ev.target !== ov) return;
      if (drawing) return drawSection(ev, ov, p, s);
      sel = undefined;
      paint();
      renderBar();
    };
    const page = h("div", { className: "lx-page" }, canvas, ov);
    page.style.width = canvas.style.width;
    return page;
  }).map((el, i, all) => { if (i === all.length - 1) queueMicrotask(paint); return el; });
}

const handle = (edge: string, down: (e: PointerEvent) => void) => {
  const el = h("span", { className: `lx-h lx-${edge}` });
  el.onpointerdown = e => { e.stopPropagation(); down(e); };
  return el;
};

function paint() {
  document.querySelectorAll(".lx-sec, .lx-fld").forEach(el => el.classList.remove("sel"));
  if (!sel) return;
  const el = sel.id ? document.querySelector(`.lx-fld[data-id="${CSS.escape(sel.id)}"]`) : document.querySelector(`.lx-sec[data-si="${sel.si}"]`);
  el?.classList.add("sel");
}

// ---- Dragging ----

/** Follows the pointer from a press; `move` gets how far it went in points. Returns on release. */
function drag(e: PointerEvent, el: HTMLElement, s: number, move: (dx: number, dy: number, ev: PointerEvent) => void, done: (moved: boolean) => void) {
  e.preventDefault();
  e.stopPropagation();
  const x0 = e.clientX, y0 = e.clientY;
  let moved = false;
  el.setPointerCapture(e.pointerId);
  el.onpointermove = ev => {
    if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
    moved = true;
    move((ev.clientX - x0) / s, (ev.clientY - y0) / s, ev);
  };
  el.onpointerup = el.onpointercancel = () => {
    el.onpointermove = el.onpointerup = el.onpointercancel = null;
    guides();
    done(moved);
  };
}

const near = (v: number, ts: number[]) =>
  ts.reduce<number | undefined>((b, t) => (Math.abs(t - v) <= TOL && (b === undefined || Math.abs(t - v) < Math.abs(b - v)) ? t : b), undefined);

/** Snaps the edges that move to the nearest line in xs (left/right edges) and ts (top/bottom edges). */
function snap(r: R, how: string, xs: number[], ts: number[]) {
  let { x, t, w, h } = r;
  const gx: number[] = [], gt: number[] = [];
  if (how === "move") {
    const a = near(x, xs), b = near(x + w, xs);
    if (a !== undefined && (b === undefined || Math.abs(a - x) <= Math.abs(b - x - w))) { x = a; gx.push(a); }
    else if (b !== undefined) { x = b - w; gx.push(b); }
    const c = near(t, ts), d = near(t + h, ts);
    if (c !== undefined && (d === undefined || Math.abs(c - t) <= Math.abs(d - t - h))) { t = c; gt.push(c); }
    else if (d !== undefined) { t = d - h; gt.push(d); }
  } else {
    if (how.includes("w")) { const a = near(x, xs); if (a !== undefined) { w += x - a; x = a; gx.push(a); } }
    if (how.includes("e")) { const b = near(x + w, xs); if (b !== undefined) { w = b - x; gx.push(b); } }
    if (how.includes("n")) { const c = near(t, ts); if (c !== undefined) { h += t - c; t = c; gt.push(c); } }
    if (how.includes("s")) { const d = near(t + h, ts); if (d !== undefined) { h = d - t; gt.push(d); } }
  }
  return { r: { x, t, w, h }, gx, gt };
}

function stretch(r: R, dx: number, dy: number, how: string): R {
  let { x, t, w, h } = r;
  if (how.includes("e")) w += dx;
  if (how.includes("w")) { x += dx; w -= dx; }
  if (how.includes("s")) h += dy;
  if (how.includes("n")) { t += dy; h -= dy; }
  return { x, t, w, h };
}

/** The pink guide lines on the page being edited (none: clears them). */
function guides(ov?: Element | null, s = 1, gx: number[] = [], gt: number[] = []) {
  document.querySelectorAll(".lx-guide").forEach(g => g.remove());
  if (!ov) return;
  for (const x of gx) ov.append(Object.assign(h("div", { className: "lx-guide v" }), { style: `left:${x * s}px` }));
  for (const t of gt) ov.append(Object.assign(h("div", { className: "lx-guide h" }), { style: `top:${t * s}px` }));
}

// Where a section's edges snap: the margins, the page's halves and thirds, and the other sections on the page.
function sectionLines(page: number, skip?: number) {
  const cw = W - 2 * M, xs = [M, W - M];
  for (const n of [2, 3]) {
    const col = (cw - (n - 1) * GAP) / n;
    for (let k = 0; k < n; k++) xs.push(M + k * (col + GAP), M + k * (col + GAP) + col);
  }
  const top = H - (geo?.tops[page] ?? H - 60), ts = [top, H - BOTTOM];
  for (const g of geo?.sections ?? []) {
    if (g.page !== page || g.si === skip) continue;
    const r = rectOf(g);
    xs.push(r.x, r.x + r.w, r.x - GAP, r.x + r.w + GAP);
    ts.push(r.t, r.t + r.h, r.t - GAP, r.t + r.h + GAP);
  }
  return { xs, ts, top };
}
function keepOnPage(r: R, page: number, how: string): R {
  const top = H - (geo?.tops[page] ?? H - 60);
  let { x, t, w, h } = r;
  w = Math.min(Math.max(w, 90), W - 2 * M);
  h = Math.max(h, 30);
  if (how === "move" || how.includes("w")) x = Math.min(Math.max(x, M), W - M - w);
  else w = Math.min(w, W - M - x);
  if (how === "move" || how.includes("n")) t = Math.min(Math.max(t, top), Math.max(top, H - BOTTOM - h));
  else h = Math.min(h, H - BOTTOM - t);
  return { x, t, w, h };
}

// ---- Sections ----

function pressSection(e: PointerEvent, box: HTMLElement, si: number, page: number, s: number) {
  if (e.button !== 0) return;
  const g = secGeo(si)!, start = rectOf(g);
  const canMove = free() && !g.split;
  let r = start, to = page;
  const b0 = box.parentElement!.getBoundingClientRect();
  const grabX = (e.clientX - b0.left) / s - start.x, grabT = (e.clientY - b0.top) / s - start.t;
  drag(e, box, s, (_dx, _dy, ev) => {
    if (!canMove) return;
    // The page under the pointer (a section can be moved to another page).
    const ovs = [...document.querySelectorAll<HTMLElement>(".lx-ov")];
    const ov = ovs.find(o => { const b = o.getBoundingClientRect(); return ev.clientY >= b.top && ev.clientY <= b.bottom; }) ?? box.parentElement!;
    to = Number(ov.dataset.page);
    if (box.parentElement !== ov) ov.append(box);
    const b = ov.getBoundingClientRect();
    const lines = sectionLines(to, si);
    const moved = { ...start, x: (ev.clientX - b.left) / s - grabX, t: (ev.clientY - b.top) / s - grabT };
    const snapped = snap(moved, "move", lines.xs, lines.ts);
    r = keepOnPage(snapped.r, to, "move");
    px(box, r, s);
    guides(ov, s, snapped.gx, snapped.gt);
  }, moved => {
    if (!moved) return select(si);
    if (!canMove) return;
    setFrame(si, to, r);
  });
}

function resizeSection(e: PointerEvent, box: HTMLElement, si: number, how: string, s: number) {
  const g = secGeo(si)!, start = rectOf(g);
  let r = start;
  drag(e, box, s, (dx, dy) => {
    const lines = sectionLines(g.page, si), snapped = snap(stretch(start, dx, dy, how), how, lines.xs, lines.ts);
    r = keepOnPage(snapped.r, g.page, how);
    px(box, r, s);
    guides(box.parentElement, s, snapped.gx, snapped.gt);
  }, moved => { if (moved) setFrame(si, g.page, r, true); });
}

/** Sections never overlap: a box dropped on another slides down under it. Undefined: no room left on the page. */
function room(page: number, r: R, skip?: number): R | undefined {
  for (let i = 0; i < 50; i++) {
    const o = geo?.sections.filter(g => g.page === page && g.si !== skip).map(rectOf)
      .find(o => r.x < o.x + o.w - 1 && o.x < r.x + r.w - 1 && r.t < o.t + o.h - 1 && o.t < r.t + r.h - 1);
    if (!o) return r.t + r.h <= H - BOTTOM + 1 ? r : undefined;
    r = { ...r, t: o.t + o.h + GAP };
  }
  return undefined;
}

function setFrame(si: number, page: number, r0: R, sized = false) {
  const r = room(page, r0, si);
  if (!r) { message = "No room there: it would cover another section."; sel = undefined; host.changed(true); renderBar(); return; }
  message = "";
  remember();
  const s = form().sections[si], round = (n: number) => Math.round(n * 2) / 2;
  s.frame = { page, x: round(r.x), y: round(H - r.t), w: round(r.w), h: sized || s.frame?.h ? round(r.h) : 0 };
  sel = { si };
  host.changed(true);
  renderBar();
}

/** Pins every section where the automatic layout puts it, each whole on one page. */
async function arrangeByHand(): Promise<boolean> {
  if (free()) return true;
  const g = await host.measure(true), t = form();
  const long = g.sections.find(x => x.split);
  if (long) {
    message = `Section ${long.si + 1} (${t.sections[long.si].title}) is longer than a page. Move some of its questions into a new section in the Form builder, then try again.`;
    renderBar();
    return false;
  }
  remember();
  for (const r of g.sections) t.sections[r.si].frame = { page: r.page, x: r.x, y: r.y, w: r.w, h: r.h };
  t.pages = g.pages;
  message = "";
  host.changed(true);
  return true;
}

/** Closes the gaps: on every page each section moves up under the sections above it (or to the top of the page). */
function tidy() {
  if (!geo) return;
  remember();
  const t = form();
  for (let p = 0; p < geo.pages; p++) {
    const done: R[] = [];
    for (const g of geo.sections.filter(x => x.page === p && !x.split).sort((a, b) => b.y - a.y)) {
      const r = rectOf(g), top = H - geo.tops[p];
      const above = done.filter(o => r.x < o.x + o.w - 1 && o.x < r.x + r.w - 1).map(o => o.t + o.h + GAP);
      const moved = { ...r, t: Math.max(top, ...above) };
      done.push(moved);
      const f = t.sections[g.si].frame;
      if (f) f.y = Math.round((H - moved.t) * 2) / 2;
    }
  }
  host.changed(true);
}

function automatic() {
  remember();
  const t = form();
  for (const s of t.sections) { delete s.frame; for (const f of s.fields) delete f.at; }
  delete t.pages;
  drawing = false;
  pending = undefined;
  host.changed(true);
  renderBar();
}

// ---- New section: draw its box ----

function drawSection(e: PointerEvent, ov: HTMLElement, page: number, s: number) {
  const b = ov.getBoundingClientRect(), x0 = (e.clientX - b.left) / s, t0 = (e.clientY - b.top) / s;
  const box = h("div", { className: "lx-new" });
  ov.querySelector(".lx-new")?.remove();
  ov.append(box);
  let r: R = { x: x0, t: t0, w: 0, h: 0 };
  drag(e, ov, s, (dx, dy) => {
    const raw = { x: Math.min(x0, x0 + dx), t: Math.min(t0, t0 + dy), w: Math.abs(dx), h: Math.abs(dy) };
    const how = `${dy < 0 ? "n" : "s"}${dx < 0 ? "w" : "e"}`, lines = sectionLines(page);
    const snapped = snap(raw, "nsew", lines.xs, lines.ts); // every edge, the corner it started from too
    r = keepOnPage(snapped.r, page, how);
    px(box, r, s);
    guides(ov, s, snapped.gx, snapped.gt);
  }, moved => {
    if (!moved || r.w < 40 || r.h < 20) { box.remove(); return; }
    const fits = room(page, r);
    if (!fits) { box.remove(); message = "No room there: draw the box in an empty part of the page (or add a page)."; renderBar(); return; }
    r = fits;
    px(box, r, s);
    drawing = false;
    ov.classList.remove("drawing");
    pending = { page, r };
    renderBar();
    bar.querySelector<HTMLInputElement>("input")?.select();
  });
}

function createSection(title: string, n: number, cols: number, kind: Kind) {
  if (!pending) return;
  remember();
  const t = form(), { page, r } = pending;
  // In reading order: after the sections above it (or on earlier pages), so the numbering follows the page.
  const at = t.sections.findIndex(s => s.frame && (s.frame.page > page || (s.frame.page === page && H - s.frame.y > r.t + 1)));
  const s: Section = { title: title || "New section", fields: [], frame: { page, x: Math.round(r.x), y: Math.round(H - r.t), w: Math.round(r.w), h: 0 } };
  if (cols) s.cols = cols;
  const si = at < 0 ? t.sections.length : at;
  t.sections.splice(si, 0, s);
  addQuestions(s, n, kind);
  pending = undefined;
  sel = { si };
  host.changed(true);
  renderBar();
}

// ---- Questions ----

/** n new questions at the end of the section: "Question 3", "Question 4", ... (one at a time, so each key is new). */
function addQuestions(s: Section, n: number, kind: Kind) {
  for (let i = 0; i < n; i++) {
    const f = host.newField(kind);
    f.label = `Question ${s.fields.length + 1}`;
    s.fields.push(f);
  }
}

function pressField(e: PointerEvent, box: HTMLElement, si: number, f: Field, s: number) {
  if (e.button !== 0) return;
  const sec = form().sections[si], g = fieldGeo(f.id)!, start = rectOf(g);
  const canMove = free() && !!sec.frame;
  let r = start;
  drag(e, box, s, (dx, dy) => {
    if (!canMove) return;
    const lines = fieldLines(si, f.id), snapped = snap({ ...start, x: start.x + dx, t: start.t + dy }, "move", lines.xs, lines.ts);
    r = keepInSection(snapped.r, si, "move");
    px(box, r, s);
    guides(box.parentElement, s, snapped.gx, snapped.gt);
  }, moved => {
    if (!moved) { select(si, f.id); host.pick(si, f.id); return; }
    if (canMove) setSpot(si, f, r);
  });
}

function resizeField(e: PointerEvent, box: HTMLElement, si: number, f: Field, how: string, s: number) {
  const start = rectOf(fieldGeo(f.id)!);
  let r = start;
  drag(e, box, s, (dx, dy) => {
    const lines = fieldLines(si, f.id), snapped = snap(stretch(start, dx, dy, how), how, lines.xs, lines.ts);
    r = keepInSection(snapped.r, si, how);
    px(box, r, s);
    guides(box.parentElement, s, snapped.gx, snapped.gt);
  }, moved => { if (moved) setSpot(si, f, r); });
}

// Where a question's edges snap: the section's 12-column grid, its inside edges, the other questions in it.
function fieldLines(si: number, skip: string) {
  const b = rectOf(secGeo(si)!), x0 = b.x + PAD, w = b.w - 2 * PAD, cw = (w - 11 * CGAP) / 12;
  const xs: number[] = [], ts = [b.t + HEAD];
  for (let k = 0; k <= 12; k++) xs.push(x0 + k * (cw + CGAP), x0 + k * (cw + CGAP) - CGAP);
  for (const g of geo?.fields ?? []) {
    if (g.si !== si || g.id === skip) continue;
    const r = rectOf(g);
    xs.push(r.x, r.x + r.w);
    ts.push(r.t, r.t + r.h + 4, r.t + r.h);
  }
  return { xs, ts };
}
function keepInSection(r: R, si: number, how: string): R {
  const b = rectOf(secGeo(si)!), x0 = b.x + PAD, x1 = b.x + b.w - PAD;
  let { x, t, w, h } = r;
  w = Math.min(Math.max(w, 30), x1 - x0);
  if (how === "move" || how.includes("w")) x = Math.min(Math.max(x, x0), x1 - w);
  else w = Math.min(w, x1 - x);
  t = Math.max(t, b.t + HEAD);
  return { x, t, w, h: Math.max(h, 25) };
}

/** Pins the section's questions where they are now (so moving one doesn't move the rest), then places this one. */
function setSpot(si: number, f: Field, r: R) {
  remember();
  pin(si);
  const b = rectOf(secGeo(si)!), round = (n: number) => Math.round(n * 2) / 2;
  f.at = { x: round(r.x - b.x), y: round(r.t - b.t), w: round(r.w), ...(f.kind === "long" ? { h: round(r.h) } : {}) };
  sel = { si, id: f.id };
  host.changed(true);
}
function pin(si: number) {
  const s = form().sections[si], b = rectOf(secGeo(si)!);
  for (const q of s.fields) {
    const g = fieldGeo(q.id);
    if (q.at || !g) continue;
    const r = rectOf(g);
    q.at = { x: r.x - b.x, y: r.t - b.t, w: r.w, ...(q.kind === "long" ? { h: r.h } : {}) };
  }
}

// ---- Keys ----

function key(e: KeyboardEvent) {
  if (!bar.isConnected || bar.hidden) return;
  if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); return undo(); }
  if (e.key === "Escape") { drawing = false; pending = undefined; sel = undefined; host.changed(true); renderBar(); return; }
  if (!sel) return;
  if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); return remove(); }
  const by = e.shiftKey ? 10 : 1, d = { ArrowLeft: [-by, 0], ArrowRight: [by, 0], ArrowUp: [0, -by], ArrowDown: [0, by] }[e.key];
  if (!d || !free()) return;
  e.preventDefault();
  if (sel.id) {
    const f = fieldOf(sel), g = f && fieldGeo(f.id);
    if (f && g && form().sections[sel.si].frame) setSpot(sel.si, f, keepInSection({ ...rectOf(g), x: rectOf(g).x + d[0], t: rectOf(g).t + d[1] }, sel.si, "move"));
  } else {
    const g = secGeo(sel.si);
    if (g && !g.split) setFrame(sel.si, g.page, keepOnPage({ ...rectOf(g), x: rectOf(g).x + d[0], t: rectOf(g).t + d[1] }, g.page, "move"));
  }
}
function undo() {
  const last = history.pop();
  if (!last) return;
  pending = undefined;
  host.replace(JSON.parse(last));
  renderBar();
}
function remove() {
  if (!sel) return;
  remember();
  const s = form().sections[sel.si];
  if (sel.id) s.fields = s.fields.filter(f => f.id !== sel!.id);
  else form().sections.splice(sel.si, 1);
  sel = undefined;
  host.changed(true);
  renderBar();
}

// ---- The bar above the PDF ----

const btn = (label: string, title: string, onclick: () => void, cls = "") => h("button", { type: "button", title, className: cls, onclick }, label);
const num = (value: number, min: number, max: number, label: string) =>
  h("input", { type: "number", value: String(value), min: String(min), max: String(max), className: "lx-num", "aria-label": label });

export function renderBar() {
  const t = form(), editable = free(), parts: (HTMLElement | string)[] = [];
  parts.push(
    btn("▭ New section", "Draw a box on a page for a new section", async () => {
      if (!(await arrangeByHand())) return;
      drawing = true;
      pending = undefined;
      sel = undefined;
      document.querySelectorAll(".lx-ov").forEach(o => o.classList.add("drawing"));
      renderBar();
    }, drawing ? "on" : ""),
    editable
      ? btn("Automatic layout", "Let the studio lay out every section again (Ctrl+Z undoes)", automatic)
      : btn("✥ Arrange by hand", "Pin the sections so you can drag and resize them", async () => { await arrangeByHand(); renderBar(); }),
  );
  if (editable) {
    parts.push(btn("Tidy up", "Close the gaps between sections on every page", tidy));
    parts.push(btn("+ Page", "Add an empty page to draw on", () => { remember(); t.pages = (geo?.pages ?? 1) + 1; host.changed(true); }));
    const last = (geo?.pages ?? 1) - 1;
    if (last > 0 && !t.sections.some(s => s.frame?.page === last) && !geo?.sections.some(g => g.page === last))
      parts.push(btn("− Page", "Remove the empty last page", () => { remember(); t.pages = last; host.changed(true); }));
  }
  parts.push(btn("↶", "Undo (Ctrl+Z)", undo, history.length ? "" : "dim"));
  const ctx = h("div", { className: "lx-ctx" });

  if (drawing) ctx.append(h("span", { className: message ? "lx-hint lx-warn" : "lx-hint" }, message || "Drag on a page to draw the new section's box. Esc cancels."));
  else if (pending) {
    const title = h("input", { value: "New section", "aria-label": "Section title", className: "lx-title" }) as HTMLInputElement;
    const n = num(4, 1, 40, "How many questions") as HTMLInputElement;
    const cols = num(pending.r.w > 300 ? 2 : 1, 1, 4, "Columns") as HTMLInputElement;
    const kind = h("select", { "aria-label": "Answer type" }, ...Object.entries(KINDS).map(([k, v]) => h("option", { value: k }, v))) as HTMLSelectElement;
    const go = () => createSection(title.value.trim(), Math.max(1, Math.min(40, +n.value || 1)), Math.max(1, Math.min(4, +cols.value || 1)), kind.value as Kind);
    ctx.append(
      h("strong", {}, "New section"), title,
      h("label", {}, "Questions ", n), h("label", {}, "Columns ", cols), kind,
      btn("Create", "Add the section with its questions", go, "primary"),
      btn("Cancel", "", () => { pending = undefined; host.changed(true); renderBar(); }),
    );
    ctx.addEventListener("keydown", e => { if (e.key === "Enter") go(); if (e.key === "Escape") { pending = undefined; host.changed(true); renderBar(); } });
  } else if (sel && t.sections[sel.si]) {
    const s = t.sections[sel.si], f = sel.id ? fieldOf(sel) : undefined;
    if (f) {
      ctx.append(
        h("strong", {}, `${sel.si + 1}.${s.fields.indexOf(f) + 1}`),
        h("input", { value: f.label, className: "lx-title", "aria-label": "Question", oninput: (e: Event) => { f.label = (e.target as HTMLInputElement).value; host.changed(); } }),
        h("select", { "aria-label": "Answer type", onchange: (e: Event) => { remember(); f.kind = (e.target as HTMLSelectElement).value as Kind; if ((f.kind === "radio" || f.kind === "checks" || f.kind === "select") && !f.options?.length) f.options = ["Yes", "No"]; host.changed(true); } },
          ...Object.entries(KINDS).map(([k, v]) => h("option", { value: k, selected: k === f.kind }, v))),
        f.at ? btn("Auto-place", "Put this question back in the section's automatic arrangement", () => { remember(); delete f.at; host.changed(true); renderBar(); }) : "",
        btn("Delete", "Delete this question", remove, "danger"),
      );
    } else {
      const add = num(1, 1, 40, "Questions to add") as HTMLInputElement;
      const kind = h("select", { "aria-label": "Answer type" }, ...Object.entries(KINDS).map(([k, v]) => h("option", { value: k }, v))) as HTMLSelectElement;
      ctx.append(
        h("strong", {}, String(sel.si + 1)),
        h("input", { value: s.title, className: "lx-title", "aria-label": "Section title", oninput: (e: Event) => { s.title = (e.target as HTMLInputElement).value; host.changed(); } }),
        h("label", {}, "Columns ", h("select", {
          "aria-label": "Columns",
          onchange: (e: Event) => { remember(); const v = +(e.target as HTMLSelectElement).value; if (v) s.cols = v; else delete s.cols; for (const q of s.fields) delete q.at; host.changed(true); },
        }, ...["Auto", "1", "2", "3", "4"].map((v, i) => h("option", { value: String(i), selected: (s.cols ?? 0) === i }, v)))),
        h("span", { className: "lx-group" }, "Add ", add, kind, btn("+ Questions", "Add questions to this section", () => {
          remember();
          addQuestions(s, Math.max(1, Math.min(40, +add.value || 1)), kind.value as Kind);
          host.changed(true);
        })),
        btn("Auto-arrange", "Line up this section's questions and fit its height to them", () => {
          remember();
          for (const q of s.fields) delete q.at;
          if (s.frame) s.frame.h = 0;
          host.changed(true);
        }),
        btn("Delete", "Delete this section", remove, "danger"),
      );
    }
  } else ctx.append(h("span", { className: message ? "lx-hint lx-warn" : "lx-hint" }, message || (editable
    ? "Drag sections and questions; drag the handles to resize. They snap to the grid and to each other."
    : "Click a section or question to edit it. Arrange by hand to move and resize them.")));
  if (message && (sel || pending)) message = "";
  bar.replaceChildren(h("div", { className: "lx-tools" }, ...parts), ctx);
}

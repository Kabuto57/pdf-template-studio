// THE SMART FORMS' LAYOUT, in the browser
// A line-by-line copy of step 1 of the lc-form project (layout.py, class Layout): where every section, question and
// box goes. The studio's canvas draws it and writes PDFs from it, so a form looks here exactly as `python build.py`
// will make it. tests/canvas-layout.test.ts checks every field lands where layout.py puts it, for all the smart
// forms; after changing layout.py, copy the change here and rerun scripts/smartforms.py.
// Differences: shapes are kept as objects (not PDF drawing commands), and it also records where each section and
// question was drawn (`sections`, `questions`), for the canvas to select and drag.
import METRICS from "./metrics.json";
import { activeRules, hasOptions, isRequired, type Field, type Section, type Template, type Values } from "../pdf";

// ---- 1. Settings (layout.py section 1)
export const W = 595.28, H = 841.89, M = 42;
export const BOTTOM = 39;
export type RGB = readonly [number, number, number];
export const RED: RGB = [0.8, 0, 0], INK: RGB = [0, 0, 0], GREY: RGB = [0.35, 0.35, 0.35], RULE: RGB = [0.75, 0.75, 0.75];
export const WHITE: RGB = [1, 1, 1], ACCENT: RGB = [0, 0, 0], TINT: RGB = [0.88, 0.88, 0.88], BANK_SHADE: RGB = [0.95, 0.95, 0.95];
export const LABEL = 7.5, TEXT = 8.5, BOX = 15, COLUMNS = 12, COLUMN_GAP = 4, PAD = 6, BAND = 13, SECTION_GAP = 5, INDENT = 14, SIGN_OFF = 46;
const BESIDE_GAP = 14.7;

// ---- 2. Text helpers
const PLAIN: Record<string, string> = { "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "..." };
export const safe = (s?: string) => (s ?? "").replace(/[^\n\x20-\x7e\xa0-\xff€]/g, c => PLAIN[c] ?? "?");

type Metrics = { widths: Record<string, number>; kern: Record<string, number> };
const FONTS = METRICS as { helv: Metrics; bold: Metrics };
/** How wide text is, in points (Adobe's Helvetica widths and kerning, as Acrobat draws it). */
export function width(text: string, size: number, bold = false) {
  const m = bold ? FONTS.bold : FONTS.helv;
  let units = 0;
  for (let i = 0; i < text.length; i++) units += (m.widths[text[i]] ?? 0) + (i + 1 < text.length ? m.kern[text.slice(i, i + 2)] ?? 0 : 0);
  return (units * size) / 1000;
}
/** Splits text into lines no wider than max (breaking between words). */
export function wrap(text: string, size: number, max: number) {
  const lines: string[] = [];
  for (const paragraph of safe(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const longer = line ? `${line} ${word}` : word;
      if (line && width(longer, size) > max) { lines.push(line); line = word; }
      else line = longer;
    }
    lines.push(line);
  }
  return lines;
}

// ---- What a layout is made of
export type Shape =
  | { t: "text"; s: string; x: number; y: number; size: number; bold: boolean; color: RGB }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; w: number; color: RGB }
  | { t: "rect"; x: number; y: number; w: number; h: number; fill?: RGB; border?: RGB; bw?: number; dash?: boolean };
export interface Look { border?: RGB; bw?: number; bg?: RGB | null; hidden?: boolean; state?: string; caption?: string }
/** One clickable box of a field: rect = [x1, y1, x2, y2] (PDF points, y up from the page bottom). */
export interface Widget extends Look { page: number; rect: [number, number, number, number] }
export interface PdfField {
  name: string;
  type: "text" | "choice" | "check" | "radio" | "button";
  widgets: Widget[];
  tooltip?: string; required?: boolean; value?: string | number | boolean | null; options?: string[];
  multiline?: boolean; max?: number; size?: number; readOnly?: boolean; format?: string;
}
/** A drawn area: y is its BOTTOM edge. */
export interface Box { page: number; x: number; y: number; w: number; h: number }
export interface Laid {
  pages: Shape[][];
  fields: PdfField[];
  links: { page: number; rect: [number, number, number, number]; target: number }[];
  sections: (Box & { si: number })[];         // one per section per page it is on
  questions: (Box & { id: string; si: number })[];
  rows: { si: number; ids: string[]; cols: number[]; of: number }[]; // the grid: each row's questions and their columns
  lastQuestionPage: number;
  spare: number;                               // room left at the end of the last page of questions
  qr: { page: number; slots: [number, number, number][]; button: [number, number] };
}

type Area = { x: number; w: number; cols: number };
const optionWidth = (o: string) => 12 + width(safe(o), TEXT) + 10;

/** Lays the form out (layout.py Layout.draw). `extra`: more height for some paragraph boxes. */
function layOnce(form: Template, answers: Values, extra: Record<string, number>): Laid {
  const out: Laid = { pages: [], fields: [], links: [], sections: [], questions: [], rows: [], lastQuestionPage: 0, spare: 0, qr: { page: 0, slots: [], button: [0, 0] } };
  const questions = form.sections.flatMap(s => s.fields);
  const byId = new Map(questions.map(q => [q.id, q]));
  const numbers = new Map(form.sections.flatMap((s, si) => s.fields.map((q, qi) => [q.id, `${si + 1}.${qi + 1}`] as const)));
  const triggers = new Set(questions.flatMap(q => [...(q.requiredIf ?? []), ...(q.activeIf ?? [])].map(r => r.field)));
  let page = -1, top = 0;

  // drawing primitives (skipped while only measuring)
  const text = (s: string, x: number, y: number, size: number, bold = false, color: RGB = INK, p = page) => { out.pages[p].push({ t: "text", s, x, y, size, bold, color }); };
  const line = (x1: number, y1: number, x2: number, y2: number, w: number, color: RGB, p = page) => { out.pages[p].push({ t: "line", x1, y1, x2, y2, w, color }); };
  const rect = (x: number, y: number, w: number, h: number, o: { fill?: RGB; border?: RGB; bw?: number; dash?: boolean }) => { out.pages[page].push({ t: "rect", x, y, w, h, ...o }); };

  function newPage(first = false) {
    page = out.pages.push([]) - 1;
    const issuer = safe(form.issuer).toUpperCase();
    if (issuer) text(issuer, M, H - 22, first ? 9 : 7, true, ACCENT);
    if (!first) text(safe(form.title), M + (issuer ? width(issuer, 7, true) + 8 : 0), H - 22, 7, false, GREY);
    line(M, H - 29, W - M, H - 29, first ? 1.5 : 0.5, ACCENT);
    top = H - 34;
  }

  const addField = (name: string, type: PdfField["type"], more: Partial<PdfField> = {}) => {
    const f: PdfField = { name, type, widgets: [], ...more };
    out.fields.push(f);
    return f;
  };
  const addWidget = (f: PdfField, x: number, y: number, w: number, h: number, look: Look = {}) => {
    const b = look.border ? look.bw ?? 0 : 0; // the box grows by half its border on each side
    f.widgets.push({ page, rect: [x - b / 2, y - b / 2, x + w + b / 2, y + h + b / 2], ...look });
  };

  // ---- one question
  function placeQuestion(q: Field, x: number, w: number, draw: boolean, labelsBeside = false): number {
    const answer = answers[q.id];
    const required = isRequired(q, answers), always = required && !!q.required;
    const blank = answer === undefined || answer === "" || answer === false || (Array.isArray(answer) && !answer.length);
    let look: Look = required && blank ? { border: RED, bw: 1.25, bg: WHITE } : { border: INK, bw: 0.75, bg: WHITE };
    if (activeRules(q).length) look = { ...look, bg: null };
    const t0 = top, number = numbers.get(q.id) ?? "", numberW = number ? width(number, LABEL, true) + 4 : 0;

    if (q.kind === "check") {
      const lines = wrap(q.label, TEXT, w - 14 - numberW);
      if (draw) {
        addWidget(addField(q.id, "check", { tooltip: q.label, required: always, value: answer === true }), x, t0 - 10, 9, 9, look);
        if (required) text("*", x + 14 + numberW + width(lines[0] ?? "", TEXT) + 2, t0 - 8, 8.5, true, RED);
        if (number) text(number, x + 14, t0 - 8, LABEL, true, ACCENT);
        lines.forEach((l, i) => text(l, x + 14 + numberW, t0 - 8 - i * 10, TEXT));
      }
      return Math.max(11, lines.length * 10);
    }

    const label = safe(q.label), options = q.options ?? [];
    let labelW = numberW + width(`${label}:`, TEXT) + (required ? 8 : 0) + 10;
    if ((q.kind === "radio" || q.kind === "checks") && labelW + options.reduce((a, o) => a + optionWidth(o), 0) <= w) {
      if (draw) {
        if (number) text(number, x, t0 - 9, LABEL, true, ACCENT);
        text(`${label}:`, x + numberW, t0 - 9, TEXT);
        if (required) text("*", x + numberW + width(`${label}:`, TEXT) + 2, t0 - 9, 8.5, true, RED);
        placeOptions(q, options, answer, look, always, (_i, cx) => [cx, t0 - 10.5, t0 - 9], x + labelW);
      }
      return 13;
    }

    const beside = q.beside;
    if (beside || (labelsBeside && canLabelBeside(q, w))) {
      labelW = inlineLabelWidth(q);
      const labelY = t0 - (beside ? 9 : 10.5);
      if (draw) {
        if (number) text(number, x, labelY, LABEL, true, ACCENT);
        text(`${label}:`, x + numberW, labelY, LABEL);
        if (required) text("*", x + numberW + width(`${label}:`, LABEL) + 2, labelY, 8.5, true, RED);
        placeBox(q, x + labelW + (beside ? BESIDE_GAP : 0), t0 - 1 - BOX, beside || w - labelW, BOX, answer, look, always);
      }
      return beside ? BOX : BOX + 2;
    }

    if (draw) {
      if (number) text(number, x, t0 - 7, LABEL, true, ACCENT);
      text(label, x + numberW, t0 - 7, LABEL);
      if (required) text("*", x + numberW + width(label, LABEL) + 2, t0 - 7, 8.5, true, RED);
    }
    let y = t0 - 10;
    if (q.kind === "select") {
      if (draw) placeBox(q, x, y - BOX, w, BOX, answer, look, always);
      return 10 + BOX;
    }
    if (hasOptions(q.kind)) {
      let cx = x;
      const spots: [number, number][] = [];
      for (const o of options) {
        const span = optionWidth(o);
        if (cx > x && cx + span > x + w) { cx = x; y -= 12; }
        spots.push([cx, y]);
        cx += span;
        if (span > w) y -= 11 * (wrap(o, TEXT, w - 12).length - 1);
      }
      if (draw) placeOptions(q, options, answer, look, always, i => [spots[i][0], spots[i][1] - 10.5, spots[i][1] - 9], x, x + w);
      return t0 - y + 12;
    }
    const h = q.kind === "long" ? 50 + (extra[q.id] ?? 0) : BOX;
    if (draw) placeBox(q, x, y - h, w, h, answer, look, always);
    return 10 + h;
  }

  function placeOptions(q: Field, options: string[], answer: Values[string], look: Look, always: boolean, where: (i: number, cx: number) => [number, number, number], cx: number, right?: number) {
    const group = q.kind === "radio"
      ? addField(q.id, "radio", { tooltip: q.label, required: always, options: options.map(safe), value: typeof answer === "string" && options.includes(answer) ? options.indexOf(answer) : null })
      : undefined;
    options.forEach((o, i) => {
      const [bx, by, ty] = where(i, cx);
      if (group) addWidget(group, bx, by, 9, 9, { state: String(i), ...look, bg: look.bg ?? WHITE });
      else addWidget(addField(`${q.id}__${i}`, "check", { tooltip: `${q.label}: ${o}`, value: Array.isArray(answer) && answer.includes(o) }), bx, by, 9, 9, look);
      const lines = right !== undefined && bx + optionWidth(o) > right ? wrap(o, TEXT, right - bx - 12) : [safe(o)];
      lines.forEach((l, k) => text(l, bx + 12, ty - 11 * k, TEXT));
      cx = bx + optionWidth(o);
    });
  }

  function placeBox(q: Field, x: number, y: number, w: number, h: number, answer: Values[string], look: Look, always: boolean) {
    const str = typeof answer === "string" ? answer : "";
    if (q.kind === "select") {
      const value = str && (q.options ?? []).includes(str) ? safe(str) : null;
      addWidget(addField(q.id, "choice", { tooltip: q.label, required: always, options: (q.options ?? []).map(safe), value, size: TEXT }), x, y, w, h, look);
    } else if (q.kind === "date") {
      // layout.py: a drop-down of real dates ("id__list"), and a calendar box under it shown by Acrobat's JavaScript
      addWidget(addField(`${q.id}__list`, "choice", { tooltip: safe(q.label), value: str || null, size: TEXT }), x, y, w, h, look);
      addWidget(addField(q.id, "text", { tooltip: `${safe(q.label)} (DD/MM/YYYY)`, value: str, size: TEXT, format: "date" }), x, y, w, h, { hidden: true, ...look });
    } else {
      const value = str ? safe(str).slice(0, q.max || undefined) : "";
      const room = w - 6, oneLine = q.kind === "text" ? safe(str).replace(/\n/g, " ") : "";
      addWidget(addField(q.id, "text", {
        tooltip: q.label, required: always, multiline: q.kind === "long", max: q.max, value, format: q.format, readOnly: !!q.words?.length,
        size: Math.min(TEXT, oneLine ? (TEXT * room) / Math.max(room, width(oneLine, TEXT)) : TEXT),
      }), x, y, w, h, look);
    }
  }

  // ---- measuring
  const inlineLabelWidth = (q: Field) => {
    const n = numbers.get(q.id), numberW = n ? width(n, LABEL, true) + 4 : 0;
    return numberW + width(`${safe(q.label)}:`, LABEL) + (q.required || q.requiredIf ? 7 : 0) + 6;
  };
  const canLabelBeside = (q: Field, w: number) =>
    (q.kind === "text" || q.kind === "date" || q.kind === "select") && (q.max || 35) <= 70 &&
    inlineLabelWidth(q) <= w * 0.65 && w - inlineLabelWidth(q) >= Math.min(boxWidthNeeded(q), 110);

  function boxWidthNeeded(q: Field): number {
    const k = q.kind, max = q.max;
    if (k === "long") return Infinity;
    if (k === "check") return 0;
    if (k === "date") return 96;
    if (k === "select") return Math.max(...(q.options?.length ? q.options : [""]).map(o => width(safe(o), TEXT))) + 24;
    if (hasOptions(k)) return (q.options ?? []).reduce((a, o) => a + optionWidth(o), 0);
    if (q.format === "number" || (max || 99) <= 3) return 40;
    const m = max || 35;
    return m <= 20 ? 100 : m <= 35 ? 165 : (max || 0) <= 70 ? 330 : Infinity;
  }

  function columnsNeeded(q: Field, labelAbove = false): number {
    if (q.cols) return q.cols;
    const columnW = (W - 2 * M - (COLUMNS - 1) * COLUMN_GAP) / COLUMNS;
    const label = width(safe(q.label), q.kind === "check" ? TEXT : LABEL) + (q.kind === "check" ? 16 : 10) + 18;
    const box = boxWidthNeeded(q);
    const least = q.kind === "check" && triggers.has(q.id) ? COLUMNS / 3 : 1;
    const need = q.kind === "radio" || q.kind === "checks" ? label + box + 12
      : q.kind === "long" || labelAbove ? Math.max(label, box)
      : Math.max(label, Math.min(inlineLabelWidth(q) + box, label + box));
    for (let n = least; n < COLUMNS; n++) if (n * columnW + (n - 1) * COLUMN_GAP >= need) return n;
    return COLUMNS;
  }

  function isFollowUp(q: Field, seen = new Set<string>()): boolean {
    for (const r of [...(q.requiredIf ?? []), ...(q.activeIf ?? [])]) {
      const parent = byId.get(r.field);
      if (!parent || seen.has(parent.id)) continue;
      seen.add(parent.id);
      if (parent.kind === "check" || isFollowUp(parent, seen)) return true;
    }
    return false;
  }

  const inside = (a: Area) => {
    const w = a.w - 2 * PAD, columnW = (w - (a.cols - 1) * COLUMN_GAP) / a.cols;
    return { x: a.x + PAD, w, span: (n: number) => n * columnW + (n - 1) * COLUMN_GAP };
  };

  function rowsOf(s: Section, cols: number): Field[][] {
    const rows: Field[][] = [];
    let used = cols, last: Field | undefined;
    for (const q of s.fields) {
      const n = Math.min(cols, columnsNeeded(q));
      if (used + n > cols || triggers.has(q.id) || q.kind === "check" || last?.kind === "check" || (last && isFollowUp(last) !== isFollowUp(q))) {
        rows.push([]);
        used = 0;
      }
      rows[rows.length - 1].push(q);
      used += n;
      last = q;
    }
    return rows;
  }

  function cells(row: Field[], area: Area): { q: Field; x: number; w: number; n: number }[] {
    if (isFollowUp(row[0])) area = { ...area, x: area.x + INDENT, w: area.w - INDENT };
    const { x: x0, span } = inside(area);
    const n = row.map(q => Math.min(area.cols, columnsNeeded(q)));
    const grows = row.map(q => !q.cols && (q.kind === "long" || q.kind === "select" || (q.kind === "text" && q.format !== "number" && (q.max || 99) > 3)));
    let growing = grows.filter(Boolean).length, spare = area.cols - n.reduce((a, b) => a + b, 0);
    if (growing) {
      for (let i = 0; i < row.length; i++) {
        if (!grows[i]) continue;
        const add = Math.ceil(spare / growing); // python: -(-spare // growing), spare and growing whole numbers
        growing -= 1;
        n[i] += add;
        spare -= add;
      }
    }
    let x = x0;
    return row.map((q, i) => { const w = span(n[i]), c = { q, x, w, n: n[i] }; x += w + COLUMN_GAP; return c; });
  }

  const labelsBeside = (row: Field[], area: Area) => cells(row, area).every(({ q, w }) => q.kind === "radio" || q.kind === "checks" || canLabelBeside(q, w));
  const rowHeight = (row: Field[], area: Area) => {
    const beside = labelsBeside(row, area);
    return Math.max(...cells(row, area).map(c => placeQuestion(c.q, c.x, c.w, false, beside)));
  };
  const noteLines = (s: Section, area: Area) => (s.note ? wrap(s.note, 7.5, inside(area).w) : []);
  const sectionHeight = (s: Section, area: Area) => {
    const note = noteLines(s, area);
    const rows = rowsOf(s, area.cols).reduce((a, r) => a + rowHeight(r, area) + 4, 0);
    return BAND + 4 + note.length * 9 + (note.length ? 4 : 0) + rows + (s.signoff ? SIGN_OFF : 0) + 1;
  };

  // ---- one section
  function drawSection(s: Section, index: number, area: Area, mayBreak: boolean, bottom?: number) {
    const rows = rowsOf(s, area.cols), note = noteLines(s, area), whole = sectionHeight(s, area);
    const inner = inside(area);
    const firstPart = s.signoff || s.bankOnly ? whole : BAND + 12 + (rows.length ? rowHeight(rows[0], area) : 0);
    if (mayBreak && top - firstPart < BOTTOM) newPage();
    let boxTop = top;
    const outline = () => {
      rect(area.x, top, area.w, boxTop - top, { border: INK, bw: 0.6 });
      out.sections.push({ si: index, page, x: area.x, y: top, w: area.w, h: boxTop - top });
    };

    if (s.bankOnly) {
      const fill = bottom !== undefined ? Math.max(whole, top - bottom) : whole;
      rect(area.x, top - fill, area.w, fill, { fill: BANK_SHADE });
    }
    rect(area.x, top - BAND, area.w, BAND, { fill: TINT });
    line(area.x, top - BAND, area.x + area.w, top - BAND, 0.6, INK);
    const heading = safe(`${index + 1}   ${s.title.toUpperCase()}${s.bankOnly ? "  (to be completed by the Bank)" : ""}`);
    text(heading, area.x + PAD, top - 9.3, Math.min(7.5, (7.5 * (area.w - 2 * PAD)) / width(heading, 7.5, true)), true);
    top -= BAND + 4;
    for (const l of note) { text(l, inner.x, top - 7.5, 7.5); top -= 9; }
    if (note.length) top -= 4;

    rows.forEach((row, i) => {
      const h = rowHeight(row, area);
      if (mayBreak && top - h < BOTTOM) {
        top -= 1;
        outline();
        newPage();
        boxTop = top;
        top -= 5;
      }
      if (i > 0) line(inner.x, top + 3, inner.x + inner.w, top + 3, 0.4, RULE);
      const beside = labelsBeside(row, area), placed = cells(row, area);
      for (const c of placed) {
        const used = placeQuestion(c.q, c.x, c.w, true, beside);
        out.questions.push({ id: c.q.id, si: index, page, x: c.x, y: top - used, w: c.w, h: used });
      }
      out.rows.push({ si: index, ids: placed.map(c => c.q.id), cols: placed.map(c => c.n), of: area.cols });
      top -= h + 4;
    });

    if (s.signoff) {
      for (const [x, w, label] of [[inner.x, 190, "Authorised signature(s)"], [inner.x + 210, 110, "Date"]] as const) {
        line(x, top - 28, x + w, top - 28, 0.75, INK);
        text(label, x, top - 36, 7, false, GREY);
      }
      rect(inner.x + inner.w - 150, top - 43, 150, 41, { border: INK, bw: 0.75, dash: true });
      text("Company stamp", inner.x + inner.w - 146, top - 39, 7, false, GREY);
      top -= SIGN_OFF;
    }
    top -= s.fields.some(q => q.beside) ? -2 : 1;
    if (bottom !== undefined) top = Math.min(top, bottom);
    outline();
    top -= SECTION_GAP;
  }

  // ---- the whole form
  function drawTitle() {
    newPage(true);
    text(safe(form.title), M, H - 48, 14, true);
    if (form.formCode) { const code = safe(form.formCode); text(code, W - M - width(code, 7), H - 47, 7, false, GREY); }
    top = H - 54;
    const note = `${safe(form.note ?? "")}  * Mandatory. Boxes outlined in red must be completed; a red note under a question says when it becomes mandatory.`;
    for (const l of wrap(note, 7, W - 2 * M)) { text(l, M, top - 7.5, 7, false, GREY); top -= 9; }
    top -= 5;
  }

  function drawSections() {
    const full: Area = { x: M, w: W - 2 * M, cols: COLUMNS };
    const halfW = (W - 2 * M - SECTION_GAP) / 2;
    const left: Area = { x: M, w: halfW, cols: COLUMNS / 2 }, right: Area = { ...left, x: M + halfW + SECTION_GAP };
    const optionsFit = (s: Section) => s.fields.every(q => !hasOptions(q.kind) || (q.options ?? []).every(o => optionWidth(o) < inside(left).w));
    const fitsHalf = (s: Section) => {
      const innerW = inside(left).w;
      return !s.note && !s.signoff && width(s.title.toUpperCase(), 6, true) + 30 < halfW &&
        s.fields.every(q => q.kind !== "long" && (hasOptions(q.kind) ? (q.options ?? []).every(o => optionWidth(o) < innerW) : q.kind === "check" || columnsNeeded(q, true) <= COLUMNS / 2)) &&
        sectionHeight(s, left) < 300;
    };
    const canHalf = (s: Section) => s.width !== "full" && ((s.width === "half" && optionsFit(s)) || (s.width === undefined && fitsHalf(s)));

    const sections = form.sections;
    for (let i = 0; i < sections.length; ) {
      const a = sections[i];
      let b: Section | undefined = sections[i + 1];
      if (b?.new_page) b = undefined;
      if (a.new_page && i > 0) newPage();
      const ha = b ? sectionHeight(a, left) : 0, hb = b ? sectionHeight(b, right) : 0;
      const bothHalf = b && a.width === "half" && b.width === "half";
      const sideBySide = !!b && canHalf(a) && canHalf(b) && (bothHalf || Math.min(ha, hb) >= 0.45 * Math.max(ha, hb));
      const pairHeight = Math.max(ha, hb) + SECTION_GAP;
      if (!sideBySide && a.width === "half" && optionsFit(a)) {
        if (top - sectionHeight(a, left) < BOTTOM) newPage();
        drawSection(a, i, left, false);
        i += 1;
        continue;
      }
      if (!sideBySide || (top - pairHeight < BOTTOM && top - sectionHeight(a, full) - SECTION_GAP >= BOTTOM)) {
        drawSection(a, i, full, true);
        i += 1;
        continue;
      }
      if (top - pairHeight < BOTTOM) newPage();
      const start = top, bottom = start - Math.max(ha, hb);
      drawSection(a, i, left, false, bottom);
      top = start;
      drawSection(b!, i + 1, right, false, bottom);
      i += 2;
    }
  }

  function drawQrPage() {
    newPage();
    text("APPLICATION QR CODE (FOR BANK USE)", M, H - 56, 11, true);
    let y = H - 70;
    for (const l of wrap("When the form is filled in, press Generate QR Code (under the code), then Print Form. The Bank scans the code to read the application (all the answers, as JSON). If the answers are too long for one code, a second code appears under the buttons: the Bank scans both. Do not write on or fold the codes.", 8, W - 2 * M)) {
      text(l, M, y, 8, false, GREY);
      y -= 10;
    }
    const label = 12, gap = 10, buttonH = 22;
    const size = Math.trunc((y - 4 - 46 - 2 * label - buttonH - 2 * gap) / 2);
    const x = (W - size) / 2, firstY = y - 4 - label - size, buttonsY = firstY - gap - buttonH;
    out.qr = { page, slots: [[x, firstY, size], [x, buttonsY - gap - label - size, size]], button: [(W - 312) / 2, buttonsY] };
    rect(x, firstY, size, size, { border: RULE, bw: 0.5 });
  }

  function drawFooters() {
    const count = out.pages.length;
    out.pages.forEach((_, i) => {
      line(M, 36, W - M, 36, 0.5, RULE, i);
      text(safe(form.formCode || form.title), M, 24, 7, false, GREY, i);
      const label = `Page ${i + 1} of ${count}`;
      text(label, W - M - width(label, 7.5), 24, 7.5, false, GREY, i);
      for (const [s, target, x] of [["< Previous page", i - 1, W / 2 - 90], ["Next page >", i + 1, W / 2 + 20]] as const) {
        if (target < 0 || target >= count) continue;
        text(s, x, 23.5, 7.5, true, ACCENT, i);
        out.links.push({ page: i, rect: [x - 4, 18, x + width(s, 7.5, true) + 4, 34], target });
      }
    });
  }

  drawTitle();
  drawSections();
  out.lastQuestionPage = page;
  out.spare = top - BOTTOM;
  drawQrPage();
  drawFooters();
  return out;
}

/** The form laid out the way lc-form's build does it (pdf_writer.build): twice, the second time giving the room
 *  left at the end of the last page of questions to the paragraph boxes on that page, if that adds no page. */
export function layout(form: Template, answers: Values = {}): Laid {
  const first = layOnce(form, answers, {});
  const last = first.questions.filter(q => q.page === first.lastQuestionPage && form.sections[q.si].fields.find(f => f.id === q.id)?.kind === "long").map(q => q.id);
  if (!last.length || first.spare < 20) return first;
  const each = Math.min(90, Math.floor((first.spare - 10) / last.length));
  const taller = layOnce(form, answers, Object.fromEntries(last.map(id => [id, each])));
  return taller.pages.length === first.pages.length ? taller : first;
}

/** "Check form" and "Reset form" at the top right of every page, as lc-form's step 2 adds them (on screen only). */
export const headerButtons = (pages: number) =>
  [["Check form", W - M - 136 + 4], ["Reset form", W - M - 68 + 4]].flatMap(([caption, x]) =>
    Array.from({ length: pages }, (_, page) => ({ page, caption: caption as string, x: x as number, y: H - 25, w: 64, h: 13 })));

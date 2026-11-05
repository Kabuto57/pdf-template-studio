// BUILDING THE PDF (the new design)
// Turns a form description (e.g. the LC in lc.ts) into a fillable PDF with pdf-lib:
//   1. store the description inside the PDF
//   2. title and instructions
//   3. each section: a black heading bar, then its questions, two half-width questions per row
//   4. each question: its label (red * if mandatory), then its box(es)
//   5. page footers
//   6. red frames / grey shading (no JavaScript needed), then the Acrobat checks (JavaScript)
// Three versions (`mode`):
//   "no-javascript": no scripts at all (no yellow JavaScript bar). Red frames, grey shading, date lists, page links.
//   "javascript":    everything checked by Acrobat's JavaScript, like the bank's old smart form: red outlines that
//                    follow the answers, locking, typing filters, calendar dates, "Check form", warnings before
//                    save/print. Assumes JavaScript is on; with it off, only the page links and lists work.
//   "both":          the two together (the studio's preview and the samples).
import { PDFDocument, PDFHexString, PDFName, PDFPage, PDFString, StandardFonts, rgb } from "pdf-lib";
import { addChecks, formatActions, swiftActions } from "./acrobat-script";
import { addDateLists } from "./dates";
import { ACCENT, GREY, H, INK, M, RED, RULE, TINT, W, WHITE, finishForm, tip, wrap } from "./look";
import { addRedFrames, type Blocks } from "./red-frames";
import { activeRules, isRequired } from "./rules";
import { stamp } from "./stored-template";
import { hasOptions, safe, subId, type Field, type Section, type Template, type Value, type Values } from "./types";
import { fillBase } from "./upload";

export type Mode = "both" | "javascript" | "no-javascript";

// Sizes, kept small so the LC fits on three pages while staying readable.
const BOTTOM = 39;   // start a new page below this height (the footer is under it)
const BOX = 15;      // height of a one-line answer box
const LABEL = 7.5;   // question labels
const TEXT = 8.5;    // answers, options and tick-box wording
const COLS = 12;     // the page is a grid of 12 narrow columns; each question takes as many as it needs
const CGAP = 4;      // gap between columns

/** Makes the blank form, or (with values) a filled one. */
export async function buildPdf(t: Template, values: Values = {}, mode: Mode = "both"): Promise<Uint8Array> {
  if (t.base) return fillBase(t, values); // an uploaded PDF: fill its own fields instead
  // Laid out once, then again with the room left at the end of the last page shared out to the paragraph boxes
  // (e.g. additional conditions) on that page, so the form ends without a blank stretch. Kept only if the page
  // count stays the same.
  // Only the boxes already on the last page grow, so nothing earlier moves.
  const first = await layoutPdf(t, values, mode, new Map());
  if (!first.lastLongs.length || first.spare < 20) return first.bytes;
  const each = Math.min(90, Math.floor((first.spare - 10) / first.lastLongs.length)); // ponytail: capped so one box doesn't dwarf the rest
  const second = await layoutPdf(t, values, mode, new Map(first.lastLongs.map(id => [id, each])));
  return second.pages === first.pages ? second.bytes : first.bytes;
}

async function layoutPdf(t: Template, values: Values, mode: Mode, longExtra: Map<string, number>) {

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const form = doc.getForm();
  const script = (code: string) => doc.context.obj({ S: "JavaScript", JS: PDFHexString.fromText(code) }); // a script, as a PDF action
  const js = mode === "no-javascript" ? undefined : script;
  doc.setTitle(safe(t.title));
  doc.setCreator("PDF Template Studio");

  // 1. Store the form's description inside the PDF.
  stamp(doc, t);

  // 2. The header: the issuer on every page (the buttons sit at its right in the JavaScript version), then on page 1
  //    the title, the form's reference, the instructions and what the red marks mean. `top` is the pen: it starts
  //    near the top of the page and moves down.
  let page: PDFPage = doc.addPage([W, H]), top = 0;
  const strip = (first: boolean) => {
    const who = safe(t.issuer ?? "").toUpperCase();
    if (who) page.drawText(who, { x: M, y: H - 22, size: first ? 9 : 7, font: bold, color: ACCENT });
    if (!first) page.drawText(safe(t.title), { x: M + (who ? bold.widthOfTextAtSize(who, 7) + 8 : 0), y: H - 22, size: 7, font, color: GREY });
    page.drawLine({ start: { x: M, y: H - 29 }, end: { x: W - M, y: H - 29 }, thickness: first ? 1.5 : 0.5, color: ACCENT });
  };
  const newPage = () => { page = doc.addPage([W, H]); strip(false); top = H - 34; };
  strip(true);
  page.drawText(safe(t.title), { x: M, y: H - 48, size: 14, font: bold, color: INK });
  if (t.formCode) page.drawText(safe(t.formCode), { x: W - M - font.widthOfTextAtSize(safe(t.formCode), 7), y: H - 47, size: 7, font, color: GREY });
  top = H - 54;
  const key = `${safe(t.note)}  * Mandatory. Boxes outlined in red must be completed; a red note under a question says when it becomes mandatory.`;
  for (const line of wrap(key, font, 7, W - 2 * M)) {
    page.drawText(line, { x: M, y: top - 7.5, size: 7, font, color: GREY });
    top -= 9;
  }
  top -= 5;

  // Box styles. A mandatory box is outlined in red (not only starred) until it is answered.
  const plain = { borderColor: INK, borderWidth: 0.75, backgroundColor: WHITE };
  const mandatory = { ...plain, borderColor: RED, borderWidth: 1.25 };
  const blocks: Blocks = new Map(); // where each question was drawn, for the red frames
  const shrink: ReturnType<typeof form.createTextField>[] = []; // boxes whose text shrinks to fit in Acrobat
  const longsOn = new Map<string, PDFPage>(); // the page each paragraph box landed on
  // Every question numbered by section, "3.1", "3.2", ..., so a question can be referred to ("see 14.3").
  const number = new Map(t.sections.flatMap((s, si) => s.fields.map((f, qi) => [f.id, `${si + 1}.${qi + 1}`] as const)));

  /**
   * 4. Lays out one question at (x, top) in width w. Draws it only when `draw` (otherwise just measures it).
   * Returns the height it takes.
   */
  function place(f: Field, x: number, w: number, draw: boolean, inline = false): number {
    const answer = values[f.id], required = isRequired(f, values);
    // Acrobat outlines "required" boxes in red itself. Only always-mandatory boxes get the flag: the others get the
    // red frame (red-frames.ts), which follows the tick; both would draw two red lines.
    const flag = required && !!f.required;
    const blank = answer === undefined || answer === "" || answer === false || (Array.isArray(answer) && !answer.length);
    const style = required && blank ? mandatory : plain;
    // Questions that can be switched off are see-through, so the grey "not yet" shade under them shows.
    const look = activeRules(f).length ? { ...style, backgroundColor: undefined } : style;

    // A single tick box: the box, then its label beside it.
    if (f.kind === "check") {
      const no = number.get(f.id) ?? "", noW = no ? bold.widthOfTextAtSize(no, LABEL) + 4 : 0;
      const lines = wrap(f.label, font, TEXT, w - 14 - noW);
      if (draw) {
        const box = form.createCheckBox(f.id);
        box.addToPage(page, { x, y: top - 10, width: 9, height: 9, ...look });
        tip(box, f.label);
        if (required) { // the red * after the label's first line
          if (flag) box.enableRequired();
          page.drawText("*", { x: x + 14 + noW + font.widthOfTextAtSize(lines[0] ?? "", TEXT) + 2, y: top - 8, size: 8.5, font: bold, color: RED });
        }
        if (answer === true) box.check();
        if (no) page.drawText(no, { x: x + 14, y: top - 8, size: LABEL, font: bold, color: ACCENT });
        lines.forEach((l, i) => page.drawText(l, { x: x + 14 + noW, y: top - 8 - i * 10, size: TEXT, font, color: INK }));
      }
      return Math.max(11, lines.length * 10);
    }

    // Pick one / tick any whose label and options fit on one line: "Confirmation charges: *  ( ) Applicant  ( ) Beneficiary".
    const no = number.get(f.id) ?? "", noW = no ? bold.widthOfTextAtSize(no, LABEL) + 4 : 0;
    const inlineW = noW + font.widthOfTextAtSize(`${safe(f.label)}:`, TEXT) + (required ? 8 : 0) + 10;
    const choices = f.kind === "radio" || f.kind === "checks"; // (a drop-down list has options too, but is one box)
    if (choices && inlineW + (f.options ?? []).reduce((sum, o) => sum + optionWidth(o), 0) <= w) {
      const options = f.options ?? [], ox = x + inlineW;
      if (draw) {
        if (no) page.drawText(no, { x, y: top - 9, size: LABEL, font: bold, color: ACCENT });
        blocks.set(f.id, { page, label: { x: x + noW, y: top - 9, text: `${safe(f.label)}:` } });
        page.drawText(`${safe(f.label)}:`, { x: x + noW, y: top - 9, size: TEXT, font, color: INK });
        if (required) page.drawText("*", { x: x + noW + font.widthOfTextAtSize(`${safe(f.label)}:`, TEXT) + 2, y: top - 9, size: 8.5, font: bold, color: RED });
        const group = f.kind === "radio" ? form.createRadioGroup(f.id) : undefined;
        if (group) { tip(group, f.label); if (flag) group.enableRequired(); }
        let cx = ox;
        options.forEach((option, i) => {
          const box = { x: cx, y: top - 10.5, width: 9, height: 9, ...look };
          if (group) group.addOptionToPage(safe(option), page, box);
          else {
            const tickBox = form.createCheckBox(subId(f.id, i));
            tickBox.addToPage(page, box);
            tip(tickBox, `${f.label}: ${option}`);
            if (Array.isArray(answer) && answer.includes(option)) tickBox.check();
          }
          page.drawText(safe(option), { x: cx + 12, y: top - 9, size: TEXT, font, color: INK });
          cx += optionWidth(option);
        });
        if (group && typeof answer === "string" && options.includes(answer)) group.select(safe(answer));
        blocks.get(f.id)!.box = [ox - 3, top - 13, cx - ox - 4, 16]; // all the options, framed as one
      }
      return 13;
    }

    // A one-line box whose label is short enough: the label beside it, "Name: [          ]", as on the smart form.
    // (Only when the whole line is set this way, so a line never mixes labels beside and above their boxes.)
    const said = shown(f), labelW = inlineLabelW(f);
    if (inline && canInline(f, w)) {
      if (draw) {
        if (no) page.drawText(no, { x, y: top - 10.5, size: LABEL, font: bold, color: ACCENT });
        blocks.set(f.id, { page, label: { x: x + noW, y: top - 10.5, text: `${said}:` } });
        page.drawText(`${said}:`, { x: x + noW, y: top - 10.5, size: LABEL, font, color: INK });
        if (required) page.drawText("*", { x: x + noW + font.widthOfTextAtSize(`${said}:`, LABEL) + 2, y: top - 10.5, size: 8.5, font: bold, color: RED });
        drawBox(f, x + labelW, top - 1 - BOX, w - labelW, BOX, answer, look, flag);
      }
      return BOX + 2;
    }

    // Everything else: the label on top (with a red * if mandatory), the box(es) below.
    if (draw) {
      const lx = x + noW;
      if (no) page.drawText(no, { x, y: top - 7, size: LABEL, font: bold, color: ACCENT });
      blocks.set(f.id, { page, label: { x: lx, y: top - 7, text: said } });
      page.drawText(said, { x: lx, y: top - 7, size: LABEL, font, color: INK });
      if (required) page.drawText("*", { x: lx + font.widthOfTextAtSize(said, LABEL) + 2, y: top - 7, size: 8.5, font: bold, color: RED });
    }
    let y = top - 10;

    // A drop-down list.
    if (f.kind === "select") {
      if (draw) drawBox(f, x, y - BOX, w, BOX, answer, look, flag);
      return 10 + BOX;
    }

    // Pick one (radio buttons) or tick any (one tick box per option), wrapping onto more lines when needed.
    if (hasOptions(f.kind)) {
      const options = f.options ?? [];
      const group = f.kind === "radio" && draw ? form.createRadioGroup(f.id) : undefined;
      if (group) { tip(group, f.label); if (flag) group.enableRequired(); }
      let cx = x, right = x;
      options.forEach((option, i) => {
        const span = optionWidth(option);
        if (cx > x && cx + span > x + w) { cx = x; y -= 12; } // next line
        if (draw) {
          const box = { x: cx, y: y - 10.5, width: 9, height: 9, ...look };
          if (group) {
            group.addOptionToPage(safe(option), page, box);
          } else {
            const tickBox = form.createCheckBox(subId(f.id, i));
            tickBox.addToPage(page, box);
            tip(tickBox, `${f.label}: ${option}`);
            if (Array.isArray(answer) && answer.includes(option)) tickBox.check();
          }
          page.drawText(safe(option), { x: cx + 12, y: y - 9, size: TEXT, font, color: INK });
        }
        right = Math.max(right, cx + span - 10);
        cx += span;
      });
      if (group && typeof answer === "string" && options.includes(answer)) group.select(safe(answer));
      if (draw) blocks.get(f.id)!.box = [x - 3, y - 13, right - x + 6, top - 10 - y + 16]; // all the options, framed as one
      return top - y + 12;
    }

    // A date, or a text box (one line, or a paragraph).
    const h = f.kind === "long" ? 50 + (longExtra.get(f.id) ?? 0) : BOX;
    if (draw && f.kind === "long") longsOn.set(f.id, page);
    if (draw) drawBox(f, x, y - h, w, h, answer, look, flag);
    return 10 + h;
  }

  /** The answer box itself: a drop-down list, a date, or a text box (one line or a paragraph), at (x, y) w by h. */
  function drawBox(f: Field, x: number, y: number, w: number, h: number, answer: Value | undefined, look: object, flag: boolean) {
    if (f.kind === "select") {
      const list = form.createDropdown(f.id);
      list.addOptions((f.options ?? []).map(safe));
      tip(list, f.label);
      if (flag) list.enableRequired();
      if (typeof answer === "string" && f.options?.includes(answer)) list.select(safe(answer));
      list.addToPage(page, { x, y, width: w, height: h, font, ...look });
      list.setFontSize(TEXT);
    } else if (f.kind === "date") {
      addDateLists(form, page, f.id, f.label, answer, { x, y, width: w, height: h }, font, TEXT, look, js);
    } else {
      const box = form.createTextField(f.id);
      if (f.kind === "long") box.enableMultiline();
      if (flag) box.enableRequired();
      tip(box, f.label);
      if (f.max) box.setMaxLength(f.max);
      if (typeof answer === "string" && answer) box.setText(safe(answer).slice(0, f.max));
      box.addToPage(page, { x, y, width: w, height: h, font, ...look });
      // A one-line box narrower than a full line of its text: an answer that doesn't fit is shrunk to fit, so a long
      // name or address still shows in full, on screen and printed. Here for answers already filled in; in Acrobat
      // by "auto" font size (set after the appearances are drawn, below).
      const text = f.kind === "text" && typeof answer === "string" ? safe(answer).replace(/\s+/g, " ") : "", room = w - 6;
      box.setFontSize(Math.min(TEXT, text ? TEXT * room / Math.max(room, font.widthOfTextAtSize(text, TEXT)) : TEXT));
      if (f.kind === "text" && room < font.widthOfTextAtSize("N".repeat(f.max ?? 35), TEXT)) shrink.push(box);
      if (js) box.acroField.dict.set(PDFName.of("AA"), f.format ? formatActions(doc, js, f) : swiftActions(doc, js)); // Acrobat: refuse wrong keys
    }
  }
  const optionWidth = (option: string) => 12 + font.widthOfTextAtSize(safe(option), TEXT) + 10;
  // The label as shown: the question's full wording, as on the bank's form.
  const shown = (f: Field) => safe(f.label);
  // A label beside its box ("Name: [   ]"), and whether a question can be set that way at width w.
  const inlineLabelW = (f: Field) => (number.has(f.id) ? bold.widthOfTextAtSize(number.get(f.id)!, LABEL) + 4 : 0) + font.widthOfTextAtSize(`${shown(f)}:`, LABEL) + (f.required || f.requiredIf ? 7 : 0) + 6;
  const canInline = (f: Field, w: number) =>
    (f.kind === "text" || f.kind === "date" || f.kind === "select") && (f.max ?? 35) <= 70 && // a very long line keeps its full width
    inlineLabelW(f) <= w * 0.65 && w - inlineLabelW(f) >= Math.min(boxNeed(f), 110);
  /** How wide a question's box(es) need to be. */
  const boxNeed = (f: Field) =>
    f.kind === "long" ? Infinity :
    f.kind === "check" ? 0 :
    f.kind === "date" ? 96 :
    f.kind === "select" ? Math.max(...(f.options ?? []).map(o => font.widthOfTextAtSize(safe(o), TEXT))) + 24 :
    hasOptions(f.kind) ? (f.options ?? []).reduce((sum, o) => sum + optionWidth(o), 0) :
    f.format === "number" || (f.max ?? 99) <= 3 ? 40 :
    (f.max ?? 35) <= 20 ? 100 : (f.max ?? 35) <= 35 ? 165 : (f.max ?? 0) <= 70 ? 330 : Infinity;

  // 3. The sections, on a grid of 12 narrow columns. Each question takes the width it needs: a little for a number,
  //    a date or a currency, a third of the page for a 35-character name or address line (room for the whole line),
  //    more for long text or many options. Questions fill a line left to
  //    right; a tick box, or a question that other questions depend on ("Drafts at", "Shipment from"), starts a new line,
  //    so it sits with the boxes it switches on, as on the bank's own form.
  const colW = (W - 2 * M - (COLS - 1) * CGAP) / COLS;
  const spanWidth = (n: number) => n * colW + (n - 1) * CGAP;
  const triggers = new Set(t.sections.flatMap(s => s.fields).flatMap(f => [...(f.requiredIf ?? []), ...(f.activeIf ?? [])]).map(r => r.field));
  const span = (f: Field, above = false) => {
    const label = font.widthOfTextAtSize(safe(f.label), f.kind === "check" ? TEXT : LABEL) + (f.kind === "check" ? 16 : 10) + 18; // + its number
    const box = boxNeed(f);
    // A tick box that switches on other boxes takes at least a third of the line, so the boxes after it line up
    // from one row to the next (originals, copies, ...).
    const least = f.kind === "check" && triggers.has(f.id) ? COLS / 3 : 1;
    const need = f.kind === "radio" || f.kind === "checks" ? label + box + 12 : // options sit beside their label when they fit
      f.kind === "long" || above ? Math.max(label, box) : Math.max(label, Math.min(inlineLabelW(f) + box, label + box));
    for (let n = least; n < COLS; n++) if (spanWidth(n) >= need) return n;
    return COLS;
  };

  // Each section is a ruled box, like the panels on the bank's smart form: an outline, a grey heading band with a
  // rule under it, and a light line between its rows. `Area` is where a section's box goes: its left edge, its
  // width and how many grid columns its content has (12 = the full page, 6 = half).
  type Area = { x: number; w: number; cols: number };
  const PAD = 6;           // inside the box, around the questions
  const BAND = 13;         // the heading band
  const SECTION_GAP = 5;   // between boxes
  const inner = (a: Area) => { const w = a.w - 2 * PAD, cw = (w - (a.cols - 1) * CGAP) / a.cols; return { x: a.x + PAD, w, sw: (n: number) => n * cw + (n - 1) * CGAP }; };
  // A tick box sits on a line of its own, and the questions it switches on (and theirs, in turn) are indented under
  // it, like the smart form: "[ ] Confirmation required" then, indented, "Confirmation charges: ( ) Applicant ...".
  const byId = new Map(t.sections.flatMap(s => s.fields).map(f => [f.id, f]));
  const under = (f: Field, seen = new Set<string>()): boolean => [...(f.requiredIf ?? []), ...(f.activeIf ?? [])].some(r => {
    const p = byId.get(r.field);
    if (!p || seen.has(p.id)) return false;
    seen.add(p.id);
    return p.kind === "check" || under(p, seen);
  });
  const INDENT = 14;
  const lines = (s: Section, cols: number) => {
    const rows: Field[][] = [];
    let used = cols, last: Field | undefined;
    for (const f of s.fields) {
      const n = Math.min(cols, span(f));
      if (used + n > cols || triggers.has(f.id) || f.kind === "check" || last?.kind === "check" || (last && under(last) !== under(f))) { rows.push([]); used = 0; }
      rows[rows.length - 1].push(f);
      used += n;
      last = f;
    }
    return rows;
  };
  // Columns left over at the end of a line go to its text boxes and lists (not dates or numbers, which keep their
  // own short width), shared out evenly, so most lines end on the box's right edge.
  const layout = (row: Field[], area: Area) => {
    const a = under(row[0]) ? { ...area, x: area.x + INDENT, w: area.w - INDENT } : area; // indented under its tick box
    const { x: x0, sw } = inner(a);
    const n = row.map(f => Math.min(a.cols, span(f)));
    const grow = row.map(f => f.kind === "long" || f.kind === "select" || (f.kind === "text" && f.format !== "number" && (f.max ?? 99) > 3));
    let k = grow.filter(Boolean).length, spare = a.cols - n.reduce((p, q) => p + q, 0), x = x0;
    if (k) row.forEach((_, i) => { if (grow[i]) { const add = Math.ceil(spare / k--); n[i] += add; spare -= add; } });
    return row.map((f, i) => { const w = sw(n[i]), at = x; x += w + CGAP; return { f, x: at, w }; });
  };
  // A line's labels go beside their boxes when every question on it can be set that way.
  const inlineRow = (row: Field[], a: Area) => layout(row, a).every(c => c.f.kind === "radio" || c.f.kind === "checks" || canInline(c.f, c.w));
  const rowHeight = (row: Field[], a: Area) => { const inl = inlineRow(row, a); return Math.max(...layout(row, a).map(c => place(c.f, c.x, c.w, false, inl))); };
  const SIGN = 46; // the signature, date and stamp lines
  const noteOf = (s: Section, a: Area) => (s.note ? wrap(s.note, font, 7.5, inner(a).w) : []);
  const sectionHeight = (s: Section, a: Area) => {
    const note = noteOf(s, a);
    return BAND + 4 + note.length * 9 + (note.length ? 4 : 0) + lines(s, a.cols).reduce((sum, r) => sum + rowHeight(r, a) + 4, 0) + (s.signoff ? SIGN : 0) + 1;
  };

  /** Draws one section's box at (a.x, top). `breaks`: may continue on a new page between rows. */
  function drawSection(s: Section, si: number, a: Area, breaks: boolean, bottom?: number) {
    const rows = lines(s, a.cols), note = noteOf(s, a), whole = sectionHeight(s, a), { x: cx, w: cw } = inner(a);
    // On a new page if not even its first row fits. The sign-off and the bank's panel are kept whole on one page.
    if (breaks && top - ((s.signoff || s.bankOnly) ? whole : BAND + 12 + (rows[0] ? rowHeight(rows[0], a) : 0)) < BOTTOM) newPage();
    let boxTop = top;
    const outline = () => page.drawRectangle({ x: a.x, y: top, width: a.w, height: boxTop - top, borderColor: INK, borderWidth: 0.6 });
    const fill = bottom !== undefined ? Math.max(whole, top - bottom) : whole;
    if (s.bankOnly) page.drawRectangle({ x: a.x, y: top - fill, width: a.w, height: fill, color: rgb(0.95, 0.95, 0.95) }); // the bank's panel is shaded
    // The heading band: "3   APPLICANT" in black on grey, shrunk a little if it's too long for the box.
    page.drawRectangle({ x: a.x, y: top - BAND, width: a.w, height: BAND, color: TINT });
    page.drawLine({ start: { x: a.x, y: top - BAND }, end: { x: a.x + a.w, y: top - BAND }, thickness: 0.6, color: INK });
    const heading = safe(`${si + 1}   ${s.title.toUpperCase()}${s.bankOnly ? "  (to be completed by the Bank)" : ""}`);
    page.drawText(heading, { x: a.x + PAD, y: top - 9.3, size: Math.min(7.5, 7.5 * (a.w - 2 * PAD) / bold.widthOfTextAtSize(heading, 7.5)), font: bold, color: INK });
    top -= BAND + 4;
    for (const line of note) { page.drawText(line, { x: cx, y: top - 7.5, size: 7.5, font, color: INK }); top -= 9; }
    if (note.length) top -= 4;
    rows.forEach((row, i) => {
      const h = rowHeight(row, a);
      if (breaks && top - h < BOTTOM) { top -= 1; outline(); newPage(); boxTop = top; top -= 5; } // the box carries on over the page
      if (i > 0) page.drawLine({ start: { x: cx, y: top + 3 }, end: { x: cx + cw, y: top + 3 }, thickness: 0.4, color: RULE }); // between rows
      const inl = inlineRow(row, a);
      for (const c of layout(row, a)) place(c.f, c.x, c.w, true, inl);
      top -= h + 4;
    });
    // Signature, date and company stamp: lines to sign on paper after printing.
    if (s.signoff) {
      const line = (x: number, w: number, label: string) => {
        page.drawLine({ start: { x, y: top - 28 }, end: { x: x + w, y: top - 28 }, thickness: 0.75, color: INK });
        page.drawText(label, { x, y: top - 36, size: 7, font, color: GREY });
      };
      line(cx, 190, "Authorised signature(s)");
      line(cx + 210, 110, "Date");
      page.drawRectangle({ x: cx + cw - 150, y: top - 43, width: 150, height: 41, borderColor: INK, borderWidth: 0.75, borderDashArray: [2, 2] });
      page.drawText("Company stamp", { x: cx + cw - 146, y: top - 39, size: 7, font, color: GREY });
      top -= SIGN;
    }
    top -= 1;
    if (bottom !== undefined) top = Math.min(top, bottom); // as tall as the panel beside it
    outline();
    top -= SECTION_GAP;
  }

  // Two columns where it fits, without changing the order: two sections that follow each other and both work at
  // half width (no paragraph boxes; every box, option and heading fits half the page) sit side by side, the first
  // on the left, like the panels on the bank's smart form. Everything else takes the full width, in order.
  const FULL: Area = { x: M, w: W - 2 * M, cols: COLS };
  const halfW = (W - 2 * M - SECTION_GAP) / 2;
  const LEFT: Area = { x: M, w: halfW, cols: COLS / 2 }, RIGHT: Area = { ...LEFT, x: M + halfW + SECTION_GAP };
  const halfOK = (s: Section) => !s.note && !s.signoff &&
    bold.widthOfTextAtSize(`${s.title.toUpperCase()}`, 6) + 30 < halfW &&
    s.fields.every(f => f.kind !== "long" && (hasOptions(f.kind) ? (f.options ?? []).every(o => optionWidth(o) < inner(LEFT).w) : f.kind === "check" || span(f, true) <= COLS / 2)) &&
    sectionHeight(s, LEFT) < 300;
  for (let si = 0; si < t.sections.length; si++) {
    const a = t.sections[si], b = t.sections[si + 1];
    // Side by side only when they're of similar height, so the shorter doesn't leave a big hole under it.
    const ha = b ? sectionHeight(a, LEFT) : 0, hb = b ? sectionHeight(b, RIGHT) : 0;
    if (!(b && halfOK(a) && halfOK(b) && Math.min(ha, hb) >= 0.45 * Math.max(ha, hb))) { drawSection(a, si, FULL, true); continue; }
    const h = Math.max(ha, hb) + SECTION_GAP;
    // The pair doesn't fit the rest of the page, but the first fits full width: it goes there (order unchanged),
    // and the next section carries on from it.
    if (top - h < BOTTOM && top - sectionHeight(a, FULL) - SECTION_GAP >= BOTTOM) { drawSection(a, si, FULL, true); continue; }
    if (top - h < BOTTOM) newPage();
    // Both panels drawn to the same height, so a row of panels ends on one line.
    const start = top, bottom = start - Math.max(ha, hb);
    drawSection(a, si, LEFT, false, bottom);
    top = start;
    drawSection(b, si + 1, RIGHT, false, bottom);
    si++;
  }

  // 5. Footers: the title, and "Page x of y".
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 36 }, end: { x: W - M, y: 36 }, thickness: 0.5, color: RULE });
    p.drawText(safe(t.formCode ?? t.title), { x: M, y: 24, size: 7, font, color: GREY });
    const n = `Page ${i + 1} of ${pages.length}`;
    p.drawText(n, { x: W - M - font.widthOfTextAtSize(n, 7.5), y: 24, size: 7.5, font, color: GREY });
    // "< Previous page" / "Next page >": plain PDF links, so they work in every viewer, JavaScript on or off.
    const link = (text: string, to: PDFPage, x: number) => {
      const w = bold.widthOfTextAtSize(text, 7.5);
      p.drawText(text, { x, y: 23.5, size: 7.5, font: bold, color: ACCENT });
      const annot = doc.context.register(doc.context.obj({
        Type: "Annot", Subtype: "Link", Rect: [x - 4, 18, x + w + 4, 34], Border: [0, 0, 0],
        A: { S: "GoTo", D: [to.ref, PDFName.of("XYZ"), null, null, null] },
      }));
      p.node.addAnnot(annot);
    };
    if (i > 0) link("< Previous page", pages[i - 1], W / 2 - 90);
    if (i < pages.length - 1) link("Next page >", pages[i + 1], W / 2 + 20);
  });

  // 6. Conditional highlighting without JavaScript, then the checks for when Acrobat runs JavaScript.
  if (mode !== "javascript") addRedFrames(doc, form, t, values, { blocks, font });
  // "Check form" and "Reset form" at the top right of every page.
  if (js && t.sections.some(s => s.fields.some(f => f.required || f.requiredIf)))
    addChecks(doc, form, pages[0], font, t, js, undefined, pages);
  // JavaScript version: "Reset form" goes back to the answers the form started with (e.g. Full Swift), not blank.
  if (mode === "javascript") for (const f of form.getFields()) {
    const v = f.acroField.dict.get(PDFName.of("V"));
    if (v) f.acroField.dict.set(PDFName.of("DV"), v);
  }
  form.updateFieldAppearances(font);
  // Font size 0 = Acrobat sizes the text to fit as it is typed. Set in the dictionaries directly, after the
  // appearances are drawn, so pdf-lib keeps the 8 pt look for the box as it is now.
  for (const box of shrink)
    for (const d of [box.acroField.dict, ...box.acroField.getWidgets().map(w => w.dict)]) {
      const da = d.lookup(PDFName.of("DA"));
      if (da instanceof PDFString) d.set(PDFName.of("DA"), PDFString.of(da.asString().replace(/[\d.]+ Tf/, "0 Tf")));
    }
  finishForm(doc, font);
  const last = doc.getPages()[doc.getPageCount() - 1];
  return { bytes: await doc.save(), pages: doc.getPageCount(), spare: top - BOTTOM, lastLongs: [...longsOn].filter(([, p]) => p === last).map(([id]) => id) };
}

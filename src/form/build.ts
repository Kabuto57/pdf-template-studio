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
import { hasOptions, safe, subId, type Field, type Template, type Values } from "./types";
import { fillBase } from "./upload";

export type Mode = "both" | "javascript" | "no-javascript";

// Sizes, kept small so the LC fits on three pages while staying readable.
const BOTTOM = 42;   // start a new page below this height (the footer is under it)
const BOX = 15;      // height of a one-line answer box
const LABEL = 7.5;   // question labels
const TEXT = 8.5;    // answers, options and tick-box wording
const COLS = 12;     // the page is a grid of 12 narrow columns; each question takes as many as it needs
const CGAP = 4;      // gap between columns

/** Makes the blank form, or (with values) a filled one. */
export async function buildPdf(t: Template, values: Values = {}, mode: Mode = "both"): Promise<Uint8Array> {
  if (t.base) return fillBase(t, values); // an uploaded PDF: fill its own fields instead

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
  // Every question numbered by section, "3.1", "3.2", ..., so a question can be referred to ("see 14.3").
  const number = new Map(t.sections.flatMap((s, si) => s.bankOnly ? [] : s.fields.map((f, qi) => [f.id, `${si + 1}.${qi + 1}`] as const)));

  /**
   * 4. Lays out one question at (x, top) in width w. Draws it only when `draw` (otherwise just measures it).
   * Returns the height it takes.
   */
  function place(f: Field, x: number, w: number, draw: boolean): number {
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
        if (required) { if (flag) box.enableRequired(); page.drawText("*", { x: x - 7, y: top - 10, size: 9, font: bold, color: RED }); }
        if (answer === true) box.check();
        if (no) page.drawText(no, { x: x + 14, y: top - 8, size: LABEL, font: bold, color: ACCENT });
        lines.forEach((l, i) => page.drawText(l, { x: x + 14 + noW, y: top - 8 - i * 10, size: TEXT, font, color: INK }));
      }
      return Math.max(11, lines.length * 10);
    }

    // Everything else: the label on top (with a red * if mandatory), the box(es) below.
    if (draw) {
      const no = number.get(f.id) ?? "", lx = x + (no ? bold.widthOfTextAtSize(no, LABEL) + 4 : 0);
      if (no) page.drawText(no, { x, y: top - 7, size: LABEL, font: bold, color: ACCENT });
      blocks.set(f.id, { page, label: { x: lx, y: top - 7, text: safe(f.label) } });
      page.drawText(safe(f.label), { x: lx, y: top - 7, size: LABEL, font, color: INK });
      if (required) page.drawText("*", { x: lx + font.widthOfTextAtSize(safe(f.label), LABEL) + 2, y: top - 7, size: 8.5, font: bold, color: RED });
    }
    let y = top - 10;

    // A drop-down list.
    if (f.kind === "select") {
      if (draw) {
        const list = form.createDropdown(f.id);
        list.addOptions((f.options ?? []).map(safe));
        tip(list, f.label);
        if (flag) list.enableRequired();
        if (typeof answer === "string" && f.options?.includes(answer)) list.select(safe(answer));
        list.addToPage(page, { x, y: y - BOX, width: w, height: BOX, font, ...look });
        list.setFontSize(TEXT);
      }
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
    const h = f.kind === "long" ? 50 : BOX;
    if (draw && f.kind === "date") {
      addDateLists(form, page, f.id, f.label, answer, { x, y: y - h, width: w, height: h }, font, TEXT, look, js);
    } else if (draw) {
      const box = form.createTextField(f.id);
      if (f.kind === "long") box.enableMultiline();
      if (flag) box.enableRequired();
      tip(box, f.label);
      if (f.max) box.setMaxLength(f.max);
      if (typeof answer === "string" && answer) box.setText(safe(answer).slice(0, f.max));
      box.addToPage(page, { x, y: y - h, width: w, height: h, font, ...look });
      // A one-line box narrower than a full line of its text: an answer that doesn't fit is shrunk to fit, so a long
      // name or address still shows in full, on screen and printed. Here for answers already filled in; in Acrobat
      // by "auto" font size (set after the appearances are drawn, below).
      const text = f.kind === "text" && typeof answer === "string" ? safe(answer).replace(/\s+/g, " ") : "", room = w - 6;
      box.setFontSize(Math.min(TEXT, text ? TEXT * room / Math.max(room, font.widthOfTextAtSize(text, TEXT)) : TEXT));
      if (f.kind === "text" && room < font.widthOfTextAtSize("N".repeat(f.max ?? 35), TEXT)) shrink.push(box);
      if (js) box.acroField.dict.set(PDFName.of("AA"), f.format ? formatActions(doc, js, f) : swiftActions(doc, js)); // Acrobat: refuse wrong keys
    }
    return 10 + h;
  }
  const optionWidth = (option: string) => 12 + font.widthOfTextAtSize(safe(option), TEXT) + 10;

  // 3. The sections, on a grid of 12 narrow columns. Each question takes the width it needs: a little for a number,
  //    a date or a currency, a third of the page for a 35-character name or address line (room for the whole line),
  //    more for long text or many options. Questions fill a line left to
  //    right; a tick box, or a question that other questions depend on ("Drafts at", "Shipment from"), starts a new line,
  //    so it sits with the boxes it switches on, as on the bank's own form.
  const colW = (W - 2 * M - (COLS - 1) * CGAP) / COLS;
  const spanWidth = (n: number) => n * colW + (n - 1) * CGAP;
  const triggers = new Set(t.sections.flatMap(s => s.fields).flatMap(f => [...(f.requiredIf ?? []), ...(f.activeIf ?? [])]).map(r => r.field));
  const span = (f: Field) => {
    const label = font.widthOfTextAtSize(safe(f.label), f.kind === "check" ? TEXT : LABEL) + (f.kind === "check" ? 16 : 10) + 18; // + its number
    const box =
      f.kind === "long" ? Infinity :
      f.kind === "check" ? 0 :
      f.kind === "date" ? 96 :
      f.kind === "select" ? Math.max(...(f.options ?? []).map(o => font.widthOfTextAtSize(safe(o), TEXT))) + 24 :
      hasOptions(f.kind) ? (f.options ?? []).reduce((sum, o) => sum + optionWidth(o), 0) :
      f.format === "number" || (f.max ?? 99) <= 3 ? 40 :
      (f.max ?? 35) <= 35 ? 165 : (f.max ?? 0) <= 70 ? 330 : Infinity;
    // A tick box that switches on other boxes takes at least a third of the line, so the boxes after it line up
    // from one row to the next (originals, copies, ...).
    const least = f.kind === "check" && triggers.has(f.id) ? COLS / 3 : 1;
    for (let n = least; n < COLS; n++) if (spanWidth(n) >= Math.max(label, box)) return n;
    return COLS;
  };
  t.sections.forEach((s, si) => {
    const rows: Field[][] = [];
    let used = COLS;
    for (const f of s.fields) {
      const n = span(f);
      if (used + n > COLS || triggers.has(f.id) || f.kind === "check") { rows.push([]); used = 0; }
      rows[rows.length - 1].push(f);
      used += n;
    }
    // Where each question of a row goes, and the row's height.
    // Columns left over at the end of a row go to its boxes (text, dates, lists), shared out evenly, so every row
    // ends on the right margin.
    const layout = (row: Field[]) => {
      const n = row.map(span), grow = row.map(f => ["text", "long", "date", "select"].includes(f.kind));
      let k = grow.filter(Boolean).length, spare = COLS - n.reduce((a, b) => a + b, 0), x = M;
      if (k) row.forEach((_, i) => { if (grow[i]) { const add = Math.ceil(spare / k--); n[i] += add; spare -= add; } });
      return row.map((f, i) => { const w = spanWidth(n[i]), at = x; x += w + CGAP; return { f, x: at, w }; });
    };
    const height = (row: Field[]) => Math.max(...layout(row).map(c => place(c.f, c.x, c.w, false)));

    // Its parts' heights: the paragraph under the heading (a declaration), the rows, and the signature lines.
    const note = s.note ? wrap(s.note, font, 7.5, W - 2 * M - 8) : [];
    const SIGN = 62;
    const whole = 17 + note.length * 9.5 + (note.length ? 4 : 0) + rows.reduce((sum, r) => sum + height(r) + 5, 0) + (s.signoff ? SIGN : 0);
    // The section heading, "3  APPLICANT": a light band with a navy edge (on a new page if not even its first row
    // fits). The sign-off and the bank's panel are kept whole on one page.
    if (top - ((s.signoff || s.bankOnly) ? whole : 18 + (rows[0] ? height(rows[0]) : 0)) < BOTTOM) newPage();
    if (s.bankOnly) { // a shaded, outlined panel, set apart from the customer's part
      page.drawRectangle({ x: M - 6, y: top - whole - 4, width: W - 2 * M + 12, height: whole + 4, color: rgb(0.95, 0.95, 0.95), borderColor: RULE, borderWidth: 0.75 });
      page.drawText(safe(`${s.title.toUpperCase()} (to be completed by the Bank)`), { x: M, y: top - 9.8, size: 7.5, font: bold, color: GREY });
    } else {
      page.drawRectangle({ x: M, y: top - 13, width: W - 2 * M, height: 12, color: TINT });
      page.drawRectangle({ x: M, y: top - 13, width: 3, height: 12, color: ACCENT });
      page.drawText(safe(`${si + 1}   ${s.title.toUpperCase()}`), { x: M + 8, y: top - 9.8, size: 7.5, font: bold, color: ACCENT });
    }
    top -= 17;
    for (const line of note) { page.drawText(line, { x: M, y: top - 7.5, size: 7.5, font, color: INK }); top -= 9.5; }
    if (note.length) top -= 4;

    for (const row of rows) {
      const h = height(row);
      if (top - h < BOTTOM) newPage();
      for (const c of layout(row)) place(c.f, c.x, c.w, true);
      top -= h + 5;
    }
    // Signature, date and company stamp: lines to sign on paper after printing.
    if (s.signoff) {
      const line = (x: number, w: number, label: string) => {
        page.drawLine({ start: { x, y: top - 34 }, end: { x: x + w, y: top - 34 }, thickness: 0.75, color: INK });
        page.drawText(label, { x, y: top - 43, size: 7, font, color: GREY });
      };
      line(M, 190, "Authorised signature(s)");
      line(M + 210, 110, "Date");
      page.drawRectangle({ x: W - M - 150, y: top - 56, width: 150, height: 54, borderColor: INK, borderWidth: 0.75, borderDashArray: [2, 2] });
      page.drawText("Company stamp", { x: W - M - 146, y: top - 52, size: 7, font, color: GREY });
      top -= SIGN;
    }
    top -= 1;
  });

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
  return doc.save();
}

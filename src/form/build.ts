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
import { PDFDocument, PDFHexString, PDFName, PDFPage, PDFString, StandardFonts } from "pdf-lib";
import { addChecks, formatActions, swiftActions } from "./acrobat-script";
import { addDateLists } from "./dates";
import { GREY, H, INK, M, RED, RULE, W, WHITE, finishForm, tip, wrap } from "./look";
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

  // 2. Title and instructions. `top` is the pen: it starts near the top of the page and moves down.
  let page: PDFPage = doc.addPage([W, H]), top = 0;
  const newPage = () => { page = doc.addPage([W, H]); top = H - 26; };
  page.drawText(safe(t.title.toUpperCase()), { x: M, y: H - 40, size: 13, font: bold, color: INK });
  page.drawLine({ start: { x: M, y: H - 47 }, end: { x: W - M, y: H - 47 }, thickness: 1.2, color: INK });
  top = H - 50;
  for (const line of wrap(t.note, font, 7.5, W - 2 * M)) {
    page.drawText(line, { x: M, y: top - 8, size: 7.5, font, color: INK });
    top -= 10;
  }
  top -= 4;

  // Box styles. A mandatory box is outlined in red (not only starred) until it is answered.
  const plain = { borderColor: INK, borderWidth: 0.75, backgroundColor: WHITE };
  const mandatory = { ...plain, borderColor: RED, borderWidth: 1.25 };
  const blocks: Blocks = new Map(); // where each question was drawn, for the red frames
  const shrink: ReturnType<typeof form.createTextField>[] = []; // boxes whose text shrinks to fit in Acrobat

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
      const lines = wrap(f.label, font, TEXT, w - 14);
      if (draw) {
        const box = form.createCheckBox(f.id);
        box.addToPage(page, { x, y: top - 10, width: 9, height: 9, ...look });
        tip(box, f.label);
        if (required) { if (flag) box.enableRequired(); page.drawText("*", { x: x - 7, y: top - 10, size: 9, font: bold, color: RED }); }
        if (answer === true) box.check();
        lines.forEach((l, i) => page.drawText(l, { x: x + 14, y: top - 8 - i * 10, size: TEXT, font, color: INK }));
      }
      return Math.max(11, lines.length * 10);
    }

    // Everything else: the label on top (with a red * if mandatory), the box(es) below.
    if (draw) {
      blocks.set(f.id, { page, label: { x, y: top - 6.5, text: safe(f.label) } });
      page.drawText(safe(f.label), { x, y: top - 7, size: LABEL, font, color: INK });
      if (required) page.drawText("*", { x: x + font.widthOfTextAtSize(safe(f.label), LABEL) + 2, y: top - 7, size: 8.5, font: bold, color: RED });
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
    const h = f.kind === "long" ? 64 : BOX;
    if (draw && f.kind === "date") {
      addDateLists(form, page, f.id, f.label, answer, { x, y: y - h, width: Math.min(w, 200), height: h }, font, TEXT, look, js);
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
  //    right; a question that other questions depend on (a tick box, "Drafts at", "Shipment from") starts a new line,
  //    so it sits with the boxes it switches on, as on the bank's own form.
  const colW = (W - 2 * M - (COLS - 1) * CGAP) / COLS;
  const spanWidth = (n: number) => n * colW + (n - 1) * CGAP;
  const triggers = new Set(t.sections.flatMap(s => s.fields).flatMap(f => [...(f.requiredIf ?? []), ...(f.activeIf ?? [])]).map(r => r.field));
  const span = (f: Field) => {
    const label = font.widthOfTextAtSize(safe(f.label), f.kind === "check" ? TEXT : LABEL) + (f.kind === "check" ? 16 : 10);
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
      if (used + n > COLS || triggers.has(f.id)) { rows.push([]); used = 0; }
      rows[rows.length - 1].push(f);
      used += n;
    }
    // Where each question of a row goes, and the row's height.
    const layout = (row: Field[]) => { let x = M; return row.map(f => { const w = spanWidth(span(f)), at = x; x += w + CGAP; return { f, x: at, w }; }); };
    const height = (row: Field[]) => Math.max(...layout(row).map(c => place(c.f, c.x, c.w, false)));

    // The black section bar, "1.  APPLICATION" (on a new page if not even its first row fits).
    if (top - 18 - (rows[0] ? height(rows[0]) : 0) < BOTTOM) newPage();
    page.drawRectangle({ x: M, y: top - 13, width: W - 2 * M, height: 12, color: INK });
    page.drawText(safe(`${si + 1}.  ${s.title.toUpperCase()}`), { x: M + 5, y: top - 10, size: 7.5, font: bold, color: WHITE });
    top -= 17;

    for (const row of rows) {
      const h = height(row);
      if (top - h < BOTTOM) newPage();
      for (const c of layout(row)) place(c.f, c.x, c.w, true);
      top -= h + 6;
    }
    top -= 1;
  });

  // 5. Footers: the title, and "Page x of y".
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 36 }, end: { x: W - M, y: 36 }, thickness: 0.5, color: RULE });
    if (mode !== "javascript") p.drawText(safe(t.title), { x: M, y: 24, size: 7.5, font, color: GREY }); // the buttons sit here otherwise
    const n = `Page ${i + 1} of ${pages.length}`;
    p.drawText(n, { x: W - M - font.widthOfTextAtSize(n, 7.5), y: 24, size: 7.5, font, color: GREY });
    // "< Previous page" / "Next page >": plain PDF links, so they work in every viewer, JavaScript on or off.
    const link = (text: string, to: PDFPage, x: number) => {
      const w = bold.widthOfTextAtSize(text, 8);
      p.drawText(text, { x, y: 23.5, size: 8, font: bold, color: INK });
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
  // The JavaScript version also gets "Check form" and "Reset form" above the footer of every page.
  if (js && t.sections.some(s => s.fields.some(f => f.required || f.requiredIf)))
    addChecks(doc, form, pages[0], font, t, js, undefined, mode === "javascript" ? pages : undefined);
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

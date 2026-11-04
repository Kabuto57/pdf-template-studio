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
import { PDFDocument, PDFHexString, PDFName, PDFPage, StandardFonts } from "pdf-lib";
import { addChecks, formatActions } from "./acrobat-script";
import { addDateLists } from "./dates";
import { BOTTOM, GAP, GREY, H, INK, M, RED, RULE, W, WHITE, finishForm, tip, wrap } from "./look";
import { addRedFrames, type Blocks } from "./red-frames";
import { activeRules, isRequired } from "./rules";
import { stamp } from "./stored-template";
import { hasOptions, safe, subId, type Field, type Template, type Values } from "./types";
import { fillBase } from "./upload";

export type Mode = "both" | "javascript" | "no-javascript";

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
  const newPage = () => { page = doc.addPage([W, H]); top = H - M; };
  page.drawText(safe(t.title.toUpperCase()), { x: M, y: H - 62, size: 16, font: bold, color: INK });
  page.drawLine({ start: { x: M, y: H - 72 }, end: { x: W - M, y: H - 72 }, thickness: 1.5, color: INK });
  top = H - 80;
  for (const line of wrap(t.note, font, 8.5, W - 2 * M)) {
    page.drawText(line, { x: M, y: top - 9, size: 8.5, font, color: INK });
    top -= 11.5;
  }
  top -= 10;

  // Box styles. A mandatory box is outlined in red (not only starred) until it is answered.
  const plain = { borderColor: INK, borderWidth: 0.75, backgroundColor: WHITE };
  const mandatory = { ...plain, borderColor: RED, borderWidth: 1.25 };
  const blocks: Blocks = new Map(); // where each question was drawn, for the red frames

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
      const lines = wrap(f.label, font, 9, w - 16);
      if (draw) {
        const box = form.createCheckBox(f.id);
        box.addToPage(page, { x, y: top - 11, width: 10, height: 10, ...look });
        tip(box, f.label);
        if (required) { if (flag) box.enableRequired(); page.drawText("*", { x: x - 7, y: top - 10, size: 9, font: bold, color: RED }); }
        if (answer === true) box.check();
        lines.forEach((l, i) => page.drawText(l, { x: x + 16, y: top - 9 - i * 11, size: 9, font, color: INK }));
      }
      return Math.max(12, lines.length * 11);
    }

    // Everything else: the label on top (with a red * if mandatory), the box(es) below.
    if (draw) {
      blocks.set(f.id, { page, label: { x, y: top - 8, text: safe(f.label) } });
      page.drawText(safe(f.label), { x, y: top - 8, size: 8, font, color: INK });
      if (required) page.drawText("*", { x: x + font.widthOfTextAtSize(safe(f.label), 8) + 2, y: top - 8, size: 9, font: bold, color: RED });
    }
    let y = top - 13;

    // A drop-down list.
    if (f.kind === "select") {
      if (draw) {
        const list = form.createDropdown(f.id);
        list.addOptions((f.options ?? []).map(safe));
        tip(list, f.label);
        if (flag) list.enableRequired();
        if (typeof answer === "string" && f.options?.includes(answer)) list.select(safe(answer));
        list.addToPage(page, { x, y: y - 20, width: w, height: 20, font, ...look });
        list.setFontSize(10);
      }
      return 33;
    }

    // Pick one (radio buttons) or tick any (one tick box per option), wrapping onto more lines when needed.
    if (hasOptions(f.kind)) {
      const options = f.options ?? [];
      const group = f.kind === "radio" && draw ? form.createRadioGroup(f.id) : undefined;
      if (group) { tip(group, f.label); if (flag) group.enableRequired(); }
      let cx = x, right = x;
      options.forEach((option, i) => {
        const span = 14 + font.widthOfTextAtSize(safe(option), 9) + 14;
        if (cx > x && cx + span > x + w) { cx = x; y -= 16; } // next line
        if (draw) {
          const box = { x: cx, y: y - 11, width: 10, height: 10, ...look };
          if (group) {
            group.addOptionToPage(safe(option), page, box);
          } else {
            const tickBox = form.createCheckBox(subId(f.id, i));
            tickBox.addToPage(page, box);
            tip(tickBox, `${f.label}: ${option}`);
            if (Array.isArray(answer) && answer.includes(option)) tickBox.check();
          }
          page.drawText(safe(option), { x: cx + 14, y: y - 9.5, size: 9, font, color: INK });
        }
        right = Math.max(right, cx + span - 10);
        cx += span;
      });
      if (group && typeof answer === "string" && options.includes(answer)) group.select(safe(answer));
      if (draw) blocks.get(f.id)!.box = [x - 3, y - 14, right - x + 6, top - 13 - y + 17]; // all the options, framed as one
      return top - y + 14;
    }

    // A date, or a text box (one line, or a paragraph).
    const h = f.kind === "long" ? 46 : 20;
    if (draw && f.kind === "date") {
      addDateLists(form, page, f.id, f.label, answer, { x, y: y - h, width: Math.min(w, 200), height: h }, font, 10, look, js);
    } else if (draw) {
      const box = form.createTextField(f.id);
      if (f.kind === "long") box.enableMultiline();
      if (flag) box.enableRequired();
      tip(box, f.label);
      if (f.max) box.setMaxLength(f.max);
      if (typeof answer === "string" && answer) box.setText(safe(answer).slice(0, f.max));
      box.addToPage(page, { x, y: y - h, width: w, height: h, font, ...look });
      box.setFontSize(10);
      if (f.format && js) box.acroField.dict.set(PDFName.of("AA"), formatActions(doc, js, f)); // Acrobat: refuse wrong keys
    }
    return 13 + h;
  }

  // 3. The sections.
  const half = (W - 2 * M - GAP) / 2;
  const widthOf = (f: Field) => f.half ? half : W - 2 * M;
  t.sections.forEach((s, si) => {
    // Pair up neighbouring half-width questions into one row.
    const rows: Field[][] = [];
    for (const f of s.fields) {
      const last = rows[rows.length - 1];
      if (f.half && last?.length === 1 && last[0].half) last.push(f); else rows.push([f]);
    }
    const height = (row: Field[]) => Math.max(...row.map(f => place(f, M, widthOf(f), false)));

    // The black section bar, "1.  APPLICATION" (on a new page if not even its first row fits).
    if (top - 34 - (rows[0] ? height(rows[0]) : 0) < BOTTOM) newPage();
    page.drawRectangle({ x: M, y: top - 18, width: W - 2 * M, height: 16, color: INK });
    page.drawText(safe(`${si + 1}.  ${s.title.toUpperCase()}`), { x: M + 6, y: top - 13.5, size: 9, font: bold, color: WHITE });
    top -= 28;

    for (const row of rows) {
      const h = height(row);
      if (top - h < BOTTOM) newPage();
      row.forEach((f, i) => place(f, M + i * (half + GAP), widthOf(f), true));
      top -= h + 10;
    }
    top -= 8;
  });

  // 5. Footers: the title, and "Page x of y".
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 36 }, end: { x: W - M, y: 36 }, thickness: 0.5, color: RULE });
    p.drawText(safe(t.title), { x: M, y: 24, size: 7.5, font, color: GREY });
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
  if (js && t.sections.some(s => s.fields.some(f => f.required || f.requiredIf))) addChecks(doc, form, pages[0], font, t, js);
  form.updateFieldAppearances(font);
  finishForm(doc, font);
  return doc.save();
}

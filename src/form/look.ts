// THE LOOK OF THE PDF: page size, margins, colours, and small drawing helpers.
// Change the numbers here to restyle every form.
import { PDFDocument, PDFFont, PDFHexString, PDFName, PDFString, rgb } from "pdf-lib";
import { safe } from "./types";

// Colours
export const RED = rgb(0.8, 0, 0);          // mandatory boxes and stars
export const INK = rgb(0, 0, 0);            // text, lines, section bars
export const GREY = rgb(0.35, 0.35, 0.35);  // footer text
export const RULE = rgb(0.75, 0.75, 0.75);  // footer line
export const WHITE = rgb(1, 1, 1);

// Page (A4, in points: 1 point = 1/72 inch, about 0.35 mm). x and y count from the page's BOTTOM-left corner.
export const W = 595.28;      // page width
export const H = 841.89;      // page height
export const M = 42;          // left / right margin
export const GAP = 16;        // gap between two half-width questions
export const BOTTOM = 56;     // start a new page below this height

/** Splits text into lines that fit `width` at this font size. */
export function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of safe(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const longer = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(longer, size) > width) { lines.push(line); line = word; }
      else line = longer;
    }
    lines.push(line);
  }
  return lines;
}

/** Sets a field's tooltip (TU). Other software uses it as the question's label. */
export const tip = (f: { acroField: { dict: { set(k: PDFName, v: PDFHexString): void } } }, label: string) =>
  f.acroField.dict.set(PDFName.of("TU"), PDFHexString.fromText(label));

/**
 * Registers the font in the form. Acrobat looks up the font named in each field (its /DA) in the form's
 * resources (/DR); without it, clicking a field does nothing and it can't be typed in.
 * (pdf.js and browsers don't mind, so previews look fine either way.)
 */
export function finishForm(doc: PDFDocument, font: PDFFont) {
  const acroForm = doc.getForm().acroForm.dict;
  acroForm.set(PDFName.of("DR"), doc.context.obj({ Font: { Helvetica: font.ref, Helv: font.ref } }));
  acroForm.set(PDFName.of("DA"), PDFString.of("/Helv 0 Tf 0 g"));
}

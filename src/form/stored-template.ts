// THE FORM TRAVELS INSIDE ITS OWN PDF
// When a PDF is made, the whole form description (questions, sections, rules) is stored inside it.
// When a filled PDF comes back, it is read out again, so the workbench knows every question from the PDF alone.
import { PDFDocument, PDFHexString, PDFName, PDFRawStream, PDFString, decodePDFRawStream } from "pdf-lib";
import type { Template } from "./types";

const KEY = PDFName.of("FormTemplate"); // a private entry in the PDF's catalog

/**
 * Stores the form (minus any uploaded PDF) inside the PDF, as compressed JSON.
 * A stream, not a string: Adobe allows at most 32,767 bytes in one PDF string, and the LC's description is
 * bigger (~33 KB). Over that limit, Acrobat would not let anyone type in the form.
 */
export const stamp = (doc: PDFDocument, t: Template) => {
  const json = JSON.stringify({ ...t, base: undefined, uploaded: !!t.base });
  doc.catalog.set(KEY, doc.context.register(doc.context.flateStream(new TextEncoder().encode(json))));
};

/** The form stored by stamp() as JSON text, or undefined. Older PDFs stored it as a string. */
export const stamped = (doc: PDFDocument) => {
  const o = doc.catalog.lookup(KEY);
  return o instanceof PDFRawStream ? new TextDecoder().decode(decodePDFRawStream(o).decode()) : text(o);
};

// pdf-lib's decodeText() overflows the stack on very long strings, so UTF-16 text is decoded here instead.
const utf16 = (b: Uint8Array) => b[0] === 0xfe && b[1] === 0xff ? new TextDecoder("utf-16be").decode(b) : undefined;

/** A PDF string object as text (or undefined if it isn't one). */
export const text = (o: unknown) =>
  o instanceof PDFHexString ? utf16(o.asBytes()) ?? o.decodeText() :
  o instanceof PDFString ? o.decodeText() :
  undefined;

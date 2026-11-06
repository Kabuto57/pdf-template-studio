// Writes public/lc-build-spec.json: the working JavaScript LC PDF as a full build specification, so another tool can
// build the same PDF from scratch (public/build_lc_pdf.py does it with Python + pikepdf).
//   npm run spec
// Every object reachable from the document catalog is written once, by number: dictionaries, arrays, names
// ("/Name"), text ({"s": ...}), numbers, references ({"ref": n}) and streams ({"stream": {...}, "text": ...} with the
// data decoded). Nothing is summarised, so the result is the same form: pages, fields, looks, actions and scripts.
import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { PDFArray, PDFBool, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNull, PDFNumber, PDFObject, PDFRawStream, PDFRef, PDFString, decodePDFRawStream } from "pdf-lib";
import { buildPdf } from "../src/pdf";
import { LC } from "../src/lc";

type J = unknown;

export async function lcSpec() {
  const doc = await PDFDocument.load(await buildPdf(LC.template, LC.defaults, "javascript"));
  const objects: Record<number, J> = {};
  const todo: PDFRef[] = [];
  const conv = (o: PDFObject | undefined, key = ""): J => {
    if (o === undefined) return null;
    if (o instanceof PDFRef) { if (!(o.objectNumber in objects)) { objects[o.objectNumber] = null; todo.push(o); } return { ref: o.objectNumber }; }
    if (o instanceof PDFName) return o.toString();
    if (o instanceof PDFString || o instanceof PDFHexString) return { s: o.decodeText() };
    if (o instanceof PDFNumber) return key === "/Resolution" ? { real: o.asNumber().toFixed(1) } : o.asNumber(); // Acrobat needs "300.0"
    if (o instanceof PDFBool) return o.asBoolean();
    if (o === PDFNull) return null;
    if (o instanceof PDFArray) return o.asArray().map(x => conv(x));
    if (o instanceof PDFRawStream) {
      const dict: Record<string, J> = {};
      for (const [k, v] of o.dict.entries()) if (!["/Length", "/Filter", "/DecodeParms"].includes(k.toString())) dict[k.toString()] = conv(v, k.toString());
      return { stream: dict, text: Buffer.from(decodePDFRawStream(o).decode()).toString("latin1") };
    }
    if (o instanceof PDFDict) {
      const dict: Record<string, J> = {};
      for (const [k, v] of o.entries()) if (!["/Metadata", "/StructTreeRoot"].includes(k.toString())) dict[k.toString()] = conv(v, k.toString());
      return dict;
    }
    throw new Error(`unexpected ${o.constructor.name}`);
  };
  const root = conv(doc.context.trailerInfo.Root);
  while (todo.length) { const r = todo.shift()!; objects[r.objectNumber] = conv(doc.context.lookup(r)); }
  return { about: "LC-Application-JavaScript.pdf as a build specification (see lc-ai-build-from-spec-prompt.txt)", root, objects };
}

it.skipIf(!process.env.LC_SPEC && process.env.npm_lifecycle_event !== "spec")("build specification", async () => {
  writeFileSync("public/lc-build-spec.json", JSON.stringify(await lcSpec()) + "\n");
}, 60_000);

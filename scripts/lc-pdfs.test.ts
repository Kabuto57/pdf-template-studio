// Writes the blank LC application PDFs to public/ so they have fixed download links on the website:
//   LC_PDFS=1 npx vitest run scripts/lc-pdfs
import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { buildLcPdf } from "../src/lc-pdf";
import { buildPdf } from "../src/pdf";
import { LC } from "../src/lc";

it.skipIf(!process.env.LC_PDFS)("blank LC PDFs", async () => {
  writeFileSync("public/LC-Application-original-look.pdf", await buildLcPdf(LC.defaults));
  writeFileSync("public/LC-Application-new-design.pdf", await buildPdf(LC.template, LC.defaults));
});

// Writes the blank LC application PDFs, and the filled samples, to public/ so they have fixed download links on the website:
//   LC_PDFS=1 npx vitest run scripts/lc-pdfs
import { it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { SAMPLES, samplePdf } from "../src/demo-applications";
import { buildLcPdf } from "../src/lc-pdf";
import { buildPdf } from "../src/pdf";
import { LC } from "../src/lc";

it.skipIf(!process.env.LC_PDFS)("blank LC PDFs", async () => {
  writeFileSync("public/LC-Application-original-look.pdf", await buildLcPdf(LC.defaults));
  writeFileSync("public/LC-Application-new-design.pdf", await buildPdf(LC.template, LC.defaults));
  mkdirSync("public/samples", { recursive: true }); // the workbench's sample applications, filled in
  for (const s of SAMPLES) writeFileSync(`public/samples/${s.file}`, await samplePdf(s));
});

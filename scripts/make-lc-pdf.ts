// THE SMALLEST WAY TO MAKE THE LC PDFs: one file, only Node.js needed (no npm install).
//   node make-lc-pdf.mjs
// writes LC-Application-JavaScript.pdf and LC-Application-no-JavaScript.pdf into the current folder.
// The website serves this file ready-made (public/make-lc-pdf.txt; rename to .mjs before running); `npm run make-script` rebuilds it from src/.
import { writeFileSync } from "node:fs";
import { LC } from "../src/lc";
import { buildPdf } from "../src/pdf";

writeFileSync("LC-Application-JavaScript.pdf", await buildPdf(LC.template, LC.defaults, "javascript"));
writeFileSync("LC-Application-no-JavaScript.pdf", await buildPdf(LC.template, LC.defaults, "no-javascript"));
console.log("Wrote LC-Application-JavaScript.pdf and LC-Application-no-JavaScript.pdf");

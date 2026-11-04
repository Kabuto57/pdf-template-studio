// THE FORM ENGINE: TABLE OF CONTENTS
// Everything about making a fillable PDF form and reading it back lives in src/form/, one job per file.
// The rest of the app imports from here, so it doesn't need to know which file does what.
//
//   form/types.ts            the vocabulary: Field, Rule, Template, answer formats (amount, phone, ...)
//   form/rules.ts            "is this question mandatory now?" and "does it apply now?"
//   form/look.ts             page size, margins, colours, text wrapping
//   form/build.ts            buildPdf: the form description -> a fillable PDF (the new design)
//   form/dates.ts            date questions: a drop-down of real dates (+ Acrobat's calendar when JavaScript runs)
//   form/red-frames.ts       red frames and grey shading that work with JavaScript off
//   form/acrobat-script.ts   the checks that run inside Acrobat when JavaScript is on, and the "Check form" button
//   form/stored-template.ts  the form description stored inside its own PDF
//   form/read.ts             extractPdf: a filled PDF -> every answer with its question
//   form/upload.ts           using a PDF made elsewhere (studio upload)
export * from "./form/types";
export * from "./form/rules";
export { finishForm } from "./form/look";
export { buildPdf, type Mode } from "./form/build";
export { addDateLists, dateIds, dateOptions, joinDate } from "./form/dates";
export { addRedFrames } from "./form/red-frames";
export { addChecks, formatActions } from "./form/acrobat-script";
export { stamp } from "./form/stored-template";
export { extractPdf } from "./form/read";
export { importPdf, toB64, type Imported } from "./form/upload";

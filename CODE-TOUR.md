# Code tour: where everything is, in plain English

Start with the LC form description (`src/lc.ts`), then the form engine (`src/form/`). Everything else uses them.

## The form engine (`src/form/`): one job per file

| File | What it does |
|---|---|
| `types.ts` | The vocabulary: a question (`Field`), a condition (`Rule`), a section, a whole form (`Template`), the answer formats (amount, phone, account, number). |
| `rules.ts` | Two questions everyone asks: **is this question mandatory right now?** (`isRequired`) and **does it apply right now?** (`isActive`). |
| `look.ts` | Page size, margins, colours, text wrapping. Change the numbers here to restyle every form. |
| `build.ts` | **`buildPdf`**: turns a form description into a fillable PDF (the studio's black-and-white design): title, black section bars, labels with a red `*`, and the boxes. |
| `dates.ts` | Date questions: a drop-down of real dates (no 31 Feb), plus Acrobat's calendar when JavaScript runs. |
| `red-frames.ts` | Red frames and grey shading that work **with JavaScript off**, using extra copies of the tick box that switch on together. |
| `acrobat-script.ts` | The checks that run **inside Acrobat when JavaScript is on**: red outlines, locking, typing filters, the "Check form" button, warnings before save or print. |
| `stored-template.ts` | Stores the form description **inside its own PDF**, so the workbench knows every question from the PDF alone. |
| `read.ts` | **`extractPdf`**: reads every answer back out of a filled PDF, exactly, by field name. |
| `upload.ts` | Using a PDF made elsewhere (the studio's upload). |

`src/pdf.ts` is the table of contents: the rest of the app imports from there.

## The forms

| File | What it is |
|---|---|
| `src/lc.ts` | **The LC application**: every section and question, one line each, with its rules. Most changes happen here; the top of the file explains how. |
| `src/bank-forms.json` | The other 12 trade forms, taken from the bank's smart form (the fill page also offers LC-01P, a 14th, from lc-form). |
| `src/lists.ts` | Currency and country lists. |

## The pages

| File | Page |
|---|---|
| `src/bank.ts` | Demo Bank website: **Download Form** builds the PDF fresh with `buildPdf`. |
| `src/mail.ts` + `src/mailbox.ts` | The customer's email, and the pretend mailbox (the browser's IndexedDB). |
| `src/ops.ts` + `src/customers.ts` | **Trade Ops Workbench**: reads the PDF, checks every rule and the customer record, shows the PDF side by side, then Approve / Reject and Submit. |
| `src/qr-read.ts` + `src/form-registry.ts` | The workbench's QR reader (1 to 16 codes, PDFs up to 30 pages) and the choice of form for a printed copy. See `docs/QR-READING.md`. |
| `src/fill/` | The fill-online page (`fill/index.html`): lc-form's Acrobat JavaScript run in the browser. |
| `src/main.ts` | PDF Template Studio: design, fill, extract. |
| `src/text.ts` | Everything that uses pdf.js: drawing PDF pages on screen, reading text from PDFs without fields, reading the old XFA forms. |

## Making a change

```bash
npm ci                                       # once
npm run dev                                  # the site at http://localhost:5173, reloads as you edit
npm test                                     # all the checks (about a minute)
LC_PDFS=1 npx vitest run scripts/lc-pdfs     # rewrite the LC PDFs, sample PDFs and schema in public/
git push                                     # GitHub tests, builds and publishes the site
```

Python (`scripts/*.py`) was only used once, to take the old smart form apart. The site never runs it.

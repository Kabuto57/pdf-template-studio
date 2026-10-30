# PDF Template Studio

Turn bank forms into clean, black-and-white fillable PDFs, fill them in, and pull the answers back out as data.
Everything runs in your browser: no account, no server, and your files are never uploaded.

**Live:** https://kabuto57.github.io/pdf-template-studio/

## How to use it

The app has three steps along the top: **1 Design**, **2 Fill**, **3 Extract**.

### Open a bank form

1. Click **Open a form…** (top right).
2. Under **Bank trade forms**, pick one, e.g. *Banker's Guarantee Application (BG)*.
3. The real PDF appears on the right. Scroll it to see every page.

Thirteen trade forms are built in, rebuilt from the bank's trade smart form:

| Form | Questions |
|---|---|
| Irrevocable Documentary Credit (LC) | 94 |
| Amendment to Documentary Credit (LC Amendment) | 32 |
| Handling / Financing of Documents under Export Documentary Credit (EBLC) | 82 |
| Application for Export Documentary Collection (OBC) | 77 |
| Import Financing | 65 |
| Bill of Exchange: Export Documentary Collection | 37 |
| Bill of Exchange: Export Documentary Credit | 42 |
| Bill of Exchange (Generic, free format) | 42 |
| Irrevocable Standby Letter of Credit Application (SBLC) | 39 |
| Standby Letter of Credit Amendment (SBLC Amendment) | 34 |
| Banker's Guarantee Application (BG) | 47 |
| Banker's Guarantee Amendment (BG Amendment) | 35 |
| Export Financing: Pre-shipment / Sales Invoice Financing | 45 |

### 1. Design (optional)

Change the form before using it:

- Rename a section or question by typing over it.
- Change a question's type: Text, Paragraph, Date, Pick one, Tick any, Tick box, or Drop-down. For choices, type one option per line.
- Tick **Half width** to put two questions side by side, and **Required** to make a question mandatory (red `*`).
- Use ↑ ↓ to reorder and ✕ to delete. **+ Add question** and **+ Add section** add new ones.
- Each question has a **Key** (e.g. `applicant_name`). That is the name its answer gets when you extract it.

**Upload your PDF template…** (top of Design, or in the *Open a form…* menu) also brings in your own forms:

- **Adobe smart form (XFA)**, like the bank's trade bundle: pick which form in the file to rebuild.
- **Fillable PDF**: its own fields and layout are kept; you can rename the questions.
- **Printed PDF**: a field is added over every blank line (`____`) and tick box (`[ ]`, `☐`).

### 2. Fill

1. Click **2 Fill**.
2. Type your answers on the left; the PDF on the right updates as you type.
3. Mandatory questions have a red `*`, taken from the bank's forms. If any are blank when you save, a warning lists them.
4. Click **Save filled PDF** (top right). The saved PDF is still fillable, so it can be opened and changed in Adobe Reader or Preview.

Or click **Download blank PDF** and fill it in Adobe Reader instead.

### 3. Extract

1. Click **3 Extract**.
2. Click **Open filled PDF…** or drop a PDF on the page. **Use the form I just saved** takes the one you saved in Fill.
3. Every answer is listed next to its question, by section. Blank mandatory answers are marked *(blank: required)*. **Download JSON** or **Copy JSON** gives the data, e.g.

```json
{ "applicant_name": "TAN ENGINEERING PTE LTD", "applicant_info_tel_no": "+65 6123 4567", "expiry_date": "Specific Date" }
```

It reads any PDF:

| PDF | How the answers are found |
|---|---|
| Made here | Exactly, from the form fields, with the questions and sections stored inside the PDF |
| Fillable PDF from elsewhere | From its form fields, named by their tooltips or field names |
| Adobe smart form (XFA) | From its fields; choose the form in the file to show |
| Printed or flattened PDF | From the text: `Label: value`, a label then its value on the same line, ticked boxes. Check these |
| Scanned PDF | Not readable: it has no text (would need OCR) |

## How it's built

### The stack

| Layer | What | Why |
|---|---|---|
| Language | **TypeScript** (strict), about 1,000 lines in `src/` | Plain, typed JavaScript; no framework |
| UI | Plain DOM (`document.createElement`) + one CSS file | Small and easy to read; nothing to learn first |
| Writing PDFs | **[pdf-lib](https://pdf-lib.js.org)** | Draws pages and creates real form fields (text boxes, radio buttons, tick boxes, drop-downs); fills and reads them |
| Reading hard PDFs | **[pdf.js](https://mozilla.github.io/pdf.js/)** (Mozilla, the PDF viewer in Firefox) | Opens encrypted PDFs, Adobe XFA smart forms, and page text. Loaded only when needed |
| Build | **Vite** | Bundles everything into a static site (`dist/`) |
| Tests | **Vitest** | Runs the PDF code in Node: build, fill and extract round trips |
| Hosting | **GitHub Pages**, deployed by **GitHub Actions** | Free; every push to `main` is tested, built and published |

There is **no server and no database**. The website is just files (HTML, JS, CSS). Everything happens in the
visitor's browser, so a PDF someone opens is never uploaded anywhere.

### Folder structure

```
pdf-template-studio/
├── index.html                 the page: top bar (steps, Open a form, Download, Save), left panel, PDF preview
├── src/
│   ├── main.ts                the app: three steps (Design / Fill / Extract), buttons, file upload, preview
│   ├── pdf.ts                 PDF engine (pdf-lib): template -> fillable PDF, fill, read answers, import PDFs
│   ├── text.ts                PDF reader (pdf.js): XFA smart forms, page text, "Label: value" pairs, blanks, preview drawing
│   ├── bank-forms.json        the 13 bank trade forms, as templates (generated, see below)
│   ├── lists.ts               currency codes (ISO 4217) and country names (ISO 3166) for drop-downs
│   ├── sample.ts              the simple banker's guarantee sample and its sample answers
│   └── styles.css             black-and-white look
├── scripts/
│   └── bank-forms.test.ts     rebuilds bank-forms.json from the bank's smart form PDF
├── tests/                     automated checks (run with npm test)
│   ├── pdf.test.ts            build -> fill -> extract gives back every answer
│   ├── upload.test.ts         uploaded fillable / printed PDFs, text extraction
│   └── xfa.test.ts            reading an XFA smart form
├── .github/workflows/pages.yml   test, build and publish on every push
├── vite.config.ts             build settings + Content Security Policy
└── package.json               dependencies: pdf-lib, pdfjs-dist (dev: typescript, vite, vitest)
```

### The data model: a template

Every form, built in or uploaded, becomes one small JSON object. This is the heart of the app:

```ts
interface Template {
  title: string;                 // "Banker's Guarantee Application (BG)"
  note: string;                  // instructions under the title
  sections: { title: string; fields: Field[] }[];
  base?: string;                 // an uploaded PDF to fill in place (instead of drawing a new layout)
}
interface Field {
  id: string;                    // the key in the extracted JSON, e.g. "applicant_name"
  label: string;                 // the question, e.g. "Applicant name"
  kind: "text" | "long" | "date" | "radio" | "checks" | "check" | "select";
  options?: string[];            // choices for radio / tick-any / drop-down
  half?: boolean;                // half width: two questions side by side
  required?: boolean;            // mandatory: red * on the form, and a required field in the PDF
}
```

Answers are a flat object keyed by field id: `{ "applicant_name": "TAN ENG", "currency": "SGD", "agree": true }`.

### The flow

```
 ┌───────────────────────────── 0. Getting a template ─────────────────────────────┐
 │                                                                                  │
 │  Bank smart form (XFA) ──pdf.js──▶ fields, choices, subforms ──▶ Template (JSON) │
 │  Fillable PDF         ──pdf-lib──▶ its fields                ──▶ Template + base │
 │  Printed PDF          ──pdf.js───▶ blanks (____ , ☐)         ──▶ fields added    │
 │  Or build one by hand in Design                                                  │
 └──────────────────────────────────────────────────────────────────────────────────┘
                 │
                 ▼
 1. Design   edit the Template; the preview redraws the real PDF as you type
                 │
                 ▼
 2. Fill     answers + Template ──buildPdf()──▶ filled, still-fillable PDF ──▶ Save
                 │
                 ▼
 3. Extract  any PDF ──extractPdf()──▶ form fields? ──yes──▶ answers + questions
                                          │ no
                                          ▼
                              XFA smart form? ──yes──▶ readXfa(): answers per form
                                          │ no
                                          ▼
                              page text ──pairs()──▶ "Label: value" answers
                                          │
                                          ▼
                            table on screen + JSON (Download / Copy)
```

### The key functions

| Function | File | What it does |
|---|---|---|
| `buildPdf(template, answers)` | `pdf.ts` | Lays out the form on A4 pages (title, black section bars, two-column rows, page breaks, footer) and creates a real form field per question, named by its key. Mandatory questions get a red `*` and are marked required in the PDF (Acrobat outlines them in red). Dates get a calendar picker (Acrobat). Stores the template inside the PDF. Returns the PDF bytes |
| `extractPdf(bytes)` | `pdf.ts` | Opens a PDF and reads every form field's value. If the template is inside, answers come back with their questions and sections |
| `importPdf(bytes)` | `pdf.ts` | Turns an uploaded PDF into a template: keeps a fillable PDF's fields, or adds fields over the blanks of a printed one |
| `readXfa(bytes)` | `text.ts` | Uses pdf.js to open an Adobe smart form (even with an owner password) and walks its form tree: every field's subform path, type, choices, caption and value |
| `renderPages(bytes, width)` | `text.ts` | Draws the preview pages on canvases with pdf.js. The browser's own PDF viewer is not used, because it counts every redrawn preview as a file download and company security software checks each one |
| `xfaTemplate(xfa, code)` | `text.ts` | Turns one form from a smart-form bundle (e.g. `BG`) into a Template: sections from subforms, readable questions from captions or field names (`txtApplicantName` → "Applicant name"), drop-downs, dates |
| `readText` / `pairs` / `blanks` | `text.ts` | For PDFs without fields: groups page text into lines, finds `Label: value` answers and ticked boxes, and finds `____` / `☐` blanks |

### How extraction knows the phone number is the phone number

It never guesses from the page picture. Each question is a **real PDF form field** whose name is its key
(`applicant_info_tel_no`), whose tooltip is its question ("Applicant info: Tel no"), and the whole template is
saved inside the PDF. So reading the answers is a lookup, exactly like reading a database row. Only PDFs with no
fields at all fall back to reading the page text, and those results are marked "check these".

### How the bank forms were made

1. `readXfa()` opened the bank's trade smart form (`Trade-Smartform.pdf`, 14 forms built in Adobe LiveCycle).
2. For each form, `xfaTemplate()` produced a Template. Currency and country drop-downs got the standard ISO
   lists (the smart form fills those by script, so they are not in the file); fields named like dates became dates; the smart form's mandatory fields (its "required" setting or a `*`) stay mandatory.
3. The bank's name was replaced with "the Bank", and the result saved as `src/bank-forms.json`.

To redo it from a newer smart form: `BANK_PDF=path/to/Trade-Smartform.pdf npx vitest run scripts`.

### Safety

- No server: nothing a user opens or types leaves their browser.
- A Content Security Policy (set in `vite.config.ts`) stops the page loading or sending anything to other sites.
- The bank's original PDF is not in this repository.

## Run it locally

```
npm install
npm run dev      # http://localhost:5173
npm test         # build -> fill -> extract round trips, uploads, XFA
npm run build    # static site in dist/
```

To rebuild the bank forms from a newer smart form (the PDF itself is not in this repo):

```
BANK_PDF=~/Downloads/Trade-Smartform.pdf npx vitest run scripts
```

Every push to `main` runs the tests and publishes the site to GitHub Pages.

## Notes and limits

- **All-in-one form:** [Trade-Application-All-in-One.pdf](https://kabuto57.github.io/pdf-template-studio/Trade-Application-All-in-One.pdf) puts all 13 bank forms in one fillable PDF, with an "Application type" tick list first. Rebuild it with `ALL_IN_ONE=public/Trade-Application-All-in-One.pdf npx vitest run scripts/all-in-one`.

- The bank's name is replaced with "the Bank" in the forms; the layout is a plain redraw, not the bank's own design.
- Some choices come pre-selected because the smart form has them as defaults.
- Currency and country drop-downs use the standard ISO lists; the bank's own lists may be shorter.
- Standard PDF fonts cover Latin text only; other scripts show as `?`.
- Proof of concept: built with an AI coding assistant, directed by Jie Yung.

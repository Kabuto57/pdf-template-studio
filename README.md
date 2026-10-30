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
- Tick **Half width** to put two questions side by side.
- Use ↑ ↓ to reorder and ✕ to delete. **+ Add question** and **+ Add section** add new ones.
- Each question has a **Key** (e.g. `applicant_name`). That is the name its answer gets when you extract it.

**Upload your PDF template…** (top of Design, or in the *Open a form…* menu) also brings in your own forms:

- **Adobe smart form (XFA)**, like the bank's trade bundle: pick which form in the file to rebuild.
- **Fillable PDF**: its own fields and layout are kept; you can rename the questions.
- **Printed PDF**: a field is added over every blank line (`____`) and tick box (`[ ]`, `☐`).

### 2. Fill

1. Click **2 Fill**.
2. Type your answers on the left; the PDF on the right updates as you type.
3. Click **Save filled PDF** (top right). The saved PDF is still fillable, so it can be opened and changed in Adobe Reader or Preview.

Or click **Download blank PDF** and fill it in Adobe Reader instead.

### 3. Extract

1. Click **3 Extract**.
2. Click **Open filled PDF…** or drop a PDF on the page. **Use the form I just saved** takes the one you saved in Fill.
3. Every answer is listed next to its question, by section. **Download JSON** or **Copy JSON** gives the data, e.g.

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

## How it works

```
 Bank smart form (XFA)  ──pdf.js──▶  questions, choices, sections  ──▶  template (JSON)
                                                                           │
                         template + answers ──pdf-lib──▶ fillable PDF ◀────┘
                                                              │
                         filled PDF ──pdf-lib / pdf.js──▶ answers as JSON
```

- Every answer is a real PDF form field named by its key, so extraction reads the field rather than guessing from the page.
- Each field's tooltip holds its question, and the template is stored inside the PDF, so the answers come back with their questions and sections.

| File | Job |
|---|---|
| `src/pdf.ts` | Draws the fillable PDF (`buildPdf`), fills uploaded PDFs, reads answers (`extractPdf`), imports PDFs (`importPdf`). Uses [pdf-lib](https://pdf-lib.js.org) |
| `src/text.ts` | Reads XFA smart forms, text, `Label: value` pairs and blanks. Uses [pdf.js](https://mozilla.github.io/pdf.js/), loaded only when needed |
| `src/bank-forms.json` | The 13 trade forms as templates |
| `scripts/bank-forms.test.ts` | Rebuilds `bank-forms.json` from the smart form |
| `src/main.ts` | The three-step app |

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

- The bank's name is replaced with "the Bank" in the forms; the layout is a plain redraw, not the bank's own design.
- Some choices come pre-selected because the smart form has them as defaults.
- Currency and country lists are filled by the smart form's own scripts in Adobe Reader, so they are text boxes here.
- Standard PDF fonts cover Latin text only; other scripts show as `?`.
- Proof of concept: built with an AI coding assistant, directed by Jie Yung.

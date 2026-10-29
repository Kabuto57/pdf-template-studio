# PDF Template Studio

Design a plain black-and-white fillable PDF form (or upload your own), fill it, and pull the answers back out as JSON. Runs entirely in the browser; files never leave it.

```
npm install
npm run dev     # http://localhost:5173
npm test        # build -> fill -> extract round trip
npm run build   # static site in dist/
```

## Flow

0. **Upload your own PDF template** (Design, top): a fillable PDF keeps its fields; a printed-style PDF gets a field added over each blank (`____`, `[ ]`, `☐`). Rename the questions, then Fill and Extract work the same, on your own layout.
1. **Design**: sections and questions (Text, Paragraph, Date, Pick one, Tick any, Tick box). Each question has a key, e.g. `applicant_tel`. The preview is the real PDF.
2. **Fill**: fill in the app, or download the blank PDF and fill it in Acrobat / Preview. **Save filled PDF** keeps the form fields live.
3. **Extract**: open a filled PDF and get every answer matched to its question, as a table and as JSON:

```json
{ "applicant_name": "TAN ENGINEERING PTE LTD", "applicant_tel": "+65 6123 4567", "guarantee_type": "Performance",
  "attachments": ["Contract / tender", "Beneficiary's wording"], "agree": true }
```

## How extraction knows what is what

- Every answer is a real PDF form field (AcroForm) named by its key, so the value is read from the field, not guessed from the page text.
- Each field's tooltip holds its question, and the whole template is stored inside the PDF, so extraction also restores sections and multi-tick answers.
- A PDF form made elsewhere still works: its field names and tooltips are used.
- A PDF with no fields at all (an old form, or a flattened one) is read as text with [pdf.js](https://mozilla.github.io/pdf.js/): `Label: value` lines, a label then a value on the same line, and ticked boxes (`[x]`, `☒`). This is a layout heuristic, so check the result; labels printed *above* their values and table cells are not paired.

The same fields can be read server-side (e.g. a Dify Code node) with `pypdf`: `PdfReader(f).get_fields()`.

## Files

- `src/pdf.ts`: build the PDF (`buildPdf`) and read it back (`extractPdf`), using [pdf-lib](https://pdf-lib.js.org).
- `src/text.ts`: text, `Label: value` pairs and blanks from PDFs without fields (pdf.js, loaded only when needed).
- `src/sample.ts`: the banker's guarantee application form and sample answers.
- `src/main.ts`: the three-step UI.

Limits: standard PDF fonts cover Latin text only (other scripts show as `?`); scanned PDFs have no text and would need OCR.

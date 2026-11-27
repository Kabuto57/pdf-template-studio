# PDF Template Studio

## 1. What it is

**Template Studio** turns bank forms into clean, black-and-white fillable PDFs, lets you fill them in, and pulls the answers back out as data. You design a form on a canvas (the studio, `studio.html`), fill it in, and extract its answers as JSON. Everything runs in your browser: no account, no server, and your files are never uploaded.

Around the studio sits a small demo of a bank's trade-application journey, all with fictional "Demo Bank" data. A customer downloads the LC application from the **demo bank** website, or fills the same 14 trade forms in any browser on the **fill online** page (no Adobe needed; it can print up to 16 QR codes carrying the answers, two to a page after the first QR page). The **Trade Ops workbench** is where the filled PDF arrives: it reads every answer exactly from the form fields, and for a printed or scanned copy it reads the answers from the QR codes (1 to 16 of them, on any pages, PDFs of up to 30 pages), then checks them and shows them next to the PDF.

**Live demo:** https://kabuto57.github.io/pdf-template-studio/ · **Studio:** https://kabuto57.github.io/pdf-template-studio/studio.html

## 2. Libraries used

Versions are the ones in `package-lock.json`. Nothing here is a server: all run in the browser or in Node for the tests.

| Library | Version | Licence | What it does here | Kind |
|---|---|---|---|---|
| [pdf-lib](https://pdf-lib.js.org) | 1.17.1 | MIT | Draws pages and creates, fills and reads real PDF form fields | runtime |
| [pdfjs-dist](https://mozilla.github.io/pdf.js/) (PDF.js) | 5.4.296 | Apache-2.0 | Draws page previews, reads page text and Adobe XFA forms, draws scanned pages for QR reading | runtime |
| [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) | 3.1.6 | MIT (ZXing engine: Apache-2.0) | Decodes QR codes in the Trade Ops workbench | runtime |
| [ajv](https://ajv.js.org) | 8.20.0 | MIT | Checks an LC application's answers against its JSON Schema | runtime |
| [Vite](https://vite.dev) | 8.3.5 | MIT | Dev server and static build (`dist/`) | dev |
| [Vitest](https://vitest.dev) | 4.1.11 | MIT | Runs the tests | dev |
| [TypeScript](https://www.typescriptlang.org) | 7.0.2 | Apache-2.0 | Type check (`tsc --noEmit`, part of the build) | dev |
| [@types/node](https://www.npmjs.com/package/@types/node) | 26.6.6 | MIT | Node types for the tests and scripts | dev |

## 3. Quick setup

You need **Node.js 20.19 or newer, or 22.12 or newer** (Vite 8 requires it; GitHub's build uses Node 22) and npm, which comes with Node. Check with `node -v`. Get Node from https://nodejs.org (the LTS installer, no admin tools needed beyond the installer) or your company's software portal.

```
git clone https://github.com/Kabuto57/pdf-template-studio.git      # or unzip a copy of the folder
cd pdf-template-studio
npm ci          # installs exactly what package-lock.json says (needs the npm registry)
npm run dev     # starts the site at http://localhost:5173
```

Leave that window open while you use the site; press Ctrl+C to stop it. Open these addresses in Chrome or Edge:

| Part | Address |
|---|---|
| Demo guide (the journey) | http://localhost:5173/ |
| Template Studio | http://localhost:5173/studio.html |
| Demo Bank website | http://localhost:5173/demo-bank/ |
| Demo Bank LC application (email form) | http://localhost:5173/demo-bank/apply.html |
| Fill online (14 forms, no Adobe) | http://localhost:5173/fill/ |
| Customer's email (pretend mailbox) | http://localhost:5173/customer-mail/ |
| Trade Ops workbench | http://localhost:5173/trade-ops/ |
| Bank back end (the pretend workflow) | http://localhost:5173/back-end/ |

**Windows:** use Command Prompt or PowerShell, in the project folder; the commands are the same. If PowerShell says scripts are disabled, use Command Prompt. **Mac:** use Terminal. If port 5173 is busy, Vite says which port it took instead; use that number.

**If `npm ci` is blocked** (a company policy that stops install scripts, or one that blocks a download): the only package with an install script is the optional, Mac-only `fsevents`, which the site does not need, so `npm ci --ignore-scripts` is safe here. With scripts switched off (this flag, or `ignore-scripts=true` in your npm settings) npm also skips the `predev` / `prebuild` step that copies PDF.js's standard fonts into `public/standard_fonts/`; run `node -e "require('fs').cpSync('node_modules/pdfjs-dist/standard_fonts','public/standard_fonts',{recursive:true})"` once yourself. If the registry itself is blocked, copy a finished `node_modules` folder from a machine where `npm ci` worked (same operating system), or use the static copy below on a machine that can build it. Nothing at run time calls the internet: after the install the site runs offline.

## 4. How to run each part locally

Start `npm run dev` first (section 3); the bank, mail and workbench pages share the browser's own storage, so use the **same browser and the same address** (`localhost:5173`) for the whole journey.

- **Template Studio** (`/studio.html`): click **Open a form...** (top right), pick a form under *Import*, *Export*, *Loans* or *Guarantees*, edit it on the canvas, then **2 Fill** (type answers, **Save filled PDF**) and **3 Extract** (**Open filled PDF...**, or **Use the form I just saved**, then **Download JSON**).
- **Demo Bank** (`/demo-bank/`): click **Download PDF** to get the LC application. Fill it in Adobe Acrobat Reader (its checks run only there; try ticking a document row and press **Check form**) and save it. **Fill online** on the same page opens `/demo-bank/apply.html`, a web form for the LC that ends in **Submit to Demo Bank**.
- **Customer's email** (`/customer-mail/`): a pretend "New message" window: attach the saved PDF, give it a subject and send it to Trade Ops. The email is simulated inside the browser (IndexedDB), so the whole journey runs on one laptop.
- **Fill online** (`/fill/`): tick the Bank's terms box, pick one of the 14 forms, fill it in. **Check form** lists what is missing, **Generate QR Code** makes the code or codes, **Print Form** opens the browser's print dialog (choose *Save as PDF*): that PDF is a printed copy with no fields, only its QR code or codes. Chrome or Edge is recommended.
- **Trade Ops workbench** (`/trade-ops/`): the inbox shows the emails sent from `/customer-mail/`; click one to see its answers, checks and PDF side by side, then **Approve** or **Reject** and **Submit**. You can also drop a PDF on the page: the studio's **Sample filled PDFs** (in `/studio.html`) are ready-made applications to drop. To try the QR reader, drop a PDF made with **Print Form** (or a scan or photo of the QR page, PNG or JPG) onto the page: the answers are read from its QR codes. A refusal message says what is wrong (a code missing, codes from different applications, a PDF over 30 pages, pages too large to read).
- **Back end** (`/back-end/`): the pretend workflow where **Send to workflow** in the workbench lands.

**A static copy** (what GitHub Pages publishes, no dev server):

```
npm run build      # type-checks, then writes the site to dist/
npm run preview    # serves dist/ at http://localhost:4173 (same pages as above, on that port)
```

`dist/` is plain files; any web server can host it (opening the HTML files straight from disk does not work, because browsers block scripts loaded that way).

**Tests:**

```
npm test           # about a minute; every check runs in Node, nothing needs the internet
```

Some checks are skipped on a machine without the lc-form project (it regenerates files and compares them) or without Playwright (the browser check of the fill page); a skip is not a failure. `npm run pdfs` rewrites the files in `public/` that the site serves (needs Python with `pdfbuild/requirements.txt` installed in `.venv`).

## 5. The detailed explanation

### The demo: LC application, from download to data

| Page | Who | What happens |
|---|---|---|
| `index.html` | presenter | The journey and a comparison with the current vendor (XFA) form |
| `demo-bank/` | customer | A fictional "Demo Bank" website: **Download PDF** gives the LC application; the email form "sends" the filled PDF to Trade Ops |
| (Adobe Acrobat Reader) | customer | Fill in the PDF. Same layout and wording as the bank's form, roomier boxes; mandatory and conditional fields outlined in red; **Check form** lists what is missing; a warning on save/print |
| `fill/` | customer | **No Adobe needed.** The same trade forms in any browser (Chrome ...): main menu with the Bank's terms tick box, all 14 forms (the 13 below plus LC-01P), every check of the Acrobat PDF (red boxes, locked questions, formats, lengths, amount in words, cross-checks, **Check form**, **Reset form**), **Generate QR Code** (the same 1 to 16 codes the PDF makes) and **Print Form** (Chrome Print / Save as PDF: the form pages and the QR page, black and white) |
| `trade-ops/` | Trade Ops | Inbox of emailed applications (or drop a PDF from real email). Every answer read exactly from the PDF's fields, checked (mandatory, conditional, dates, numbers, expiry after shipment), shown by section with the key facts on top. JSON / CSV, **Send to workflow** (simulated). **Printed or scanned forms:** drop the PDF, or a PNG/JPG scan of the QR page: the answers are read from its QR code, 1 to 16 codes ("QR code 3 of 7"; extra QR pages hold two codes each; found on any page, in any order, put in order by each code's own structured-append label, refused with a clear message if one is missing; PDFs of up to 30 pages), with zxing-wasm (`src/qr-read.ts`) |

Demo script: open `demo-bank/`, **Download PDF**, fill it in Adobe Acrobat Reader (try ticking a document row: its boxes turn red), **Check form**, save, attach it in *Send your completed form*, **Send**, then open the Trade Ops workbench. The email is simulated inside the browser (IndexedDB), so the whole journey runs on one laptop.

The LC has the bank form's own sections, wording and fields, drawn in the studio's black-and-white layout by `buildPdf` (`src/form/build.ts`), with our fields, rules and checks in it.

### The studio (`studio.html`)

The app has three steps along the top: **1 Design**, **2 Fill**, **3 Extract**.

#### Open a smart form

1. Click **Open a form…** (top right).
2. Under **Guarantees**, pick one, e.g. *Banker's Guarantee Application*. The studio opens on the LC.
3. The form appears on the canvas, page by page, exactly as the lc-form project builds it.

The fourteen smart forms in the studio (the 13 trade forms plus the pipe-format LC form) are the form files of the [lc-form](https://github.com/Kabuto57/lc-form) project
(`forms/*_form.py`: the old smart form's questions, wording and rules, in the new design). They are copied in by
`scripts/smartforms.py` (see "Keeping in step with lc-form" below):

| Form | Form file | Questions |
|---|---|---|
| Irrevocable Documentary Credit Application | `lc_form.py` | 108 |
| Amendment to Original Documentary Credit | `lc_amendment_form.py` | 33 |
| Handling / Financing of Documents under Export Documentary Credit | `eblc_form.py` | 84 |
| Application for Export Documentary Collection / Financing of Bills | `obc_form.py` | 77 |
| Import Financing | `import_financing_form.py` | 74 |
| Export Financing: Pre-shipment / Sales Invoice Financing | `export_financing_form.py` | 55 |
| Banker's Guarantee Application | `bg_form.py` | 52 |
| Amendment to Banker's Guarantee | `bg_amendment_form.py` | 35 |
| Irrevocable Standby Letter of Credit Application | `sblc_form.py` | 39 |
| Amendment to Standby Letter of Credit | `sblc_amendment_form.py` | 34 |
| Bill of Exchange (Generic, free format) | `bill_of_exchange_form.py` | 18 |
| Bill of Exchange (Export Documentary Credit) | `bill_of_exchange_eblc_form.py` | 18 |
| Bill of Exchange (Export Documentary Collection) | `bill_of_exchange_obc_form.py` | 16 |

#### 1. Design: the canvas

The middle of the screen is the form itself; the studio's own marks (selection, conditions, drop places) are blue,
so they never look like part of the form.

- **Add** (left): drag a kind of question (Text, Paragraph, Date, Pick one, Tick any, Tick box, Drop-down) onto the
  page, where a blue line shows it will go. Or click it to add it after the selected question. The same for a
  **Section**, a **Bank use section** or a **Signature section**. **Outline** jumps to a section.
- **Code** (top left of the pages, like Overleaf): opens the form file beside the pages, coloured like a code
  editor. Change the page and the code follows; type in the code and the page follows as soon as it reads (a line
  it can't read is named under the editor, in red). Clicking a question's line selects it on the page, and the
  selected question's line is marked. Drag the bar between the code and the pages, or between the pages and the
  right-hand panel, to make either wider (the widths are remembered).
- **Select and move**: click a question to select it; drag it to move it (also into another section). Drag a
  section by its grey heading. Alt+↑/↓ moves the selection one place, Delete removes it, Ctrl/Cmd+D duplicates,
  Ctrl/Cmd+Z undoes (Shift: redoes).
- **Properties** (right): the wording, answer type, options (Currencies / Countries fill a drop-down), the key, the
  most characters and the answer format.
- **Toolbar on the selected question**: Add condition, Mandatory, Duplicate, Delete.
- **Resize with the mouse**: drag the selected question's right-edge handle to set its width (the grid's columns
  show while dragging; it snaps to them); drag a paragraph box's bottom handle to make it taller or shorter; drag a
  section's right-edge handle to make it half or full width; drag the selected section's bottom-edge handle to make
  it taller (snaps to 5 points; the extra is blank space at the bottom of its box, and dragging back up to the
  questions' height removes the setting). The same is *Minimum height* in the section's Properties (blank = fit the
  questions); it is `min_height=` in the form file and in the built PDF. Typed values follow the same rule as the drag (steps of
  5, at most a page, removed at or below the questions' height). An auto-width section 300 points tall or more no longer pairs side
  by side and goes full width.
- **Add a condition on the page**: press *Add condition* (on the toolbar or in Properties), then click the question
  it waits on. A small pop-up beside it asks only what that question allows (ticked or not, which options, or any
  answer) and whether the condition makes the question mandatory or only unlocks it. Conditions are listed in
  Properties as sentences ("Mandatory when 13.3 Drafts at is "Term""), each with × to remove it.
- **Buttons**: drag *Button* onto a section, or tick them in the section's Properties: Check form, Reset form,
  Generate QR Code, Print Form, in a row at the section's bottom right. They do what the form's own buttons of those
  names do (lc-form's `buttons=[...]`).
- **Rules**: *Mandatory*: No / Always / When… and *Locked*: until mandatory / always open / until…. A condition is
  "question X is ticked", "is one of these options" or "has any answer"; add more and any one is enough. "Edit with
  lists" changes them with drop-downs instead of the page. The
  selected question's conditions are drawn as blue lines to the questions they wait on (**Show all conditions**
  draws every one), and a small blue dot marks every question with a condition.
- **Checks across answers** (nothing selected): a date after (or not before) another, a number in a range.
- **Layout, within the house style**: a question's width is a share of the 12-column grid (Auto, 1/4, 1/3, 1/2,
  2/3, 3/4, Full); a section is Auto, Full or Half width, can start a new page and can have a minimum height. Auto lets the layout decide, as
  lc-form does. Nothing can be placed off the grid, so every form keeps the same look.
- **Review** (right): *problems* lc-form would refuse to build (two questions with one key, a condition on an
  option that doesn't exist ...) and *tips*: a follow-up placed before the question that switches it on, a drop-down
  with 2-3 options (pick-one reads faster), a pick-one with 8+ options, a row left half empty, a page that ends with
  a big blank, a form with no signature block. Most have a one-click fix; **Apply all fixes** does them together.
- **Form file** (top right): the form as an lc-form form file. Put it in lc-form's `forms/` folder and run
  `python build.py <name>_form.py` for the full PDF with Acrobat's checks, buttons and QR code. **Download blank
  PDF** and **Save filled PDF** give the same pages and fillable boxes without the Acrobat scripts.

**Upload a PDF template…** (in the *Open a form…* menu) also brings in your own forms:

- **Adobe smart form (XFA)**, like the bank's trade bundle: pick which form in the file to rebuild on the canvas.
- **Fillable PDF**: its own fields and layout are kept; you can rename the questions.
- **Printed PDF**: a field is added over every blank line (`____`) and tick box (`[ ]`, `☐`).

#### 2. Fill

1. Click **2 Fill**.
2. Type your answers on the left; the PDF on the right updates as you type. **Fill with sample** fills any form (all the bank forms, uploaded ones too) with made-up but realistic answers, guessed from each question's wording, so you can try Save and Extract straight away.
3. Mandatory questions have a red `*`, and while blank they are **outlined in red**; a line at the top counts how many are left. Some are mandatory only after you pick an option, exactly as in the bank's smart form. On the LC, for example, picking **Drafts: Term** makes *Term* and *days after* mandatory, and ticking **Tolerance** makes *Plus value* and *Minus value* mandatory. Hover a question to see why it is mandatory. In Design, such a question shows "Required when …".
   **Save filled PDF** is blocked while any are blank: it lists them and jumps to the first. **Save as draft anyway** saves a `-draft.pdf` on purpose. In the PDF, mandatory boxes are outlined in red too.
4. Click **Save filled PDF** (top right). The saved PDF is still fillable, so it can be opened and changed in Adobe Reader or Preview.

Or click **Download blank PDF** and fill it in Adobe Reader instead.

**Checks inside the downloaded PDF.** **Download blank PDF** (or a saved one) carries the same rules, so they work while filling it offline in **Adobe Acrobat or Reader**, before it is emailed:
- picking an option or ticking a row makes its boxes mandatory and outlines them in red until filled;
- a **Check form** button (top right of page 1, not printed) lists every mandatory question still blank;
- saving or printing an incomplete form shows the same warning;
- number boxes refuse letters, dates are checked, and each box takes no more characters than on the bank's form.
Mac Preview and web browsers do not run PDF scripts: there the form still fills, but only the starting red outlines show.

#### 3. Extract

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

### How it's built

#### The stack

| Layer | What | Why |
|---|---|---|
| Language | **TypeScript** (strict) | Plain, typed JavaScript; no framework |
| UI | Plain DOM (`document.createElement`) + one CSS file | Small and easy to read; nothing to learn first |
| Writing PDFs | **[pdf-lib](https://pdf-lib.js.org)** | Draws pages and creates real form fields (text boxes, radio buttons, tick boxes, drop-downs); fills and reads them |
| Reading hard PDFs | **[pdf.js](https://mozilla.github.io/pdf.js/)** (Mozilla, the PDF viewer in Firefox) | Opens encrypted PDFs, Adobe XFA smart forms, and page text. Loaded only when needed |
| Build | **Vite** | Bundles everything into a static site (`dist/`) |
| Tests | **Vitest** | Runs the PDF code in Node: build, fill and extract round trips |
| Hosting | **GitHub Pages**, deployed by **GitHub Actions** | Free; every push to `main` is tested, built and published |

There is **no server and no database**. The website is just files (HTML, JS, CSS). Everything happens in the
visitor's browser, so a PDF someone opens is never uploaded anywhere.

#### Folder structure

```
pdf-template-studio/
├── studio.html                the studio page: top bar (steps, Open a form, Download, Save), left panel, PDF preview
├── src/
│   ├── main.ts                the studio: three steps (Design on the canvas / Fill / Extract), buttons, file upload, PDF preview
│   ├── lc.ts                  the LC application, rebuilt by hand to match the bank's form, plus its sample answers
│   ├── pdf.ts                 table of contents for the form engine in src/form/ (see CODE-TOUR.md)
│   ├── form/                  the form engine, one job per file: build, rules, dates, red frames, Acrobat checks, read
│   ├── text.ts                PDF reader (pdf.js): XFA smart forms, page text, "Label: value" pairs, blanks, preview drawing
│   ├── bank-forms.json        the 13 bank trade forms as first converted from the smart form (website, workbench)
│   ├── canvas/                the studio's Design step: the canvas, in the smart forms' layout
│   │   ├── layout.ts          lc-form's layout.py, line by line: where every section, question and box goes
│   │   ├── render.ts          draws a laid-out form as SVG pages
│   │   ├── canvas.ts          the canvas: add, select, drag, resize, properties, rules, review panel, undo
│   │   ├── code-pane.ts       the form file beside the pages (Code), coloured; edits go both ways
│   │   ├── read-form-file.ts  reads a form file's Python back into a form (for the code pane)
│   │   ├── conditions.ts      conditions in plain words, and the pop-up that adds one on the page
│   │   ├── review.ts          the design review: problems lc-form would refuse, tips with fixes
│   │   ├── edit.ts            moving, renaming and deleting questions (rules follow)
│   │   ├── form-file.ts       the form as an lc-form form file (forms/<name>_form.py)
│   │   ├── write-pdf.ts       a PDF of the canvas layout (pdf-lib), for Download / Save / Fill
│   │   ├── forms.ts           the smart forms (smartforms.json) and lc_form.py's shared lists
│   │   └── smartforms.json, metrics.json   copied from lc-form by scripts/smartforms.py
│   ├── lists.ts               currency codes (ISO 4217) and country names (ISO 3166) for drop-downs
│   ├── sample.ts              the simple banker's guarantee sample, and sampleFor(): sample answers for any form
│   └── styles.css             black-and-white look
├── scripts/
│   ├── smartforms.py          copies lc-form's form files (and its Helvetica widths) into src/canvas/
│   ├── fill-engine.py         copies lc-form's Acrobat JavaScript into src/fill/gen/ (generated; do not edit)
│   ├── xfa-rules.py           one-off tool that reads the bank's old smart form
│   ├── bank-forms.test.ts     rebuilds bank-forms.json from the bank's smart form PDF (skipped without it)
│   └── lc-pdfs.test.ts        rewrites public/ files: the two LC PDFs, the sample PDFs, the LC's JSON Schema (npm run pdfs)
├── tests/                     automated checks (run with npm test)
│   ├── canvas-layout.test.ts  every field of every smart form lands where lc-form's layout.py puts it
│   ├── canvas-form-file.test.ts  exported form files load in lc-form and give back the same forms
│   ├── canvas.test.ts         PDFs from the canvas, the design review and its fixes
│   ├── pdf.test.ts            build -> fill -> extract gives back every answer
│   ├── upload.test.ts         uploaded fillable / printed PDFs, text extraction
│   ├── xfa.test.ts            reading an XFA smart form
│   ├── qr-read.test.ts, qr-multi.test.ts   the workbench's QR reader: 1 to 16 codes, page rules, limits
│   ├── fill.test.ts, e2e/     the fill-online page (the e2e check needs Playwright and is skipped otherwise)
│   └── ...                    and the rest (forms, lc, layout, validate, customers)
├── .github/workflows/pages.yml   test, build and publish on every push
├── vite.config.ts             build settings + Content Security Policy
└── package.json               dependencies: pdf-lib, pdfjs-dist (dev: typescript, vite, vitest)
```

#### Filling the forms in the browser (`fill/`)

`fill/index.html` is lc-form's `build_all.py` one-PDF without Adobe. It runs **lc-form's own Acrobat JavaScript**
(`acrobat_js.py`, filled in per form by `pdf_writer.py`: the rules engine `lcRules`, `lcPayload`, the QR encoder
`lcQrMatrix`, the Check form / Reset form / Generate QR Code / Print Form scripts, and each box's keystroke and
validate scripts) against a stand-in for Acrobat's document, so the checks and messages cannot drift from the PDF:

| File | What it does |
|---|---|
| `scripts/fill-engine.py` | Run on the lc-form `.venv`: copies those scripts word for word into `src/fill/gen/*.ts` (wrapped in a function, no `eval`, so the site's content security policy holds), the menu into `gen/menu.json`, and the PDF's field list into `tests/fixtures/fill-fields.json`. Commit the output (CI has no lc-form). |
| `src/fill/doc.ts` | The stand-in for Acrobat's `Doc` / `Field` (`getField`, `value`, `required`, `readonly`, `display`, `fillColor` ..., `calculate`, `resetForm`, `numFields`) |
| `src/fill/engine.ts` | When to call which script (change, keystroke, validate, buttons), and what `app.alert` and `print` do |
| `src/fill/view.ts`, `fill.css` | The pages as `src/canvas/layout.ts` lays them out, with a live box over every PDF box; message boxes; QR page; print CSS |
| `src/fill/menu.ts`, `fill.ts` | The main menu (terms tick box; no tick: "Please tick the box to agree to the Bank's terms and conditions before opening a form."; Main menu asks first, then clears the form) |

Answers stay in the page: nothing is sent, nothing is stored. Differences from the PDF: a drop-down also offers a blank line, a date box has a
small calendar button (the browser's date picker) instead of Acrobat's, Reset form / Main menu confirm in a page message box, and the
PDF's "Before printing" warning runs when the browser prints (Ctrl+P, menu), and Print Form still refuses until the QR code matches the answers.
A printout made without a valid QR code carries a boxed "NO VALID QR CODE" notice where the code goes, so it can never look complete. A date that does not
exist is refused on leaving its box with Acrobat's date message.
`demo-bank/apply.html` (LC only, emails the filled PDF to Trade Ops) is kept; it is not replaced by `fill/`.

After lc-form changes (use the Python in lc-form's own `.venv`, and give it the folder where you cloned lc-form): `<lc-form folder>/.venv/bin/python scripts/fill-engine.py <lc-form folder>`, then `npm test`
(`tests/fill.test.ts` regenerates the files and compares bytes; skipped without lc-form).
`tests/e2e/fill.e2e.test.ts` drives the page in Chromium (Reset form, Main menu, maximum lengths, QR decode, print): it runs inside `npm test`
when Playwright is found (`PLAYWRIGHT_DIR=<folder with node_modules/playwright>`, default: your `Documents/template-studio` folder) and is skipped otherwise, e.g. on
GitHub's CI. Playwright is not a dependency of this repo.

#### Keeping in step with lc-form

The canvas copies lc-form's layout step (`layout.py`) into `src/canvas/layout.ts`, so a form looks the same in the
studio as in the PDF lc-form builds. After the forms or the layout change in lc-form:

```
<lc-form folder>/.venv/bin/python scripts/smartforms.py <lc-form folder>   # forms, letter widths, test fixture
npm test                                                                          # canvas-layout.test.ts compares every field
```

If `canvas-layout.test.ts` fails after a `layout.py` change, copy the change into `layout.ts` (same names, same order).

#### The data model: a template

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

#### The flow

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

#### The key functions

| Function | File | What it does |
|---|---|---|
| `buildPdf(template, answers)` | `pdf.ts` | Lays out the form on A4 pages (title, black section bars, two-column rows, page breaks, footer) and creates a real form field per question, named by its key. Mandatory questions get a red `*` and are marked required in the PDF (Acrobat outlines them in red). Dates get a calendar picker (Acrobat). Stores the template inside the PDF. Returns the PDF bytes |
| `extractPdf(bytes)` | `pdf.ts` | Opens a PDF and reads every form field's value. If the template is inside, answers come back with their questions and sections |
| `importPdf(bytes)` | `pdf.ts` | Turns an uploaded PDF into a template: keeps a fillable PDF's fields, or adds fields over the blanks of a printed one |
| `readXfa(bytes)` | `text.ts` | Uses pdf.js to open an Adobe smart form (even with an owner password) and walks its form tree: every field's subform path, type, choices, caption and value |
| `renderPages(bytes, width)` | `text.ts` | Draws the preview pages on canvases with pdf.js. The browser's own PDF viewer is not used, because it counts every redrawn preview as a file download and company security software checks each one |
| `xfaTemplate(xfa, code)` | `text.ts` | Turns one form from a smart-form bundle (e.g. `BG`) into a Template: sections from subforms, readable questions from captions or field names (`txtApplicantName` → "Applicant name"), drop-downs, dates |
| `readText` / `pairs` / `blanks` | `text.ts` | For PDFs without fields: groups page text into lines, finds `Label: value` answers and ticked boxes, and finds `____` / `☐` blanks |

#### How extraction knows the phone number is the phone number

It never guesses from the page picture. Each question is a **real PDF form field** whose name is its key
(`applicant_info_tel_no`), whose tooltip is its question ("Applicant info: Tel no"), and the whole template is
saved inside the PDF. So reading the answers is a lookup, exactly like reading a database row. Only PDFs with no
fields at all fall back to reading the page text, and those results are marked "check these".

#### How the bank forms were made

1. `readXfa()` opened the bank's trade smart form (`Trade-Smartform.pdf`, 13 forms built in Adobe LiveCycle).
2. For each form, `xfaTemplate()` produced a Template. Currency and country drop-downs got the standard ISO
   lists (the smart form fills those by script, so they are not in the file); fields named like dates became dates; the smart form's mandatory fields (its "required" setting or a `*`) stay mandatory.
3. The bank's name was replaced with "the Bank", and the result saved as `src/bank-forms.json`.

How the smart form itself works (layers, fields, scripts, mandatory logic, barcodes): [docs/how-the-bank-smart-form-is-built.md](docs/how-the-bank-smart-form-is-built.md).

How the workbench reads the QR code (finding it, joining up to 16 codes, choosing the form, matching, how zxing decodes, why it isn't OCR): [docs/QR-READING.md](docs/QR-READING.md).

To redo it from a newer smart form: `BANK_PDF=path/to/Trade-Smartform.pdf npx vitest run scripts`.


**The LC is hand-built.** `src/lc.ts` holds the Irrevocable Documentary Credit application with the bank form's own 17 sections (Mode of Advising … Documents Required … Signature), its 103 fields and nothing else, its wording, its 16 always-mandatory fields and 42 "mandatory when …" rules. Ticking a row under Documents Required (or Back-to-back DC, Drafts, Confirmation, Financing, Advance payment) makes that row's boxes mandatory, so they turn red until filled. The smart form itself only unlocks some of them (e.g. invoice originals and copies) without requiring them. It includes the fields the smart form only shows after a choice (shipment places, open cover no., term LC prepayment). The generator copies it into `bank-forms.json`.

**Conditional mandatory rules.** The smart form makes questions mandatory with scripts, e.g. `if (this.rawValue == "Term") controlScript.mandatoryChange(txtTerm, 1)`. `scripts/xfa-rules.py` reads those scripts from the decrypted form and writes one rule per trigger, value and target (99 rules over 10 forms, 22 on the LC); simple `==` / `||` conditions and their `else` branches are understood, anything more complex is skipped. The generator then stores them on each question as `requiredIf`:

```json
{ "id": "term", "label": "Term", "kind": "text", "requiredIf": [{ "field": "drafts", "values": ["Term:"] }] }
```

`isRequired(field, answers)` in `pdf.ts` decides, and Fill, Save and Extract all use it.

```
BANK_PDF=<your downloads folder>/Trade-Smartform.pdf BANK_RULES=rules.json npx vitest run scripts/bank-forms
```

#### Safety

- No server: nothing a user opens or types leaves their browser.
- A Content Security Policy (set in `vite.config.ts`) stops the page loading or sending anything to other sites.
- The bank's original PDF is not in this repository.

### Notes and limits

- The bank's name is replaced with "the Bank" in the forms; the layout is a plain redraw, not the bank's own design.
- Some choices come pre-selected because the smart form has them as defaults.
- Currency and country drop-downs use the standard ISO lists; the bank's own lists may be shorter.
- Standard PDF fonts cover Latin text only; other scripts show as `?`.
- Proof of concept: built with an AI coding assistant, directed by Jie Yung.

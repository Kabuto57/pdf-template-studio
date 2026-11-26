# How the workbench reads the QR code

The Trade Ops workbench (`trade-ops/`) reads an application's answers from the QR code the form prints on its last
page. This page explains what goes into the code, how the workbench finds and decodes it, how it picks the form, and
how it checks the answers. **No OCR and no AI are used anywhere.**

Code: [`src/qr-read.ts`](../src/qr-read.ts) (finding, joining, matching) and
[`src/form-registry.ts`](../src/form-registry.ts) (choosing the form). The code itself is written by the form's own
JavaScript (`lcPayload` and `lcQrMatrix` in lc-form's `acrobat_js.py`). Tests: `tests/qr-read.test.ts`,
`tests/form-registry.test.ts`.

---

## 1. What goes into the QR code

When the customer presses **Generate QR Code** in Acrobat, the form builds one block of JSON text:

```json
{"form": "LC-01", "version": "1.0", "saved": "2026-11-23T14:05", "complete": true,
 "data": {"applicant_name": "ABC PTE LTD", "amount": "1,250.00", "partial_shipment": "Allowed"}}
```

| Key | Meaning |
|---|---|
| `form`, `version` | From the form code printed on the form ("Form LC-01 · v1.0 · Nov 2026"). Used to find the form (section 4). |
| `saved` | When the code was made. |
| `complete` | Whether the form's own checks passed at that moment. |
| `data` | Only answered questions, keyed by question id. A tick box is `true`; a "tick any" question is a list. |
| `truncated` | Only present when long paragraphs had to be shortened to fit (they end in "..."). |

**Size.** One QR code (version 40, 177 × 177 squares, error correction M) holds about 2,300 characters.

| Answers' length | What is printed |
|---|---|
| Up to 2,300 characters | One code |
| Up to 36,800 (2,300 bytes a code) | 2 to 16 codes, labelled "QR code 1 of 7" and so on (codes 3 and up on extra QR pages, two to a page). The JSON text is padded with spaces to a whole number of 2,300-byte slices and cut into that many equal slices. Each code also carries the QR standard's *structured append* label: its index (0-based), the total, and the *parity* (the XOR of all bytes of the whole padded text). One code has no label. |
| Longer | The long paragraphs are shortened and listed in `truncated`; ops asks the customer for the full text. |

---

## 2. Finding the code: `readQr`

The workbench tries three ways, cheapest first, and stops at the first that works.

| Try | When it works | How | Picture? |
|---|---|---|---|
| 1. Hidden field `__qr` (`qrField`) | PDF saved in Acrobat, fields still there | Generate QR Code also stores the exact JSON in a hidden field. Read as text. | No |
| 2. Squares as text (`qrFromText`) | "Save as PDF" or printed to PDF | Each black square is a tiny font character (ZapfDingbats "n"), so the PDF stores where each one is. The code works out the square size, rebuilds the grid, redraws a clean picture and decodes it with zxing. | A clean picture rebuilt from the squares |
| 3. Picture of the page (`codesIn`) | Scan, photo, or a PDF whose text became shapes | The page is drawn as an image at 2× size (pdf.js); zxing finds up to 4 QR codes on it. A scanned JPG or PNG is first wrapped in a one-page PDF. | Yes |

Pages are searched from the **last page backwards**. For a printed copy every page is searched, in case pages were
scanned out of order or its codes are on different pages. Codes found on different pages are collected together.

---

## 3. Joining up to 16 codes: `joinResult` / `joinCodes`

Codes found anywhere (any page, any image, any order) go in together. The order comes from each code's own
structured-append label (zxing-wasm: `sequenceIndex`, `sequenceSize`, and `sequenceId`, which for QR is the parity as
text). Permutations are never tried for labelled codes (16! orders).

1. **Duplicates removed.** The same code found twice (a page scanned twice) counts once.
2. **Labelled or not.** Labelled and unlabelled codes mixed are refused. Unlabelled codes (some scanners drop the label) are accepted only as one or two, and for two both orders are tried (code 1 always starts the JSON with `{`).
3. **One application.** Each code's check value must be ASCII digits. Labelled codes must all share the parity and the total. Different parities: "codes from N different applications", refused, never merged. Different totals, a total outside 1 to 16, or two different codes claiming the same index: refused.
4. **Complete.** Missing indices are named: "Code 3 of 5 not found; scan all 5 codes." (or "Codes 2, 6 of 7 not found ...").
5. **Bytes joined in index order, then checked.** The joined bytes must be at most 16 x 2,329, and their XOR must equal the parity every code carries (a damaged or foreign code fails here). A character such as "é" is two bytes and a split can fall between them; joining bytes first keeps it whole.
6. **Parsed as data (`parsePayload`).** The bytes must be valid UTF-8 (strict; nothing is guessed at). `JSON.parse` (never evaluated) allows JSON's own white space, so the padding spaces are fine; a byte order mark or a no-break space is not padding and is refused. The result must have `form` and `data`.

`readQr` reads pages from the last backwards (`readPages`, `nextPage`) and decides on all the codes read (`joinPages`), so
codes 1-2 and 3-4 on different pages work, and the blank backs of a duplex print or attachment pages after the QR page
don't matter. Reading is dynamic: it stops as soon as the codes found are a whole application, or can never be one (a
foreign or mixed set, a wrong parity: refused at once). While codes are only missing (or none was found yet) it goes on
towards the first page, so the pages read depend on the document, not on a fixed number. A real application is a few pages
(8 QR pages for 16 codes), so there is one safety ceiling: a PDF of more than `MAX_PDF_PAGES` = 200 pages is refused before
any page is rendered ("This PDF has N pages; the workbench reads PDFs of up to 200 pages."). A code drawn as printed
text (`qrFromText`, `textPageCodes`) counts as one unlabelled code of its page, under the same rules. An old unlabelled
two-code set with one half on each page still joins (the other half is looked for on the earlier pages); a lone half is
refused once the document has been read. If codes were found but they don't join, the reason above is shown to the
operator (`QrRefusal`); with no code at all the answer is simply "none".

**Limits while drawing a page** (`renderScale`). A page is drawn at 2x (an A4 page is about 2 megapixels), but never with more than
`MAX_RENDER_PIXELS` = 25,000,000 pixels: a larger page is scaled down, not skipped. A page more than 14,400 units on a side is not
drawn; if no code is found on the other pages the operator is told so. A page that fails to draw or decode stops the read with
"Page N could not be read: ...", worded as its own refusal in the workbench (not as "codes don't join"). A page count that is
not a whole number is refused. A code already seen on a later page adds nothing, so a long PDF of repeated pages is read
quickly. When the form's fields are intact the QR code is only a cross-check; if it can't be read the operator sees a notice
that the cross-check was skipped, and why.

---

## 4. Choosing the form: `findForm`

Needed only for a printed or scanned copy. A PDF that still has its fields carries its own form description inside it
(`/FormTemplate`, see `src/form/stored-template.ts`), so no lookup is needed.

- The key is `form@version` from the QR code, e.g. `BG-01@1.0`. Both must match exactly, so a v1.0 application is never read with the v2.0 form.
- Looked up in this order:
  1. the registry folder [`forms/`](../forms/README.md) in this repo (published with the site, the same for every user);
  2. forms added in this browser (**Forms** button in the workbench: choose the blank form PDF; kept in this browser only);
  3. the LC built into the workbench (`src/lc.ts`).
- Old versions stay side by side.
- An unknown form doesn't fail: the raw answers are shown with the warning "form X version Y is not known here".

The workbench is the supported reader. (lc-form's `read_qr.py`, a local command-line tool outside this repository, finds the form file by **form code only**, and warns when the version differs.)

---

## 5. Checking the answers

The QR answers are compared with the rest of the PDF.

**A. Fields still there (`matchFields`).** Each question's QR answer must equal its field's answer. Both sides are
tidied first: blank, unticked and an empty list count as the same; spaces and list order are ignored. A shortened
answer matches when the full answer starts with the kept part. A difference means the customer edited the form after
making the code, so ops sees "the QR code says X, the form says Y: the code is out of date".

**B. Printed copy, no fields (`matchPrinted`).** Each typed answer (text, paragraph, date) must appear in the page's
text, ignoring case and spacing. This is the PDF's own text layer, not OCR. Ticks and choices can't be read from
printed text, so they are taken from the code. If fewer than half the typed answers are found, the pages don't carry
the answers as text (some viewers print text as shapes, a scan has no text at all): nothing is flagged and the code is
the record.

**C. The form's checks.** Mandatory fields, conditional rules and formats run against the answers with the form found
in section 4. For the LC the cross-checks also run (e.g. expiry date after issue date).

---

## 6. How zxing decodes a QR code

zxing is Google's open-source barcode reader, the same engine used by phone camera apps. The workbench uses
`zxing-wasm` (runs in the browser; nothing is sent anywhere); lc-form's `read_qr.py` uses `zxing-cpp`.
It uses fixed geometry and error-correction maths: no AI, no trained model, no guessing.

**Part 1: finding the code in a picture** (scans and photos only; skipped for "Save as PDF" copies, whose square
positions are already known)

1. **Black and white.** Each pixel becomes pure black or white, compared with its neighbours, so shadows and grey paper don't matter.
2. **Three corner "eyes".** Across an eye in any direction the widths run black-white-black-white-black in the ratio **1 : 1 : 3 : 1 : 1**. zxing scans rows for that rhythm and confirms it vertically.
3. **Straighten.** Three eyes give position, size and angle; a smaller alignment square corrects tilt. Every square's place on the grid is calculated.
4. **Read the grid.** The centre of each square is checked: black = 1, white = 0 (177 × 177, about 31,000 squares).

**Part 2: decoding the grid** (the same for every source)

5. **Settings.** A strip next to the eyes says the error-correction level and mask; it is stored twice.
6. **Unmask.** A fixed pattern flipped over the data when the code was made (to avoid big solid blocks) is flipped back.
7. **Bytes.** Data squares are read in a fixed zigzag, two columns at a time, from the bottom right; 8 squares make a byte.
8. **Repair (Reed-Solomon).** About 40 % of the bytes are check bytes computed from the data. They find and correct flipped squares (a stain, a bad scan): at level M about 15 % of the code can be damaged. Beyond that the check fails and zxing reports **no code**. It never returns wrong text.
9. **Text.** A header says "byte mode, N bytes" (and, for several codes, "code 3 of 7"). The bytes are the UTF-8 JSON text.

Result: the exact JSON, character for character, or a clear failure.

### QR decoding compared with OCR and AI

| | QR decoding (zxing) | OCR / AI |
|---|---|---|
| Method | Fixed geometry and error-correction maths | Learned guesses at letter shapes |
| Result | Exact text, or "no code" | Best guess, can be quietly wrong |
| Same input twice | Same output every time | Can differ |
| Needs | About 2 MB library in the browser, nothing sent anywhere | A model, often a cloud service |

Benchmark (10 test LCs, printed and scanned): QR 100 %, about 0.04 s per form; Gemini 3.7 Flash 99.5 %,
about 39 s per form.

**When OCR would be needed:** only for a scanned paper form with **no QR code**. The workbench doesn't do that; it
says "looks like a scan, which would need OCR" and stops.

---

## Libraries

| Library | Used for | Licence |
|---|---|---|
| `zxing-wasm` | Decoding every QR code in the workbench | MIT (ZXing engine: Apache-2.0) |
| `pdfjs-dist` (PDF.js) | Square positions (way 2), drawing pages as images (way 3), page text (check B) | Apache-2.0 |
| `pdf-lib` | Reading the hidden `__qr` field and the form stored in the PDF (way 1) | MIT |
| `zxing-cpp` (lc-form, Python) | `read_qr.py` for scanned images | Apache-2.0 |
| `pillow` (lc-form, Python) | Opening image files in `read_qr.py` | MIT-CMU |

The QR code is **made** without any library: the form's own JavaScript encoder runs inside Acrobat.

# Poor-quality LC applications 21 to 30: how the QR code survives

Ten typed LC applications (no handwriting), each with one kind of bad copy. Every sample has the same four pages as the
samples20-poor set; the QR code is on page 4. `qr-closeups/` shows the QR area of page 4 as it arrived. The answer key is
`LC-Samples-21-30-answers.json` (keyed by PDF name). Made by `benchmark/make_qr_samples.py` in lc-form.

Results are measured, not assumed: the Python reader is zxing-cpp on page 4 as stored in the PDF (what `read_qr.py` does);
the web reader is the workbench's `codesIn()` + `joinCodes()` (`src/qr-read.ts`) on the same page 4 image.
"Answers match" means the joined JSON data equals the answer key exactly.

| No. | Kind | Problem | What was done to the image | Python reader | Web reader |
|---|---|---|---|---|---|
| 21 | phone-photo | Photographed with a phone | Taken at an angle (keystone), a shadow across the code, uneven light, phone blur, JPEG. | 2 of 2 codes; answers match | 2 of 2 codes; answers match |
| 22 | scan-75dpi | Scanned at only 75 dpi | Whole page shrunk to 75 dpi: each QR square is under 2 pixels. Slight tilt, JPEG. | 1 of 1 codes; answers match | 1 of 1 codes; answers match |
| 23 | blurred | Out of focus and motion blur | Soft focus plus a horizontal smear (camera moved), then a medium scan. | 1 of 1 codes; answers match | 1 of 1 codes; answers match |
| 24 | crease-and-punch | Folded, punched and stapled | Letter folds at thirds (one runs through the code), two punch holes in the margin, a staple beside the code. | 1 of 1 codes; answers match | 1 of 1 codes; answers match |
| 25 | stain-and-pen | Coffee ring and pen scribble | A brown coffee ring and a pen scribble over about 6 percent of the code (2.6 percent of its pixels visibly darkened, since black squares cannot get darker). | 1 of 1 codes; answers match | 1 of 1 codes; answers match |
| 26 | torn-corner | Torn corner | The top-left corner of the code is torn off, taking one of the three corner squares with it. | 0 of 1 codes; answers NOT recovered | 0 of 1 codes; answers NOT recovered |
| 27 | cropped-edge | Page shifted on the scanner | The page sat 4.8 cm too far up on the glass, so the top of the code is cut off at the edge. | 0 of 1 codes; answers NOT recovered | 0 of 1 codes; answers NOT recovered |
| 28 | two-codes-fax | Two-code form sent by fax, one code damaged | Standard fax (204 x 98 dpi, black and white) and a jammed roll: a smeared band and a dirty streak across the second code. | 1 of 2 codes; answers NOT recovered | 1 of 2 codes; answers NOT recovered |
| 29 | faded-halftone | Faded low-toner print with a halftone screen | Grey, washed-out ink printed as a halftone dot pattern (moire against the scan), then a medium scan. | 1 of 1 codes; answers match | 1 of 1 codes; answers match |
| 30 | shrunk-and-skewed | Printed 'fit to page' at 60 percent and scanned skewed | Page shrunk to 60 percent, rotated about 6 degrees, scanned at 150 dpi. | 2 of 2 codes; answers match | 2 of 2 codes; answers match |

Samples 21, 28 and 30 carry two QR codes (a long goods description); the other seven carry one.

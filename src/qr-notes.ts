// What the workbench tells the operator about a QR read. Pure text, no pdf.js or zxing, so ops.ts can import it at once
// (qr-read.ts is loaded only when a PDF needs it) and tests/qr-notes.test.ts can run it in Node.

/** The refusal shown when QR codes were found (or the PDF could not be read) but the answers can't be taken from them. */
export const refusalText = (e: { kind: "codes" | "pages" | "render"; message: string }) =>
  e.kind === "codes" ? `its QR codes can't be read as one application. ${e.message}` : `its QR code can't be read. ${e.message}`;

/** A complete application was read, but pages were skipped as too large to draw: worth a look, not a refusal. */
export const skippedNotice = (found: { skipped?: number } | undefined) =>
  found?.skipped ? `${found.skipped} page(s) were too large to read.` : undefined;

/** The issue lines for the operator: why the cross-check did not run, and the notice. */
export const qrNotes = (o: { qrSkipped?: string; qrNotice?: string }) =>
  [o.qrSkipped && `the QR code cross-check was skipped: ${o.qrSkipped}`, o.qrNotice].filter((m): m is string => !!m);

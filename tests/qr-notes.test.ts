// The text the workbench shows for a QR read (src/qr-notes.ts, used by src/ops.ts).
import { expect, it } from "vitest";
import { QrRefusal } from "../src/qr-read";
import { qrNotes, refusalText, skippedNotice } from "../src/qr-notes";

it("a refusal is worded by its kind", () => {
  expect(refusalText(new QrRefusal("Code 2 of 3 not found.", "codes"))).toBe("its QR codes can't be read as one application. Code 2 of 3 not found.");
  for (const kind of ["pages", "render"] as const)
    expect(refusalText(new QrRefusal("Page 2 could not be read: x", kind))).toBe("its QR code can't be read. Page 2 could not be read: x");
});

it("pages skipped as too large give a notice; none, or no read at all, give nothing", () => {
  expect(skippedNotice({ skipped: 2 })).toBe("2 page(s) were too large to read.");
  expect(skippedNotice({ skipped: 0 })).toBeUndefined();
  expect(skippedNotice(undefined)).toBeUndefined();
});

it("the issue lines: why the cross-check did not run, then the notice", () => {
  expect(qrNotes({})).toEqual([]);
  expect(qrNotes({ qrSkipped: "no code" })).toEqual(["the QR code cross-check was skipped: no code"]);
  expect(qrNotes({ qrNotice: "1 page(s) were too large to read." })).toEqual(["1 page(s) were too large to read."]);
  expect(qrNotes({ qrSkipped: "a", qrNotice: "b" })).toEqual(["the QR code cross-check was skipped: a", "b"]);
});

it("ops.ts uses all three (a guard against unwiring them)", async () => {
  const { readFileSync } = await import("node:fs");
  const ops = readFileSync(new URL("../src/ops.ts", import.meta.url), "utf8");
  expect(ops).toMatch(/refusal = refusalText\(e\)/);
  expect(ops).toMatch(/qrNotice: skippedNotice\(found\)/);
  expect(ops).toMatch(/qrNotes\(current!\)/);
});

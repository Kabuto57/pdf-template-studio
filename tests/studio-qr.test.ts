// The Studio's Generate QR Code (src/studio-qr.ts): the fill page's engine and lc-form's scripts make the codes; the saved PDF carries them.
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { SMART_FORMS } from "../src/canvas/forms";
import { writePdf } from "../src/canvas/write-pdf";
import { OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { codesIn, joinCodes, parsePayload, readQr } from "../src/qr-read";
import { sampleFor } from "../src/sample";
import { addQr, canonical, generateQr, usable } from "../src/studio-qr";
import type { Qr } from "../src/studio-qr";
import type { Template, Values } from "../src/pdf";

const open = (file: string): Template => { const f = SMART_FORMS.find(s => s.file === file)!; return { ...JSON.parse(JSON.stringify(f.form)), file, pdfName: f.pdfName ?? undefined }; };
type Rect = [number, number, number, number];
/** The filled squares of each page of a PDF, read the way a viewer would: pdf.js's operator list, with the current transform applied. */
async function drawn(pdf: Uint8Array): Promise<Rect[][]> {
  const doc = await getDocument({ data: pdf.slice(), useSystemFonts: false, verbosity: 0 }).promise, pages: Rect[][] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const ol = await (await doc.getPage(n)).getOperatorList(), rects: Rect[] = [];
    let m = [1, 0, 0, 1, 0, 0]; const stack: number[][] = [];
    ol.fnArray.forEach((fn, i) => {
      const a = ol.argsArray[i];
      if (fn === OPS.save) stack.push(m);
      else if (fn === OPS.restore) m = stack.pop() ?? m;
      else if (fn === OPS.transform) { const [p, q, r, s, e, f] = a as number[]; m = [m[0] * p + m[2] * q, m[1] * p + m[3] * q, m[0] * r + m[2] * s, m[1] * r + m[3] * s, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]]; }
      else if (fn === OPS.constructPath) { const b = a[2] as Record<number, number>, w = b[2] - b[0], h = b[3] - b[1]; if (h < 5) rects.push([m[4] + b[0], m[5] + b[1], w, h]); } // squares only: the frame is taller
    });
    pages.push(rects);
  }
  return pages;
}
/** The (row, column) of every dark module a page's squares make in a slot. */
function cellsOf(rects: Rect[], [sx, sy, size]: number[]) {
  const m = size / 185, out = new Set<string>();
  for (const [x, y, rw, rh] of rects) {
    if (y < sy - 1 || y > sy + size) continue;
    const c0 = Math.round((x - sx) / m), c1 = Math.round((x + rw - sx) / m), r0 = Math.round((sy + size - (y + rh)) / m);
    for (let c = c0; c < c1; c++) out.add(`${r0 - 4},${c - 4}`);
  }
  return out;
}
/** A page's squares in a slot, rasterised (3 pixels a module) as a scanner would see that code. */
function raster(rects: Rect[], slot: number[]) {
  const px = 3, w = 185 * px, data = new Uint8ClampedArray(w * w * 4).fill(255);
  for (const k of cellsOf(rects, slot)) {
    const [r, c] = k.split(",").map(x => +x + 4);
    for (let dy = 0; dy < px; dy++) data.fill(0, ((r * px + dy) * w + c * px) * 4, ((r * px + dy) * w + c * px) * 4 + 3);
  }
  return { data, width: w, height: w, colorSpace: "srgb" } as unknown as ImageData;
}
/** The codes drawn on the saved PDF (the kept text left out, so only the squares are read), joined. */
async function readDrawn(t: Template, values: Values, qr: Qr) {
  const plain = (await getDocument({ data: (await writePdf(t, values)).slice(), verbosity: 0 }).promise).numPages;
  const pages = await drawn(await addQr(await writePdf(t, values), qr, false));
  const codes = (await Promise.all(pages.flatMap(rects => qr.slots.map(slot => codesIn(raster(rects, slot)))))).flat();
  // every module of every code is where the engine's matrix has it (a scanner also reads a mirrored code, so the text alone cannot tell)
  qr.codes.forEach((c, k) => {
    const want = new Set(c.rows.flatMap((row, y) => [...row.matchAll(/n/g)].map(m => `${y},${m.index}`)));
    expect(cellsOf(pages[qr.page + (k >> 1)], qr.slots[k & 1]), `code ${k + 1}`).toEqual(want);
  });
  return { pages: pages.length - plain, joined: codes.length ? joinCodes(codes) : undefined, n: codes.length };
}
const made = async (t: Template, values: Values) => { const r = await generateQr(t, values); if (!("qr" in r)) throw new Error(r.message); return r.qr; };
const longs = (t: Template) => Object.fromEntries(t.sections.flatMap(s => s.fields).filter(q => q.kind === "long").map(q => [q.id, "Y".repeat((q.max || 3000) - 1)]));

describe("Studio: Generate QR Code", () => {
  it("refuses while mandatory answers are blank, listing them", async () => {
    const r = await generateQr(open("lc_form.py"), {});
    expect(r).toHaveProperty("message");
    expect((r as { message: string }).message).toMatch(/cannot be generated yet[\s\S]*mandatory questions? (is|are) still blank:\n- /);
  });

  it("says what to do for an edited form", async () => {
    const t = open("lc_form.py");
    t.title += " (mine)";
    expect(await generateQr(t, sampleFor(t))).toEqual({ message: expect.stringMatching(/smart forms.*export the form file/) });
  });

  it("makes the codes from the LC sample; the saved PDF reads back to the same answers", async () => {
    const t = open("lc_form.py"), values = sampleFor(t), r = await generateQr(t, values);
    if (!("qr" in r)) throw new Error(r.message);
    const payload = parsePayload(r.qr.text)!;
    if (!payload) throw new Error("no payload");
    expect(payload.complete).toBe(true);
    expect(payload.form).toMatch(/^LC-/);
    // the saved PDF: exact through the kept text ...
    const pdf = await addQr(await writePdf(t, values), r.qr);
    expect((await readQr(pdf))?.payload).toEqual(payload);
  }, 60000);

  for (const [what, make, codes, extra] of [
    ["1 code", () => "bill_of_exchange_form.py", 1, 0], ["2 codes", () => "lc_form.py", 2, 0], ["4+ codes (long paragraphs)", () => "lc_form.py", 4, 1],
  ] as const)
    it(`the squares drawn on the saved PDF are read back by the QR reader: ${what}`, async () => {
      const file = make(), t = open(file), values = what.startsWith("4+") ? { ...sampleFor(t), ...longs(t) } : sampleFor(t), qr = await made(t, values);
      expect(qr.codes.length).toBeGreaterThanOrEqual(codes);
      if (!what.startsWith("4+")) expect(qr.codes).toHaveLength(codes);
      const r = await readDrawn(t, values, qr);
      expect(r.n).toBe(qr.codes.length);
      expect(r.pages).toBe(Math.ceil(qr.codes.length / 2) - 1);
      if (extra) expect(r.pages).toBeGreaterThanOrEqual(1);
      expect(r.joined).toEqual(parsePayload(qr.text));
    }, 120000);

  it("codes are used only for the form and answers they were made from", async () => {
    const a = open("lc_form.py"), b = open("bg_form.py"), values = sampleFor(a), qr = await made(a, values);
    expect(usable(qr, a, values)).toBe(qr);
    expect(usable(qr, b, {})).toBeUndefined(); // another form
    expect(usable(qr, b, values)).toBeUndefined();
    const edited = JSON.parse(JSON.stringify(a)) as Template;
    edited.sections[0].title += "!"; // a canvas edit
    expect(usable(qr, edited, values)).toBeUndefined();
    expect(usable(qr, a, { ...values, applicant: "other" })).toBeUndefined(); // an answer
    expect(usable(undefined, a, values)).toBeUndefined();
  }, 60000);

  it("a form whose keys were deleted and added back in another order is still the same form", async () => {
    const t = open("lc_form.py"), { title, ...rest } = t, reordered = { ...rest, title } as Template;
    expect(Object.keys(reordered)).not.toEqual(Object.keys(t));
    expect(canonical(reordered)).toBe(canonical(t));
    expect(await generateQr(reordered, sampleFor(t))).toHaveProperty("qr");
  }, 60000);

  it("the pipe-format form makes pipe records", async () => {
    const t = open("lc_pipe_form.py"), r = await generateQr(t, sampleFor(t));
    if (!("qr" in r)) throw new Error(r.message);
    expect(r.qr.text.startsWith("1|")).toBe(true);
  }, 60000);
});

// The Studio's Generate QR Code (src/studio-qr.ts): the fill page's engine and lc-form's scripts make the codes; the saved PDF carries them.
import { describe, expect, it } from "vitest";
import { SMART_FORMS } from "../src/canvas/forms";
import { writePdf } from "../src/canvas/write-pdf";
import { codesIn, joinCodes, parsePayload, readQr } from "../src/qr-read";
import { sampleFor } from "../src/sample";
import { addQr, generateQr, squares } from "../src/studio-qr";
import type { Template } from "../src/pdf";

const open = (file: string): Template => { const f = SMART_FORMS.find(s => s.file === file)!; return { ...JSON.parse(JSON.stringify(f.form)), file, pdfName: f.pdfName ?? undefined }; };
/** A picture of the squares `squares` would draw in a slot (1 unit = 1 pixel at scale 2), as a scanner would see it. */
function picture(rows: string[]) {
  const size = 185, px = 3, w = size * px, data = new Uint8ClampedArray(w * w * 4).fill(255);
  for (const [x, y, rw] of squares(rows, [0, 0, size]))
    for (let dy = 0; dy < px; dy++) data.fill(0, ((Math.round(size - y - 1) * px + dy) * w + Math.round(x) * px) * 4, ((Math.round(size - y - 1) * px + dy) * w + Math.round(x + rw) * px) * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { data, width: w, height: w, colorSpace: "srgb" } as unknown as ImageData;
}

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
    // the drawn squares decode to the same text
    const read = (await Promise.all(r.qr.codes.map(c => codesIn(picture(c.rows))))).flat();
    expect(joinCodes(read)).toEqual(payload);
    // the saved PDF: exact through the kept text ...
    const pdf = await addQr(await writePdf(t, values), r.qr);
    expect((await readQr(pdf))?.payload).toEqual(payload);
    // ... and the QR page has the drawn squares (the text left out, more content than without)
    const bare = await addQr(await writePdf(t, values), r.qr, false), plain = await writePdf(t, values);
    expect(bare.length).toBeGreaterThan(plain.length + 1000);
  }, 60000);

  it("the pipe-format form makes pipe records", async () => {
    const t = open("lc_pipe_form.py"), r = await generateQr(t, sampleFor(t));
    if (!("qr" in r)) throw new Error(r.message);
    expect(r.qr.text.startsWith("1|")).toBe(true);
  }, 60000);
});

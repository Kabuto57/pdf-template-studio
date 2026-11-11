// The workbench's QR code reader: the form's own code (lcPayload + lcQrMatrix) decodes with jsQR, and its answers are
// matched against the fields or the printed pages.
import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import { qrScript } from "../src/form/acrobat-script";
import { SAMPLES, qrPayload, samplePdf } from "../src/demo-applications";
import { LC, LC_SAMPLE } from "../src/lc";
import { extractPdf } from "../src/pdf";
import { matchFields, matchPrinted, parsePayload } from "../src/qr-read";
import { readText } from "../src/text";

const t = LC.template;
/** The code as a picture: `px` pixels a square, 4 white squares around it. */
function picture(text: string, px = 4) {
  const m = new Function(`${qrScript}; return lcQrMatrix;`)()(text) as boolean[][], n = m.length + 8, w = n * px;
  const data = new Uint8ClampedArray(w * w * 4).fill(255);
  for (let y = 0; y < m.length; y++) for (let x = 0; x < m.length; x++) if (m[y][x])
    for (let dy = 0; dy < px; dy++) for (let dx = 0; dx < px; dx++) data.fill(0, (((y + 4) * px + dy) * w + (x + 4) * px + dx) * 4, (((y + 4) * px + dy) * w + (x + 4) * px + dx) * 4 + 3);
  return { data, w };
}

describe("QR code of the answers", () => {
  it("the form's own code decodes back to its answers", () => {
    const text = qrPayload(t, LC_SAMPLE), { data, w } = picture(text);
    expect(text.length).toBe(2300);
    const code = jsQR(data, w, w)!;
    expect(code.data).toBe(text);
    const p = parsePayload(code.data)!;
    expect(p.form).toBe("LC-01");
    expect(p.data.applicant_name).toBe(LC_SAMPLE.applicant_name);
    expect(matchFields(t, p, LC_SAMPLE)).toEqual([]);
  });

  it("flags answers that differ from the fields (a code out of date)", () => {
    const p = parsePayload(qrPayload(t, LC_SAMPLE))!;
    const changed = matchFields(t, p, { ...LC_SAMPLE, amount: "999,000.00" });
    expect(changed).toEqual([{ id: "amount", label: "Amount", qr: LC_SAMPLE.amount, pdf: "999,000.00" }]);
  });

  it("reads a printed copy: the fields are gone, the code's typed answers are on the pages", async () => {
    const s = SAMPLES.find(x => x.printed)!, bytes = await samplePdf(s);
    expect((await extractPdf(bytes).catch(() => undefined))?.rows.length ?? 0).toBe(0); // no fields left
    const words = (await readText(bytes)).map(l => l.segs.map(g => g.text).join(" ")).join(" ");
    const p = parsePayload(qrPayload(t, s.answers))!;
    expect(matchPrinted(t, p, words)).toEqual([]);
    const wrong = { ...p, data: { ...p.data, beneficiary_name: "SOMEONE ELSE LTD" } };
    expect(matchPrinted(t, wrong, words).map(m => m.id)).toEqual(["beneficiary_name"]);
  }, 30000);
});

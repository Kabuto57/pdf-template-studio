// The workbench's QR code reader: the form's own code (lcPayload + lcQrMatrix) decodes with zxing, and its answers are
// matched against the fields or the printed pages.
import { describe, expect, it } from "vitest";
import { qrScript } from "../src/form/acrobat-script";
import { SAMPLES, qrPayload, samplePdf } from "../src/demo-applications";
import { LC, LC_SAMPLE } from "../src/lc";
import { extractPdf } from "../src/pdf";
import { codesIn, joinCodes, matchFields, matchPrinted, parsePayload, qrFromText } from "../src/qr-read";
import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
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
  it("the form's own code decodes back to its answers", async () => {
    const text = qrPayload(t, LC_SAMPLE), { data, w } = picture(text);
    expect(text.length).toBe(2300);
    const [code] = await codesIn({ data, width: w, height: w, colorSpace: "srgb" } as ImageData);
    expect(new TextDecoder().decode(code.bytes)).toBe(text);
    const p = parsePayload(new TextDecoder().decode(code.bytes))!;
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
    expect(matchPrinted(t, p, words)).toEqual({ mismatches: [], readable: true });
    // The code itself, rebuilt from where its squares are printed (ZapfDingbats text, as Acrobat draws it).
    const doc = await getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
    const items = (await (await doc.getPage(doc.numPages)).getTextContent()).items as { str: string; transform: number[] }[];
    expect(parsePayload((await qrFromText(items))!)?.data).toEqual(p.data);
    const wrong = { ...p, data: { ...p.data, beneficiary_name: "SOMEONE ELSE LTD" } };
    expect(matchPrinted(t, wrong, words).mismatches.map(m => m.id)).toEqual(["beneficiary_name"]);
    // A copy printed without its answers as text (only the form's own wording): nothing to match, nothing flagged.
    const blank = (await readText(await samplePdf({ ...s, answers: {} }))).map(l => l.segs.map(g => g.text).join(" ")).join(" ");
    expect(matchPrinted(t, p, blank)).toEqual({ mismatches: [], readable: false });
  }, 30000);
});

// lc-form's LC prints one or two codes. Fixtures: a scanned QR page from lc-form's benchmark (two plain codes), and the
// two structured-append codes its own lcQrMatrix draws ("QR code 1 of 2" / "2 of 2").
describe("lc-form's one or two QR codes (zxing)", () => {
  const blob = (f: string) => new Blob([readFileSync(new URL(`./fixtures/${f}`, import.meta.url))]);

  it("reads both codes on a scanned QR page and joins them into one application", async () => {
    const codes = await codesIn(blob("lc-form-two-codes-scan.jpg"));
    expect(codes).toHaveLength(2);
    const p = joinCodes(codes)!;
    expect(p.form).toBe("LC-01");
    expect(Object.keys(p.data)).toHaveLength(65);
    expect(joinCodes([codes[1], codes[0]])).toEqual(p); // scanned in either order
    expect(joinCodes([codes[0]])).toBeUndefined(); // half an application
  }, 30000);

  it("reads the form's own structured-append pair, in order by its sequence number", async () => {
    const codes = await codesIn(blob("lc-form-structured-append.png"));
    expect(codes.map(c => [c.index, c.size]).sort()).toEqual([[0, 2], [1, 2]]);
    const want = JSON.parse(readFileSync(new URL("./fixtures/lc-form-structured-append.txt", import.meta.url), "utf8"));
    expect(joinCodes([...codes].reverse())).toEqual(want); // the non-ASCII answer survives the split
  }, 30000);

  it("ignores the same code scanned twice, and refuses three", async () => {
    const [a, b] = await codesIn(blob("lc-form-two-codes-scan.jpg"));
    expect(joinCodes([a, b, a])?.form).toBe("LC-01");
    expect(joinCodes([a, b, { ...a, bytes: new Uint8Array([123, 125]) }])).toBeUndefined();
  }, 30000);
});

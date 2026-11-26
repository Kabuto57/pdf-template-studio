// 1 to 16 QR codes (structured append) joined by the workbench's reader. The codes are drawn by lc-form's own encoder
// (lcQrMatrix with [index, total, parity], copied into src/fill/gen), read back with zxing-wasm as a scanner would, and
// joined in the order their labels say. Payload as lc-form makes it: JSON padded with spaces to n x 2300 bytes, n equal slices.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { codesIn, joinCodes, joinPages, joinResult, MAX_CODES, QrRefusal, type Code } from "../src/qr-read";

const CAP = 2300;
const src = readFileSync(new URL("../src/fill/gen/lc_form.ts", import.meta.url), "utf8");
const encode = new Function(`${src.slice(src.indexOf("function lcQrMatrix("), src.indexOf("// lcDrawQr("))}; return lcQrMatrix;`)() as
  (bytes: string, part: number[] | null) => boolean[][];

/** A square picture of one code: 3 pixels a square, 4 white squares around it. */
function picture(m: boolean[][], px = 3) {
  const w = (m.length + 8) * px, data = new Uint8ClampedArray(w * w * 4).fill(255);
  for (let y = 0; y < m.length; y++) for (let x = 0; x < m.length; x++) if (m[y][x])
    for (let dy = 0; dy < px; dy++) for (let dx = 0; dx < px; dx++) data.fill(0, (((y + 4) * px + dy) * w + (x + 4) * px + dx) * 4, (((y + 4) * px + dy) * w + (x + 4) * px + dx) * 4 + 3);
  return { data, width: w, height: w, colorSpace: "srgb" } as unknown as ImageData;
}
/** Two or more codes side by side on one white "page". */
function page(ms: boolean[][][], px = 3) {
  const pics = ms.map(m => picture(m, px)), h = pics[0].height, w = pics.reduce((n, p) => n + p.width, 0), data = new Uint8ClampedArray(w * h * 4).fill(255);
  let at = 0;
  for (const p of pics) { for (let y = 0; y < h; y++) data.set(p.data.subarray(y * p.width * 4, (y + 1) * p.width * 4), (y * w + at) * 4); at += p.width; }
  return { data, width: w, height: h, colorSpace: "srgb" } as unknown as ImageData;
}

/** An application of exactly n codes: its JSON, the n slices of the padded text (one char a byte), and the parity. */
function app(n: number, tag: string, parityLie = 0) {
  const head = `{"form":"LC-01","version":"1.0","saved":"2026-11-25T10:00","complete":true,"data":{"tag":"${tag}","a":"`;
  let json: string;
  if (n === 1) json = head + "short" + '"}}';
  else {
    // the first slice ends between the two bytes of "é" (a character split across two codes must survive)
    const base = head + "x".repeat(CAP - 1 - Buffer.byteLength(head)) + "é";
    json = base + "y".repeat((n - 1) * CAP + 50 - Buffer.byteLength(base) - 3) + '"}}';
  }
  const bytes = Buffer.from(json, "utf8");
  expect(bytes.length).toBeLessThanOrEqual(n * CAP);
  expect(bytes.length).toBeGreaterThan((n - 1) * CAP);
  const padded = Buffer.concat([bytes, Buffer.alloc(n * CAP - bytes.length, 32)]), parity = padded.reduce((x, b) => x ^ b, 0);
  const slices = Array.from({ length: n }, (_, k) => padded.subarray(k * CAP, (k + 1) * CAP).toString("latin1"));
  return { json: JSON.parse(json), n, parity, slices, matrices: slices.map((s, k) => encode(s, n > 1 ? [k, n, (parity ^ parityLie) & 255] : null)) };
}
type App = ReturnType<typeof app>;
/** What a scanner reads from each code of the application, in order (index k is element k). */
async function scan(a: App): Promise<Code[]> {
  const out: Code[] = [];
  for (const m of a.matrices) { const r = await codesIn(picture(m)); expect(r).toHaveLength(1); out.push(r[0]); }
  return out;
}
const shuffled = <T,>(a: T[]) => a.map((x, i) => [x, (i * 7919 + 13) % 101] as const).sort((p, q) => p[1] - q[1]).map(p => p[0]);
const msg = (c: Code[]) => { const r = joinResult(c); return "error" in r ? r.error : "joined"; };

describe("1 to 16 structured-append codes", () => {
  for (const n of [1, 2, 3, 7, 16]) {
    it(`${n} code${n > 1 ? "s" : ""}: joined, in any order, to exactly the source JSON`, async () => {
      const a = app(n, `app-${n}`), codes = await scan(a);
      if (n > 1) expect(codes.map(c => [c.index, c.size]).sort((p, q) => p[0] - q[0])).toEqual(a.slices.map((_, k) => [k, n]));
      expect(joinCodes(codes)).toEqual(a.json);
      expect(joinCodes([...codes].reverse())).toEqual(a.json);
      expect(joinCodes(shuffled(codes))).toEqual(a.json);
      if (n > 1) expect(codes.every(c => c.id === String(a.parity))).toBe(true); // zxing-wasm's sequenceId is the parity
    }, 60000);
  }

  it("the split character (é across two codes) survives", async () => {
    const a = app(3, "split"), p = joinCodes(await scan(a))!;
    expect((p.data as { a: string }).a.includes("é")).toBe(true);
    expect(p).toEqual(a.json);
  }, 30000);

  it("a missing middle code is refused, naming it", async () => {
    const codes = await scan(app(7, "missing"));
    expect(joinCodes(codes.filter(c => c.index !== 3))).toBeUndefined();
    expect(msg(codes.filter(c => c.index !== 3))).toBe("Code 4 of 7 not found; scan all 7 codes.");
    expect(msg(codes.filter(c => c.index !== 1 && c.index !== 5))).toBe("Codes 2, 6 of 7 not found; scan all 7 codes.");
    expect(msg(codes.slice(0, 1))).toBe("Codes 2, 3, 4, 5, 6, 7 of 7 not found; scan all 7 codes.");
  }, 30000);

  it("the same code found twice counts once", async () => {
    const a = app(3, "dup"), codes = await scan(a);
    expect(joinCodes([...codes, codes[1], codes[1], codes[0]])).toEqual(a.json);
  }, 30000);

  it("codes of two applications mixed are not merged", async () => {
    const A = app(3, "app-A"), B = app(3, "app-B");
    expect(A.parity).not.toBe(B.parity); // (else the parity can't tell them apart: the next test covers that)
    const mixed = [...(await scan(A)), ...(await scan(B))];
    expect(joinCodes(shuffled(mixed))).toBeUndefined();
    expect(msg(mixed)).toMatch(/2 different applications/);
    expect(msg([...(await scan(A)).slice(0, 2), ...(await scan(B)).slice(2)])).toMatch(/different applications/);
  }, 30000);

  it("two applications with the same parity and total: a clash on an index is refused", async () => {
    const A = await scan(app(3, "app-A")), B = (await scan(app(3, "app-B"))).map(c => ({ ...c, id: A[0].id }));
    expect(msg([...A, ...B])).toMatch(/Two different QR codes both say they are code \d of 3/);
    expect(msg([B[0], A[1], A[2]])).toMatch(/check value/); // a lucky parity match still fails the parity of the joined text
  }, 30000);

  it("codes that disagree on the total are refused", async () => {
    const codes = await scan(app(3, "total"));
    expect(msg([codes[0], codes[1], { ...codes[2], size: 4 }])).toMatch(/disagree on how many codes there are \(3 and 4\)/);
  }, 30000);

  it("a wrong parity (in the labels, or from a damaged code) is refused", async () => {
    const lie = await scan(app(3, "lie", 5));
    expect(joinCodes(lie)).toBeUndefined();
    expect(msg(lie)).toMatch(/check value \(parity\)/);
    const good = await scan(app(3, "flip")), bytes = good[1].bytes.slice();
    bytes[10] ^= 1;
    expect(msg([good[0], { ...good[1], bytes }, good[2]])).toMatch(/check value \(parity\)/);
  }, 30000);

  it("more than 16 codes, an index beyond the total, or too many bytes: refused", async () => {
    const [c] = await scan(app(2, "limit"));
    expect(msg([{ ...c, index: 0, size: 17 }])).toMatch(/1 to 16/);
    expect(msg([{ ...c, index: 3, size: 2 }])).toMatch(/code 4 of 2/);
    const big = Array.from({ length: MAX_CODES }, (_, index) => ({ bytes: new Uint8Array(2400).fill(32), index, size: MAX_CODES, id: "32" }));
    big.forEach(b => (b.bytes[0] = 123)); // not 2400 x 16 equal bytes: just oversize
    expect(msg(big)).toMatch(/longer than 16 codes can hold/);
  });

  it("labelled and unlabelled codes mixed are refused", async () => {
    const [a] = await scan(app(2, "mixed")), plain = { bytes: new TextEncoder().encode('{"form":"LC-01","data":{}}'), index: -1, size: -1, id: "" };
    expect(msg([a, plain])).toMatch(/some are not/);
  }, 30000);

  it("the JSON is data only: a hostile key does not touch Object.prototype", () => {
    const text = '{"form":"LC-01","data":{"__proto__":{"polluted":1},"x":"y"}}', bytes = new TextEncoder().encode(text);
    const p = joinCodes([{ bytes, index: -1, size: -1, id: "" }])!;
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.keys(p.data)).toContain("x");
  });

  it("codes 1-2 on one page and 3-4 on another (two to a page) join up", async () => {
    const a = app(4, "pages"), p1 = await codesIn(page(a.matrices.slice(0, 2))), p2 = await codesIn(page(a.matrices.slice(2)));
    expect(p1).toHaveLength(2);
    expect(p2).toHaveLength(2);
    expect(joinCodes(p1)).toBeUndefined(); // the first page alone is not an application
    expect(msg(p1)).toBe("Codes 3, 4 of 4 not found; scan all 4 codes.");
    expect(joinCodes([...p2, ...p1])).toEqual(a.json);
  }, 30000);

  it("three unlabelled codes are refused (an unlabelled set is one or two codes), even when they would join in the order given", () => {
    const text = new TextEncoder().encode('{"form":"LC-01","version":"1.0","saved":"x","complete":true,"data":{"a":"' + "z".repeat(60) + '"}}');
    const third = Math.floor(text.length / 3), plain = (b: Uint8Array): Code => ({ bytes: b, index: -1, size: -1, id: "" });
    const three = [plain(text.slice(0, third)), plain(text.slice(third, 2 * third)), plain(text.slice(2 * third))];
    expect(msg(three)).toMatch(/3 different QR codes without a "code N of M" label/);
    expect(joinCodes([plain(text.slice(0, 40)), plain(text.slice(40))])!.form).toBe("LC-01"); // two unlabelled codes still join
  });

  it("one image holding all 16 codes: every code is read (not just a few)", async () => {
    const a = app(16, "sixteen"), found = await codesIn(page(a.matrices));
    expect(found).toHaveLength(16);
    expect(joinCodes(found)).toEqual(a.json);
  }, 60000);

  it("the joined bytes must be valid UTF-8, and only JSON's own white space may surround the JSON", () => {
    const enc = (s: string) => [...new TextEncoder().encode(s)];
    const one = (bytes: number[]): Code => ({ bytes: Uint8Array.from(bytes), index: 0, size: 1, id: String(bytes.reduce((x, b) => x ^ b, 0)) });
    const json = '{"form":"LC-01","data":{"a":"x"}}';
    expect(joinCodes([one(enc(json))])!.form).toBe("LC-01");
    expect(joinCodes([one(enc(json + "   "))])!.form).toBe("LC-01"); // the padding
    expect(joinCodes([one([...enc('{"form":"LC-01","data":{"a":"'), 0xff, ...enc('"}}')])])).toBeUndefined(); // invalid UTF-8: not guessed at
    expect(joinCodes([one([...enc(json), 0xc2, 0xa0])])).toBeUndefined(); // a trailing no-break space is not padding
    expect(joinCodes([one([0xef, 0xbb, 0xbf, ...enc(json)])])).toBeUndefined(); // nor is a byte order mark
  });

  it("the check value must be ASCII digits", () => {
    const bytes = new TextEncoder().encode('{"form":"LC-01","data":{}}');
    for (const id of ["", String.fromCharCode(178), "+1", "1e1", " 7"]) expect(msg([{ bytes, index: 0, size: 1, id }]), JSON.stringify(id)).toMatch(/not a number/);
  });

  it("joinPages decides on the codes of every page together", async () => {
    const A = await scan(app(4, "pa")), B = await scan(app(4, "pb"));
    const ok = joinPages([{ page: 5, codes: [A[0], A[1]] }, { page: 4, codes: [] }, { page: 3, codes: [A[3], A[2]] }])!;
    expect(ok.page).toBe(5);
    expect(ok.codes).toBe(4);
    expect(joinPages([{ page: 2, codes: [] }])).toBeUndefined();
    // codes of another application on an earlier page: refused, even though the later pages alone would join
    const mixed = [{ page: 5, codes: A }, { page: 2, codes: [B[0]] }];
    expect(() => joinPages(mixed)).toThrow(QrRefusal);
    expect(() => joinPages(mixed)).toThrow(/different applications/);
    expect(() => joinPages([{ page: 5, codes: [A[0]] }])).toThrow(/not found; scan all 4 codes/);
  }, 30000);
});

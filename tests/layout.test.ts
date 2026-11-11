// The studio's layout editor: sections placed by hand (Section.frame), questions placed by hand (Field.at), even
// column grids (Section.cols).
import { describe, expect, it } from "vitest";
import { buildPdf, extractPdf, type Geometry, type Template } from "../src/pdf";
import { LC } from "../src/lc";

const q = (id: string) => ({ id, label: id.replace("_", " "), kind: "text" as const });
const form = (): Template => ({
  title: "Placed",
  note: "",
  sections: [
    { title: "Left", fields: [q("a_1"), q("a_2")], frame: { page: 0, x: 42, y: 700, w: 250, h: 0 }, cols: 1 },
    { title: "Right", fields: [q("b_1"), q("b_2"), q("b_3"), q("b_4")], frame: { page: 0, x: 300, y: 700, w: 253, h: 0 }, cols: 2 },
    { title: "Lower", fields: [q("c_1")], frame: { page: 1, x: 42, y: 600, w: 511, h: 80 } },
  ],
});

describe("layout editor", () => {
  it("draws sections where they were put, questions in even columns, and reads the answers back", async () => {
    const geo = {} as Geometry;
    const bytes = await buildPdf(form(), { a_1: "x", b_4: "y", c_1: "z" }, "both", geo);
    expect(geo.pages).toBe(2);
    expect(geo.sections.map(s => [s.si, s.page, s.x, s.y])).toEqual([[0, 0, 42, 700], [1, 0, 300, 700], [2, 1, 42, 600]]);
    expect(geo.sections[2].h).toBe(80); // a fixed height is kept
    const b = geo.fields.filter(f => f.si === 1);
    expect(b[0].x).toBe(b[2].x); // a column lines up from row to row
    expect(b[1].w).toBeCloseTo(b[0].w);
    const { data } = await extractPdf(bytes);
    expect(data).toMatchObject({ a_1: "x", b_4: "y", c_1: "z" });
  });

  it("puts a question placed by hand at its spot, and pushes a section under one that grew", async () => {
    const t = form();
    t.sections[0].fields[1].at = { x: 10, y: 200, w: 200 }; // far down: the Left box grows
    t.sections.push({ title: "Under", fields: [q("d_1")], frame: { page: 0, x: 42, y: 620, w: 250, h: 0 } });
    const geo = {} as Geometry;
    await buildPdf(t, {}, "both", geo);
    const a2 = geo.fields.find(f => f.id === "a_2")!, left = geo.sections.find(s => s.si === 0)!, under = geo.sections.find(s => s.si === 3)!;
    expect([a2.x, a2.y, a2.w]).toEqual([52, 500, 200]);
    expect(left.y - left.h).toBeLessThan(500);
    expect(under.y).toBeLessThan(left.y - left.h); // no overlap
  });

  it("keeps every section whole on one page when asked (Arrange by hand)", async () => {
    const t: Template = { ...LC.template, design: "new" }; // two of its sections carry on over a page
    const split = {} as Geometry, whole = {} as Geometry;
    await buildPdf(t, {}, "both", split);
    await buildPdf(t, {}, "both", whole, true);
    expect(split.sections.some(s => s.split)).toBe(true);
    expect(whole.sections.some(s => s.split)).toBe(false);
  }, 30000);
});

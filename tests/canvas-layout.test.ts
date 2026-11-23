// The studio's copy of the smart forms' layout (src/canvas/layout.ts) must put every field exactly where lc-form's
// layout.py does. The fixture is written by scripts/smartforms.py from the lc-form project.
import { describe, expect, it } from "vitest";
import PARITY from "./fixtures/layout-parity.json";
import { layout } from "../src/canvas/layout";
import { SMART_FORMS } from "../src/canvas/forms";

const expected = PARITY as unknown as Record<string, { pages: number; ops: number[]; widgets: [string, number, number, number, number, number][] }>;

describe("smart-form layout matches lc-form's layout.py", () => {
  for (const f of SMART_FORMS) {
    it(f.file, () => {
      const laid = layout(f.form, f.defaults), want = expected[f.file];
      expect(laid.pages.length).toBe(want.pages);
      expect(laid.pages.map(p => p.length)).toEqual(want.ops);
      const got = laid.fields.flatMap(x => x.widgets.map(w => [x.name, w.page, ...w.rect] as const));
      expect(got.map(g => g.slice(0, 2))).toEqual(want.widgets.map(w => w.slice(0, 2)));
      got.forEach((g, i) => g.slice(2).forEach((n, k) => expect(Math.abs((n as number) - (want.widgets[i][2 + k] as number)), `${g[0]} corner ${k}`).toBeLessThan(0.002)));
    });
  }
});

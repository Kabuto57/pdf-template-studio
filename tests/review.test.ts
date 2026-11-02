import { describe, expect, it } from "vitest";
import { buildPdf, extractPdf } from "../src/pdf";
import { DEMO_WATCHLIST, reportTemplate, review, sameName } from "../src/review";
import { GUARANTEE, SAMPLE } from "../src/sample";

const rowsOf = async (values: typeof SAMPLE) => (await extractPdf(await buildPdf(GUARANTEE, values))).rows;
const status = (cs: ReturnType<typeof review>, name: string) => cs.find(c => c.name === name)?.status;
const NOW = new Date(2026, 10, 2);

describe("ops review", () => {
  it("passes a clean application", async () => {
    const checks = review(await rowsOf(SAMPLE), DEMO_WATCHLIST, NOW);
    expect(checks.filter(c => c.status !== "pass")).toEqual([]);
  });

  it("flags blanks, bad dates, listed names, risky countries and words", async () => {
    const checks = review(await rowsOf({ ...SAMPLE, signatory_name: "", expiry_date: "01/10/2026", amount: "lots",
      beneficiary_name: "Shadow Harbour Shipping L.L.C.", beneficiary_country: "Iran", purpose: "Supply of military radios" }), DEMO_WATCHLIST, NOW);
    expect(status(checks, "Mandatory questions")).toBe("fail");
    expect(status(checks, "Dates")).toBe("fail");
    expect(status(checks, "Expiry")).toBe("check");
    expect(status(checks, "Amounts")).toBe("fail");
    expect(status(checks, "Sanctions screening")).toBe("check");
    expect(status(checks, "High-risk countries")).toBe("check");
    expect(status(checks, "Purpose and goods")).toBe("check");
  });

  it("matches names despite punctuation and suffixes, not unrelated ones", () => {
    expect(sameName("RED DUNE TRADING F.Z.E.", "Red Dune Trading FZE")).toBe(true);
    expect(sameName("Red Dune Tradng", "Red Dune Trading FZE")).toBe(true);
    expect(sameName("Harbour Development Authority", "Shadow Harbour Shipping LLC")).toBe(false);
  });

  it("report is a fillable PDF that extracts back with the decision", async () => {
    const rows = await rowsOf(SAMPLE);
    const { template, values } = reportTemplate(GUARANTEE.title, "bg.pdf", rows, review(rows, DEMO_WATCHLIST, NOW), { decision: "Accept", reviewer: "OPS ONE" });
    const { data } = await extractPdf(await buildPdf(template, values));
    expect(data.decision).toBe("Accept");
    expect(data[`answer_${rows.findIndex(r => r.id === "applicant_tel")}`]).toBe("+65 6123 4567");
  });
});

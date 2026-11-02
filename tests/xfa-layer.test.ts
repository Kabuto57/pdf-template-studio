// The XFA layer that Acrobat uses (it runs XFA scripts even with Acrobat JavaScript switched off).
import { describe, expect, it } from "vitest";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFString, decodePDFRawStream } from "pdf-lib";
import { buildPdf, extractPdf } from "../src/pdf";
import { LC } from "../src/lc";
import { buildLcPdf } from "../src/lc-pdf";

const packets = async (pdf: Uint8Array) => {
  const doc = await PDFDocument.load(pdf); // not getForm(): pdf-lib deletes XFA there
  const xfa = (doc.catalog.lookup(PDFName.of("AcroForm")) as PDFDict).lookup(PDFName.of("XFA")) as PDFArray, out: Record<string, string> = {};
  for (let i = 0; i < xfa.size(); i += 2) out[(xfa.lookup(i) as PDFString).decodeText()] = new TextDecoder().decode(decodePDFRawStream(xfa.lookup(i + 1) as PDFRawStream).decode());
  return { doc, xfa, out };
};
const unxml = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** A minimal stand-in for Acrobat's XFA object model: fields with a value, a border and a nullTest. */
function mockForm(template: string) {
  const pages = template.split('<subform x="0pt" y="0pt"').slice(1), nodes = new Map<string, any>();
  const field = () => {
    const edges = [0, 1, 2, 3].map(() => ({ presence: "visible", color: { value: "0,0,0" }, thickness: "0.6pt" }));
    return { rawValue: null as string | null, className: "field", validate: { nullTest: "disabled" },
      border: { getElement: (_: string, i: number) => edges[i], fill: { presence: "visible", color: { value: "255,255,255" } } } };
  };
  pages.forEach((body, p) => {
    for (const m of body.matchAll(/<(field|exclGroup) name="([\w]+)"/g)) {
      if (m[2].match(/^o\d+$/)) continue;
      const n = field();
      if (m[1] === "exclGroup") {
        const kids = [...body.split(`<exclGroup name="${m[2]}"`)[1].split("</exclGroup>")[0].matchAll(/<field name="o\d+"/g)].map(field);
        Object.assign(n, { className: "exclGroup", nodes: { length: kids.length, item: (i: number) => kids[i] }, kids });
      }
      nodes.set(`form1.#subform[${p}].${m[2]}`, n);
    }
  });
  const script = unxml(/<script name="rules"[^>]*>([\s\S]*?)<\/script>/.exec(template)![1]);
  const xfa = { resolveNode: (p: string) => nodes.get(p) ?? null, host: { messageBox: () => {} } };
  const rules = new Function("xfa", `${script}; return { run: run, M: M };`)(xfa);
  const red = (n: any) => n.border.getElement("edge", 0).color.value === "204,0,0";
  const at = (id: string) => [...nodes].find(([k]) => k.endsWith(`.${id}`))![1];
  return { rules, at, red, nodes };
}

describe.each([["original look", () => buildLcPdf()], ["new design", () => buildPdf(LC.template)]])("XFA layer, %s", (_, make) => {
  it("is there, with every question, and Acrobat draws it (NeedsRendering)", async () => {
    const { doc, out } = await packets(await make());
    expect(doc.catalog.lookup(PDFName.of("NeedsRendering"))?.toString()).toBe("true");
    for (const f of LC.template.sections.flatMap(s => s.fields)) expect(out.template, f.id).toContain(`name="${f.kind === "checks" ? `${f.id}__0` : f.id}"`);
  });

  it("every rule points at a field that exists", async () => {
    const { rules, nodes } = mockForm((await packets(await make())).out.template);
    for (const [id, m] of Object.entries(rules.M as Record<string, { p: string | string[] }>))
      for (const p of [m.p].flat()) expect(nodes.has(p), `${id}: ${p}`).toBe(true);
  });

  it("ticking, picking and choosing make the right boxes mandatory and red", async () => {
    const { rules, at, red } = mockForm((await packets(await make())).out.template);
    rules.run();
    expect(at("applicant_name").validate.nullTest).toBe("error"); // always mandatory
    expect(red(at("applicant_name"))).toBe(true);
    expect(at("invoice_originals").validate.nullTest).toBe("disabled");
    expect(red(at("invoice_originals"))).toBe(false);

    at("doc_commercial_invoice").rawValue = "1"; rules.run(); // tick box
    expect(at("invoice_originals").validate.nullTest).toBe("error");
    expect(red(at("invoice_originals"))).toBe(true);
    at("invoice_originals").rawValue = "3"; rules.run(); // answered: still mandatory, no longer red
    expect(red(at("invoice_originals"))).toBe(false);
    at("doc_commercial_invoice").rawValue = "0"; at("invoice_originals").rawValue = null; rules.run();
    expect(at("invoice_originals").validate.nullTest).toBe("disabled");

    at("drafts_at").rawValue = "Term"; rules.run(); // radio
    expect(at("term_days").validate.nullTest).toBe("error");
    const insurance = "Insurance covered by applicant under open Cover No.";
    expect(rules.run("insurance_arrangement", insurance)).toContain("Open cover no"); // drop-down, before its value is set
    expect(red(at("insurance_cover_no"))).toBe(true);
  });

  it("reads answers Acrobat saved in the XFA layer", async () => {
    const { doc, xfa, out } = await packets(await make());
    const i = Array.from({ length: xfa.size() / 2 }, (_, k) => 2 * k).find(k => (xfa.lookup(k) as PDFString).decodeText() === "datasets")!;
    const saved = out.datasets.replace("<doc_commercial_invoice>0<", "<doc_commercial_invoice>1<")
      .replace("<form1>", "<form1><applicant_name>ACME &amp; CO</applicant_name><drafts_at>Term</drafts_at><goods_description>Line 1&#xD;Line 2</goods_description>");
    xfa.set(i + 1, doc.context.register(doc.context.flateStream(new TextEncoder().encode(saved))));
    const { data } = await extractPdf(await doc.save({ updateFieldAppearances: false }));
    expect([data.applicant_name, data.doc_commercial_invoice, data.drafts_at, data.goods_description]).toEqual(["ACME & CO", true, "Term", "Line 1\nLine 2"]);
  });
});

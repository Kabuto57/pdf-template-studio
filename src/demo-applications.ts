// SAMPLE FILLED APPLICATIONS
// The "Sample filled PDFs" in the Template Studio (written to public/samples/ by scripts/lc-pdfs.test.ts). Each one is a real LC application PDF, made by
// buildPdf from different answers, and each shows a different situation ops meets every day.
import { PDFDocument, StandardFonts } from "pdf-lib";
import { LC, LC_SAMPLE } from "./lc";
import { buildPdf, subId, type Template, type Values } from "./pdf";
import { payloadScript, qrScript } from "./form/acrobat-script";

interface Sample { from: string; subject: string; body: string; file: string; shows: string; answers: Values; printed?: boolean }

// The applicant's own details, as in the bank's customer records (customers.ts).
const LIM: Values = {
  applicant_name: "LIM BROTHERS TRADING PTE LTD", applicant_address_1: "8 Jurong Port Road", applicant_address_2: "#03-12",
  applicant_address_3: "Singapore 619093", contact_name: "LIM KOK HUA", contact_tel: "+65 6265 8800", contact_fax: "",
  issuance_charges_account: "072-334455-6", authorised_person: "LIM KOK HUA, Managing Director",
};
const OCEANIC: Values = {
  applicant_name: "OCEANIC FOODS PTE LTD", applicant_address_1: "21 Fishery Port Road", applicant_address_2: "Singapore 619742",
  applicant_address_3: "", contact_name: "NG MEI LING", contact_tel: "+65 6898 2211", contact_fax: "",
  issuance_charges_account: "072-889900-1", authorised_person: "NG MEI LING, Finance Director",
};
const SUNRISE: Values = {
  applicant_name: "SUNRISE ELECTRONICS PTE LTD", applicant_address_1: "3 Changi Business Park Vista", applicant_address_2: "#05-01",
  applicant_address_3: "Singapore 486051", contact_name: "CHEN JIA HUI", contact_tel: "+65 6545 3030", contact_fax: "",
  issuance_charges_account: "072-556677-8", authorised_person: "CHEN JIA HUI, Director",
};

export const SAMPLES: Sample[] = [
  {
    from: "tan.weiming@tanengineering.example", subject: "LC application: steel coils from Shanghai", file: "LC-TanEngineering.pdf",
    body: "Please find our LC application attached.", shows: "Complete and correct: ready to approve",
    answers: LC_SAMPLE,
  },
  {
    from: "kokhua@limbrothers.example", subject: "LC application (urgent)", file: "LC-LimBrothers.pdf",
    body: "Hi, attached our LC application. Thanks.", shows: "Mandatory answers missing, including one that only becomes mandatory when Term is picked",
    answers: { ...LC_SAMPLE, ...LIM, beneficiary_address_1: "", expiry_date: "", term_days: "", term_after: "" },
  },
  {
    from: "meiling@oceanicfoods.example", subject: "Application for LC: frozen seafood", file: "LC-OceanicFoods.pdf",
    body: "Dear Trade Ops, our application is attached.", shows: "Wrong formats and characters the bank's systems can't carry",
    answers: {
      ...LC_SAMPLE, ...OCEANIC, amount: "1,25,000.0.0", contact_tel: "6898 22II",
      beneficiary_name: "NORDIC SJØMAT AS * Fisheries", beneficiary_address_3: "Ålesund, Norway",
      goods_description: "20 MT frozen salmon fillets, IQF, 1-2 lb, CFR Singapore.",
    },
  },
  {
    from: "jiahui@sunrise-electronics.example", subject: "LC application: components", file: "LC-SunriseElectronics.pdf",
    body: "Attached. Please debit charges from our usual account.", shows: "Details that differ from the bank's customer record",
    answers: { ...LC_SAMPLE, ...SUNRISE, contact_tel: "+65 6545 9999", issuance_charges_account: "072-111222-3", authorised_person: "JOHN TAN, Purchasing Manager" },
  },
  {
    from: "ops@globalwidgets.example", subject: "New LC application", file: "LC-GlobalWidgets.pdf",
    body: "We would like to open an LC with your bank.", shows: "Not an existing customer: needs KYC",
    answers: {
      ...LC_SAMPLE, applicant_name: "GLOBAL WIDGETS LTD", applicant_address_1: "1 Example Street", applicant_address_2: "Singapore 000001",
      applicant_address_3: "", contact_name: "ALEX WONG", issuance_charges_account: "", authorised_person: "ALEX WONG, Director",
    },
  },
  {
    from: "tan.weiming@tanengineering.example", subject: "LC application #2: machinery", file: "LC-TanEngineering-2.pdf",
    body: "Second application, for the machinery order.", shows: "Answers that contradict each other (dates out of order, CIF with insurance, a document row not ticked)",
    answers: {
      ...LC_SAMPLE, price_basis: "CIF", latest_shipment_date: "15/01/2027", expiry_date: "31/12/2026",
      awb_freight: "Prepaid", awb_notify_party: "TAN ENGINEERING PTE LTD",
      goods_description: "2 units CNC milling machines, model VM-850, as per quotation Q-2026-77. CIF Singapore.",
    },
  },
  {
    from: "kokhua@limbrothers.example", subject: "RE: LC application (printed copy)", file: "LC-LimBrothers-printed.pdf",
    body: "Sorry, resending. I printed it to PDF.", shows: "A printed / 'Saved as PDF' copy: the fields are gone, so the workbench reads the answers from its QR code and matches them to the printed text",
    answers: { ...LC_SAMPLE, ...LIM }, printed: true,
  },
  {
    from: "meiling@oceanicfoods.example", subject: "LC application: local delivery", file: "LC-OceanicFoods-2.pdf",
    body: "Our application for the local supplier.", shows: "Complete and correct (a second customer)",
    answers: {
      ...LC_SAMPLE, ...OCEANIC, currency: "SGD", amount: "86,500.00", gst: "No GST", price_basis: "Local Delivery",
      beneficiary_name: "SEA HARVEST SUPPLIES PTE LTD", beneficiary_address_1: "5 Senoko Way", beneficiary_address_2: "Singapore 758047",
      beneficiary_address_3: "", beneficiary_contact: "PETER LOW", beneficiary_tel: "+65 6757 1010",
      shipment_from_place: "Singapore", shipment_to_place: "Singapore", doc_bill_of_lading: false, bl_made_out_to: "", bl_freight: "", bl_notify_party: "",
      doc_delivery_order: true, do_originals: "1", do_copies: "1", do_countersigned_by: "One", do_signature_verified: "need",
      doc_insurance: false, insurance_arrangement: "", insurance_cover_no: "", insurance_cover_with: "", doc_certificate_of_origin: false,
      origin_originals: "", origin_copies: "", origin_country: "", post_shipment_financing: false, financing_type: "", financing_currency: "",
      goods_description: "Chilled seafood, assorted, as per purchase order PO-OF-2291. Local delivery to our Jurong warehouse.",
    },
  },
];

/** One sample's filled PDF. */
export async function samplePdf(s: Sample) {
  if (!s.printed) return buildPdf(LC.template, s.answers);
  // The JavaScript version, after "Generate QR Code", then printed: the page looks the same, but the fields and
  // scripts are gone; the QR code stays as a picture on the last page.
  const t = { issuer: "Demo Bank · Trade Services", ...LC.template };
  const doc = await PDFDocument.load(await buildPdf(t, s.answers, "javascript"));
  const text = qrPayload(t, s.answers);
  const m = new Function(`${qrScript}; return lcQrMatrix;`)()(text) as boolean[][];
  const form = doc.getForm(), last = doc.getPages()[doc.getPageCount() - 1], zapf = await doc.embedFont(StandardFonts.ZapfDingbats);
  m.forEach((row, y) => { // as Acrobat draws lcDrawQr's rows: in the comb field "__qr_<y>", a ZapfDingbats square ("n") per dark cell
    const r = form.getTextField(`__qr_${y}`).acroField.getWidgets()[0].getRectangle(), size = r.width / row.length;
    row.forEach((dark, x) => dark && last.drawText("\u25a0", { x: r.x + x * size - 0.12, y: r.y, size: 3.515, font: zapf }));
  });
  form.flatten();
  return doc.save();
}

/** The QR code's text exactly as the form's own lcPayload makes it in Acrobat (run here on stand-in fields). */
export function qrPayload(t: Template, v: Values) {
  const fields: { name: string; type: string; value: string }[] = [];
  for (const f of t.sections.flatMap(s => s.fields)) {
    const a = v[f.id];
    if (f.kind === "checks") (f.options ?? []).forEach((o, i) => fields.push({ name: subId(f.id, i), type: "checkbox", value: Array.isArray(a) && a.includes(o) ? "Yes" : "Off" }));
    else if (f.kind === "check") fields.push({ name: f.id, type: "checkbox", value: a === true ? "Yes" : "Off" });
    else fields.push({ name: f.id, type: f.kind === "radio" ? "radiobutton" : "text", value: typeof a === "string" ? a || (f.kind === "radio" ? "Off" : "") : "" });
  }
  const d = { numFields: fields.length, getNthFieldName: (i: number) => fields[i].name, getField: (n: string) => { const f = fields.find(x => x.name === n)!; return { ...f, valueAsString: f.value }; } };
  return new Function("d", `${payloadScript(t)}; return lcPayload(d);`)(d) as string;
}


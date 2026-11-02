// The LC application drawn in the bank form's own layout (copied by scripts/xfa-layout.py into lc-layout.json),
// with our fields, rules and checks inside, so customers see the form they know.
import { PDFDocument, PDFFont, PDFHexString, PDFName, PDFPage, PDFRadioGroup, StandardFonts, rgb } from "pdf-lib";
import layout from "./lc-layout.json";
import { LC } from "./lc";
import { addChecks, isRequired, safe, stamp, subId, type Field, type Values } from "./pdf";

type Item = { k: string; x: number; y: number; w?: number; h?: number; x2?: number; y2?: number; size?: number; bold?: boolean;
  align?: string; text?: string; edges?: boolean[]; key?: string; option?: string | null; round?: boolean; multi?: boolean };

const W = 595.28, H = 841.89, MM = 72 / 25.4;
const INK = rgb(0, 0, 0), RED = rgb(0.8, 0, 0), FILL = rgb(0.93, 0.95, 1), GREY = rgb(0.35, 0.35, 0.35);

// Bank form field (XFA path) -> our question. Repeated paths (two "txtApplyForward") list their questions in order.
const P = "form1.LC.subfrmLC.", F = "form1.LC.subfrmLCFoot.", ONE = F + "subfrmDetails.subfrmOne.";
const FIELDS: Record<string, string | string[]> = {
  "header.txtLCDate": "application_date",
  [P + "subfrmModeOfAdvising.RadioButtonList"]: "mode_of_advising",
  [P + "subfrmApplicant.txtName"]: "applicant_name", [P + "subfrmApplicant.txtAddress1"]: "applicant_address_1",
  [P + "subfrmApplicant.txtAddress2"]: "applicant_address_2", [P + "subfrmApplicant.txtAddress3"]: "applicant_address_3",
  [P + "subfrmApplicant.txtContractName"]: "contact_name", [P + "subfrmApplicant.txtTel"]: "contact_tel", [P + "subfrmApplicant.txtFax"]: "contact_fax",
  [P + "subfrmForBankUse.subfrmForBankUse.subfrmDCNo.txtDCNo"]: "dc_no", [P + "subfrmForBankUse.subfrmForBankUse.subfrmBankCode.txtBankCode"]: "bank_code",
  [P + "subfrmForBankUse.subfrmAdvisingBank.txtName"]: "advising_bank_name", [P + "subfrmForBankUse.subfrmAdvisingBank.txtAddress1"]: "advising_bank_address_1",
  [P + "subfrmForBankUse.subfrmAdvisingBank.txtAddress2"]: "advising_bank_address_2", [P + "subfrmForBankUse.subfrmAdvisingBank.txtAddress3"]: "advising_bank_address_3",
  [P + "subfrm3PartyBeneficiary.txtName"]: "third_party_name", [P + "subfrm3PartyBeneficiary.txtAddress1"]: "third_party_address_1",
  [P + "subfrm3PartyBeneficiary.txtAddress2"]: "third_party_address_2", [P + "subfrm3PartyBeneficiary.txtAddress3"]: "third_party_address_3",
  [P + "subfrmBeneficiary.txtName"]: "beneficiary_name", [P + "subfrmBeneficiary.txtAddress1"]: "beneficiary_address_1",
  [P + "subfrmBeneficiary.txtAddress2"]: "beneficiary_address_2", [P + "subfrmBeneficiary.txtAddress3"]: "beneficiary_address_3",
  [P + "subfrmBeneficiary.txtContractName"]: "beneficiary_contact", [P + "subfrmBeneficiary.txtTel"]: "beneficiary_tel", [P + "subfrmBeneficiary.txtFax"]: "beneficiary_fax",
  [P + "subfrmCreditAmount.drpCurrency"]: "currency", [P + "subfrmCreditAmount.txtAmount"]: "amount", [P + "subfrmCreditAmount.radGST"]: "gst",
  [P + "subfrmCreditAmount.chkTolerance"]: "tolerance", [P + "subfrmCreditAmount.txtPlusValue"]: "tolerance_plus", [P + "subfrmCreditAmount.txtMinusValue"]: "tolerance_minus",
  [P + "subfrmPriceBasis.RadioButtonList"]: "price_basis", [P + "subfrmPriceBasis.txtOthers"]: "price_basis_other",
  [P + "subfrmPartialshipment.radPartialShipment"]: "partial_shipment", [P + "subfrmPartialshipment.radTranshipment"]: "transhipment",
  [P + "subfrmShipmentFrom.drpPortOfLoading"]: "shipment_from",
  [P + "subfrmShipmentFrom.subfrmLoadDeparture.subfrmPortOfLoad.txtLoading1"]: "shipment_from_place",
  [P + "subfrmShipmentFrom.subfrmLoadDeparture.subfrmPortOfLoad.txtLoading2"]: "shipment_from_place_2",
  [P + "subfrmShipmentTo.drpPortOfDischarge"]: "shipment_to",
  [P + "subfrmShipmentTo.subfrmDischargeDestination.subfrmDischarge.txtDischarge1"]: "shipment_to_place",
  [P + "subfrmShipmentTo.subfrmDischargeDestination.subfrmDischarge.txtDischarge2"]: "shipment_to_place_2",
  [P + "subfrmShipmentDate.txtDate"]: "latest_shipment_date", [P + "subfrmDateOfExpiry.txtDate"]: "expiry_date", [P + "subfrmPresentation.txtPeriod"]: "presentation_days",
  [P + "subfrmDrafts.subfrmBtoB.txtCrNo"]: "master_dc_no", [P + "subfrmDrafts.subfrmBtoB.txtIssuBy"]: "master_dc_issued_by", [P + "subfrmDrafts.subfrmBtoB.chkBTB"]: "back_to_back",
  [P + "subfrmDrafts.sufrmDraft.chkDraft"]: "drafts", [P + "subfrmDrafts.sufrmDraft.radDrafts"]: "drafts_at",
  [P + "subfrmDrafts.sufrmDraft.txtTerm"]: "term_days", [P + "subfrmDrafts.sufrmDraft.txtDaysAfter"]: "term_after",
  [P + "subfrmDrafts.sufrmDraft.txtDate"]: "draft_date", [P + "subfrmDrafts.sufrmDraft.radTerm"]: "term_prepay",
  [P + "subfrmDrafts.chkFullSet"]: "doc_bill_of_lading", [P + "subfrmDrafts.radConsignee"]: "bl_made_out_to", [P + "subfrmDrafts.txtFullSet"]: "bl_made_out_to_other",
  [P + "subfrmDrafts.radFreight"]: "bl_freight", [P + "subfrmDrafts.txtNotifyParty"]: "bl_notify_party",
  [P + "subfrmOriginalAirWaybill.chkOriginalAirWaybill"]: "doc_air_waybill", [P + "subfrmOriginalAirWaybill.radioButtonList"]: "awb_freight",
  [P + "subfrmOriginalAirWaybill.txtNotifyParty"]: "awb_notify_party",
  [P + "subfrmTransportDocumentsByDO.chkDeliveryOrderIn"]: "doc_delivery_order", [P + "subfrmTransportDocumentsByDO.txtOriginals"]: "do_originals",
  [P + "subfrmTransportDocumentsByDO.txtCopies"]: "do_copies", [P + "subfrmTransportDocumentsByDO.drpCountersignedBy"]: "do_countersigned_by",
  [P + "subfrmTransportDocumentsByDO.drpWhoseSignature"]: "do_signature_verified",
  [P + "subfrmInsurance.chkInsurance"]: "doc_insurance", [P + "subfrmInsurance.drpForFOBCFR"]: "insurance_arrangement",
  [P + "subfrmInsurance.subfrmCoverNo.txtCoverNo"]: "insurance_cover_no", [P + "subfrmInsurance.subfrmCoverNo.txtWith"]: "insurance_cover_with",
  [P + "subfrmBeneficiaryCertificate.chkBeneficiaryCertificate"]: "doc_beneficiary_certificate",
  [P + "subfrmBeneficiaryCertificate.chkFaxed"]: "bencert_sent_by#0", [P + "subfrmBeneficiaryCertificate.chkMailed"]: "bencert_sent_by#1",
  [P + "subfrmBeneficiaryCertificate.chkCouriered"]: "bencert_sent_by#2", [P + "subfrmBeneficiaryCertificate.txtDaysAfterShipment"]: "bencert_days",
  [F + "subfrmInvoice.chkSignedCommercialInvoice"]: "doc_commercial_invoice", [F + "subfrmInvoice.txtSignedOriginals"]: "invoice_originals", [F + "subfrmInvoice.txtSignedCopies"]: "invoice_copies",
  [F + "subfrmInvoice.chkPackingList"]: "doc_packing_list", [F + "subfrmInvoice.txtPackingListOriginals"]: "packing_list_originals", [F + "subfrmInvoice.txtPackingListCopies"]: "packing_list_copies",
  [F + "subfrmInvoice.chkWeightNote"]: "doc_weight_note", [F + "subfrmInvoice.txtWeightNoteOriginals"]: "weight_note_originals", [F + "subfrmInvoice.txtWeightNoteCopies"]: "weight_note_copies",
  [F + "subfrmInvoice.chkCertificateOfOrigin"]: "doc_certificate_of_origin", [F + "subfrmInvoice.txtCertificateOfOriginInOriginals"]: "origin_originals",
  [F + "subfrmInvoice.txtCertificateOfOriginCopies"]: "origin_copies", [F + "subfrmInvoice.txtCertificateOfOriginCountry"]: "origin_country",
  [F + "subfrmOtherDoc.chkBeneficiaryCertificate"]: "doc_other", [F + "subfrmOtherDoc.txtOtherDoc"]: "other_documents_1", [F + "subfrmOtherDoc.txtOtherDoc1"]: "other_documents_2",
  [F + "subfrmGoodsDescription.txtGoodsDescription"]: "goods_description", [F + "subfrmAdditionalCond.txtAdditionalCond"]: "additional_conditions",
  [ONE + "subfrmBankCharges.chkBankCharges"]: "bank_charges", [ONE + "subfrmBankCharges.radChargeAccount"]: "bank_charges_for",
  [ONE + "subfrmConfirmation.chkConfirmation"]: "confirmation", [ONE + "subfrmConfirmation.radioButtonList"]: "confirmation_charges",
  [ONE + "subfrmSettlementInstructions.chkTrustReceipts"]: "post_shipment_financing", [ONE + "subfrmSettlementInstructions.radTrustReceipts"]: "financing_type",
  [ONE + "subfrmSettlementInstructions.txtForgeign"]: "financing_currency",
  [ONE + "subfrmSettlementInstructions.txtApplyForward"]: ["forward_contract_no", "advance_payment_account"],
  [ONE + "subfrmSettlementInstructions.chkBTB"]: "advance_payment",
  [ONE + "subfrmIssuanceCharges.chkDebit"]: "debit_issuance_charges", [ONE + "subfrmIssuanceCharges.txtWithyou"]: "issuance_charges_account",
  [F + "subfrmDetails.subfrmTwo.subfrmSignature.txtSignature"]: "authorised_person",
};
// The bank form's option values -> ours, in the order the bank form lists them.
const OPTIONS: Record<string, string[]> = {
  gst: ["GSY", "GSN"], partial_shipment: ["Y", "N"], transhipment: ["Y", "N"], bl_made_out_to: ["1", "2", "3"],
  bank_charges_for: ["LAB", "LAA"], confirmation_charges: ["LID", "LIC"], financing_type: ["1", "2", "3"], term_prepay: ["Prepay", "NonPrepay"],
};

const fields = new Map(LC.template.sections.flatMap(s => s.fields).map(f => [f.id, f]));
const blank = (v: Values[string] | undefined) => v === undefined || v === "" || v === false || (Array.isArray(v) && !v.length);

/** The LC application as a fillable PDF in the bank's layout, with the same checks as the app. */
export async function buildLcPdf(values: Values = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const form = doc.getForm(), js = (code: string) => doc.context.obj({ S: "JavaScript", JS: PDFHexString.fromText(code) });
  doc.setTitle(LC.template.title); doc.setCreator("PDF Template Studio");
  stamp(doc, LC.template); // so Extract gets every answer with its question
  const groups = new Map<string, PDFRadioGroup>(), seen = new Map<string, number>();
  const pages = (layout.pages as Item[][]).map(() => doc.addPage([W, H]));
  const X = (mm: number) => mm * MM, Y = (mm: number) => H - mm * MM;

  const question = (key: string): [Field, number?] | undefined => {
    let id = FIELDS[key];
    if (Array.isArray(id)) { const n = seen.get(key) ?? 0; seen.set(key, n + 1); id = id[n]; }
    if (!id) return undefined;
    const [qid, i] = id.split("#"), f = fields.get(qid);
    return f && [f, i === undefined ? undefined : Number(i)];
  };
  const look = (f: Field) => ({ borderColor: isRequired(f, values) && blank(values[f.id]) ? RED : INK, borderWidth: isRequired(f, values) && blank(values[f.id]) ? 1.2 : 0.6, backgroundColor: FILL });

  const draw = (page: PDFPage, it: Item) => {
    const f: PDFFont = it.bold ? bold : font, size = Math.min(it.size ?? 8, 11);
    if (it.k === "text") {
      const width = (it.w ?? 0) * MM;
      // Short labels in narrow boxes grow sideways in the bank's form rather than wrapping.
      const lines = safe(it.text ?? "").split("\n").flatMap(p => wrap(p, f, size, width > 30 * MM ? width : Infinity));
      for (const [i, line] of lines.entries()) {
        const tw = f.widthOfTextAtSize(line, size), dx = it.align === "center" ? (width - tw) / 2 : it.align === "right" ? width - tw : 0;
        page.drawText(line, { x: X(it.x) + Math.max(0, dx), y: Y(it.y) - size - i * size * 1.2, size, font: f, color: INK });
      }
    } else if (it.k === "line") page.drawLine({ start: { x: X(it.x), y: Y(it.y) }, end: { x: X(it.x2!), y: Y(it.y2!) }, thickness: 0.5, color: INK });
    else if (it.k === "box") {
      const [t, r, b, l] = it.edges ?? [true, true, true, true], x0 = X(it.x), x1 = X(it.x + it.w!), y0 = Y(it.y), y1 = Y(it.y + it.h!);
      const ln = (a: [number, number], z: [number, number]) => page.drawLine({ start: { x: a[0], y: a[1] }, end: { x: z[0], y: z[1] }, thickness: 0.5, color: INK });
      if (t) ln([x0, y0], [x1, y0]); if (r) ln([x1, y0], [x1, y1]); if (b) ln([x0, y1], [x1, y1]); if (l) ln([x0, y0], [x0, y1]);
    } else if (it.k === "oval") page.drawEllipse({ x: X(it.x + it.w! / 2), y: Y(it.y + it.h! / 2), xScale: it.w! * MM / 2, yScale: it.h! * MM / 2, borderColor: INK, borderWidth: 0.5 });
    else if (it.k === "check" || it.k === "field") widget(page, it);
  };

  const widget = (page: PDFPage, it: Item) => {
    const q = question(it.key!);
    if (!q) return;
    const [f, sub] = q, v = values[f.id], rect = { x: X(it.x), y: Y(it.y + it.h!), width: it.w! * MM, height: it.h! * MM, ...look(f) };
    const tip = (o: { acroField: { dict: { set(k: PDFName, v: PDFHexString): void } } }) => o.acroField.dict.set(PDFName.of("TU"), PDFHexString.fromText(safe(f.label)));
    if (f.kind === "radio") {
      const opts = f.options ?? [], i = OPTIONS[f.id] ? OPTIONS[f.id].indexOf(it.option ?? "") : opts.indexOf(it.option ?? "");
      if (i < 0) return;
      let g = groups.get(f.id);
      if (!g) { g = form.createRadioGroup(f.id); tip(g); groups.set(f.id, g); }
      g.addOptionToPage(safe(opts[i]), page, rect);
      if (v === opts[i]) g.select(safe(opts[i]));
    } else if (f.kind === "check" || f.kind === "checks") {
      const cb = form.createCheckBox(f.kind === "checks" ? subId(f.id, sub ?? 0) : f.id);
      cb.addToPage(page, rect); tip(cb);
      if (f.kind === "check" ? v === true : Array.isArray(v) && v.includes(f.options![sub ?? 0])) cb.check();
    } else if (f.kind === "select") {
      const dd = form.createDropdown(f.id);
      dd.addOptions((f.options ?? []).map(safe)); tip(dd);
      if (typeof v === "string" && f.options?.includes(v)) dd.select(safe(v));
      dd.addToPage(page, { ...rect, font }); dd.setFontSize(9);
    } else {
      const tf = form.createTextField(f.id);
      if (f.kind === "long" || it.multi) tf.enableMultiline();
      if (f.max) tf.setMaxLength(f.max);
      if (typeof v === "string" && v) tf.setText(safe(v).slice(0, f.max));
      tf.addToPage(page, { ...rect, font }); tf.setFontSize(9); tip(tf);
      if (f.kind === "date") tf.acroField.dict.set(PDFName.of("AA"), doc.context.obj({ F: js('AFDate_FormatEx("dd/mm/yyyy");'), K: js('AFDate_KeystrokeEx("dd/mm/yyyy");') }));
      else if (f.format) tf.acroField.dict.set(PDFName.of("AA"), doc.context.obj({ K: js(`if (!event.willCommit && /${f.format === "number" ? "[^0-9]" : "[^0-9.,]"}/.test(event.change)) { event.rc = false; app.beep(0); }`) }));
    }
  };

  for (const it of layout.header as Item[]) draw(pages[0], it);
  pages[0].drawText("THE BANK, TRADE SERVICES", { x: X(12), y: Y(17.5) - 8, size: 8, font: bold, color: INK });
  (layout.pages as Item[][]).forEach((items, p) => items.forEach(it => draw(pages[p], it)));
  pages.forEach((page, i) => {
    const n = `Page ${i + 1} of ${pages.length}`;
    page.drawText(n, { x: (W - font.widthOfTextAtSize(n, 7)) / 2, y: 22, size: 7, font, color: GREY });
  });
  addChecks(doc, form, pages[0], font, LC.template, js);
  form.updateFieldAppearances(font);
  return doc.save();
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const t = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(t, size) > width) { out.push(line); line = word; } else line = t;
  }
  return [...out, line];
}

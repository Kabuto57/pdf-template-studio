// The Irrevocable Documentary Credit (LC) application, rebuilt by hand from the bank's smart form so it has
// the same sections, the same fields (and only those), the same wording and the same mandatory rules.
// Source: the LC subform of Trade-Smartform.pdf (its subforms, captions and mandatoryChange scripts).
// One deliberate difference: ticking a "Documents Required" row (and the other tick-to-fill rows) makes
// that row's own boxes mandatory. The smart form only unlocks them (mandatoryChange(..., 0)).
import type { Field, Rule, Section, Template, Values } from "./pdf";
import { CURRENCIES } from "./lists";

const when = (field: string, ...values: string[]): Rule[] => [{ field, values }];
const ticked = (field: string) => when(field, "true");
const text = (id: string, label: string, more: Partial<Field> = {}): Field => ({ id, label, kind: "text", half: true, ...more });
const tick = (id: string, label: string, more: Partial<Field> = {}): Field => ({ id, label, kind: "check", ...more });
const pick = (id: string, label: string, options: string[], more: Partial<Field> = {}): Field => ({ id, label, kind: "radio", options, ...more });
const req = { required: true };

const sections: Section[] = [
  { title: "Application", fields: [
    { id: "application_date", label: "Date", kind: "date", half: true, ...req },
  ] },
  { title: "Mode of Advising", fields: [
    pick("mode_of_advising", "Mode of advising", ["Full Swift", "Registered Airmail", "Airmail with Brief Swift", "Courier Service", "Courier Service with Brief Swift"], req),
  ] },
  { title: "Applicant", fields: [
    text("applicant_name", "Applicant name", { ...req, half: false, max: 35 }),
    text("applicant_address_1", "Applicant address", { ...req, half: false, max: 35 }),
    text("applicant_address_2", "Applicant address (line 2)", { half: false, max: 35 }),
    text("applicant_address_3", "Applicant address (line 3)", { half: false, max: 35 }),
    text("contact_name", "Contact party for this application & confirmation of FX rate: Name", { ...req, half: false, max: 35 }),
    text("contact_tel", "Contact party: Tel no", { ...req, max: 15, format: "phone" }),
    text("contact_fax", "Contact party: Fax no", { max: 15, format: "phone" }),
  ] },
  { title: "For Bank Use", fields: [
    text("dc_no", "DC no"),
    text("bank_code", "Bank code"),
  ] },
  { title: "Advising Bank (at Issuing Bank's option, if no nomination)", fields: [
    text("advising_bank_name", "Name", { half: false, max: 35 }),
    text("advising_bank_address_1", "Address", { half: false, max: 35 }),
    text("advising_bank_address_2", "Address (line 2)", { half: false, max: 35 }),
    text("advising_bank_address_3", "Address (line 3)", { half: false, max: 35 }),
  ] },
  { title: "For the Benefit of a 3rd Party", fields: [
    text("third_party_name", "Name", { half: false, max: 35 }),
    text("third_party_address_1", "Address", { half: false, max: 35 }),
    text("third_party_address_2", "Address (line 2)", { half: false, max: 35 }),
    text("third_party_address_3", "Address (line 3)", { half: false, max: 35 }),
  ] },
  { title: "Beneficiary", fields: [
    text("beneficiary_name", "Beneficiary's name", { ...req, half: false, max: 35 }),
    text("beneficiary_address_1", "Beneficiary's address", { ...req, half: false, max: 35 }),
    text("beneficiary_address_2", "Beneficiary's address (line 2)", { half: false, max: 35 }),
    text("beneficiary_address_3", "Beneficiary's address (line 3)", { half: false, max: 35 }),
    text("beneficiary_contact", "Contact person", { half: false, max: 35 }),
    text("beneficiary_tel", "Tel no", { max: 15, format: "phone" }),
    text("beneficiary_fax", "Fax no", { max: 15, format: "phone" }),
  ] },
  { title: "Credit Amount (Currency & Figures)", fields: [
    { id: "currency", label: "Currency", kind: "select", options: CURRENCIES, half: true, ...req },
    text("amount", "Amount", { ...req, format: "amount" }),
    pick("gst", "For local DCs, amount is (if not checked, it will be inclusive of GST)", ["inclusive of GST", "No GST"]),
    tick("tolerance", "Tolerance on credit amount & goods quantity"),
    text("tolerance_plus", "Tolerance + (%)", { requiredIf: ticked("tolerance"), max: 2, format: "number" }),
    text("tolerance_minus", "Tolerance - (%)", { requiredIf: ticked("tolerance"), max: 2, format: "number" }),
  ] },
  { title: "Price Basis", fields: [
    pick("price_basis", "Price basis", ["FOB", "CFR", "CIF", "Local Delivery", "FCA", "CIP", "CPT", "Others"], req),
    text("price_basis_other", "Others (please specify)", { half: false, max: 35, requiredIf: when("price_basis", "Others") }),
  ] },
  { title: "Shipment", fields: [
    pick("partial_shipment", "Partial shipment", ["allowed", "not allowed"], { ...req, half: true }),
    pick("transhipment", "Transhipment", ["allowed", "not allowed"], { ...req, half: true }),
    { id: "shipment_from", label: "Shipment from", kind: "select", half: true, options: ["Port of Loading / Airport of Departure", "Dispatch from", "Place of Taking in charge", "Place of Receipt"] },
    text("shipment_from_place", "Shipment from: place", { max: 35, requiredIf: [{ field: "shipment_from", values: [""], not: true }] }),
    text("shipment_from_place_2", "Shipment from: place (line 2)"),
    { id: "shipment_to", label: "Shipment to", kind: "select", half: true, options: ["Port of Discharge / Airport of Destination", "For Transportation to", "Place of Final Destination", "Place of Delivery"] },
    text("shipment_to_place", "Shipment to: place", { max: 35, requiredIf: [{ field: "shipment_to", values: [""], not: true }] }),
    text("shipment_to_place_2", "Shipment to: place (line 2)"),
    { id: "latest_shipment_date", label: "Latest shipment date", kind: "date", half: true },
  ] },
  { title: "Expiry and Presentation", fields: [
    { id: "expiry_date", label: "Date of expiry (in beneficiary's country)", kind: "date", half: true, ...req },
    text("presentation_days", "Presentation period (days after shipment)", { format: "number" }),
  ] },
  { title: "Back-to-back DC", fields: [
    tick("back_to_back", "This is a back-to-back DC to be issued against the master credit (the \"Master DC\")"),
    text("master_dc_no", "Master credit no", { requiredIf: ticked("back_to_back"), max: 20 }),
    text("master_dc_issued_by", "Issued by", { requiredIf: ticked("back_to_back"), max: 35 }),
  ] },
  { title: "Drafts", fields: [
    tick("drafts", "Drafts for 100% invoice value at"),
    pick("drafts_at", "Drafts at", ["Sight", "Term", "Date"], { requiredIf: ticked("drafts") }),
    text("term_days", "Term: days", { requiredIf: when("drafts_at", "Term"), format: "number" }),
    text("term_after", "days after", { requiredIf: when("drafts_at", "Term"), max: 35 }),
    { id: "draft_date", label: "Date", kind: "date", half: true, requiredIf: when("drafts_at", "Date") },
    pick("term_prepay", "If it is a term LC, please select one", ["You may prepay the acceptance of this term LC at the cost of beneficiary", "You may not prepay the acceptance of this term LC"],
      { requiredIf: when("drafts_at", "Term") }),
  ] },
  { title: "Documents Required", fields: [
    tick("doc_bill_of_lading", "Full set of Clean on Board marine bills of lading"),
    pick("bl_made_out_to", "Made out to", ["order of the Bank", "order blank endorsed", "other (specify)"], { requiredIf: ticked("doc_bill_of_lading") }),
    text("bl_made_out_to_other", "Made out to (other)", { requiredIf: when("bl_made_out_to", "other (specify)"), max: 70 }),
    pick("bl_freight", "Marked Freight", ["Prepaid", "Collect"], { half: true, requiredIf: ticked("doc_bill_of_lading") }),
    text("bl_notify_party", "Notify party (if not specified, notify party is considered to be applicant)", { half: false, max: 114, requiredIf: ticked("doc_bill_of_lading") }),

    tick("doc_air_waybill", "Original Air Waybill consigned to the Bank"),
    pick("awb_freight", "Marked Freight", ["Prepaid", "Collect"], { half: true, requiredIf: ticked("doc_air_waybill") }),
    text("awb_notify_party", "Notify party (if not specified, notify party is considered to be applicant)", { half: false, max: 114, requiredIf: ticked("doc_air_waybill") }),

    tick("doc_delivery_order", "Delivery order signed by beneficiary made out to applicant"),
    text("do_originals", "Delivery order: originals", { requiredIf: ticked("doc_delivery_order"), max: 2, format: "number" }),
    text("do_copies", "Delivery order: copies", { requiredIf: ticked("doc_delivery_order"), max: 2, format: "number" }),
    { id: "do_countersigned_by", label: "Countersigned by how many of our signatories", kind: "select", half: true, options: ["One", "Two"], requiredIf: ticked("doc_delivery_order") },
    { id: "do_signature_verified", label: "Whose signature(s) ... to be verified by the Bank", kind: "select", half: true, options: ["need", "need not"], requiredIf: ticked("doc_delivery_order") },

    tick("doc_insurance", "Marine/Air Insurance Policy or Certificate in duplicate, in Singapore in the currency of the credit, covering Institute Cargo Clauses (A), Institute War Clauses, Institute Strikes Clauses / Strikes, Riots and Civil Commotion"),
    { id: "insurance_arrangement", label: "For FOB/CFR/FCA/CPT", kind: "select", half: false,
      options: ["Insurance cover note attached", "Covered by ultimate buyer", "Please arrange insurance on our behalf", "Insurance covered by applicant under open Cover No."] },
    text("insurance_cover_no", "Open cover no", { max: 20, requiredIf: when("insurance_arrangement", "Insurance covered by applicant under open Cover No.") }),
    text("insurance_cover_with", "With", { max: 35, requiredIf: when("insurance_arrangement", "Insurance covered by applicant under open Cover No.") }),

    tick("doc_beneficiary_certificate", "Beneficiary's certificate stating 1 set of non-negotiable documents has been sent to applicant"),
    { id: "bencert_sent_by", label: "Sent by", kind: "checks", options: ["faxed", "mailed", "couriered"], requiredIf: ticked("doc_beneficiary_certificate") },
    text("bencert_days", "Within (days after shipment)", { requiredIf: ticked("doc_beneficiary_certificate"), format: "number" }),

    tick("doc_commercial_invoice", "Signed commercial invoice"),
    text("invoice_originals", "Commercial invoice: originals", { requiredIf: ticked("doc_commercial_invoice"), max: 2, format: "number" }),
    text("invoice_copies", "Commercial invoice: copies", { requiredIf: ticked("doc_commercial_invoice"), max: 2, format: "number" }),

    tick("doc_packing_list", "Packing list"),
    text("packing_list_originals", "Packing list: originals", { requiredIf: ticked("doc_packing_list"), max: 2, format: "number" }),
    text("packing_list_copies", "Packing list: copies", { requiredIf: ticked("doc_packing_list"), max: 2, format: "number" }),

    tick("doc_weight_note", "Weight note"),
    text("weight_note_originals", "Weight note: originals", { requiredIf: ticked("doc_weight_note"), max: 2, format: "number" }),
    text("weight_note_copies", "Weight note: copies", { requiredIf: ticked("doc_weight_note"), max: 2, format: "number" }),

    tick("doc_certificate_of_origin", "Certificate of origin"),
    text("origin_originals", "Certificate of origin: originals", { requiredIf: ticked("doc_certificate_of_origin"), max: 2, format: "number" }),
    text("origin_copies", "Certificate of origin: copies", { requiredIf: ticked("doc_certificate_of_origin"), max: 2, format: "number" }),
    text("origin_country", "Showing country of origin as", { requiredIf: ticked("doc_certificate_of_origin"), max: 35 }),

    tick("doc_other", "Other documents"),
    text("other_documents_1", "Other documents", { half: false, max: 70, requiredIf: ticked("doc_other") }),
    text("other_documents_2", "Other documents (line 2)", { half: false, max: 70 }),
  ] },
  { title: "Goods Description", fields: [
    { id: "goods_description", label: "Goods description (if space is insufficient, attach additional information with Company's stamp, signed by authorised signors)", kind: "long", max: 6500, ...req },
  ] },
  { title: "Additional Conditions", fields: [
    { id: "additional_conditions", label: "Additional conditions (if space is insufficient, attach additional information with Company's stamp, signed by authorised signors)", kind: "long", max: 6500 },
  ] },
  { title: "Charges, Confirmation and Settlement", fields: [
    tick("bank_charges", "All bank charges are for account of", req),
    pick("bank_charges_for", "Charges for account of", ["Beneficiary, except charges at DC Issuing Bank's counter", "Applicant (including all charges incurred inside and outside of DC Issuing Bank's country)"],
      { requiredIf: ticked("bank_charges") }),
    tick("confirmation", "Confirmation required"),
    pick("confirmation_charges", "Confirmation charges", ["Applicant", "Beneficiary"], { requiredIf: ticked("confirmation") }),
    tick("post_shipment_financing", "Please provide us with post-shipment financing under Documentary Credit (\"TR/BRP\") financing for 100% value of all documentary presentations made in compliance with this DC, but where there are discrepancies, we hereby agree to waive all such discrepancies"),
    pick("financing_type", "Financing", ["SGD financing", "Foreign Currency Financing", "Apply Forward Contract"], { requiredIf: ticked("post_shipment_financing") }),
    text("financing_currency", "Foreign currency financing in (type of currency)", { max: 20, requiredIf: when("financing_type", "Foreign Currency Financing") }),
    text("forward_contract_no", "Forward contract no", { max: 20, requiredIf: when("financing_type", "Apply Forward Contract") }),
    tick("advance_payment", "We authorise you to debit DC amount in full from our account for advance payment"),
    text("advance_payment_account", "Account no for advance payment", { requiredIf: ticked("advance_payment"), max: 20, format: "account" }),
    tick("debit_issuance_charges", "Please debit all DC issuance charges to our account with you"),
    text("issuance_charges_account", "Account no for DC issuance charges", { ...req, max: 17, format: "account" }),
  ] },
  { title: "Signature", fields: [
    text("authorised_person", "Authorised person(s) & company stamp", { half: false }),
  ] },
];

export const LC: { code: string; template: Template; defaults: Values } = {
  code: "LC",
  template: { title: "Irrevocable Documentary Credit (LC)", note: "Please complete in block letters. Dates are DD/MM/YYYY.", sections },
  defaults: { mode_of_advising: "Full Swift", presentation_days: "21", bank_charges: true, bank_charges_for: "Beneficiary, except charges at DC Issuing Bank's counter", post_shipment_financing: true, debit_issuance_charges: true },
};

/** A realistic import LC: steel coils from Shanghai, FOB, 90 days after bill of lading date. */
export const LC_SAMPLE: Values = {
  application_date: "02/11/2026", mode_of_advising: "Full Swift",
  applicant_name: "TAN ENGINEERING PTE LTD", applicant_address_1: "12 Marina Boulevard", applicant_address_2: "#20-01 Tower 3", applicant_address_3: "Singapore 018982",
  contact_name: "TAN WEI MING", contact_tel: "+65 6123 4567", contact_fax: "+65 6123 4568",
  beneficiary_name: "SHANGHAI EASTERN STEEL CO LTD", beneficiary_address_1: "88 Pudong Avenue", beneficiary_address_2: "Pudong New District", beneficiary_address_3: "Shanghai 200120, China",
  beneficiary_contact: "LI MING", beneficiary_tel: "+86 21 58881234",
  currency: "USD", amount: "480,000.00", tolerance: true, tolerance_plus: "5", tolerance_minus: "5",
  price_basis: "FOB", partial_shipment: "not allowed", transhipment: "allowed",
  shipment_from: "Port of Loading / Airport of Departure", shipment_from_place: "Shanghai, China",
  shipment_to: "Port of Discharge / Airport of Destination", shipment_to_place: "Singapore",
  latest_shipment_date: "15/12/2026", expiry_date: "31/12/2026", presentation_days: "21",
  drafts: true, drafts_at: "Term", term_days: "90", term_after: "bill of lading date", term_prepay: "You may not prepay the acceptance of this term LC",
  doc_bill_of_lading: true, bl_made_out_to: "order of the Bank", bl_freight: "Collect", bl_notify_party: "TAN ENGINEERING PTE LTD, 12 Marina Boulevard, Singapore 018982",
  doc_insurance: true, insurance_arrangement: "Insurance covered by applicant under open Cover No.", insurance_cover_no: "OC-2026-0457", insurance_cover_with: "Example Insurance Pte Ltd",
  doc_commercial_invoice: true, invoice_originals: "3", invoice_copies: "3",
  doc_packing_list: true, packing_list_originals: "3", packing_list_copies: "3",
  doc_certificate_of_origin: true, origin_originals: "1", origin_copies: "2", origin_country: "China",
  goods_description: "500 MT hot-rolled steel coils, grade SAE1006, 2.0mm x 1250mm, as per proforma invoice PI-2026-118 dated 20/10/2026. FOB Shanghai (Incoterms 2020).",
  bank_charges: true, bank_charges_for: "Beneficiary, except charges at DC Issuing Bank's counter",
  post_shipment_financing: true, financing_type: "Foreign Currency Financing", financing_currency: "USD",
  debit_issuance_charges: true, issuance_charges_account: "072-123456-7", authorised_person: "TAN WEI MING, Director",
};

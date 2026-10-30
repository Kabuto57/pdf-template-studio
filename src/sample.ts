import type { Template, Values } from "./pdf";
import { COUNTRIES, CURRENCIES } from "./lists";

export const GUARANTEE: Template = {
  title: "Banker's Guarantee Application",
  note: "Please complete in block letters. Fields marked with a date take DD/MM/YYYY. Return the signed form to your relationship manager or any branch.",
  sections: [
    {
      title: "Applicant", fields: [
        { id: "applicant_name", label: "Applicant name", kind: "text" },
        { id: "applicant_address", label: "Applicant address", kind: "long" },
        { id: "applicant_town", label: "Town", kind: "text", half: true },
        { id: "applicant_country", label: "Country", kind: "select", options: COUNTRIES, half: true },
        { id: "applicant_tel", label: "Tel no", kind: "text", half: true },
        { id: "applicant_email", label: "Email", kind: "text", half: true },
      ],
    },
    {
      title: "Guarantee amount and type", fields: [
        { id: "currency", label: "Currency", kind: "select", options: CURRENCIES, half: true },
        { id: "amount", label: "Amount", kind: "text", half: true },
        { id: "amount_in_words", label: "Amount in words", kind: "text" },
        { id: "guarantee_type", label: "Type of guarantee", kind: "radio", options: ["Performance", "Tender / bid", "Advance payment", "Financial", "Other"] },
      ],
    },
    {
      title: "For the benefit of (third party)", fields: [
        { id: "beneficiary_name", label: "Beneficiary name", kind: "text" },
        { id: "beneficiary_address", label: "Beneficiary address", kind: "long" },
        { id: "beneficiary_town", label: "Town", kind: "text", half: true },
        { id: "beneficiary_country", label: "Country", kind: "select", options: COUNTRIES, half: true },
        { id: "purpose", label: "Purpose / contract reference", kind: "text" },
      ],
    },
    {
      title: "Dates", fields: [
        { id: "effective_date", label: "Effective date", kind: "date", half: true },
        { id: "expiry_date", label: "Expiry date", kind: "date", half: true },
        { id: "claim_expiry_date", label: "Claim expiry date", kind: "date", half: true },
      ],
    },
    {
      title: "Requirements of the issuing bank", fields: [
        { id: "wording", label: "Guarantee wording", kind: "radio", options: ["Bank's standard wording", "Beneficiary's wording (attached)"] },
        { id: "delivery", label: "Deliver the guarantee by", kind: "radio", options: ["Collect at branch", "Courier to applicant", "Courier to beneficiary"] },
        { id: "attachments", label: "Documents attached", kind: "checks", options: ["Contract / tender", "Beneficiary's wording", "Board resolution", "Other"] },
        { id: "debit_account", label: "Debit charges and margin from account no", kind: "text", half: true },
        { id: "margin", label: "Cash margin", kind: "radio", half: true, options: ["Yes", "No"] },
      ],
    },
    {
      title: "Declaration", fields: [
        { id: "agree", label: "I / We request the bank to issue the guarantee above and agree to the bank's terms and conditions for guarantees, which I / we have read.", kind: "check" },
        { id: "signatory_name", label: "Authorised signatory name", kind: "text", half: true },
        { id: "signed_date", label: "Date", kind: "date", half: true },
      ],
    },
  ],
};

export const SAMPLE: Values = {
  applicant_name: "TAN ENGINEERING PTE LTD",
  applicant_address: "12 Marina Boulevard\n#20-01 Tower 3",
  applicant_town: "Singapore", applicant_country: "Singapore",
  applicant_tel: "+65 6123 4567", applicant_email: "finance@tan-eng.com.sg",
  currency: "SGD", amount: "250,000.00", amount_in_words: "Two hundred and fifty thousand Singapore dollars only",
  guarantee_type: "Performance",
  beneficiary_name: "HARBOUR DEVELOPMENT AUTHORITY",
  beneficiary_address: "1 Harbourfront Avenue",
  beneficiary_town: "Singapore", beneficiary_country: "Singapore",
  purpose: "Contract HDA/2026/114 - Pier 3 refurbishment",
  effective_date: "01/11/2026", expiry_date: "31/10/2027", claim_expiry_date: "31/01/2028",
  wording: "Beneficiary's wording (attached)", delivery: "Courier to beneficiary",
  attachments: ["Contract / tender", "Beneficiary's wording"],
  debit_account: "072-123456-7", margin: "No",
  agree: true, signatory_name: "TAN WEI MING", signed_date: "29/10/2026",
};

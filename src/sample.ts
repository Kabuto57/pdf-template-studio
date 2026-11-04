// SAMPLE FORMS AND ANSWERS
// The banker's guarantee example the studio can open, and sampleFor(): believable answers for any form,
// so "Fill with sample" shows what a completed form looks like.
import type { Template, Values } from "./pdf";
import { COUNTRIES, CURRENCIES } from "./lists";
import { LC, LC_SAMPLE } from "./lc";
import { isRequired } from "./pdf";

export const GUARANTEE: Template = {
  title: "Banker's Guarantee Application",
  note: "Please complete in block letters. Fields marked with a date take DD/MM/YYYY. Return the signed form to your relationship manager or any branch.",
  sections: [
    {
      title: "Applicant",
      fields: [
        { id: "applicant_name", label: "Applicant name", kind: "text", required: true },
        { id: "applicant_address", label: "Applicant address", kind: "long", required: true },
        { id: "applicant_town", label: "Town", kind: "text", half: true },
        { id: "applicant_country", label: "Country", kind: "select", options: COUNTRIES, half: true },
        { id: "applicant_tel", label: "Tel no", kind: "text", half: true, required: true },
        { id: "applicant_email", label: "Email", kind: "text", half: true },
      ],
    },
    {
      title: "Guarantee amount and type",
      fields: [
        { id: "currency", label: "Currency", kind: "select", options: CURRENCIES, half: true },
        { id: "amount", label: "Amount", kind: "text", half: true, required: true },
        { id: "amount_in_words", label: "Amount in words", kind: "text" },
        {
          id: "guarantee_type",
          label: "Type of guarantee",
          kind: "radio",
          options: ["Performance", "Tender / bid", "Advance payment", "Financial", "Other"],
        },
      ],
    },
    {
      title: "For the benefit of (third party)",
      fields: [
        { id: "beneficiary_name", label: "Beneficiary name", kind: "text", required: true },
        { id: "beneficiary_address", label: "Beneficiary address", kind: "long" },
        { id: "beneficiary_town", label: "Town", kind: "text", half: true },
        { id: "beneficiary_country", label: "Country", kind: "select", options: COUNTRIES, half: true },
        { id: "purpose", label: "Purpose / contract reference", kind: "text" },
      ],
    },
    {
      title: "Dates",
      fields: [
        { id: "effective_date", label: "Effective date", kind: "date", half: true, required: true },
        { id: "expiry_date", label: "Expiry date", kind: "date", half: true, required: true },
        { id: "claim_expiry_date", label: "Claim expiry date", kind: "date", half: true },
      ],
    },
    {
      title: "Requirements of the issuing bank",
      fields: [
        {
          id: "wording",
          label: "Guarantee wording",
          kind: "radio",
          options: ["Bank's standard wording", "Beneficiary's wording (attached)"],
        },
        {
          id: "delivery",
          label: "Deliver the guarantee by",
          kind: "radio",
          options: ["Collect at branch", "Courier to applicant", "Courier to beneficiary"],
        },
        {
          id: "attachments",
          label: "Documents attached",
          kind: "checks",
          options: ["Contract / tender", "Beneficiary's wording", "Board resolution", "Other"],
        },
        { id: "debit_account", label: "Debit charges and margin from account no", kind: "text", half: true },
        { id: "margin", label: "Cash margin", kind: "radio", half: true, options: ["Yes", "No"] },
      ],
    },
    {
      title: "Declaration",
      fields: [
        {
          id: "agree",
          label:
            "I / We request the bank to issue the guarantee above and agree to the bank's terms and conditions for guarantees, which I / we have read.",
          kind: "check",
          required: true,
        },
        { id: "signatory_name", label: "Authorised signatory name", kind: "text", half: true, required: true },
        { id: "signed_date", label: "Date", kind: "date", half: true },
      ],
    },
  ],
};

export const SAMPLE: Values = {
  applicant_name: "TAN ENGINEERING PTE LTD",
  applicant_address: "12 Marina Boulevard\n#20-01 Tower 3",
  applicant_town: "Singapore",
  applicant_country: "Singapore",
  applicant_tel: "+65 6123 4567",
  applicant_email: "finance@tan-eng.com.sg",
  currency: "SGD",
  amount: "250,000.00",
  amount_in_words: "Two hundred and fifty thousand Singapore dollars only",
  guarantee_type: "Performance",
  beneficiary_name: "HARBOUR DEVELOPMENT AUTHORITY",
  beneficiary_address: "1 Harbourfront Avenue",
  beneficiary_town: "Singapore",
  beneficiary_country: "Singapore",
  purpose: "Contract HDA/2026/114 - Pier 3 refurbishment",
  effective_date: "01/11/2026",
  expiry_date: "31/10/2027",
  claim_expiry_date: "31/01/2028",
  wording: "Beneficiary's wording (attached)",
  delivery: "Courier to beneficiary",
  attachments: ["Contract / tender", "Beneficiary's wording"],
  debit_account: "072-123456-7",
  margin: "No",
  agree: true,
  signatory_name: "TAN WEI MING",
  signed_date: "29/10/2026",
};

const day = (plus: number) => {
  const d = new Date();
  d.setDate(d.getDate() + plus);
  return d.toLocaleDateString("en-GB");
};
const TEXT: [RegExp, string][] = [
  [/e-?mail/i, "finance@tan-eng.com.sg"],
  [/tel|phone|mobile|fax|contact (no|number)/i, "+65 6123 4567"],
  [/passport|\bic\b/i, "S1234567A"],
  [/swift/i, "EXBKSGSG"],
  [/cif|registration|ref|acc(ount)? ?no|account|\b(dc|cr|lc) no/i, "072-123456-7"],
  [/word/i, "Two hundred and fifty thousand only"],
  [/plus|minus|%/i, "5"],
  [/amount|sum|value/i, "250,000.00"],
  [/currency/i, "SGD"],
  [/copies|originals/i, "2"],
  [/(beneficiary|third party|3party|drawee|consignee|buyer).*address.*3/i, "Singapore 098632"],
  [/(beneficiary|third party|3party|drawee|consignee|buyer).*address.*2/i, "HarbourFront Centre"],
  [/(beneficiary|third party|3party|drawee|consignee|buyer).*address/i, "1 Harbourfront Avenue"],
  [/country|\bport|airport|place/i, "Singapore"],
  [/address.*3/i, "Singapore 018982"],
  [/address.*2/i, "#20-01 Tower 3"],
  [/address/i, "12 Marina Boulevard"],
  [/days|period|term|tenor/i, "90"],
  [/(beneficiary|third party|drawee).*(contact|person|attention)/i, "LIM MEI LING"],
  [/bank|correspondent/i, "Example Bank Ltd, Singapore"],
  [/beneficiary|drawee|third party|3party|consignee|buyer|notify/i, "HARBOUR DEVELOPMENT AUTHORITY"],
  [/signat|contact|attention|person/i, "TAN WEI MING"],
  [/name|applicant|drawer|seller|shipper|company/i, "TAN ENGINEERING PTE LTD"],
  [/\brate\b/i, "1.35"],
  [/\bno\b|number|code|\bid\b/i, "REF-2026-0114"],
];
const STORY = "Steel fittings for Pier 3 refurbishment, contract HDA/2026/114";

/** Plausible answers for any form, so every bank form can be tried end to end. The simple guarantee keeps its own. */
export function sampleFor(t: Template): Values {
  if (t.title === LC.template.title) return { ...LC_SAMPLE };
  const out: Values = {};
  for (const f of t.sections.flatMap(s => s.fields)) {
    const own = SAMPLE[f.id],
      opts = (f.options ?? []).filter(o => !o.startsWith("<"));
    if (
      own !== undefined &&
      !(f.kind !== "long" && String(own).includes("\n")) &&
      (!opts.length || [own].flat().every(v => opts.includes(v as string)))
    ) {
      out[f.id] = own;
      continue;
    }
    const guess = TEXT.find(([re]) => re.test(f.label))?.[1];
    switch (f.kind) {
      case "check":
        if (f.required) out[f.id] = true;
        break; // ponytail: ticking every box would pick conflicting options
      case "radio":
        out[f.id] = opts[0] ?? "";
        break;
      case "checks":
        out[f.id] = opts.slice(0, 1);
        break;
      case "select":
        out[f.id] = opts.find(o => o === guess) ?? opts[0] ?? "";
        break;
      case "date":
        out[f.id] = day(
          /claim/i.test(f.label)
            ? 462
            : /expir|until|latest|last/i.test(f.label)
              ? 372
              : /effective|ship|from/i.test(f.label)
                ? 7
                : 0,
        );
        break;
      case "long":
        out[f.id] = /address/i.test(f.label) ? "12 Marina Boulevard\n#20-01 Tower 3" : (guess ?? STORY);
        break;
      default:
        out[f.id] =
          guess ?? (/purpose|goods|descri|instruction|remark|service|detail/i.test(f.label) ? STORY : "SAMPLE");
    }
  }
  // Answers that only apply after another choice stay blank unless that choice was made.
  for (const f of t.sections.flatMap(s => s.fields)) if (f.requiredIf && !isRequired(f, out)) delete out[f.id];
  return out;
}

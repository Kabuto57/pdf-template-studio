// The bank's customer records (demo stand-in for the core banking / KYC system), and the check of an application against them.
// ponytail: one hard-coded record; swap `find` for a call to the real customer system.
export interface Customer {
  cif: string;
  name: string;
  address: string[];
  tel: string;
  accounts: string[];
  signatories: string[];
}

export const CUSTOMERS: Customer[] = [
  {
    cif: "CIF 0048213",
    name: "TAN ENGINEERING PTE LTD",
    address: ["12 Marina Boulevard", "#20-01 Tower 3", "Singapore 018982"],
    tel: "+65 6123 4567",
    accounts: ["072-123456-7", "072-765432-1"],
    signatories: ["TAN WEI MING", "LIM SU LIN"],
  },
];

const norm = (s: unknown) =>
  String(s ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
export const find = (name: unknown) => CUSTOMERS.find(c => norm(c.name) === norm(name));

export interface Match {
  id: string;
  label: string;
  form: string;
  record: string;
  ok: boolean;
}

/** Compares the applicant's details in the form with the customer record. Blank answers are skipped. */
export function compare(c: Customer, data: Record<string, unknown>): Match[] {
  const s = (id: string) => String(data[id] ?? "").trim();
  const out: Match[] = [];
  const add = (id: string, label: string, form: string, record: string, ok: boolean) => {
    if (form) out.push({ id, label, form, record, ok });
  };
  add("applicant_name", "Name", s("applicant_name"), c.name, true);
  const addr = ["applicant_address_1", "applicant_address_2", "applicant_address_3"].map(s).filter(Boolean).join(", ");
  add("applicant_address_1", "Address", addr, c.address.join(", "), norm(addr) === norm(c.address.join("")));
  add("contact_tel", "Tel no", s("contact_tel"), c.tel, norm(s("contact_tel")) === norm(c.tel));
  for (const [id, label] of [
    ["issuance_charges_account", "Charges account"],
    ["advance_payment_account", "Advance payment account"],
  ])
    add(
      id,
      label,
      s(id),
      c.accounts.join(", "),
      c.accounts.some(a => norm(a) === norm(s(id))),
    );
  const who = s("authorised_person").split(",")[0];
  add(
    "authorised_person",
    "Authorised person",
    s("authorised_person"),
    c.signatories.join(", "),
    c.signatories.some(p => norm(p) === norm(who)),
  );
  return out;
}

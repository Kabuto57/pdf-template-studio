import { describe, expect, it } from "vitest";
import { compare, find } from "../src/customers";
import { LC_SAMPLE } from "../src/lc";

describe("applicant against the customer record", () => {
  it("the sample applicant matches; a wrong account or signatory is caught", () => {
    const c = find(" Tan Engineering Pte. Ltd ")!;
    expect(c.cif).toBeTruthy();
    expect(compare(c, LC_SAMPLE).filter(m => !m.ok)).toEqual([]);
    const bad = compare(c, { ...LC_SAMPLE, issuance_charges_account: "072-999999-9", authorised_person: "JOHN DOE, Director", applicant_address_2: "#21-01 Tower 3" });
    expect(bad.filter(m => !m.ok).map(m => m.id)).toEqual(["applicant_address_1", "issuance_charges_account", "authorised_person"]);
    expect(find("SOMEONE ELSE PTE LTD")).toBeUndefined();
  });
});

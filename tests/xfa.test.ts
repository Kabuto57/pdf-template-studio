import { expect, it } from "vitest";
import { humanize, xfaFields, xfaForms, xfaTemplate } from "../src/text";

// A tiny version of the tree pdf.js builds for an XFA form (allXfaHtml), already filled in.
const field = (xfaName: string, ui: object, caption?: string) => ({ name: "div", attributes: { class: ["xfaField"], xfaName },
  children: [...(caption ? [{ name: "span", attributes: { class: ["xfaCaption"] }, children: [{ name: "span", value: caption }] }] : []), ui] });
const sub = (xfaName: string, ...children: object[]) => ({ name: "div", attributes: { class: ["xfaSubform"], xfaName }, children });
const tree = sub("form1",
  sub("MainPage", field("btnBG", { name: "button" }, "Banker's Guarantee Application (BG)")),
  sub("BG",
    sub("applicant", sub("subApplicantInfo",
      field("txtApplicantName", { name: "input", attributes: { type: "text", value: "TAN ENG", required: true } }),
      field("txtTelNo", { name: "input", attributes: { type: "text", value: "+65 6123 4567" } }))),
    sub("beneficiary", sub("subBeneficiaryInfo", field("txtTelNo", { name: "input", attributes: { type: "text", value: "" } }))),
    sub("amount", field("drpCurrency", { name: "select", children: [{ name: "option", attributes: { hidden: true }, value: " " },
      { name: "option", value: "SGD", attributes: { selected: true } }, { name: "option", value: "USD", attributes: {} }] })),
    sub("dates", { name: "div", attributes: { class: ["xfaExclgroup"], xfaName: "radExpiryDate" }, children: [
      field("radSpecific", { name: "input", attributes: { type: "radio", xfaOn: "1" } }, "Specific Date"),
      field("radOpen", { name: "input", attributes: { type: "radio", xfaOn: "2", checked: true } }, "Open ended")] }),
    sub("sign", field("chkAgree", { name: "input", attributes: { type: "checkbox", checked: true } }, "We agree"))));

it("reads XFA fields, answers and form titles", () => {
  const x = xfaFields(tree as never);
  expect(xfaForms(x).find(f => f.code === "BG")).toMatchObject({ title: "Banker's Guarantee Application (BG)", count: 6, answered: 5 });
  const { template, values } = xfaTemplate(x, "BG");
  expect(template.sections.map(s => s.title)).toEqual(["Applicant", "Beneficiary", "Amount", "Dates", "Sign"]);
  expect(values).toEqual({
    applicant_name: "TAN ENG", applicant_info_tel_no: "+65 6123 4567", beneficiary_info_tel_no: "",
    currency: "SGD", expiry_date: "Open ended", we_agree: true,
  });
  expect(template.sections[2].fields[0]).toMatchObject({ kind: "select", options: ["SGD", "USD"] });
  expect(template.sections[0].fields[0]).toMatchObject({ label: "Applicant name", required: true });
  expect(template.sections[0].fields[1].required).toBeUndefined();
});

it("turns XFA names into words", () => {
  expect(humanize("txtApplicantName")).toBe("Applicant name");
  expect(humanize("txtDBSCIFNo")).toBe("DBSCIF no");
  expect(humanize("txtAddress2")).toBe("Address 2");
});

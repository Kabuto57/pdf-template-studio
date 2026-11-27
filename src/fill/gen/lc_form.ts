// @ts-nocheck: lc-form's Acrobat JavaScript, copied word for word by scripts/fill-engine.py (do not edit; rerun it)
export const document = function (app, color, display, console) {
// =====================================================================================================================
// THE RULES ENGINE (runs inside Acrobat). Built into the PDF as the document script "lcRules".
//
// lcRules(doc) checks every question and colours its box:
//   blank or wrong mandatory answer -> red outline, pink fill, marked Required
//   answered and right              -> black outline, white fill
//   doesn't apply yet               -> greyed out, locked, and its answer cleared
// It returns the list of missing questions, plus .bad (wrong answers) and .first (where to put the cursor).
//
// lcWords(amount, currency) writes an amount in words ("USD One Thousand ... only").
// lcDates(doc) shows each date's calendar box and hides its drop-down list (Acrobat only).
//
// The form's own data is pasted into this script when the PDF is built (see document_script in pdf_writer.py):
//   lcModel  the rules table: one entry per question (its label, kind, "applies only if" rules, "mandatory if" rules ...)
//   lcDeps   an index: box name -> the questions to re-check when that box changes (null = always check everything)
//   lcState  what the last run saw, so the next run can skip work that cannot have changed:
//              v  = each box's last-seen value (a box whose value did not change is not checked again)
//              st = each box's last-written look (a box whose look did not change is not written again)
//
// Acrobat's JavaScript is old-style (ES3/ES5): write "var" and "function" only, and none of the newer (ES6) syntax or
// methods. Plain ASCII characters only (the build checks this).
// Every read or write of an Acrobat field is slow, so the code below avoids repeating them.
// =====================================================================================================================
var lcModel = {"application_date":{"kind":"date","label":"Date","hasRule":1,"always":1,"check":1},"mode_of_advising":{"kind":"radio","label":"Mode of advising","hasRule":1,"always":1},"applicant_name":{"kind":"text","label":"Applicant name","hasRule":1,"always":1,"check":1},"applicant_address_1":{"kind":"text","label":"Applicant address","hasRule":1,"always":1,"check":1},"applicant_address_2":{"kind":"text","label":"Applicant address (line 2)","check":1},"applicant_address_3":{"kind":"text","label":"Applicant address (line 3)","check":1},"applicant_address_4":{"kind":"text","label":"Applicant address (line 4)","check":1},"contact_name":{"kind":"text","label":"Contact party for this application & confirmation of FX rate: Name","hasRule":1,"always":1,"check":1},"contact_tel":{"kind":"text","label":"Contact party: Tel no","hasRule":1,"always":1,"check":["^\\+?[\\d ()-]*\\d[\\d ()-]*$","is not a phone number (digits, spaces, + - ( ) only)"]},"contact_fax":{"kind":"text","label":"Contact party: Fax no","check":["^\\+?[\\d ()-]*\\d[\\d ()-]*$","is not a phone number (digits, spaces, + - ( ) only)"]},"dc_no":{"kind":"text","label":"DC no","check":1},"bank_code":{"kind":"text","label":"Bank code","check":1},"advising_bank_name":{"kind":"text","label":"Name","check":1},"advising_bank_address_1":{"kind":"text","label":"Address","check":1},"advising_bank_address_2":{"kind":"text","label":"Address (line 2)","check":1},"advising_bank_address_3":{"kind":"text","label":"Address (line 3)","check":1},"third_party_name":{"kind":"text","label":"Name","check":1},"third_party_address_1":{"kind":"text","label":"Address","check":1},"third_party_address_2":{"kind":"text","label":"Address (line 2)","check":1},"third_party_address_3":{"kind":"text","label":"Address (line 3)","check":1},"beneficiary_name":{"kind":"text","label":"Beneficiary's name","hasRule":1,"always":1,"check":1},"beneficiary_address_1":{"kind":"text","label":"Beneficiary's address","hasRule":1,"always":1,"check":1},"beneficiary_address_2":{"kind":"text","label":"Beneficiary's address (line 2)","check":1},"beneficiary_address_3":{"kind":"text","label":"Beneficiary's address (line 3)","check":1},"beneficiary_address_4":{"kind":"text","label":"Beneficiary's address (line 4)","check":1},"beneficiary_contact":{"kind":"text","label":"Contact person","check":1},"beneficiary_tel":{"kind":"text","label":"Tel no","check":["^\\+?[\\d ()-]*\\d[\\d ()-]*$","is not a phone number (digits, spaces, + - ( ) only)"]},"beneficiary_fax":{"kind":"text","label":"Fax no","check":["^\\+?[\\d ()-]*\\d[\\d ()-]*$","is not a phone number (digits, spaces, + - ( ) only)"]},"currency":{"kind":"select","label":"Currency","hasRule":1,"always":1},"amount":{"kind":"text","label":"Amount","hasRule":1,"always":1,"check":["^\\d{1,3}(,?\\d{3})*(\\.\\d{1,2})?$","is not an amount"]},"tolerance":{"kind":"check","label":"Tolerance on credit amount & goods quantity"},"tolerance_plus":{"kind":"text","label":"Tolerance + (%)","hasRule":1,"requiredIf":[["tolerance",["true"],0]],"activeIf":[["tolerance",["true"],0]],"check":["^\\d+$","should be a whole number"]},"tolerance_minus":{"kind":"text","label":"Tolerance - (%)","hasRule":1,"requiredIf":[["tolerance",["true"],0]],"activeIf":[["tolerance",["true"],0]],"check":["^\\d+$","should be a whole number"]},"price_basis":{"kind":"radio","label":"Price basis","hasRule":1,"always":1},"price_basis_other":{"kind":"text","label":"Others (please specify)","hasRule":1,"requiredIf":[["price_basis",["Others"],0]],"activeIf":[["price_basis",["Others"],0]],"check":1},"partial_shipment":{"kind":"radio","label":"Partial shipment","hasRule":1,"always":1},"transhipment":{"kind":"radio","label":"Transhipment","hasRule":1,"always":1},"shipment_from":{"kind":"select","label":"Shipment from"},"shipment_from_port":{"kind":"text","label":"Port of Loading / Airport of Departure","hasRule":1,"requiredIf":[["shipment_from",["Port of Loading / Airport of Departure","Place of Taking in charge","Place of Receipt"],0]],"activeIf":[["shipment_from",["Port of Loading / Airport of Departure","Place of Taking in charge","Place of Receipt"],0]],"check":1},"shipment_from_port_2":{"kind":"text","label":"Port of Loading / Airport of Departure (line 2)","activeIf":[["shipment_from",["Port of Loading / Airport of Departure","Place of Taking in charge","Place of Receipt"],0]],"check":1},"shipment_from_place":{"kind":"text","label":"Dispatch from / Place of Taking in Charge / Place of Receipt","hasRule":1,"requiredIf":[["shipment_from",["Dispatch from","Place of Taking in charge","Place of Receipt"],0]],"activeIf":[["shipment_from",["Dispatch from","Place of Taking in charge","Place of Receipt"],0]],"check":1},"shipment_from_place_2":{"kind":"text","label":"Dispatch from / Place of Taking in Charge / Place of Receipt (line 2)","activeIf":[["shipment_from",["Dispatch from","Place of Taking in charge","Place of Receipt"],0]],"check":1},"shipment_to":{"kind":"select","label":"Shipment to"},"shipment_to_port":{"kind":"text","label":"Port of Discharge / Airport of Destination","hasRule":1,"requiredIf":[["shipment_to",["Port of Discharge / Airport of Destination","Place of Final Destination","Place of Delivery"],0]],"activeIf":[["shipment_to",["Port of Discharge / Airport of Destination","Place of Final Destination","Place of Delivery"],0]],"check":1},"shipment_to_port_2":{"kind":"text","label":"Port of Discharge / Airport of Destination (line 2)","activeIf":[["shipment_to",["Port of Discharge / Airport of Destination","Place of Final Destination","Place of Delivery"],0]],"check":1},"shipment_to_place":{"kind":"text","label":"For Transportation to / Place of Final Destination / Place of Delivery","hasRule":1,"requiredIf":[["shipment_to",["For Transportation to","Place of Final Destination","Place of Delivery"],0]],"activeIf":[["shipment_to",["For Transportation to","Place of Final Destination","Place of Delivery"],0]],"check":1},"shipment_to_place_2":{"kind":"text","label":"For Transportation to / Place of Final Destination / Place of Delivery (line 2)","activeIf":[["shipment_to",["For Transportation to","Place of Final Destination","Place of Delivery"],0]],"check":1},"latest_shipment_date":{"kind":"date","label":"Latest shipment date","check":1},"expiry_date":{"kind":"date","label":"Date of expiry (in beneficiary's country)","hasRule":1,"always":1,"check":1},"presentation_days":{"kind":"text","label":"Presentation period (days after shipment)","check":["^\\d+$","should be a whole number"]},"back_to_back":{"kind":"check","label":"This is a back-to-back DC to be issued against the master credit (the \"Master DC\")"},"master_dc_no":{"kind":"text","label":"Master credit no","hasRule":1,"requiredIf":[["back_to_back",["true"],0]],"activeIf":[["back_to_back",["true"],0]],"check":1},"master_dc_issued_by":{"kind":"text","label":"Issued by","hasRule":1,"requiredIf":[["back_to_back",["true"],0]],"activeIf":[["back_to_back",["true"],0]],"check":1},"drafts":{"kind":"check","label":"Drafts for the percentage of invoice value below, at"},"drafts_percent":{"kind":"text","label":"Percentage of invoice value (%)","hasRule":1,"requiredIf":[["drafts",["true"],0]],"activeIf":[["drafts",["true"],0]],"check":["^\\d+$","should be a whole number"]},"drafts_at":{"kind":"radio","label":"Drafts at","hasRule":1,"requiredIf":[["drafts",["true"],0]],"activeIf":[["drafts",["true"],0]]},"term_days":{"kind":"text","label":"Term: days","hasRule":1,"requiredIf":[["drafts_at",["Term"],0]],"activeIf":[["drafts_at",["Term"],0]],"check":["^\\d+$","should be a whole number"]},"term_after":{"kind":"text","label":"days after","hasRule":1,"requiredIf":[["drafts_at",["Term"],0]],"activeIf":[["drafts_at",["Term"],0]],"check":1},"draft_date":{"kind":"date","label":"Date","hasRule":1,"requiredIf":[["drafts_at",["Date"],0]],"activeIf":[["drafts_at",["Date"],0]],"check":1},"term_prepay":{"kind":"radio","label":"If it is a term LC, please select one","hasRule":1,"requiredIf":[["drafts_at",["Term"],0]],"activeIf":[["drafts_at",["Term"],0]]},"doc_bill_of_lading":{"kind":"check","label":"Full set of Clean on Board marine bills of lading"},"bl_made_out_to":{"kind":"radio","label":"Made out to","hasRule":1,"requiredIf":[["doc_bill_of_lading",["true"],0]],"activeIf":[["doc_bill_of_lading",["true"],0]]},"bl_made_out_to_other":{"kind":"text","label":"Made out to (other)","hasRule":1,"requiredIf":[["bl_made_out_to",["other (specify)"],0]],"activeIf":[["bl_made_out_to",["other (specify)"],0]],"check":1},"bl_freight":{"kind":"radio","label":"Marked Freight","hasRule":1,"requiredIf":[["doc_bill_of_lading",["true"],0]],"activeIf":[["doc_bill_of_lading",["true"],0]]},"bl_notify_party":{"kind":"text","label":"Notify party (if not specified, notify party is considered to be applicant)","hasRule":1,"requiredIf":[["doc_bill_of_lading",["true"],0]],"activeIf":[["doc_bill_of_lading",["true"],0]],"check":1},"doc_air_waybill":{"kind":"check","label":"Original Air Waybill consigned to the Bank"},"awb_freight":{"kind":"radio","label":"Marked Freight","hasRule":1,"requiredIf":[["doc_air_waybill",["true"],0]],"activeIf":[["doc_air_waybill",["true"],0]]},"awb_notify_party":{"kind":"text","label":"Notify party (if not specified, notify party is considered to be applicant)","hasRule":1,"requiredIf":[["doc_air_waybill",["true"],0]],"activeIf":[["doc_air_waybill",["true"],0]],"check":1},"doc_delivery_order":{"kind":"check","label":"Delivery order signed by beneficiary made out to applicant"},"do_originals":{"kind":"text","label":"Delivery order: originals","hasRule":1,"requiredIf":[["doc_delivery_order",["true"],0]],"activeIf":[["doc_delivery_order",["true"],0]],"check":["^\\d+$","should be a whole number"]},"do_copies":{"kind":"text","label":"Delivery order: copies","hasRule":1,"requiredIf":[["doc_delivery_order",["true"],0]],"activeIf":[["doc_delivery_order",["true"],0]],"check":["^\\d+$","should be a whole number"]},"do_countersigned_by":{"kind":"select","label":"Countersigned by how many of our signatories","hasRule":1,"requiredIf":[["doc_delivery_order",["true"],0]],"activeIf":[["doc_delivery_order",["true"],0]]},"do_signature_verified":{"kind":"select","label":"Whose signature(s) ... to be verified by the Bank","hasRule":1,"requiredIf":[["doc_delivery_order",["true"],0]],"activeIf":[["doc_delivery_order",["true"],0]]},"doc_insurance":{"kind":"check","label":"Marine/Air Insurance Policy or Certificate in duplicate, in Singapore in the currency of the credit, covering Institute Cargo Clauses (A), Institute War Clauses, Institute Strikes Clauses / Strikes, Riots and Civil Commotion"},"insurance_arrangement":{"kind":"select","label":"For FOB/CFR/FCA/CPT","activeIf":[["doc_insurance",["true"],0]]},"insurance_cover_no":{"kind":"text","label":"Open cover no","hasRule":1,"requiredIf":[["insurance_arrangement",["Insurance covered by applicant under open Cover No."],0]],"activeIf":[["insurance_arrangement",["Insurance covered by applicant under open Cover No."],0]],"check":1},"insurance_cover_with":{"kind":"text","label":"With","hasRule":1,"requiredIf":[["insurance_arrangement",["Insurance covered by applicant under open Cover No."],0]],"activeIf":[["insurance_arrangement",["Insurance covered by applicant under open Cover No."],0]],"check":1},"doc_beneficiary_certificate":{"kind":"check","label":"Beneficiary's certificate stating 1 set of non-negotiable documents has been sent to applicant"},"bencert_sent_by":{"kind":"checks","label":"Sent by","options":["faxed","mailed","couriered"],"hasRule":1,"requiredIf":[["doc_beneficiary_certificate",["true"],0]],"activeIf":[["doc_beneficiary_certificate",["true"],0]]},"bencert_days":{"kind":"text","label":"Within (days after shipment)","hasRule":1,"requiredIf":[["doc_beneficiary_certificate",["true"],0]],"activeIf":[["doc_beneficiary_certificate",["true"],0]],"check":["^\\d+$","should be a whole number"]},"doc_commercial_invoice":{"kind":"check","label":"Signed commercial invoice"},"invoice_originals":{"kind":"text","label":"Commercial invoice: originals","hasRule":1,"requiredIf":[["doc_commercial_invoice",["true"],0]],"activeIf":[["doc_commercial_invoice",["true"],0]],"check":["^\\d+$","should be a whole number"]},"invoice_copies":{"kind":"text","label":"Commercial invoice: copies","hasRule":1,"requiredIf":[["doc_commercial_invoice",["true"],0]],"activeIf":[["doc_commercial_invoice",["true"],0]],"check":["^\\d+$","should be a whole number"]},"doc_packing_list":{"kind":"check","label":"Packing list"},"packing_list_originals":{"kind":"text","label":"Packing list: originals","hasRule":1,"requiredIf":[["doc_packing_list",["true"],0]],"activeIf":[["doc_packing_list",["true"],0]],"check":["^\\d+$","should be a whole number"]},"packing_list_copies":{"kind":"text","label":"Packing list: copies","hasRule":1,"requiredIf":[["doc_packing_list",["true"],0]],"activeIf":[["doc_packing_list",["true"],0]],"check":["^\\d+$","should be a whole number"]},"doc_weight_note":{"kind":"check","label":"Weight note"},"weight_note_originals":{"kind":"text","label":"Weight note: originals","hasRule":1,"requiredIf":[["doc_weight_note",["true"],0]],"activeIf":[["doc_weight_note",["true"],0]],"check":["^\\d+$","should be a whole number"]},"weight_note_copies":{"kind":"text","label":"Weight note: copies","hasRule":1,"requiredIf":[["doc_weight_note",["true"],0]],"activeIf":[["doc_weight_note",["true"],0]],"check":["^\\d+$","should be a whole number"]},"doc_certificate_of_origin":{"kind":"check","label":"Certificate of origin"},"origin_originals":{"kind":"text","label":"Certificate of origin: originals","hasRule":1,"requiredIf":[["doc_certificate_of_origin",["true"],0]],"activeIf":[["doc_certificate_of_origin",["true"],0]],"check":["^\\d+$","should be a whole number"]},"origin_copies":{"kind":"text","label":"Certificate of origin: copies","hasRule":1,"requiredIf":[["doc_certificate_of_origin",["true"],0]],"activeIf":[["doc_certificate_of_origin",["true"],0]],"check":["^\\d+$","should be a whole number"]},"origin_country":{"kind":"text","label":"Showing country of origin as","hasRule":1,"requiredIf":[["doc_certificate_of_origin",["true"],0]],"activeIf":[["doc_certificate_of_origin",["true"],0]],"check":1},"doc_other":{"kind":"check","label":"Other documents"},"other_documents_1":{"kind":"text","label":"Other documents","hasRule":1,"requiredIf":[["doc_other",["true"],0]],"activeIf":[["doc_other",["true"],0]],"check":1},"other_documents_2":{"kind":"text","label":"Other documents (line 2)","activeIf":[["doc_other",["true"],0]],"check":1},"goods_description":{"kind":"long","label":"Goods description (if space is insufficient, attach additional information with Company's stamp, signed by authorised signors)","hasRule":1,"always":1,"check":1},"additional_conditions":{"kind":"long","label":"Additional conditions (if space is insufficient, attach additional information with Company's stamp, signed by authorised signors)","check":1},"bank_charges":{"kind":"check","label":"All bank charges are for account of","hasRule":1,"always":1},"bank_charges_for":{"kind":"radio","label":"Charges for account of","hasRule":1,"requiredIf":[["bank_charges",["true"],0]],"activeIf":[["bank_charges",["true"],0]]},"confirmation":{"kind":"check","label":"Confirmation required"},"confirmation_charges":{"kind":"radio","label":"Confirmation charges","hasRule":1,"requiredIf":[["confirmation",["true"],0]],"activeIf":[["confirmation",["true"],0]]},"post_shipment_financing":{"kind":"check","label":"Please provide us with post-shipment financing under Documentary Credit (\"TR/BRP\") financing for 100% value of all documentary presentations made in compliance with this DC, but where there are discrepancies, we hereby agree to waive all such discrepancies"},"financing_type":{"kind":"radio","label":"Financing","hasRule":1,"requiredIf":[["post_shipment_financing",["true"],0]],"activeIf":[["post_shipment_financing",["true"],0]]},"financing_currency":{"kind":"select","label":"Foreign currency financing in (type of currency)","hasRule":1,"requiredIf":[["financing_type",["Foreign Currency Financing"],0]],"activeIf":[["financing_type",["Foreign Currency Financing"],0]]},"forward_contract_no":{"kind":"text","label":"Forward contract no","hasRule":1,"requiredIf":[["financing_type",["Apply Forward Contract"],0]],"activeIf":[["financing_type",["Apply Forward Contract"],0]],"check":1},"advance_payment":{"kind":"check","label":"We authorise you to debit DC amount in full from our account for advance payment"},"advance_payment_account":{"kind":"text","label":"Account no for advance payment","hasRule":1,"requiredIf":[["advance_payment",["true"],0]],"activeIf":[["advance_payment",["true"],0]],"check":["^\\d[\\d-]*\\d$|^\\d$","is not an account number (digits and - only)"]},"issuance_charges_account":{"kind":"text","label":"Account no for DC issuance charges","hasRule":1,"always":1,"check":["^\\d[\\d-]*\\d$|^\\d$","is not an account number (digits and - only)"]},"authorised_person":{"kind":"text","label":"Name and title of authorised person(s)","check":1}};
var lcDeps = {"application_date":["application_date","latest_shipment_date","expiry_date"],"mode_of_advising":["mode_of_advising"],"applicant_name":["applicant_name"],"applicant_address_1":["applicant_address_1"],"applicant_address_2":["applicant_address_2"],"applicant_address_3":["applicant_address_3"],"applicant_address_4":["applicant_address_4"],"contact_name":["contact_name"],"contact_tel":["contact_tel"],"contact_fax":["contact_fax"],"dc_no":["dc_no"],"bank_code":["bank_code"],"advising_bank_name":["advising_bank_name"],"advising_bank_address_1":["advising_bank_address_1"],"advising_bank_address_2":["advising_bank_address_2"],"advising_bank_address_3":["advising_bank_address_3"],"third_party_name":["third_party_name"],"third_party_address_1":["third_party_address_1"],"third_party_address_2":["third_party_address_2"],"third_party_address_3":["third_party_address_3"],"beneficiary_name":["beneficiary_name"],"beneficiary_address_1":["beneficiary_address_1"],"beneficiary_address_2":["beneficiary_address_2"],"beneficiary_address_3":["beneficiary_address_3"],"beneficiary_address_4":["beneficiary_address_4"],"beneficiary_contact":["beneficiary_contact"],"beneficiary_tel":["beneficiary_tel"],"beneficiary_fax":["beneficiary_fax"],"currency":["currency"],"amount":["amount"],"tolerance":["tolerance","tolerance_plus","tolerance_minus"],"tolerance_plus":["tolerance_plus"],"tolerance_minus":["tolerance_minus"],"price_basis":["price_basis","price_basis_other","insurance_arrangement","insurance_cover_no","insurance_cover_with"],"price_basis_other":["price_basis_other"],"partial_shipment":["partial_shipment"],"transhipment":["transhipment"],"shipment_from":["shipment_from","shipment_from_port","shipment_from_port_2","shipment_from_place","shipment_from_place_2"],"shipment_from_port":["shipment_from_port"],"shipment_from_port_2":["shipment_from_port_2"],"shipment_from_place":["shipment_from_place"],"shipment_from_place_2":["shipment_from_place_2"],"shipment_to":["shipment_to","shipment_to_port","shipment_to_port_2","shipment_to_place","shipment_to_place_2"],"shipment_to_port":["shipment_to_port"],"shipment_to_port_2":["shipment_to_port_2"],"shipment_to_place":["shipment_to_place"],"shipment_to_place_2":["shipment_to_place_2"],"latest_shipment_date":["latest_shipment_date","expiry_date"],"expiry_date":["expiry_date"],"presentation_days":["presentation_days"],"back_to_back":["back_to_back","master_dc_no","master_dc_issued_by"],"master_dc_no":["master_dc_no"],"master_dc_issued_by":["master_dc_issued_by"],"drafts":["drafts","drafts_percent","drafts_at","term_days","term_after","draft_date","term_prepay"],"drafts_percent":["drafts_percent"],"drafts_at":["drafts_at","term_days","term_after","draft_date","term_prepay"],"term_days":["term_days"],"term_after":["term_after"],"draft_date":["draft_date"],"term_prepay":["term_prepay"],"doc_bill_of_lading":["doc_bill_of_lading","bl_made_out_to","bl_made_out_to_other","bl_freight","bl_notify_party"],"bl_made_out_to":["bl_made_out_to","bl_made_out_to_other"],"bl_made_out_to_other":["bl_made_out_to_other"],"bl_freight":["bl_freight"],"bl_notify_party":["bl_notify_party"],"doc_air_waybill":["doc_air_waybill","awb_freight","awb_notify_party"],"awb_freight":["awb_freight"],"awb_notify_party":["awb_notify_party"],"doc_delivery_order":["doc_delivery_order","do_originals","do_copies","do_countersigned_by","do_signature_verified"],"do_originals":["do_originals"],"do_copies":["do_copies"],"do_countersigned_by":["do_countersigned_by"],"do_signature_verified":["do_signature_verified"],"doc_insurance":["doc_insurance","insurance_arrangement","insurance_cover_no","insurance_cover_with"],"insurance_arrangement":["insurance_arrangement","insurance_cover_no","insurance_cover_with"],"insurance_cover_no":["insurance_cover_no"],"insurance_cover_with":["insurance_cover_with"],"doc_beneficiary_certificate":["doc_beneficiary_certificate","bencert_sent_by","bencert_days"],"bencert_sent_by":["bencert_sent_by"],"bencert_days":["bencert_days"],"doc_commercial_invoice":["doc_commercial_invoice","invoice_originals","invoice_copies"],"invoice_originals":["invoice_originals"],"invoice_copies":["invoice_copies"],"doc_packing_list":["doc_packing_list","packing_list_originals","packing_list_copies"],"packing_list_originals":["packing_list_originals"],"packing_list_copies":["packing_list_copies"],"doc_weight_note":["doc_weight_note","weight_note_originals","weight_note_copies"],"weight_note_originals":["weight_note_originals"],"weight_note_copies":["weight_note_copies"],"doc_certificate_of_origin":["doc_certificate_of_origin","origin_originals","origin_copies","origin_country"],"origin_originals":["origin_originals"],"origin_copies":["origin_copies"],"origin_country":["origin_country"],"doc_other":["doc_other","other_documents_1","other_documents_2"],"other_documents_1":["other_documents_1"],"other_documents_2":["other_documents_2"],"goods_description":["goods_description"],"additional_conditions":["additional_conditions"],"bank_charges":["bank_charges","bank_charges_for"],"bank_charges_for":["bank_charges_for"],"confirmation":["confirmation","confirmation_charges"],"confirmation_charges":["confirmation_charges"],"post_shipment_financing":["post_shipment_financing","financing_type","financing_currency","forward_contract_no"],"financing_type":["financing_type","financing_currency","forward_contract_no"],"financing_currency":["financing_currency"],"forward_contract_no":["forward_contract_no"],"advance_payment":["advance_payment","advance_payment_account"],"advance_payment_account":["advance_payment_account"],"issuance_charges_account":["issuance_charges_account"],"authorised_person":["authorised_person"]};
var lcState = {v: {}, st: {}};

// ---------------------------------------------------------------------------------------------------------------------
// lcRules(d, src)
//   d    the PDF document (Acrobat's "this").
//   src  optional. The name of the box that just changed (its blur, its click, or what the calculation says triggered
//        it). Then only the questions that read that box are re-checked, and nothing at all if its value is what the
//        last run saw. No src (opening, Reset form, Check form, saving ...): every question, and every look is
//        written again.
// Returns the array of missing questions' labels, with two extra properties:
//   .bad    the wrong answers, as "<question>: <what is wrong>"
//   .first  the name of the box of the first problem (Check form puts the cursor there)
// ---------------------------------------------------------------------------------------------------------------------
function lcRules(d, src) {
  // ---- Fixed values used below, given names -------------------------------------------------------------------------
  var DISPLAY_HIDDEN = 1;                               // a field's .display is 1 when it is hidden (Acrobat's display.hidden)
  var OFF = "Off";                                      // the value of a tick box or option that is not ticked
  var GREY_LINE = ["G", 0.6];                           // outline of a box that does not apply (mid grey)
  var GREY_FILL = ["G", 0.86];                          // fill of a box that does not apply (light grey)
  var PINK_FILL = ["RGB", 1, 0.88, 0.88];              // fill of a box that is blank or wrong (the outline is red)
  var MONTH_NAMES = "JanFebMarAprMayJunJulAugSepOctNovDec";   // 3 letters each, so month number = position / 3 + 1
  // The characters an answer may contain (letters, digits, space and . , - / ( ) ' : ? + # & @ % and line breaks). This
  // is written as a string, so the backslashes are doubled: it reads [^A-Za-z0-9 .,\-/()':?+#&@%\r\n] ("anything else").
  var OTHER_CHARACTERS = "[^A-Za-z0-9 .,\\-/()':?+#&@%\\r\\n]";

  var model = lcModel;        // the rules table (see the top of this script)
  var state = lcState;        // what the last run saw
  var onlyThese = null;       // null = check every question; otherwise {question id: 1} = check just those
  var cleared = false;        // did this pass clear a box? (then a second pass is needed: another question may read it)
  var i;

  // ---- Which questions to check? ----------------------------------------------------------------------------------
  if (src) {
    // The box's name, without the form's code ("BGA.") that the joined PDF puts in front of every box name.
    var changedName = String(src).replace(/^[A-Z]+\./, "");
    // A tick-any option or a date's drop-down list is named "<question>__<number>" or "<question>__list".
    var partOfGroup = /^(.+)__(\d+|list)$/.exec(changedName);
    // The question that box belongs to ("" if it belongs to none).
    var changedQuestion = "";
    if (model[changedName]) changedQuestion = changedName;
    else if (partOfGroup && model[partOfGroup[1]]) changedQuestion = partOfGroup[1];

    if (lcDeps) {
      var toRecheck = changedQuestion && lcDeps[changedQuestion];   // the list of question ids that read this box
      var changedField = d.getField(changedName);
      var newValue = changedField ? String(changedField.value) : "";
      // Nothing reads this box, or its value is the one the last run saw: there is nothing to do.
      if (!toRecheck || state.v[changedName] === newValue) {
        var nothing = [];
        nothing.bad = [];
        nothing.first = "";
        return nothing;
      }
      state.v[changedName] = newValue;
      onlyThese = {};
      for (i = 0; i < toRecheck.length; i++) onlyThese[toRecheck[i]] = 1;
    }
  }
  // A full run starts from scratch: forget what the last run saw, so every box is checked and written again.
  if (!onlyThese) {
    state.v = {};
    state.st = {};
  }

  // ===================================================================================================================
  // HELPERS. They read the document d and the rules table, and are used by the checks further down.
  // ===================================================================================================================

  // Is value one of the items in list? (Loose == on purpose: a rule may list the number 1 for the text "1".)
  function has(list, value) {
    for (var k = 0; k < list.length; k++) {
      if (list[k] == value) return true;
    }
    return false;
  }

  // A real DD/MM/YYYY date as a Date, or null (blank text, wrong shape, or a day that does not exist such as 31/02/2026).
  // new Date() rolls 31/02 over to 03/03, so a date is real only if the day and month come back unchanged.
  function parseDate(text) {
    var parts = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(text);
    if (!parts) return null;
    var dayOfMonth = +parts[1];
    var monthIndex = parts[2] - 1;   // Date counts months from 0
    var date = new Date(+parts[3], monthIndex, dayOfMonth);
    if (date.getDate() == dayOfMonth && date.getMonth() == monthIndex) return date;
    return null;
  }

  // Is this box on the page? (A date has two boxes: the calendar box, and a drop-down list for when JavaScript is off;
  // lcDates hides one of them.)
  function shown(id) {
    var field = d.getField(id);
    return !!field && field.display != DISPLAY_HIDDEN;
  }

  // Is this answer blank? An answer is text, or a list of ticked options (for tick-any questions).
  function empty(answer) {
    if (typeof answer == "object") return !answer.length;
    return answer === "";
  }

  // --- Reading an answer -----------------------------------------------------------------------------------------

  // A tick-any question: the list of the options that are ticked, e.g. ["Air", "Sea"].
  function tickedOptions(id, question) {
    var ticked = [];
    for (var k = 0; k < question.options.length; k++) {
      var option = d.getField(id + "__" + k);   // one tick box per option
      if (option && option.value != OFF) ticked.push(question.options[k]);
    }
    return ticked;
  }

  // The drop-down list's text "05 Mar 2026" as "05/03/2026" ("" while it still says "Pick a date").
  function dateFromList(text) {
    var parts = /^(\d\d) (\w{3}) (\d{4})$/.exec(text);
    if (!parts) return "";
    var monthNumber = ("0" + (MONTH_NAMES.indexOf(parts[2]) / 3 + 1)).slice(-2);   // "Mar" -> 6 / 3 + 1 -> "03"
    return parts[1] + "/" + monthNumber + "/" + parts[3];
  }

  // The answer to question id, read from the PDF's fields:
  //   tick-any  -> a list of the ticked options
  //   date      -> "DD/MM/YYYY" text, from the calendar box (or from the drop-down list when that is the one showing)
  //   tick box  -> "true" or "false"
  //   anything else -> its text ("" if blank, or an option group with nothing picked)
  function val(id) {
    var question = model[id];
    if (question.kind == "checks") return tickedOptions(id, question);
    if (question.kind == "date") {
      if (shown(id)) return d.getField(id).valueAsString;
      var listBox = d.getField(id + "__list");
      if (listBox) return dateFromList(listBox.valueAsString);
    }
    var field = d.getField(id);
    if (!field) return "";
    if (question.kind == "check") return field.value != OFF ? "true" : "false";
    return field.value == OFF ? "" : String(field.value);
  }

  // The answer to question id, or "" when the form has no such question (other forms lack some of the LC's questions).
  function v(id) {
    if (model[id]) return val(id);
    return "";
  }

  // --- "Applies only if" and "mandatory if" ----------------------------------------------------------------------

  // Does the answer (text, or list of ticked options) include one of the values?
  function matchesAny(answer, values) {
    if (typeof answer != "object") return has(values, answer);
    for (var k = 0; k < answer.length; k++) {
      if (has(values, answer[k])) return true;
    }
    return false;
  }

  // Does any of these conditions hold? Each condition is [question id, values, not]:
  //   not = 0: holds when the answer to that question is one of the values.     e.g. ["mode", ["Air"], 0]
  //   not = 1: holds when it is answered, but not with one of the values.       e.g. ["mode", ["Air"], 1]
  // Used for activeIf ("this question applies only if ...") and requiredIf ("this question is mandatory if ...").
  function any(conditions) {
    for (var k = 0; k < conditions.length; k++) {
      var questionId = conditions[k][0];
      var values = conditions[k][1];
      var negate = conditions[k][2];
      var answer = val(questionId);
      var matches = matchesAny(answer, values);
      if (negate) {
        if (!matches && !empty(answer)) return true;
      } else if (matches) {
        return true;
      }
    }
    return false;
  }

  // Must this question be answered right now? Always (always: true), or when one of its requiredIf conditions holds.
  function mandatory(id) {
    var question = model[id];
    if (question.always) return true;
    return any(question.requiredIf || []);
  }

  // --- Is the typed answer wrong? --------------------------------------------------------------------------------

  // The characters in text that are not allowed, each once, in order of appearance ([] when all are fine).
  function disallowedCharacters(text) {
    var found = text.match(new RegExp(OTHER_CHARACTERS, "g")) || [];
    var each = [];
    for (var k = 0; k < found.length; k++) {
      if (!has(each, found[k])) each.push(found[k]);
    }
    return each;
  }

  // What is wrong with the typed answer, as a sentence for the "bad" list; "" when it is fine or blank.
  // Three checks, in this order, and the first that fails wins:
  //   1. only the allowed characters             "remove ~ ^ (letters, digits and ...)"
  //   2. a date is a real date                   "not a real date (DD/MM/YYYY)"
  //   3. the question's own pattern (a regular expression and its message from the form file)
  // Only questions with a "check" in the rules table are checked at all.
  function wrong(id) {
    var question = model[id];
    var text = "";
    if (question.kind == "date") {
      text = val(id);
    } else {
      var field = d.getField(id);
      if (field) text = field.valueAsString;
    }
    if (!question.check || !text) return "";

    var disallowed = disallowedCharacters(text);
    if (disallowed.length) return "remove " + disallowed.join(" ") + " (letters, digits and . , - / ( ) ' : ? + # & @ % only)";

    if (question.kind == "date") return parseDate(text) ? "" : "not a real date (DD/MM/YYYY)";

    // question.check is [pattern, message], or just the number 1 ("allowed characters only", which was checked above).
    if (question.check.length && !new RegExp(question.check[0]).test(text)) return question.check[1];
    return "";
  }

  // ===================================================================================================================
  // THE RULES ACROSS ANSWERS. Each rule: what it checks (one sentence and an example), then its code. A rule that is
  // broken puts its message on the question: the box turns red, and Check form lists "<question>: <message>".
  // Rules 1-6 are the LC's own (the same as the cross-checks in pdf-template-studio's form/validate.ts); a form without
  // those questions skips them (v() gives "" for a question the form does not have). Rules 7-9 come from the form file
  // (FORM["checks"]), so any form can add its own.
  // ===================================================================================================================

  // Is this text a number such as "1,250.50"? ("abc" and "" are not.)
  function isNumber(text) {
    return /^[\d,]+(\.\d+)?$/.test(text);
  }

  // "1,250.50" -> 1250.5
  function toNumber(text) {
    return Number(text.replace(/,/g, ""));
  }

  // Runs every rule across answers. Returns what is wrong, by question id: {question id: message}.
  function across() {
    var problems = {};
    // The dates as real dates (null while blank or not a date, so a rule that needs both dates is skipped).
    var applicationDate = parseDate(v("application_date"));
    var shipmentDate = parseDate(v("latest_shipment_date"));
    var expiryDate = parseDate(v("expiry_date"));
    var amount = v("amount");
    var priceBasis = v("price_basis");

    // Rule 1: the LC must not expire before the latest shipment date.
    //         e.g. expiry 01/03/2026, latest shipment 15/03/2026 -> expiry_date: is before the latest shipment date
    if (shipmentDate && expiryDate && expiryDate < shipmentDate) {
      problems.expiry_date = "is before the latest shipment date";
    }
    // Rule 2: the LC must not expire before the application date (checked only when rule 1 is fine, so a question
    //         never shows two messages).
    //         e.g. application 10/03/2026, expiry 01/03/2026 (no shipment date yet) -> expiry_date: is before the application date
    else if (applicationDate && expiryDate && expiryDate < applicationDate) {
      problems.expiry_date = "is before the application date";
    }

    // Rule 3: the latest shipment date must not be before the application date.
    //         e.g. application 10/03/2026, latest shipment 05/03/2026 -> latest_shipment_date: is before the application date
    if (applicationDate && shipmentDate && shipmentDate < applicationDate) {
      problems.latest_shipment_date = "is before the application date";
    }

    // Rule 4: the application date must not be in the future.
    //         e.g. today is 27/11/2026, application 28/11/2026 -> application_date: is in the future
    if (applicationDate && applicationDate.getTime() > new Date().getTime()) {
      problems.application_date = "is in the future";
    }

    // Rule 5: the amount must be more than zero (only once it is a number).
    //         e.g. amount 0.00 -> amount: must be more than zero
    if (isNumber(amount) && !(toNumber(amount) > 0)) {
      problems.amount = "must be more than zero";
    }

    // Rule 6: "insurance for FOB/CFR/FCA/CPT" must be left blank when the price basis is CIF or CIP
    //         (with CIF and CIP the beneficiary arranges the insurance).
    //         e.g. price basis CIF and an insurance arrangement filled in ->
    //              insurance_arrangement: is only for FOB/CFR/FCA/CPT, but price basis is CIF (the beneficiary insures)
    if (v("insurance_arrangement") && (priceBasis == "CIF" || priceBasis == "CIP")) {
      problems.insurance_arrangement = "is only for FOB/CFR/FCA/CPT, but price basis is " + priceBasis + " (the beneficiary insures)";
    }

    // Rules 7-9: the form file's own checks. Each is {t: kind, a: question, m: message, ...}, tried in the order the
    // form file lists them (a later one replaces an earlier message on the same question).
    var formChecks = [];
    for (var j = 0; j < formChecks.length; j++) {
      var check = formChecks[j];

      // Rule 7 ("order"): date a must not be before date b (with s: true it must be after b: the same day is not enough).
      //         e.g. {t: "order", a: "expiry_date", b: "issue_date", m: "is before the issue date"},
      //         expiry 01/03/2026, issue 05/03/2026 -> expiry_date: is before the issue date
      if (check.t == "order") {
        var dateA = parseDate(v(check.a));
        var dateB = parseDate(v(check.b));
        if (dateA && dateB) {
          var tooEarly = check.s ? dateA <= dateB : dateA < dateB;
          if (tooEarly) problems[check.a] = check.m;
        }
      }

      // Rule 8 ("range"): number a must be between lo and hi.
      //         e.g. {t: "range", a: "tolerance", lo: 0, hi: 10, m: "must be between 0 and 10"}, tolerance 15 -> that message
      if (check.t == "range") {
        var rangeAnswer = v(check.a);
        if (isNumber(rangeAnswer)) {
          var rangeNumber = toNumber(rangeAnswer);
          if (rangeNumber < check.lo || rangeNumber > check.hi) problems[check.a] = check.m;
        }
      }

      // Rule 9 ("lengths"): a's digits (ignoring spaces, dashes ...) must be one of the allowed lengths, which can depend
      //         on the answer to b (e.g. an account number's length by currency; "*" = any other answer).
      //         e.g. {t: "lengths", a: "account", b: "currency", by: {"USD": [10], "*": [8, 9]}, m: "..."},
      //         currency USD and an account number of 9 digits -> that message
      if (check.t == "lengths") {
        var digits = v(check.a).replace(/\D/g, "");
        var otherAnswer = v(check.b);
        var allowedLengths = check.by.hasOwnProperty(otherAnswer) ? check.by[otherAnswer] : check.by["*"];
        if (digits && allowedLengths && allowedLengths.length && !has(allowedLengths, digits.length)) {
          problems[check.a] = check.m;
        }
      }
    }
    return problems;
  }

  // ===================================================================================================================
  // WRITING THE LOOK OF A BOX
  // ===================================================================================================================

  // Empties a box of a question that does not apply, so an answer can't stay behind in a locked question.
  //   field  the box;  kind  its question's kind;  boxName  the box's name.
  // Sets "cleared" when it really changed an answer (a second pass then re-checks the questions that read it).
  function clearAnswer(field, kind, boxName) {
    if (kind == "check" || kind == "checks" || kind == "radio") {
      if (field.value != OFF) {
        field.value = OFF;
        cleared = true;
      }
    } else if (field.type == "combobox" && /__list$/.test(field["name"])) {
      // A date's drop-down list: back to its first line, "Pick a date".
      if (field.currentValueIndices != 0) {
        field.currentValueIndices = 0;
        cleared = true;
      }
    } else if (field.value !== "" && field.value != null) {
      field.value = "";
      cleared = true;
    }
    delete state.v[boxName];   // the next change of this box is new to the next run
  }

  // A box of a question that does not apply: grey, locked (the caller does that), answer cleared.
  function paintGrey(field, kind, boxName) {
    clearAnswer(field, kind, boxName);
    field.lineWidth = 1;
    field.strokeColor = GREY_LINE;
    field.fillColor = GREY_FILL;
  }

  // A box of a question that applies. A problem (blank mandatory, or wrong): red outline, pink fill. Fine: black outline
  // and white fill; or, for an "underlined" question (just a line to write on): no outline, a transparent fill, and
  // only its underline.
  function paintActive(field, underlined, problem) {
    field.lineWidth = problem || !underlined ? 1 : 0;
    if (problem) {
      field.strokeColor = color.red;
      field.fillColor = PINK_FILL;
    } else if (underlined) {
      field.strokeColor = color.transparent;
      field.fillColor = color.transparent;
    } else {
      field.strokeColor = color.black;
      field.fillColor = color.white;
    }
  }

  // The names of the boxes on the page that belong to a question:
  //   tick-any  one box per option ("<id>__0", "<id>__1" ...)
  //   a date    its calendar box, or its drop-down list ("<id>__list") when the list is the one showing
  //   otherwise the question's own box
  function boxesOf(id, question) {
    var names = [id];
    if (question.kind == "checks") {
      names = [];
      for (var k = 0; k < question.options.length; k++) names.push(id + "__" + k);
    }
    if (question.kind == "date" && !shown(id) && d.getField(id + "__list")) names = [id + "__list"];
    return names;
  }

  // ===================================================================================================================
  // GO THROUGH EVERY QUESTION, in 5 steps, and colour (and lock) its boxes.
  // ===================================================================================================================
  var missing = [];        // labels of the mandatory questions still blank
  var bad = [];            // "<label>: <what is wrong>" for each wrong answer
  var firstProblem = "";   // the box of the first question with a problem
  var id, question, applies, required, problem, whatsWrong, boxNames, lookKey, field, boxName, wordsField, words;
  var calculateWas = d.calculate;
  d.calculate = false;   // every write below would otherwise run the calculation again
  try {
    // A second pass only if a box was cleared (a later question may read it). Three passes at most.
    for (var pass = 0; pass < 3; pass++) {
      missing = [];
      bad = [];
      firstProblem = "";
      cleared = false;
      var wrongAcross = across();   // what the rules across answers found, by question id

      for (id in model) {
        question = model[id];
        if (!question.hasRule && !question.check && !question.activeIf) continue;   // no rule, no format: nothing to do
        if (onlyThese && !onlyThese[id]) continue;                                  // this change can't affect it

        // Step 1: does the question apply? (activeIf in the form file, e.g. "only when Term is picked")
        applies = !question.activeIf || any(question.activeIf);

        // Step 2: is it mandatory now, and still blank? (always: true, or requiredIf in the form file)
        required = false;
        if (question.hasRule && applies) required = mandatory(id);
        if (required) {
          if (question.kind == "check") problem = val(id) != "true";   // a tick box is "blank" when not ticked
          else problem = empty(val(id));
        } else {
          problem = false;
        }
        if (problem) missing.push(question.label);

        // Step 3: is the answer wrong? (its format, or one of the rules across answers above)
        whatsWrong = "";
        if (applies) whatsWrong = wrong(id) || wrongAcross[id] || "";
        if (whatsWrong) {
          bad.push(question.label + ": " + whatsWrong);
          problem = true;
        }

        // Step 4: which boxes on the page are this question's (tick-any: one per option; a date: its list or its box)
        boxNames = boxesOf(id, question);
        if (problem && !firstProblem) firstProblem = boxNames[0];

        // Step 5: colour each box. Doesn't apply: grey, locked, answer cleared. Problem: red outline, pink fill.
        //         Fine: black outline (or just its underline), white fill.
        // lookKey sums up the look in two letters: "r" if marked Required, then "p" (problem), "o" (fine) or
        // "g" (greyed). A box that already has this look is skipped: every write to Acrobat is slow.
        lookKey = (required && problem ? "r" : "-") + (applies ? (problem ? "p" : "o") : "g");
        for (i = 0; i < boxNames.length; i++) {
          boxName = boxNames[i];
          field = d.getField(boxName);
          if (!field) continue;
          if (state.st[boxName] === lookKey) continue;
          state.st[boxName] = lookKey;
          // Required only while blank or wrong: Acrobat outlines Required boxes in red even when they are filled.
          if (question.hasRule && question.kind != "checks") field.required = !!(required && problem);
          if (question.activeIf) field.readonly = !applies;   // locked until it applies
          if (applies) paintActive(field, question.underlined, problem);
          else paintGrey(field, question.kind, boxName);
        }
      }

      // Amounts in words (a question with words: [amount id, currency id]), as the old bill of exchange wrote them.
      for (id in model) {
        question = model[id];
        if (!question.words) continue;
        if (onlyThese && !onlyThese[id]) continue;
        wordsField = d.getField(id);
        if (!wordsField) continue;
        words = lcWords(v(question.words[0]), v(question.words[1] || ""));
        if (wordsField.value != words) {
          wordsField.value = words;
          delete state.v[id];
        }
      }

      if (!cleared) break;
    }
  } catch (e) {
    console.println("lcRules: " + e);
  }
  d.calculate = calculateWas;

  missing.bad = bad;
  missing.first = firstProblem;   // the field of the first problem, for "Check form" to go to
  return missing;
}

// ---------------------------------------------------------------------------------------------------------------------
// lcWords(amount, currency): an amount in words.
//   "1,250.50", "USD" -> "USD One Thousand Two Hundred Fifty and Fifty cents only"
//   "" or text that is not an amount -> "" (the words stay blank until the amount is filled in)
// ---------------------------------------------------------------------------------------------------------------------
function lcWords(amount, currency) {
  var ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
              "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  var TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  var SCALES = ["", " Thousand", " Million", " Billion", " Trillion"];   // the name of each group of 3 digits

  // Whole part and (up to 2-digit) cents part: "1250.5" -> "1250" and "5". No commas or spaces are allowed to remain.
  var amountText = String(amount).replace(/[, ]/g, "");
  var parts = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amountText);
  if (!parts) return "";

  // 1 to 999 in words: 305 -> "Three Hundred Five", 42 -> "Forty Two".
  function belowThousand(number) {
    var hundreds = Math.floor(number / 100);
    var rest = number % 100;
    var pieces = [];
    if (hundreds) pieces.push(ONES[hundreds] + " Hundred");
    if (rest >= 20) {
      var tens = TENS[Math.floor(rest / 10)];
      if (rest % 10) tens = tens + " " + ONES[rest % 10];
      pieces.push(tens);
    } else if (rest) {
      pieces.push(ONES[rest]);
    }
    return pieces.join(" ");
  }

  // A string of digits in words: "1250" -> "One Thousand Two Hundred Fifty"; "" or "000" -> "Zero".
  // It works from the right in groups of 3 digits (units, thousands, millions ...) and skips an all-zero group.
  function digitsInWords(digits) {
    digits = digits.replace(/^0+/, "");
    if (!digits) return "Zero";
    var groups = [];
    for (var scale = 0; digits.length; scale++) {
      var group = +digits.slice(-3);
      digits = digits.slice(0, -3);
      if (group) groups.unshift(belowThousand(group) + SCALES[scale]);
    }
    return groups.join(" ");
  }

  var words = digitsInWords(parts[1]);
  if (parts[2] && +parts[2]) {
    // One digit after the point is tenths of a dollar: "0.5" means 50 cents, not 5.
    var cents = parts[2].length == 1 ? parts[2] + "0" : parts[2];
    words += " and " + digitsInWords(cents) + " cents";
  }
  return (currency ? currency + " " : "") + words + " only";
}

// ---------------------------------------------------------------------------------------------------------------------
// lcDates(d): Acrobat only. Shows each date's calendar box and hides its drop-down list.
// A date question has two boxes: the calendar box (works with JavaScript) and a plain drop-down list of real dates
// (the fallback for when JavaScript is off). The list below is filled in when the PDF is built: the ids of the date questions.
// ---------------------------------------------------------------------------------------------------------------------
function lcDates(d) {
  var dateIds = ["application_date","latest_shipment_date","expiry_date","draft_date"];
  for (var i = 0; i < dateIds.length; i++) {
    var calendarBox = d.getField(dateIds[i]);
    if (!calendarBox) continue;
    calendarBox.display = display.visible;
    var listBox = d.getField(dateIds[i] + "__list");
    if (listBox) listBox.display = display.hidden;
  }
}

// When the warning before saving / printing was last closed. Some Acrobat versions (seen on Windows) fire the
// save / print events several times in a row; the warning then shows once, not once per event.
var lcWarnedAt = 0;

// On opening in Acrobat: show the calendars, and set every box's colour and lock.
if (typeof app != "undefined" && /^(Exchange|Reader)/.test(app.viewerType)) {
  lcDates(this);
  lcRules(this);
}

// =====================================================================================================================
// THE QR CODES' TEXT
//
// What this does: lcPayload(doc) reads every answered question and returns them as one piece of text (JSON), which
// the QR codes then carry. JSON is plain text that a computer can read back, like this:
//   {"form": "LC-01", "version": "1.0", "saved": "2026-11-27T10:30", "complete": true, "data": {"amount": "1,250.50", ...}}
// How answers look in it: a ticked tick box becomes true. A "tick any" question becomes the list of options that are
// ticked. A blank question is left out.
//
// How big it can be: one QR code holds 2,300 bytes (LC_QR_CAP). A longer text needs more codes, at most 16 (LC_QR_MAX):
// 16 is the most that "structured append" allows (that is the part of the QR standard that lets codes say "I am
// code 2 of 3"). lcDrawQr cuts the text into slices, one per code.
// The text is padded with spaces so it fills the codes it needs exactly: 2,300, 4,600 ... 36,800 bytes.
// Only if the answers are longer than 16 codes can hold, the long paragraphs are shortened (and listed in "truncated").
//
// The names FORM, VERSION, GROUPS and LONG in capitals below are filled in when the PDF is built (document_script in
// pdf_writer.py).
// =====================================================================================================================
var LC_QR_CAP = 2300;   // bytes in one QR code
var LC_QR_MAX = 16;     // most codes for one form

// The text as UTF-8 bytes, one character per byte (what really goes into the codes).
// Example: "A" is 1 byte, but a letter with an accent is 2 bytes, so the byte count can be bigger than the letter count.
function lcBytes(text) {
  return unescape(encodeURIComponent(text));
}

// How many codes this text needs (0 for no text). Example: 2,301 bytes -> 2 codes.
function lcCodes(text) {
  if (!text) return 0;
  return Math.ceil(lcBytes(text).length / LC_QR_CAP);
}

// ---------------------------------------------------------------------------------------------------------------------
// lcPayload(d): every answered question as JSON text (see above).
//   d  the PDF document.
// Returns the text, padded with spaces to fill whole codes.
// ---------------------------------------------------------------------------------------------------------------------
function lcPayload(d) {
  var GROUPS = {"bencert_sent_by": ["faxed","mailed","couriered"]};     // "tick any" questions: question id -> its list of options, in order
  var LONG_QUESTIONS = ["goods_description","additional_conditions"]; // the long paragraph questions, which may be shortened if the answers are too big
  var budget = LC_QR_MAX * LC_QR_CAP;   // the most bytes 16 codes can hold
  var data = {};                 // the answers: question id -> answer
  var truncated = [];            // ids of the questions that had to be shortened
  var i, n, field, partOfGroup, answer, check;
  var now = new Date();

  // 1. Go through every box in the PDF and note the answers.
  // The box's name is kept in the variable n and the line below is written in exactly this way on purpose: build_all.py
  // finds that line and adds a filter to it, so that one form of the joined PDF does not read another form's boxes.
  for (i = 0; i < d.numFields; i++) {
    n = d.getNthFieldName(i);
    // Skip the form's own helper boxes (their names start with two underscores), the date drop-down lists, and the
    // extra QR code pages' rows.
    if (/^__/.test(n) || /__list$/.test(n) || /__qrx_/.test(n)) continue;
    field = d.getField(n);
    if (!field || field.type == "button" || field.type == "signature") continue;

    // One option of a "tick any" question is named "<question>__<number>": add the option to the question's list.
    partOfGroup = /^(.+)__(\d+)$/.exec(n);
    if (partOfGroup && GROUPS[partOfGroup[1]]) {
      if (field.value != "Off") {
        if (!data[partOfGroup[1]]) data[partOfGroup[1]] = [];
        data[partOfGroup[1]].push(GROUPS[partOfGroup[1]][+partOfGroup[2]]);
      }
      continue;
    }
    // A single tick box: true when ticked, left out when not.
    if (field.type == "checkbox") {
      if (field.value != "Off") data[n] = true;
      continue;
    }
    // Option buttons give the picked option; text boxes give the text without blanks at the start and end.
    if (field.type == "radiobutton") {
      answer = field.value == "Off" ? "" : String(field.value);
    } else {
      answer = String(field.valueAsString).replace(/^\s+|\s+$/g, "");
    }
    if (answer !== "") data[n] = answer;
  }

  // 2. Is the form complete (nothing missing, nothing wrong)? Ask the rules engine.
  var complete = true;
  if (typeof lcRules == "function") {
    check = lcRules(d);
    complete = !check.length && !(check.bad || []).length;
  }

  // 3. Put it together. Two digits for a date part: 5 -> "05".
  function twoDigits(number) {
    return ("0" + number).slice(-2);
  }
  var saved = now.getFullYear() + "-" + twoDigits(now.getMonth() + 1) + "-" + twoDigits(now.getDate()) +
              "T" + twoDigits(now.getHours()) + ":" + twoDigits(now.getMinutes());
  var out = {"form": "LC-01", "version": "1.0", "saved": saved, "complete": complete, "data": data};

  // 4. 16 codes hold 36,800 bytes. Only if the answers are longer still: shorten the long paragraphs, one after the
  // other, until it fits, and say which ones in "truncated".
  var tooMany;
  for (i = 0; i < LONG_QUESTIONS.length && lcBytes(JSON.stringify(out)).length > budget; i++) {
    var longId = LONG_QUESTIONS[i];
    if (!data[longId]) continue;
    truncated.push(longId);
    out.truncated = truncated;
    // How many bytes are still too many (plus 3 for the "..." that marks the cut).
    tooMany = lcBytes(JSON.stringify(out)).length - budget + 3;
    if (tooMany < data[longId].length) data[longId] = data[longId].slice(0, data[longId].length - tooMany) + "...";
    else data[longId] = "...";
  }

  // 5. Pad with spaces up to whole codes (2,300 bytes each). Letters that take 2 or more bytes make the byte count
  // bigger than the character count, so that difference is taken off the number of spaces.
  var text = JSON.stringify(out);
  var byteCount = lcBytes(text).length;
  var wantedLength = Math.max(1, Math.ceil(byteCount / LC_QR_CAP)) * LC_QR_CAP - (byteCount - text.length);
  while (text.length < wantedLength) text += " ";
  return text;
}

// =====================================================================================================================
// THE QR CODE ENCODER (standard QR code, no library needed)
//
// What this does: lcQrMatrix(bytes, part) works out the picture of ONE QR code: a square grid of 177 x 177 tiny
// squares, each dark or light. It returns the grid as rows: grid[y][x] is true for a dark square.
//   bytes  the text as UTF-8 bytes, one character per byte (what lcBytes gives).
//   part   null for a single code, or [index, total, parity] for one of several codes. This is "structured append":
//          each code says "I am code <index> of <total>", and "parity" is a check number of the whole text (every byte
//          XORed together), so a scanner that knows structured append can join the codes in the right order. Any other
//          scanner just reads each code's text on its own, and the texts are joined in order.
// What kind of code: version 40 (the biggest, 177 x 177), error correction level M (about 15% of it can be damaged
// and it still reads), byte mode, mask 0. At most 2,329 bytes per code.
//
// How it is built, in order (the same steps as the QR standard):
//   1. Draw the fixed patterns every QR code has (the three big corner squares, the alignment squares, the dotted
//      lines, and the little strips that say what kind of code it is).
//   2. Turn the bytes into a long row of bits, and pad it to the size the code has room for.
//   3. Add error correction ("Reed-Solomon": extra check bytes worked out from the data, so a scanner can fix a
//      smudged or torn code).
//   4. Pour the bits into the free squares in a zigzag order.
//   5. Flip every second square ("mask 0"), which stops large plain areas that scanners find hard to read.
// The maths below must not be changed, or the codes will not scan.
// =====================================================================================================================
function lcQrMatrix(text, part) {
  var SIZE = 177;                    // squares across (and down) of a version 40 code
  var DATA_CODEWORDS = 2334;         // bytes of answers a version 40 / level M code holds (a "codeword" is one byte)
  var BLOCKS = 49;                   // the data is cut into 49 blocks, each with its own error correction
  var SHORT_BLOCKS = 18;             // the first 18 blocks have 47 data bytes; the other 31 have 48
  var ECC_PER_BLOCK = 28;            // error correction bytes added to each block
  var bytes = [];                    // the text as numbers 0 to 255
  var grid = [];                     // grid[y][x]: is this square dark?
  var isFixed = [];                  // isFixed[y][x]: is this square part of a fixed pattern (so data must not go there)?
  var i, j, x, y;

  for (i = 0; i < text.length; i++) bytes.push(text.charCodeAt(i) & 255);
  // Start with a grid of light squares, none of them fixed.
  for (y = 0; y < SIZE; y++) {
    grid.push([]);
    isFixed.push([]);
    for (x = 0; x < SIZE; x++) {
      grid[y].push(false);
      isFixed[y].push(false);
    }
  }

  // Paint one square of a fixed pattern.
  function setFixed(x, y, dark) {
    grid[y][x] = dark;
    isFixed[y][x] = true;
  }

  // Multiply two numbers "in GF(256)": the special arithmetic of Reed-Solomon, where every number is one byte and the
  // answer is one byte again (0x11D is the rule that keeps it inside a byte). Used only for the error correction.
  function multiply(a, b) {
    var product = 0;
    for (var k = 7; k >= 0; k--) {
      product = (product << 1) ^ ((product >>> 7) * 0x11D);
      product ^= ((b >>> k) & 1) * a;
    }
    return product;
  }

  // Bit number k of a number, as true / false.
  function bit(value, k) {
    return ((value >>> k) & 1) != 0;
  }

  // ---- 1. The fixed patterns ------------------------------------------------------------------------------------

  // The two dotted "timing" lines (row 6 and column 6): dark, light, dark, light ...
  for (i = 0; i < SIZE; i++) {
    setFixed(6, i, i % 2 == 0);
    setFixed(i, 6, i % 2 == 0);
  }

  // A "finder": the big square-in-a-square a scanner looks for, centred on (cx, cy), with its light border.
  // Measured from the middle in squares: distance 0 and 1 dark (the solid middle), 2 light, 3 dark, 4 light (the border).
  function drawFinder(cx, cy) {
    for (var dy = -4; dy <= 4; dy++) {
      for (var dx = -4; dx <= 4; dx++) {
        var distance = Math.max(Math.abs(dx), Math.abs(dy));
        var fx = cx + dx;
        var fy = cy + dy;
        if (fx >= 0 && fx < SIZE && fy >= 0 && fy < SIZE) setFixed(fx, fy, distance != 2 && distance != 4);
      }
    }
  }
  drawFinder(3, 3);               // top left
  drawFinder(SIZE - 4, 3);        // top right
  drawFinder(3, SIZE - 4);        // bottom left

  // "Alignment" patterns: small squares that help a scanner straighten a big code. Their centres are at every
  // combination of these positions, except the three that would land on a finder.
  var ALIGNMENT_AT = [6, 30, 58, 86, 114, 142, 170];
  var last = ALIGNMENT_AT.length - 1;
  for (i = 0; i < ALIGNMENT_AT.length; i++) {
    for (j = 0; j < ALIGNMENT_AT.length; j++) {
      if ((i == 0 && j == 0) || (i == 0 && j == last) || (i == last && j == 0)) continue;
      for (var ay = -2; ay <= 2; ay++) {
        for (var ax = -2; ax <= 2; ax++) {
          setFixed(ALIGNMENT_AT[i] + ax, ALIGNMENT_AT[j] + ay, Math.max(Math.abs(ax), Math.abs(ay)) != 1);
        }
      }
    }
  }

  // The "format" strip: 15 bits that say "error correction M, mask 0", written twice (next to two of the finders).
  // The 5 bits of information are all zero here (M is 00, mask 0 is 000), so the 10 check bits are zero too; the
  // standard then XORs the 15 bits with 0x5412 so the strip is never all light.
  var formatCheck = 0;
  for (i = 0; i < 10; i++) formatCheck = (formatCheck << 1) ^ ((formatCheck >>> 9) * 0x537);
  var formatBits = ((0 << 10) | formatCheck) ^ 0x5412;
  for (i = 0; i <= 5; i++) setFixed(8, i, bit(formatBits, i));
  setFixed(8, 7, bit(formatBits, 6));
  setFixed(8, 8, bit(formatBits, 7));
  setFixed(7, 8, bit(formatBits, 8));
  for (i = 9; i < 15; i++) setFixed(14 - i, 8, bit(formatBits, i));
  for (i = 0; i < 8; i++) setFixed(SIZE - 1 - i, 8, bit(formatBits, i));
  for (i = 8; i < 15; i++) setFixed(8, SIZE - 15 + i, bit(formatBits, i));
  setFixed(8, SIZE - 8, true);   // the one square that is always dark

  // The "version" strip: 18 bits that say "version 40" (12 check bits worked out from the number 40), written twice.
  var versionCheck = 40;
  for (i = 0; i < 12; i++) versionCheck = (versionCheck << 1) ^ ((versionCheck >>> 11) * 0x1F25);
  var versionBits = (40 << 12) | versionCheck;
  for (i = 0; i < 18; i++) {
    var vx = SIZE - 11 + i % 3;
    var vy = Math.floor(i / 3);
    setFixed(vx, vy, bit(versionBits, i));
    setFixed(vy, vx, bit(versionBits, i));
  }

  // ---- 2. The data bits ------------------------------------------------------------------------------------------
  // In order: (for one of several codes: mode 0011 = "structured append", this code's index, the total - 1, the
  // parity), then mode 0100 = "bytes follow", the length in 16 bits, the bytes, a terminator of up to 4 zero bits,
  // then padding to 2,334 bytes.
  var bits = [];
  var capacityBits = DATA_CODEWORDS * 8;
  // Add a number as n bits, biggest bit first.
  function putBits(value, count) {
    for (var k = count - 1; k >= 0; k--) bits.push((value >>> k) & 1);
  }
  if (part) {
    putBits(3, 4);
    putBits(part[0], 4);
    putBits(part[1] - 1, 4);
    putBits(part[2], 8);
  }
  putBits(4, 4);
  putBits(bytes.length, 16);
  for (i = 0; i < bytes.length; i++) putBits(bytes[i], 8);
  if (bits.length > capacityBits) throw new Error("too much text for one QR code (" + bytes.length + " bytes)");
  putBits(0, Math.min(4, capacityBits - bits.length));   // terminator
  while (bits.length % 8) bits.push(0);                   // finish the last byte
  // Eight bits at a time -> bytes ("data codewords").
  var data = [];
  for (i = 0; i < bits.length; i += 8) {
    var byteValue = 0;
    for (j = 0; j < 8; j++) byteValue = (byteValue << 1) | bits[i + j];
    data.push(byteValue);
  }
  // Fill what is left with the two padding bytes the standard asks for, 0xEC and 0x11 in turn.
  for (i = 0; data.length < DATA_CODEWORDS; i++) data.push(i % 2 ? 0x11 : 0xEC);

  // ---- 3. Error correction (Reed-Solomon) ---------------------------------------------------------------------
  // 49 blocks (18 of 47 data bytes and 31 of 48), each given 28 error correction bytes.
  // First the "generator": a list of 28 numbers that every block is divided by (worked out once).
  var generator = [];
  var root = 1;
  for (i = 0; i < ECC_PER_BLOCK - 1; i++) generator.push(0);
  generator.push(1);
  for (i = 0; i < ECC_PER_BLOCK; i++) {
    for (j = 0; j < ECC_PER_BLOCK; j++) {
      generator[j] = multiply(generator[j], root);
      if (j + 1 < ECC_PER_BLOCK) generator[j] ^= generator[j + 1];
    }
    root = multiply(root, 2);
  }
  // Then each block: its data bytes followed by its error correction bytes (the remainder of the division).
  var blocks = [];
  var position = 0;   // where this block starts in data
  for (i = 0; i < BLOCKS; i++) {
    var blockLength = i < SHORT_BLOCKS ? 47 : 48;
    var blockData = data.slice(position, position + blockLength);
    var ecc = [];
    position += blockLength;
    for (j = 0; j < ECC_PER_BLOCK; j++) ecc.push(0);
    for (j = 0; j < blockData.length; j++) {
      var factor = blockData[j] ^ ecc.shift();
      ecc.push(0);
      for (var eccIndex = 0; eccIndex < ECC_PER_BLOCK; eccIndex++) ecc[eccIndex] ^= multiply(generator[eccIndex], factor);
    }
    // A short block gets a -1 "no byte here" marker so that all blocks are equally long when interleaved below.
    if (i < SHORT_BLOCKS) blockData.push(-1);
    blocks.push(blockData.concat(ecc));
  }
  // Interleave: first byte of block 1, first byte of block 2 ... then the second byte of each block, and so on
  // (skipping the "no byte here" markers). This spreads a smudge over many blocks, so each can still be repaired.
  var codewords = [];
  for (i = 0; i < blocks[0].length; i++) {
    for (j = 0; j < BLOCKS; j++) {
      if (blocks[j][i] != -1) codewords.push(blocks[j][i]);
    }
  }

  // ---- 4. Place the bits, and 5. mask 0 -----------------------------------------------------------------------
  // The standard fills the grid two columns at a time, from the bottom right, going up and then down in turn (a
  // zigzag), and skips squares that belong to a fixed pattern. Column 6 is skipped (the timing line).
  var bitNumber = 0;
  for (var rightColumn = SIZE - 1; rightColumn >= 1; rightColumn -= 2) {
    if (rightColumn == 6) rightColumn = 5;
    for (var step = 0; step < SIZE; step++) {
      for (j = 0; j < 2; j++) {
        x = rightColumn - j;
        var goingUp = ((rightColumn + 1) & 2) == 0;
        y = goingUp ? SIZE - 1 - step : step;
        if (!isFixed[y][x] && bitNumber < codewords.length * 8) {
          grid[y][x] = ((codewords[bitNumber >>> 3] >>> (7 - (bitNumber & 7))) & 1) != 0;
          bitNumber++;
        }
      }
    }
  }
  // Mask 0: flip every square where x + y is even (only squares that are not fixed patterns).
  for (y = 0; y < SIZE; y++) {
    for (x = 0; x < SIZE; x++) {
      if (!isFixed[y][x] && (x + y) % 2 == 0) grid[y][x] = !grid[y][x];
    }
  }
  return grid;
}

// =====================================================================================================================
// THE PAGES THE CODES GO ON
//
// A code is drawn with text boxes, one box per row of the code. Each row box is read-only and holds the letter "n" in
// the ZapfDingbats font (which prints as a black square) for each dark square, and a space for each light square.
//   Codes 1 and 2 sit on the form's QR code page: rows "__qr1_0" ... "__qr1_176" and "__qr2_0" ... "__qr2_176".
//   Codes 3 to 16 go two to a page on extra pages, which exist only while they are needed. lcDrawQr copies the hidden
//   page template "qrx" (its rows are "__qrx_1_0" ... "__qrx_2_176") after the last page, with Template.spawn, and
//   deletes the extra pages it no longer needs. If the viewer refuses to delete a page, the page stays, empty and
//   marked "not used", and is left out of printing (see lcLastPage).
// The viewer renames a copied page's boxes (bRename: true), but each name still ends with the template's name, so
// lcExtra finds them by that ending.
// Do not write the call to get a field with the usual dot-and-name spelling for those boxes: build_all.py rewrites the
// usual spelling, to add the form's code in the joined PDF. The square-bracket spelling d["getField"](name) is left alone,
// and the names found are already complete.
// =====================================================================================================================

// lcExtra(d): finds the extra QR pages that exist now.
// Returns a list in page order: [{p: the start of that page's box names, page: its page number}].
function lcExtra(d) {
  var pages = [];
  var i, fieldName, nameParts, field;
  var qrBox = d.getField("__qr");
  var qrPage = qrBox && typeof qrBox.page == "number" ? qrBox.page : -1;   // the extras come after this page
  for (i = 0; i < d.numFields; i++) {
    fieldName = d.getNthFieldName(i);
    nameParts = /^(.*)__qrx_1_0$/.exec(fieldName);
    // Not the first row of a QR page, or the template's own row (its start is "" or just the form's code): skip.
    if (!nameParts || /^([A-Z]+\.)?$/.test(nameParts[1])) continue;
    field = d["getField"](fieldName);
    if (field && typeof field.page == "number" && field.page > qrPage && field.page < d.numPages) {
      pages.push({p: nameParts[1], page: field.page});
    }
  }
  pages.sort(function (first, second) { return first.page - second.page; });
  return pages;
}

// lcSlot(d, extraPages, j): the place for code number j (0 = the first code).
// Returns a function: what -> that slot's box, where what is a row number 0-176, or "label", or "frame".
// Example: for code 1 (j = 0), lcSlot(d, pages, 0)("label") is the box "__qr1_label".
function lcSlot(d, extraPages, j) {
  var prefix = null;       // null = a code on the form's own QR page; otherwise the start of an extra page's box names
  var rowName;             // the part of the box name that says which code of the page this is
  if (j < 2) {
    rowName = "__qr" + (j + 1);
  } else {
    rowName = "__qrx_" + ((j - 2) % 2 + 1);                       // two codes to an extra page: 1st and 2nd
    var page = extraPages[(j - 2) >> 1];                          // which extra page (undefined if it does not exist)
    prefix = page && page.p;
  }
  return function (what) {
    if (prefix === null) return d.getField(rowName + "_" + what);
    if (prefix === undefined) return null;
    return d["getField"](prefix + rowName + "_" + what);
  };
}

// How many extra pages n codes need. Example: 2 codes -> 0 extra pages; 3 or 4 codes -> 1; 5 or 6 -> 2.
function lcPagesFor(codeCount) {
  return codeCount > 2 ? Math.ceil((codeCount - 2) / 2) : 0;
}

// The last page of the form as printed: the QR code page, plus the extra pages that the codes of this text use.
function lcLastPage(d, text) {
  return d.getField("__qr").page + lcPagesFor(lcCodes(text));
}

// lcQrCheck(d, text): are the codes on the pages exactly the codes this text needs?
// Used before printing. Returns "" when all is well (every code in use has its first row drawn, and every other
// slot is empty); otherwise a sentence that says what is wrong, e.g. "QR code 2 is blank".
function lcQrCheck(d, text) {
  var needed = lcCodes(text);
  var extraPages = lcExtra(d);
  var j, firstRow;
  if (extraPages.length < lcPagesFor(needed)) return "the extra QR code pages are missing";
  for (j = 0; j < 2 + 2 * extraPages.length || j < needed; j++) {
    firstRow = lcSlot(d, extraPages, j)("0");
    if (!firstRow) return "QR code " + (j + 1) + " is missing";
    if ((firstRow.value !== "") != (j < needed)) {
      if (j < needed) return "QR code " + (j + 1) + " is blank";
      return "QR code " + (j + 1) + " is left over";
    }
  }
  return "";
}

// ---------------------------------------------------------------------------------------------------------------------
// lcDrawQr(d, text): draws the text as one QR code, or as many as it needs (at most 16, one per 2,300 bytes).
//   d     the PDF document.
//   text  what the codes should carry. "" clears every code and removes the extra pages.
// Returns how many codes it drew (0 for "").
// How: the text is cut into slices of equal size, one per code. Each code carries the structured-append header (its
// number, the total, the parity of the whole text), so a scanner that supports it joins them; any other scanner reads
// each slice and the slices are joined in order. Frames, and labels such as "QR code 1 of 3 (scan all 3 codes)",
// show only for codes in use.
// ---------------------------------------------------------------------------------------------------------------------
function lcDrawQr(d, text) {
  var byteString = lcBytes(text);
  var count = lcCodes(text);
  var sliceSize = count ? Math.ceil(byteString.length / count) : 0;
  var codes = [];          // one grid for each code
  var parity = 0;          // all the bytes XORed together
  var i, k, j, y, x, row, pages, newPages, slotBox, box;
  var calculateWas = d.calculate;
  var extraNeeded;         // how many extra pages these codes need
  if (count > LC_QR_MAX) throw new Error("the answers are too long for " + LC_QR_MAX + " QR codes (" + byteString.length + " bytes, at most " + LC_QR_MAX * LC_QR_CAP + ")");
  for (i = 0; i < byteString.length; i++) parity ^= byteString.charCodeAt(i) & 255;
  // Work out every code first, before anything on the form is touched: if the maths fails, the form is left as it was.
  for (k = 0; k < count; k++) {
    codes.push(lcQrMatrix(byteString.slice(k * sliceSize, (k + 1) * sliceSize), count > 1 ? [k, count, parity] : null));
  }

  // The label under a code. A code in use says which one it is; a slot not in use is blank, except the first slot of an
  // extra page that is left over, which says so.
  function labelFor(j) {
    if (!codes[j]) {
      if (j % 2 == 0 && j >= 2 + 2 * extraNeeded) return "(this page is not used)";
      return "";
    }
    if (count < 2) return "";
    var label = "QR code " + (j + 1) + " of " + count;
    if (j == 0) label += count == 2 ? " (scan both codes)" : " (scan all " + count + " codes)";
    return label;
  }

  d.calculate = false;   // thousands of rows are written: do not re-run the checks after each one
  try {
    pages = lcExtra(d);
    extraNeeded = lcPagesFor(count);
    // Add the extra pages that are needed.
    while (pages.length < extraNeeded) {
      d.getTemplate("qrx").spawn({nPage: d.numPages, bRename: true, bOverlay: false});
      newPages = lcExtra(d);
      if (newPages.length <= pages.length) throw new Error("the viewer did not add the page for QR code " + (2 * pages.length + 3));
      pages = newPages;
    }
    // Take away the extra pages that are not needed (if the viewer refuses, they stay, marked "not used").
    while (pages.length > extraNeeded) {
      try {
        d.deletePages(pages[pages.length - 1].page);
      } catch (e) {
        break;
      }
      newPages = lcExtra(d);
      if (newPages.length >= pages.length) break;
      pages = newPages;
    }
    // Every slot gets its code, or is emptied.
    for (j = 0; j < 2 + 2 * pages.length; j++) {
      slotBox = lcSlot(d, pages, j);
      for (y = 0; y < 177; y++) {
        row = "";
        // "n" (a black square in ZapfDingbats) for a dark square, a space for a light one.
        if (codes[j]) {
          for (x = 0; x < 177; x++) row += codes[j][y][x] ? "n" : " ";
        }
        slotBox(y).value = row;
      }
      box = slotBox("label");
      if (box) box.value = labelFor(j);
      box = slotBox("frame");
      if (box) box.display = codes[j] ? display.visible : display.hidden;
    }
  } finally {
    d.calculate = calculateWas;
  }
  return count;
}
return { lcRules: lcRules, lcPayload: lcPayload, lcDrawQr: lcDrawQr, lcDates: lcDates, lcQrMatrix: lcQrMatrix, lcWords: lcWords, lcLastPage: typeof lcLastPage == "function" ? lcLastPage : undefined, lcPagesFor: typeof lcPagesFor == "function" ? lcPagesFor : undefined, lcPipeStoredMatches: typeof lcPipeStoredMatches == "function" ? lcPipeStoredMatches : undefined, lcPipeText: typeof lcPipeText == "function" ? lcPipeText : undefined, lcQrCheck: typeof lcQrCheck == "function" ? lcQrCheck : undefined };
};
export const keys = {
"applicant_name": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"applicant_address_1": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"applicant_address_2": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"applicant_address_3": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"applicant_address_4": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"contact_name": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"contact_tel": { K: function (event, app) {
if (!event.willCommit && /[^0-9+() -]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\+?[\d ()-]*\d[\d ()-]*$/.test(event.value)) { app.alert("Contact party: Tel no is not a phone number (digits, spaces, + - ( ) only)."); event.rc = false; }
} },
"contact_fax": { K: function (event, app) {
if (!event.willCommit && /[^0-9+() -]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\+?[\d ()-]*\d[\d ()-]*$/.test(event.value)) { app.alert("Contact party: Fax no is not a phone number (digits, spaces, + - ( ) only)."); event.rc = false; }
} },
"dc_no": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"bank_code": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"advising_bank_name": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"advising_bank_address_1": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"advising_bank_address_2": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"advising_bank_address_3": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"third_party_name": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"third_party_address_1": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"third_party_address_2": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"third_party_address_3": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"beneficiary_name": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"beneficiary_address_1": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"beneficiary_address_2": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"beneficiary_address_3": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"beneficiary_address_4": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"beneficiary_contact": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"beneficiary_tel": { K: function (event, app) {
if (!event.willCommit && /[^0-9+() -]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\+?[\d ()-]*\d[\d ()-]*$/.test(event.value)) { app.alert("Tel no is not a phone number (digits, spaces, + - ( ) only)."); event.rc = false; }
} },
"beneficiary_fax": { K: function (event, app) {
if (!event.willCommit && /[^0-9+() -]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\+?[\d ()-]*\d[\d ()-]*$/.test(event.value)) { app.alert("Fax no is not a phone number (digits, spaces, + - ( ) only)."); event.rc = false; }
} },
"amount": { K: function (event, app) {
if (!event.willCommit && /[^0-9.,]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d{1,3}(,?\d{3})*(\.\d{1,2})?$/.test(event.value)) { app.alert("Amount is not an amount."); event.rc = false; }
} },
"tolerance_plus": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Tolerance + (%) should be a whole number."); event.rc = false; }
} },
"tolerance_minus": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Tolerance - (%) should be a whole number."); event.rc = false; }
} },
"price_basis_other": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"shipment_from_port": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"shipment_from_port_2": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"shipment_from_place": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"shipment_from_place_2": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"shipment_to_port": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"shipment_to_port_2": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"shipment_to_place": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"shipment_to_place_2": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"presentation_days": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Presentation period (days after shipment) should be a whole number."); event.rc = false; }
} },
"master_dc_no": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"master_dc_issued_by": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"drafts_percent": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Percentage of invoice value (%) should be a whole number."); event.rc = false; }
} },
"term_days": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Term: days should be a whole number."); event.rc = false; }
} },
"term_after": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"bl_made_out_to_other": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"bl_notify_party": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"awb_notify_party": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"do_originals": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Delivery order: originals should be a whole number."); event.rc = false; }
} },
"do_copies": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Delivery order: copies should be a whole number."); event.rc = false; }
} },
"insurance_cover_no": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"insurance_cover_with": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"bencert_days": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Within (days after shipment) should be a whole number."); event.rc = false; }
} },
"invoice_originals": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Commercial invoice: originals should be a whole number."); event.rc = false; }
} },
"invoice_copies": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Commercial invoice: copies should be a whole number."); event.rc = false; }
} },
"packing_list_originals": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Packing list: originals should be a whole number."); event.rc = false; }
} },
"packing_list_copies": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Packing list: copies should be a whole number."); event.rc = false; }
} },
"weight_note_originals": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Weight note: originals should be a whole number."); event.rc = false; }
} },
"weight_note_copies": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Weight note: copies should be a whole number."); event.rc = false; }
} },
"origin_originals": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Certificate of origin: originals should be a whole number."); event.rc = false; }
} },
"origin_copies": { K: function (event, app) {
if (!event.willCommit && /[^0-9]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d+$/.test(event.value)) { app.alert("Certificate of origin: copies should be a whole number."); event.rc = false; }
} },
"origin_country": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"other_documents_1": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"other_documents_2": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"goods_description": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"additional_conditions": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"forward_contract_no": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"advance_payment_account": { K: function (event, app) {
if (!event.willCommit && /[^0-9-]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d[\d-]*\d$|^\d$/.test(event.value)) { app.alert("Account no for advance payment is not an account number (digits and - only)."); event.rc = false; }
} },
"issuance_charges_account": { K: function (event, app) {
if (!event.willCommit && /[^0-9-]/.test(event.change)) { event.rc = false; app.beep(0); }
}, V: function (event, app) {
if (event.value !== "" && !/^\d[\d-]*\d$|^\d$/.test(event.value)) { app.alert("Account no for DC issuance charges is not an account number (digits and - only)."); event.rc = false; }
} },
"authorised_person": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} }
};
export const ruleEvents = {"application_date__list": "U", "application_date": "Bl", "mode_of_advising": "U", "applicant_name": "Bl", "applicant_address_1": "Bl", "applicant_address_2": "Bl", "applicant_address_3": "Bl", "applicant_address_4": "Bl", "contact_name": "Bl", "contact_tel": "Bl", "contact_fax": "Bl", "dc_no": "Bl", "bank_code": "Bl", "advising_bank_name": "Bl", "advising_bank_address_1": "Bl", "advising_bank_address_2": "Bl", "advising_bank_address_3": "Bl", "third_party_name": "Bl", "third_party_address_1": "Bl", "third_party_address_2": "Bl", "third_party_address_3": "Bl", "beneficiary_name": "Bl", "beneficiary_address_1": "Bl", "beneficiary_address_2": "Bl", "beneficiary_address_3": "Bl", "beneficiary_address_4": "Bl", "beneficiary_contact": "Bl", "beneficiary_tel": "Bl", "beneficiary_fax": "Bl", "currency": "Bl", "amount": "Bl", "tolerance": "U", "tolerance_plus": "Bl", "tolerance_minus": "Bl", "price_basis": "U", "price_basis_other": "Bl", "partial_shipment": "U", "transhipment": "U", "shipment_from": "Bl", "shipment_from_port": "Bl", "shipment_from_port_2": "Bl", "shipment_from_place": "Bl", "shipment_from_place_2": "Bl", "shipment_to": "Bl", "shipment_to_port": "Bl", "shipment_to_port_2": "Bl", "shipment_to_place": "Bl", "shipment_to_place_2": "Bl", "latest_shipment_date__list": "U", "latest_shipment_date": "Bl", "expiry_date__list": "U", "expiry_date": "Bl", "presentation_days": "Bl", "back_to_back": "U", "master_dc_no": "Bl", "master_dc_issued_by": "Bl", "drafts": "U", "drafts_percent": "Bl", "drafts_at": "U", "term_days": "Bl", "term_after": "Bl", "draft_date__list": "U", "draft_date": "Bl", "term_prepay": "U", "doc_bill_of_lading": "U", "bl_made_out_to": "U", "bl_made_out_to_other": "Bl", "bl_freight": "U", "bl_notify_party": "Bl", "doc_air_waybill": "U", "awb_freight": "U", "awb_notify_party": "Bl", "doc_delivery_order": "U", "do_originals": "Bl", "do_copies": "Bl", "do_countersigned_by": "Bl", "do_signature_verified": "Bl", "doc_insurance": "U", "insurance_arrangement": "Bl", "insurance_cover_no": "Bl", "insurance_cover_with": "Bl", "doc_beneficiary_certificate": "U", "bencert_sent_by__0": "U", "bencert_sent_by__1": "U", "bencert_sent_by__2": "U", "bencert_days": "Bl", "doc_commercial_invoice": "U", "invoice_originals": "Bl", "invoice_copies": "Bl", "doc_packing_list": "U", "packing_list_originals": "Bl", "packing_list_copies": "Bl", "doc_weight_note": "U", "weight_note_originals": "Bl", "weight_note_copies": "Bl", "doc_certificate_of_origin": "U", "origin_originals": "Bl", "origin_copies": "Bl", "origin_country": "Bl", "doc_other": "U", "other_documents_1": "Bl", "other_documents_2": "Bl", "goods_description": "Bl", "additional_conditions": "Bl", "bank_charges": "U", "bank_charges_for": "U", "confirmation": "U", "confirmation_charges": "U", "post_shipment_financing": "U", "financing_type": "U", "financing_currency": "Bl", "forward_contract_no": "Bl", "advance_payment": "U", "advance_payment_account": "Bl", "issuance_charges_account": "Bl", "authorised_person": "Bl"};
export const sectionButtons = {};

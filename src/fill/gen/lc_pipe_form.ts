// @ts-nocheck: lc-form's Acrobat JavaScript, copied word for word by scripts/fill-engine.py (do not edit; rerun it)
export const document = function (app, color, display, console) {
// THE RULES ENGINE (runs inside Acrobat). Built into the PDF as the document script "lcRules".
// lcRules(doc) checks every question and colours its box:
//   blank or wrong mandatory answer -> red outline, pink fill, marked Required
//   answered and right              -> black outline, white fill
//   doesn't apply yet               -> greyed out, locked, and its answer cleared
// It returns the list of missing questions, plus .bad (wrong answers) and .first (where to put the cursor).
// lcDates(doc) shows each date's calendar box and hides its drop-down list (Acrobat only).
// {"application_date":{"kind":"date","label":"Date","hasRule":1,"always":1,"check":1},"mode_of_advising":{"kind":"radio","label":"Mode of advising","hasRule":1,"always":1},"applicant_name":{"kind":"text","label":"Applicant name","hasRule":1,"always":1,"check":1},"applicant_address_1":{"kind":"text","label":"Applicant address","hasRule":1,"always":1,"check":1},"applicant_address_2":{"kind":"text","label":"Applicant address (line 2)","check":1},"applicant_address_3":{"kind":"text","label":"Applicant address (line 3)","check":1},"applicant_address_4":{"kind":"text","label":"Applicant address (line 4)","check":1},"contact_name":{"kind":"text","label":"Contact party for this application & confirmation of FX rate: Name","hasRule":1,"always":1,"check":1},"contact_tel":{"kind":"text","label":"Contact party: Tel no","hasRule":1,"always":1,"check":["^\\+?[\\d ()-]*\\d[\\d ()-]*$","is not a phone number (digits, spaces, + - ( ) only)"]},"contact_fax":{"kind":"text","label":"Contact party: Fax no","check":["^\\+?[\\d ()-]*\\d[\\d ()-]*$","is not a phone number (digits, spaces, + - ( ) only)"]},"dc_no":{"kind":"text","label":"DC no","check":1},"bank_code":{"kind":"text","label":"Bank code","check":1},"advising_bank_name":{"kind":"text","label":"Name","check":1},"advising_bank_address_1":{"kind":"text","label":"Address","check":1},"advising_bank_address_2":{"kind":"text","label":"Address (line 2)","check":1},"advising_bank_address_3":{"kind":"text","label":"Address (line 3)","check":1},"third_party_name":{"kind":"text","label":"Name","check":1},"third_party_address_1":{"kind":"text","label":"Address","check":1},"third_party_address_2":{"kind":"text","label":"Address (line 2)","check":1},"third_party_address_3":{"kind":"text","label":"Address (line 3)","check":1},"beneficiary_name":{"kind":"text","label":"Beneficiary's name","hasRule":1,"always":1,"check":1},"beneficiary_address_1":{"kind":"text","label":"Beneficiary's address","hasRule":1,"always":1,"check":1},"beneficiary_address_2":{"kind":"text","label":"Beneficiary's address (line 2)","check":1},"beneficiary_address_3":{"kind":"text","label":"Beneficiary's address (line 3)","check":1},"beneficiary_address_4":{"kind":"text","label":"Beneficiary's address (line 4)","check":1},"beneficiary_contact":{"kind":"text","label":"Contact person","check":1},"beneficiary_tel":{"kind":"text","label":"Tel no","check":["^\\+?[\\d ()-]*\\d[\\d ()-]*$","is not a phone number (digits, spaces, + - ( ) only)"]},"beneficiary_fax":{"kind":"text","label":"Fax no","check":["^\\+?[\\d ()-]*\\d[\\d ()-]*$","is not a phone number (digits, spaces, + - ( ) only)"]},"currency":{"kind":"select","label":"Currency","hasRule":1,"always":1},"amount":{"kind":"text","label":"Amount","hasRule":1,"always":1,"check":["^\\d{1,3}(,?\\d{3})*(\\.\\d{1,2})?$","is not an amount"]},"tolerance":{"kind":"check","label":"Tolerance on credit amount & goods quantity"},"tolerance_plus":{"kind":"text","label":"Tolerance + (%)","hasRule":1,"requiredIf":[["tolerance",["true"],0]],"activeIf":[["tolerance",["true"],0]],"check":["^\\d+$","should be a whole number"]},"tolerance_minus":{"kind":"text","label":"Tolerance - (%)","hasRule":1,"requiredIf":[["tolerance",["true"],0]],"activeIf":[["tolerance",["true"],0]],"check":["^\\d+$","should be a whole number"]},"price_basis":{"kind":"radio","label":"Price basis","hasRule":1,"always":1},"price_basis_other":{"kind":"text","label":"Others (please specify)","hasRule":1,"requiredIf":[["price_basis",["Others"],0]],"activeIf":[["price_basis",["Others"],0]],"check":1},"partial_shipment":{"kind":"radio","label":"Partial shipment","hasRule":1,"always":1},"transhipment":{"kind":"radio","label":"Transhipment","hasRule":1,"always":1},"shipment_from":{"kind":"select","label":"Shipment from"},"shipment_from_place":{"kind":"text","label":"Shipment from: place","hasRule":1,"requiredIf":[["shipment_from",[""],1]],"check":1},"shipment_from_place_2":{"kind":"text","label":"Shipment from: place (line 2)","check":1},"shipment_to":{"kind":"select","label":"Shipment to"},"shipment_to_place":{"kind":"text","label":"Shipment to: place","hasRule":1,"requiredIf":[["shipment_to",[""],1]],"check":1},"shipment_to_place_2":{"kind":"text","label":"Shipment to: place (line 2)","check":1},"latest_shipment_date":{"kind":"date","label":"Latest shipment date","check":1},"expiry_date":{"kind":"date","label":"Date of expiry (in beneficiary's country)","hasRule":1,"always":1,"check":1},"presentation_days":{"kind":"text","label":"Presentation period (days after shipment)","check":["^\\d+$","should be a whole number"]},"back_to_back":{"kind":"check","label":"This is a back-to-back DC to be issued against the master credit (the \"Master DC\")"},"master_dc_no":{"kind":"text","label":"Master credit no","hasRule":1,"requiredIf":[["back_to_back",["true"],0]],"activeIf":[["back_to_back",["true"],0]],"check":1},"master_dc_issued_by":{"kind":"text","label":"Issued by","hasRule":1,"requiredIf":[["back_to_back",["true"],0]],"activeIf":[["back_to_back",["true"],0]],"check":1},"drafts":{"kind":"check","label":"Drafts for the percentage of invoice value below, at"},"drafts_percent":{"kind":"text","label":"Percentage of invoice value (%)","hasRule":1,"requiredIf":[["drafts",["true"],0]],"activeIf":[["drafts",["true"],0]],"check":["^\\d+$","should be a whole number"]},"drafts_at":{"kind":"radio","label":"Drafts at","hasRule":1,"requiredIf":[["drafts",["true"],0]],"activeIf":[["drafts",["true"],0]]},"term_days":{"kind":"text","label":"Term: days","hasRule":1,"requiredIf":[["drafts_at",["Term"],0]],"activeIf":[["drafts_at",["Term"],0]],"check":["^\\d+$","should be a whole number"]},"term_after":{"kind":"text","label":"days after","hasRule":1,"requiredIf":[["drafts_at",["Term"],0]],"activeIf":[["drafts_at",["Term"],0]],"check":1},"draft_date":{"kind":"date","label":"Date","hasRule":1,"requiredIf":[["drafts_at",["Date"],0]],"activeIf":[["drafts_at",["Date"],0]],"check":1},"term_prepay":{"kind":"radio","label":"If it is a term LC, please select one","hasRule":1,"requiredIf":[["drafts_at",["Term"],0]],"activeIf":[["drafts_at",["Term"],0]]},"doc_bill_of_lading":{"kind":"check","label":"Full set of Clean on Board marine bills of lading"},"bl_made_out_to":{"kind":"radio","label":"Made out to","hasRule":1,"requiredIf":[["doc_bill_of_lading",["true"],0]],"activeIf":[["doc_bill_of_lading",["true"],0]]},"bl_made_out_to_other":{"kind":"text","label":"Made out to (other)","hasRule":1,"requiredIf":[["bl_made_out_to",["other (specify)"],0]],"activeIf":[["bl_made_out_to",["other (specify)"],0]],"check":1},"bl_freight":{"kind":"radio","label":"Marked Freight","hasRule":1,"requiredIf":[["doc_bill_of_lading",["true"],0]],"activeIf":[["doc_bill_of_lading",["true"],0]]},"bl_notify_party":{"kind":"text","label":"Notify party (if not specified, notify party is considered to be applicant)","hasRule":1,"requiredIf":[["doc_bill_of_lading",["true"],0]],"activeIf":[["doc_bill_of_lading",["true"],0]],"check":1},"doc_air_waybill":{"kind":"check","label":"Original Air Waybill consigned to the Bank"},"awb_freight":{"kind":"radio","label":"Marked Freight","hasRule":1,"requiredIf":[["doc_air_waybill",["true"],0]],"activeIf":[["doc_air_waybill",["true"],0]]},"awb_notify_party":{"kind":"text","label":"Notify party (if not specified, notify party is considered to be applicant)","hasRule":1,"requiredIf":[["doc_air_waybill",["true"],0]],"activeIf":[["doc_air_waybill",["true"],0]],"check":1},"doc_delivery_order":{"kind":"check","label":"Delivery order signed by beneficiary made out to applicant"},"do_originals":{"kind":"text","label":"Delivery order: originals","hasRule":1,"requiredIf":[["doc_delivery_order",["true"],0]],"activeIf":[["doc_delivery_order",["true"],0]],"check":["^\\d+$","should be a whole number"]},"do_copies":{"kind":"text","label":"Delivery order: copies","hasRule":1,"requiredIf":[["doc_delivery_order",["true"],0]],"activeIf":[["doc_delivery_order",["true"],0]],"check":["^\\d+$","should be a whole number"]},"do_countersigned_by":{"kind":"select","label":"Countersigned by how many of our signatories","hasRule":1,"requiredIf":[["doc_delivery_order",["true"],0]],"activeIf":[["doc_delivery_order",["true"],0]]},"do_signature_verified":{"kind":"select","label":"Whose signature(s) ... to be verified by the Bank","hasRule":1,"requiredIf":[["doc_delivery_order",["true"],0]],"activeIf":[["doc_delivery_order",["true"],0]]},"doc_insurance":{"kind":"check","label":"Marine/Air Insurance Policy or Certificate in duplicate, in Singapore in the currency of the credit, covering Institute Cargo Clauses (A), Institute War Clauses, Institute Strikes Clauses / Strikes, Riots and Civil Commotion"},"insurance_arrangement":{"kind":"select","label":"For FOB/CFR/FCA/CPT","activeIf":[["doc_insurance",["true"],0]]},"insurance_cover_no":{"kind":"text","label":"Open cover no","hasRule":1,"requiredIf":[["insurance_arrangement",["Insurance covered by applicant under open Cover No."],0]],"activeIf":[["insurance_arrangement",["Insurance covered by applicant under open Cover No."],0]],"check":1},"insurance_cover_with":{"kind":"text","label":"With","hasRule":1,"requiredIf":[["insurance_arrangement",["Insurance covered by applicant under open Cover No."],0]],"activeIf":[["insurance_arrangement",["Insurance covered by applicant under open Cover No."],0]],"check":1},"doc_beneficiary_certificate":{"kind":"check","label":"Beneficiary's certificate stating 1 set of non-negotiable documents has been sent to applicant"},"bencert_sent_by":{"kind":"checks","label":"Sent by","options":["faxed","mailed","couriered"],"hasRule":1,"requiredIf":[["doc_beneficiary_certificate",["true"],0]],"activeIf":[["doc_beneficiary_certificate",["true"],0]]},"bencert_days":{"kind":"text","label":"Within (days after shipment)","hasRule":1,"requiredIf":[["doc_beneficiary_certificate",["true"],0]],"activeIf":[["doc_beneficiary_certificate",["true"],0]],"check":["^\\d+$","should be a whole number"]},"doc_commercial_invoice":{"kind":"check","label":"Signed commercial invoice"},"invoice_originals":{"kind":"text","label":"Commercial invoice: originals","hasRule":1,"requiredIf":[["doc_commercial_invoice",["true"],0]],"activeIf":[["doc_commercial_invoice",["true"],0]],"check":["^\\d+$","should be a whole number"]},"invoice_copies":{"kind":"text","label":"Commercial invoice: copies","hasRule":1,"requiredIf":[["doc_commercial_invoice",["true"],0]],"activeIf":[["doc_commercial_invoice",["true"],0]],"check":["^\\d+$","should be a whole number"]},"doc_packing_list":{"kind":"check","label":"Packing list"},"packing_list_originals":{"kind":"text","label":"Packing list: originals","hasRule":1,"requiredIf":[["doc_packing_list",["true"],0]],"activeIf":[["doc_packing_list",["true"],0]],"check":["^\\d+$","should be a whole number"]},"packing_list_copies":{"kind":"text","label":"Packing list: copies","hasRule":1,"requiredIf":[["doc_packing_list",["true"],0]],"activeIf":[["doc_packing_list",["true"],0]],"check":["^\\d+$","should be a whole number"]},"doc_weight_note":{"kind":"check","label":"Weight note"},"weight_note_originals":{"kind":"text","label":"Weight note: originals","hasRule":1,"requiredIf":[["doc_weight_note",["true"],0]],"activeIf":[["doc_weight_note",["true"],0]],"check":["^\\d+$","should be a whole number"]},"weight_note_copies":{"kind":"text","label":"Weight note: copies","hasRule":1,"requiredIf":[["doc_weight_note",["true"],0]],"activeIf":[["doc_weight_note",["true"],0]],"check":["^\\d+$","should be a whole number"]},"doc_certificate_of_origin":{"kind":"check","label":"Certificate of origin"},"origin_originals":{"kind":"text","label":"Certificate of origin: originals","hasRule":1,"requiredIf":[["doc_certificate_of_origin",["true"],0]],"activeIf":[["doc_certificate_of_origin",["true"],0]],"check":["^\\d+$","should be a whole number"]},"origin_copies":{"kind":"text","label":"Certificate of origin: copies","hasRule":1,"requiredIf":[["doc_certificate_of_origin",["true"],0]],"activeIf":[["doc_certificate_of_origin",["true"],0]],"check":["^\\d+$","should be a whole number"]},"origin_country":{"kind":"text","label":"Showing country of origin as","hasRule":1,"requiredIf":[["doc_certificate_of_origin",["true"],0]],"activeIf":[["doc_certificate_of_origin",["true"],0]],"check":1},"doc_other":{"kind":"check","label":"Other documents"},"other_documents_1":{"kind":"text","label":"Other documents","hasRule":1,"requiredIf":[["doc_other",["true"],0]],"activeIf":[["doc_other",["true"],0]],"check":1},"other_documents_2":{"kind":"text","label":"Other documents (line 2)","activeIf":[["doc_other",["true"],0]],"check":1},"goods_description":{"kind":"long","label":"Goods description (if space is insufficient, attach additional information with Company's stamp, signed by authorised signors)","hasRule":1,"always":1,"check":1},"additional_conditions":{"kind":"long","label":"Additional conditions (if space is insufficient, attach additional information with Company's stamp, signed by authorised signors)","check":1},"bank_charges":{"kind":"check","label":"All bank charges are for account of","hasRule":1,"always":1},"bank_charges_for":{"kind":"radio","label":"Charges for account of","hasRule":1,"requiredIf":[["bank_charges",["true"],0]],"activeIf":[["bank_charges",["true"],0]]},"confirmation":{"kind":"check","label":"Confirmation required"},"confirmation_charges":{"kind":"radio","label":"Confirmation charges","hasRule":1,"requiredIf":[["confirmation",["true"],0]],"activeIf":[["confirmation",["true"],0]]},"post_shipment_financing":{"kind":"check","label":"Please provide us with post-shipment financing under Documentary Credit (\"TR/BRP\") financing for 100% value of all documentary presentations made in compliance with this DC, but where there are discrepancies, we hereby agree to waive all such discrepancies"},"financing_type":{"kind":"radio","label":"Financing","hasRule":1,"requiredIf":[["post_shipment_financing",["true"],0]],"activeIf":[["post_shipment_financing",["true"],0]]},"financing_currency":{"kind":"select","label":"Foreign currency financing in (type of currency)","hasRule":1,"requiredIf":[["financing_type",["Foreign Currency Financing"],0]],"activeIf":[["financing_type",["Foreign Currency Financing"],0]]},"forward_contract_no":{"kind":"text","label":"Forward contract no","hasRule":1,"requiredIf":[["financing_type",["Apply Forward Contract"],0]],"activeIf":[["financing_type",["Apply Forward Contract"],0]],"check":1},"advance_payment":{"kind":"check","label":"We authorise you to debit DC amount in full from our account for advance payment"},"advance_payment_account":{"kind":"text","label":"Account no for advance payment","hasRule":1,"requiredIf":[["advance_payment",["true"],0]],"activeIf":[["advance_payment",["true"],0]],"check":["^\\d[\\d-]*\\d$|^\\d$","is not an account number (digits and - only)"]},"issuance_charges_account":{"kind":"text","label":"Account no for DC issuance charges","hasRule":1,"always":1,"check":["^\\d[\\d-]*\\d$|^\\d$","is not an account number (digits and - only)"]},"authorised_person":{"kind":"text","label":"Name and title of authorised person(s)","check":1}} is filled in by document_script (step 2) with the rules table built from the form; ["application_date","latest_shipment_date","expiry_date","draft_date"] with the date
// question ids. Acrobat's JavaScript is old-style: var, no arrow functions.
// The rules table, the index "box -> the questions to re-check when it changes" (null = always check everything), and what
// the last run saw: v = each box's last-seen value, st = each box's last-written look (so unchanged boxes are not written again).
var lcModel = {"application_date":{"kind":"date","label":"Date","hasRule":1,"always":1,"check":1},"mode_of_advising":{"kind":"radio","label":"Mode of advising","hasRule":1,"always":1},"applicant_name":{"kind":"text","label":"Applicant name","hasRule":1,"always":1,"check":1},"applicant_address_1":{"kind":"text","label":"Applicant address","hasRule":1,"always":1,"check":1},"applicant_address_2":{"kind":"text","label":"Applicant address (line 2)","check":1},"applicant_address_3":{"kind":"text","label":"Applicant address (line 3)","check":1},"applicant_address_4":{"kind":"text","label":"Applicant address (line 4)","check":1},"contact_name":{"kind":"text","label":"Contact party for this application & confirmation of FX rate: Name","hasRule":1,"always":1,"check":1},"contact_tel":{"kind":"text","label":"Contact party: Tel no","hasRule":1,"always":1,"check":["^\\+?[\\d ()-]*\\d[\\d ()-]*$","is not a phone number (digits, spaces, + - ( ) only)"]},"contact_fax":{"kind":"text","label":"Contact party: Fax no","check":["^\\+?[\\d ()-]*\\d[\\d ()-]*$","is not a phone number (digits, spaces, + - ( ) only)"]},"dc_no":{"kind":"text","label":"DC no","check":1},"bank_code":{"kind":"text","label":"Bank code","check":1},"advising_bank_name":{"kind":"text","label":"Name","check":1},"advising_bank_address_1":{"kind":"text","label":"Address","check":1},"advising_bank_address_2":{"kind":"text","label":"Address (line 2)","check":1},"advising_bank_address_3":{"kind":"text","label":"Address (line 3)","check":1},"third_party_name":{"kind":"text","label":"Name","check":1},"third_party_address_1":{"kind":"text","label":"Address","check":1},"third_party_address_2":{"kind":"text","label":"Address (line 2)","check":1},"third_party_address_3":{"kind":"text","label":"Address (line 3)","check":1},"beneficiary_name":{"kind":"text","label":"Beneficiary's name","hasRule":1,"always":1,"check":1},"beneficiary_address_1":{"kind":"text","label":"Beneficiary's address","hasRule":1,"always":1,"check":1},"beneficiary_address_2":{"kind":"text","label":"Beneficiary's address (line 2)","check":1},"beneficiary_address_3":{"kind":"text","label":"Beneficiary's address (line 3)","check":1},"beneficiary_address_4":{"kind":"text","label":"Beneficiary's address (line 4)","check":1},"beneficiary_contact":{"kind":"text","label":"Contact person","check":1},"beneficiary_tel":{"kind":"text","label":"Tel no","check":["^\\+?[\\d ()-]*\\d[\\d ()-]*$","is not a phone number (digits, spaces, + - ( ) only)"]},"beneficiary_fax":{"kind":"text","label":"Fax no","check":["^\\+?[\\d ()-]*\\d[\\d ()-]*$","is not a phone number (digits, spaces, + - ( ) only)"]},"currency":{"kind":"select","label":"Currency","hasRule":1,"always":1},"amount":{"kind":"text","label":"Amount","hasRule":1,"always":1,"check":["^\\d{1,3}(,?\\d{3})*(\\.\\d{1,2})?$","is not an amount"]},"tolerance":{"kind":"check","label":"Tolerance on credit amount & goods quantity"},"tolerance_plus":{"kind":"text","label":"Tolerance + (%)","hasRule":1,"requiredIf":[["tolerance",["true"],0]],"activeIf":[["tolerance",["true"],0]],"check":["^\\d+$","should be a whole number"]},"tolerance_minus":{"kind":"text","label":"Tolerance - (%)","hasRule":1,"requiredIf":[["tolerance",["true"],0]],"activeIf":[["tolerance",["true"],0]],"check":["^\\d+$","should be a whole number"]},"price_basis":{"kind":"radio","label":"Price basis","hasRule":1,"always":1},"price_basis_other":{"kind":"text","label":"Others (please specify)","hasRule":1,"requiredIf":[["price_basis",["Others"],0]],"activeIf":[["price_basis",["Others"],0]],"check":1},"partial_shipment":{"kind":"radio","label":"Partial shipment","hasRule":1,"always":1},"transhipment":{"kind":"radio","label":"Transhipment","hasRule":1,"always":1},"shipment_from":{"kind":"select","label":"Shipment from"},"shipment_from_place":{"kind":"text","label":"Shipment from: place","hasRule":1,"requiredIf":[["shipment_from",[""],1]],"check":1},"shipment_from_place_2":{"kind":"text","label":"Shipment from: place (line 2)","check":1},"shipment_to":{"kind":"select","label":"Shipment to"},"shipment_to_place":{"kind":"text","label":"Shipment to: place","hasRule":1,"requiredIf":[["shipment_to",[""],1]],"check":1},"shipment_to_place_2":{"kind":"text","label":"Shipment to: place (line 2)","check":1},"latest_shipment_date":{"kind":"date","label":"Latest shipment date","check":1},"expiry_date":{"kind":"date","label":"Date of expiry (in beneficiary's country)","hasRule":1,"always":1,"check":1},"presentation_days":{"kind":"text","label":"Presentation period (days after shipment)","check":["^\\d+$","should be a whole number"]},"back_to_back":{"kind":"check","label":"This is a back-to-back DC to be issued against the master credit (the \"Master DC\")"},"master_dc_no":{"kind":"text","label":"Master credit no","hasRule":1,"requiredIf":[["back_to_back",["true"],0]],"activeIf":[["back_to_back",["true"],0]],"check":1},"master_dc_issued_by":{"kind":"text","label":"Issued by","hasRule":1,"requiredIf":[["back_to_back",["true"],0]],"activeIf":[["back_to_back",["true"],0]],"check":1},"drafts":{"kind":"check","label":"Drafts for the percentage of invoice value below, at"},"drafts_percent":{"kind":"text","label":"Percentage of invoice value (%)","hasRule":1,"requiredIf":[["drafts",["true"],0]],"activeIf":[["drafts",["true"],0]],"check":["^\\d+$","should be a whole number"]},"drafts_at":{"kind":"radio","label":"Drafts at","hasRule":1,"requiredIf":[["drafts",["true"],0]],"activeIf":[["drafts",["true"],0]]},"term_days":{"kind":"text","label":"Term: days","hasRule":1,"requiredIf":[["drafts_at",["Term"],0]],"activeIf":[["drafts_at",["Term"],0]],"check":["^\\d+$","should be a whole number"]},"term_after":{"kind":"text","label":"days after","hasRule":1,"requiredIf":[["drafts_at",["Term"],0]],"activeIf":[["drafts_at",["Term"],0]],"check":1},"draft_date":{"kind":"date","label":"Date","hasRule":1,"requiredIf":[["drafts_at",["Date"],0]],"activeIf":[["drafts_at",["Date"],0]],"check":1},"term_prepay":{"kind":"radio","label":"If it is a term LC, please select one","hasRule":1,"requiredIf":[["drafts_at",["Term"],0]],"activeIf":[["drafts_at",["Term"],0]]},"doc_bill_of_lading":{"kind":"check","label":"Full set of Clean on Board marine bills of lading"},"bl_made_out_to":{"kind":"radio","label":"Made out to","hasRule":1,"requiredIf":[["doc_bill_of_lading",["true"],0]],"activeIf":[["doc_bill_of_lading",["true"],0]]},"bl_made_out_to_other":{"kind":"text","label":"Made out to (other)","hasRule":1,"requiredIf":[["bl_made_out_to",["other (specify)"],0]],"activeIf":[["bl_made_out_to",["other (specify)"],0]],"check":1},"bl_freight":{"kind":"radio","label":"Marked Freight","hasRule":1,"requiredIf":[["doc_bill_of_lading",["true"],0]],"activeIf":[["doc_bill_of_lading",["true"],0]]},"bl_notify_party":{"kind":"text","label":"Notify party (if not specified, notify party is considered to be applicant)","hasRule":1,"requiredIf":[["doc_bill_of_lading",["true"],0]],"activeIf":[["doc_bill_of_lading",["true"],0]],"check":1},"doc_air_waybill":{"kind":"check","label":"Original Air Waybill consigned to the Bank"},"awb_freight":{"kind":"radio","label":"Marked Freight","hasRule":1,"requiredIf":[["doc_air_waybill",["true"],0]],"activeIf":[["doc_air_waybill",["true"],0]]},"awb_notify_party":{"kind":"text","label":"Notify party (if not specified, notify party is considered to be applicant)","hasRule":1,"requiredIf":[["doc_air_waybill",["true"],0]],"activeIf":[["doc_air_waybill",["true"],0]],"check":1},"doc_delivery_order":{"kind":"check","label":"Delivery order signed by beneficiary made out to applicant"},"do_originals":{"kind":"text","label":"Delivery order: originals","hasRule":1,"requiredIf":[["doc_delivery_order",["true"],0]],"activeIf":[["doc_delivery_order",["true"],0]],"check":["^\\d+$","should be a whole number"]},"do_copies":{"kind":"text","label":"Delivery order: copies","hasRule":1,"requiredIf":[["doc_delivery_order",["true"],0]],"activeIf":[["doc_delivery_order",["true"],0]],"check":["^\\d+$","should be a whole number"]},"do_countersigned_by":{"kind":"select","label":"Countersigned by how many of our signatories","hasRule":1,"requiredIf":[["doc_delivery_order",["true"],0]],"activeIf":[["doc_delivery_order",["true"],0]]},"do_signature_verified":{"kind":"select","label":"Whose signature(s) ... to be verified by the Bank","hasRule":1,"requiredIf":[["doc_delivery_order",["true"],0]],"activeIf":[["doc_delivery_order",["true"],0]]},"doc_insurance":{"kind":"check","label":"Marine/Air Insurance Policy or Certificate in duplicate, in Singapore in the currency of the credit, covering Institute Cargo Clauses (A), Institute War Clauses, Institute Strikes Clauses / Strikes, Riots and Civil Commotion"},"insurance_arrangement":{"kind":"select","label":"For FOB/CFR/FCA/CPT","activeIf":[["doc_insurance",["true"],0]]},"insurance_cover_no":{"kind":"text","label":"Open cover no","hasRule":1,"requiredIf":[["insurance_arrangement",["Insurance covered by applicant under open Cover No."],0]],"activeIf":[["insurance_arrangement",["Insurance covered by applicant under open Cover No."],0]],"check":1},"insurance_cover_with":{"kind":"text","label":"With","hasRule":1,"requiredIf":[["insurance_arrangement",["Insurance covered by applicant under open Cover No."],0]],"activeIf":[["insurance_arrangement",["Insurance covered by applicant under open Cover No."],0]],"check":1},"doc_beneficiary_certificate":{"kind":"check","label":"Beneficiary's certificate stating 1 set of non-negotiable documents has been sent to applicant"},"bencert_sent_by":{"kind":"checks","label":"Sent by","options":["faxed","mailed","couriered"],"hasRule":1,"requiredIf":[["doc_beneficiary_certificate",["true"],0]],"activeIf":[["doc_beneficiary_certificate",["true"],0]]},"bencert_days":{"kind":"text","label":"Within (days after shipment)","hasRule":1,"requiredIf":[["doc_beneficiary_certificate",["true"],0]],"activeIf":[["doc_beneficiary_certificate",["true"],0]],"check":["^\\d+$","should be a whole number"]},"doc_commercial_invoice":{"kind":"check","label":"Signed commercial invoice"},"invoice_originals":{"kind":"text","label":"Commercial invoice: originals","hasRule":1,"requiredIf":[["doc_commercial_invoice",["true"],0]],"activeIf":[["doc_commercial_invoice",["true"],0]],"check":["^\\d+$","should be a whole number"]},"invoice_copies":{"kind":"text","label":"Commercial invoice: copies","hasRule":1,"requiredIf":[["doc_commercial_invoice",["true"],0]],"activeIf":[["doc_commercial_invoice",["true"],0]],"check":["^\\d+$","should be a whole number"]},"doc_packing_list":{"kind":"check","label":"Packing list"},"packing_list_originals":{"kind":"text","label":"Packing list: originals","hasRule":1,"requiredIf":[["doc_packing_list",["true"],0]],"activeIf":[["doc_packing_list",["true"],0]],"check":["^\\d+$","should be a whole number"]},"packing_list_copies":{"kind":"text","label":"Packing list: copies","hasRule":1,"requiredIf":[["doc_packing_list",["true"],0]],"activeIf":[["doc_packing_list",["true"],0]],"check":["^\\d+$","should be a whole number"]},"doc_weight_note":{"kind":"check","label":"Weight note"},"weight_note_originals":{"kind":"text","label":"Weight note: originals","hasRule":1,"requiredIf":[["doc_weight_note",["true"],0]],"activeIf":[["doc_weight_note",["true"],0]],"check":["^\\d+$","should be a whole number"]},"weight_note_copies":{"kind":"text","label":"Weight note: copies","hasRule":1,"requiredIf":[["doc_weight_note",["true"],0]],"activeIf":[["doc_weight_note",["true"],0]],"check":["^\\d+$","should be a whole number"]},"doc_certificate_of_origin":{"kind":"check","label":"Certificate of origin"},"origin_originals":{"kind":"text","label":"Certificate of origin: originals","hasRule":1,"requiredIf":[["doc_certificate_of_origin",["true"],0]],"activeIf":[["doc_certificate_of_origin",["true"],0]],"check":["^\\d+$","should be a whole number"]},"origin_copies":{"kind":"text","label":"Certificate of origin: copies","hasRule":1,"requiredIf":[["doc_certificate_of_origin",["true"],0]],"activeIf":[["doc_certificate_of_origin",["true"],0]],"check":["^\\d+$","should be a whole number"]},"origin_country":{"kind":"text","label":"Showing country of origin as","hasRule":1,"requiredIf":[["doc_certificate_of_origin",["true"],0]],"activeIf":[["doc_certificate_of_origin",["true"],0]],"check":1},"doc_other":{"kind":"check","label":"Other documents"},"other_documents_1":{"kind":"text","label":"Other documents","hasRule":1,"requiredIf":[["doc_other",["true"],0]],"activeIf":[["doc_other",["true"],0]],"check":1},"other_documents_2":{"kind":"text","label":"Other documents (line 2)","activeIf":[["doc_other",["true"],0]],"check":1},"goods_description":{"kind":"long","label":"Goods description (if space is insufficient, attach additional information with Company's stamp, signed by authorised signors)","hasRule":1,"always":1,"check":1},"additional_conditions":{"kind":"long","label":"Additional conditions (if space is insufficient, attach additional information with Company's stamp, signed by authorised signors)","check":1},"bank_charges":{"kind":"check","label":"All bank charges are for account of","hasRule":1,"always":1},"bank_charges_for":{"kind":"radio","label":"Charges for account of","hasRule":1,"requiredIf":[["bank_charges",["true"],0]],"activeIf":[["bank_charges",["true"],0]]},"confirmation":{"kind":"check","label":"Confirmation required"},"confirmation_charges":{"kind":"radio","label":"Confirmation charges","hasRule":1,"requiredIf":[["confirmation",["true"],0]],"activeIf":[["confirmation",["true"],0]]},"post_shipment_financing":{"kind":"check","label":"Please provide us with post-shipment financing under Documentary Credit (\"TR/BRP\") financing for 100% value of all documentary presentations made in compliance with this DC, but where there are discrepancies, we hereby agree to waive all such discrepancies"},"financing_type":{"kind":"radio","label":"Financing","hasRule":1,"requiredIf":[["post_shipment_financing",["true"],0]],"activeIf":[["post_shipment_financing",["true"],0]]},"financing_currency":{"kind":"select","label":"Foreign currency financing in (type of currency)","hasRule":1,"requiredIf":[["financing_type",["Foreign Currency Financing"],0]],"activeIf":[["financing_type",["Foreign Currency Financing"],0]]},"forward_contract_no":{"kind":"text","label":"Forward contract no","hasRule":1,"requiredIf":[["financing_type",["Apply Forward Contract"],0]],"activeIf":[["financing_type",["Apply Forward Contract"],0]],"check":1},"advance_payment":{"kind":"check","label":"We authorise you to debit DC amount in full from our account for advance payment"},"advance_payment_account":{"kind":"text","label":"Account no for advance payment","hasRule":1,"requiredIf":[["advance_payment",["true"],0]],"activeIf":[["advance_payment",["true"],0]],"check":["^\\d[\\d-]*\\d$|^\\d$","is not an account number (digits and - only)"]},"issuance_charges_account":{"kind":"text","label":"Account no for DC issuance charges","hasRule":1,"always":1,"check":["^\\d[\\d-]*\\d$|^\\d$","is not an account number (digits and - only)"]},"authorised_person":{"kind":"text","label":"Name and title of authorised person(s)","check":1}};
var lcDeps = {"application_date":["application_date","latest_shipment_date","expiry_date"],"mode_of_advising":["mode_of_advising"],"applicant_name":["applicant_name"],"applicant_address_1":["applicant_address_1"],"applicant_address_2":["applicant_address_2"],"applicant_address_3":["applicant_address_3"],"applicant_address_4":["applicant_address_4"],"contact_name":["contact_name"],"contact_tel":["contact_tel"],"contact_fax":["contact_fax"],"dc_no":["dc_no"],"bank_code":["bank_code"],"advising_bank_name":["advising_bank_name"],"advising_bank_address_1":["advising_bank_address_1"],"advising_bank_address_2":["advising_bank_address_2"],"advising_bank_address_3":["advising_bank_address_3"],"third_party_name":["third_party_name"],"third_party_address_1":["third_party_address_1"],"third_party_address_2":["third_party_address_2"],"third_party_address_3":["third_party_address_3"],"beneficiary_name":["beneficiary_name"],"beneficiary_address_1":["beneficiary_address_1"],"beneficiary_address_2":["beneficiary_address_2"],"beneficiary_address_3":["beneficiary_address_3"],"beneficiary_address_4":["beneficiary_address_4"],"beneficiary_contact":["beneficiary_contact"],"beneficiary_tel":["beneficiary_tel"],"beneficiary_fax":["beneficiary_fax"],"currency":["currency"],"amount":["amount"],"tolerance":["tolerance","tolerance_plus","tolerance_minus"],"tolerance_plus":["tolerance_plus"],"tolerance_minus":["tolerance_minus"],"price_basis":["price_basis","price_basis_other","insurance_arrangement","insurance_cover_no","insurance_cover_with"],"price_basis_other":["price_basis_other"],"partial_shipment":["partial_shipment"],"transhipment":["transhipment"],"shipment_from":["shipment_from","shipment_from_place"],"shipment_from_place":["shipment_from_place"],"shipment_from_place_2":["shipment_from_place_2"],"shipment_to":["shipment_to","shipment_to_place"],"shipment_to_place":["shipment_to_place"],"shipment_to_place_2":["shipment_to_place_2"],"latest_shipment_date":["latest_shipment_date","expiry_date"],"expiry_date":["expiry_date"],"presentation_days":["presentation_days"],"back_to_back":["back_to_back","master_dc_no","master_dc_issued_by"],"master_dc_no":["master_dc_no"],"master_dc_issued_by":["master_dc_issued_by"],"drafts":["drafts","drafts_percent","drafts_at","term_days","term_after","draft_date","term_prepay"],"drafts_percent":["drafts_percent"],"drafts_at":["drafts_at","term_days","term_after","draft_date","term_prepay"],"term_days":["term_days"],"term_after":["term_after"],"draft_date":["draft_date"],"term_prepay":["term_prepay"],"doc_bill_of_lading":["doc_bill_of_lading","bl_made_out_to","bl_made_out_to_other","bl_freight","bl_notify_party"],"bl_made_out_to":["bl_made_out_to","bl_made_out_to_other"],"bl_made_out_to_other":["bl_made_out_to_other"],"bl_freight":["bl_freight"],"bl_notify_party":["bl_notify_party"],"doc_air_waybill":["doc_air_waybill","awb_freight","awb_notify_party"],"awb_freight":["awb_freight"],"awb_notify_party":["awb_notify_party"],"doc_delivery_order":["doc_delivery_order","do_originals","do_copies","do_countersigned_by","do_signature_verified"],"do_originals":["do_originals"],"do_copies":["do_copies"],"do_countersigned_by":["do_countersigned_by"],"do_signature_verified":["do_signature_verified"],"doc_insurance":["doc_insurance","insurance_arrangement","insurance_cover_no","insurance_cover_with"],"insurance_arrangement":["insurance_arrangement","insurance_cover_no","insurance_cover_with"],"insurance_cover_no":["insurance_cover_no"],"insurance_cover_with":["insurance_cover_with"],"doc_beneficiary_certificate":["doc_beneficiary_certificate","bencert_sent_by","bencert_days"],"bencert_sent_by":["bencert_sent_by"],"bencert_days":["bencert_days"],"doc_commercial_invoice":["doc_commercial_invoice","invoice_originals","invoice_copies"],"invoice_originals":["invoice_originals"],"invoice_copies":["invoice_copies"],"doc_packing_list":["doc_packing_list","packing_list_originals","packing_list_copies"],"packing_list_originals":["packing_list_originals"],"packing_list_copies":["packing_list_copies"],"doc_weight_note":["doc_weight_note","weight_note_originals","weight_note_copies"],"weight_note_originals":["weight_note_originals"],"weight_note_copies":["weight_note_copies"],"doc_certificate_of_origin":["doc_certificate_of_origin","origin_originals","origin_copies","origin_country"],"origin_originals":["origin_originals"],"origin_copies":["origin_copies"],"origin_country":["origin_country"],"doc_other":["doc_other","other_documents_1","other_documents_2"],"other_documents_1":["other_documents_1"],"other_documents_2":["other_documents_2"],"goods_description":["goods_description"],"additional_conditions":["additional_conditions"],"bank_charges":["bank_charges","bank_charges_for"],"bank_charges_for":["bank_charges_for"],"confirmation":["confirmation","confirmation_charges"],"confirmation_charges":["confirmation_charges"],"post_shipment_financing":["post_shipment_financing","financing_type","financing_currency","forward_contract_no"],"financing_type":["financing_type","financing_currency","forward_contract_no"],"financing_currency":["financing_currency"],"forward_contract_no":["forward_contract_no"],"advance_payment":["advance_payment","advance_payment_account"],"advance_payment_account":["advance_payment_account"],"issuance_charges_account":["issuance_charges_account"],"authorised_person":["authorised_person"]};
var lcState = {v: {}, st: {}};
function lcRules(d, src) {
var M = lcModel, S = lcState, only = null, calc, pass, cleared = false, nm, g, sig;
// src = the name of the box that just changed (its blur, its click, or what the calculation says triggered it). Then only the
// questions that read that box are re-checked (lcDeps), and nothing at all if its value is what the last run saw.
// No src (opening, Reset form, Check form, saving ...): every question, and every look is written again.
if (src) {
  nm = String(src).replace(/^[A-Z]+\./, ""); g = /^(.+)__(\d+|list)$/.exec(nm);
  g = M[nm] ? nm : g && M[g[1]] ? g[1] : "";
  if (lcDeps) {
    g = g && lcDeps[g];
    sig = d.getField(nm); sig = sig ? String(sig.value) : "";
    if (!g || S.v[nm] === sig) { g = []; g.bad = []; g.first = ""; return g; }
    S.v[nm] = sig; only = {}; for (sig = 0; sig < g.length; sig++) only[g[sig]] = 1;
  }
}
if (!only) { S.v = {}; S.st = {}; }
function has(list, x) { for (var i = 0; i < list.length; i++) if (list[i] == x) return true; return false; }

// The answer to question id, read from the PDF's fields.
function val(id) {
  var m = M[id], f, a = [], i;
  if (m.kind == "checks") { for (i = 0; i < m.options.length; i++) { f = d.getField(id + "__" + i); if (f && f.value != "Off") a.push(m.options[i]); } return a; }
  if (m.kind == "date" && shown(id)) return d.getField(id).valueAsString;
  if (m.kind == "date" && d.getField(id + "__list")) { a = /^(\d\d) (\w{3}) (\d{4})$/.exec(d.getField(id + "__list").valueAsString);
    return a ? a[1] + "/" + ("0" + ("JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(a[2]) / 3 + 1)).slice(-2) + "/" + a[3] : ""; }
  f = d.getField(id); if (!f) return "";
  if (m.kind == "check") return f.value != "Off" ? "true" : "false";
  return f.value == "Off" ? "" : String(f.value);
}
function shown(id) { var f = d.getField(id); return !!f && f.display != 1; } // 1 = display.hidden
function empty(x) { return typeof x == "object" ? !x.length : x === ""; }

// Does any of these rules hold?
function any(rules) {
  var i, j, x, hit;
  for (i = 0; i < rules.length; i++) {
    x = val(rules[i][0]); hit = false;
    if (typeof x == "object") { for (j = 0; j < x.length; j++) if (has(rules[i][1], x[j])) hit = true; } else hit = has(rules[i][1], x);
    if (rules[i][2] ? !hit && !empty(x) : hit) return true;
  }
  return false;
}
function mandatory(id) { var m = M[id]; return m.always ? true : any(m.requiredIf || []); }

// What is wrong with a typed answer, or "".
function wrong(id) {
  var m = M[id], f = d.getField(id), s = m.kind == "date" ? val(id) : f ? f.valueAsString : "", x, k;
  if (!m.check || !s) return "";
  x = s.match(new RegExp("[^A-Za-z0-9 .,\\-/()':?+#&@%\\r\\n]", "g"));
  if (x) { k = []; for (var i = 0; i < x.length; i++) if (!has(k, x[i])) k.push(x[i]); return "remove " + k.join(" ") + " (letters, digits and . , - / ( ) ' : ? + # & @ % only)"; }
  if (m.kind == "date") { x = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(s); k = x && new Date(+x[3], x[2] - 1, +x[1]); return k && k.getDate() == +x[1] && k.getMonth() == x[2] - 1 ? "" : "not a real date (DD/MM/YYYY)"; }
  return m.check.length && !new RegExp(m.check[0]).test(s) ? m.check[1] : "";
}

// A real DD/MM/YYYY date as a Date, or null.
function day(s) { var x = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(s), k = x && new Date(+x[3], x[2] - 1, +x[1]); return k && k.getDate() == +x[1] && k.getMonth() == x[2] - 1 ? k : null; }
function v(id) { return M[id] ? val(id) : ""; }

// THE RULES ACROSS ANSWERS. Each rule: what it checks (one sentence), then its code. A rule that is broken puts its
// message on the question: the box turns red, and Check form lists "<question>: <message>".
// Rules 1-6 are the LC's own (the same as the cross-checks in pdf-template-studio's form/validate.ts); a form without
// those questions skips them. Rules 7-9 come from the form file (FORM["checks"]), so any form can add its own.
function isNumber(s) { return /^[\d,]+(\.\d+)?$/.test(s); }   // "1,250.50" yes, "abc" no
function toNumber(s) { return Number(s.replace(/,/g, "")); }   // "1,250.50" -> 1250.5
function across() {
  var X = {};                                     // what is wrong, by question id
  var applied  = day(v("application_date"));      // the dates as real dates (null while blank or not a date)
  var shipment = day(v("latest_shipment_date"));
  var expiry   = day(v("expiry_date"));
  var amount   = v("amount");
  var basis    = v("price_basis");

  // Rule 1: the LC must not expire before the latest shipment date.
  if (shipment && expiry && expiry < shipment) X.expiry_date = "is before the latest shipment date";
  // Rule 2: the LC must not expire before the application date (checked only when rule 1 is fine).
  else if (applied && expiry && expiry < applied) X.expiry_date = "is before the application date";

  // Rule 3: the latest shipment date must not be before the application date.
  if (applied && shipment && shipment < applied) X.latest_shipment_date = "is before the application date";

  // Rule 4: the application date must not be in the future.
  if (applied && applied.getTime() > new Date().getTime()) X.application_date = "is in the future";

  // Rule 5: the amount must be more than zero.
  if (isNumber(amount) && !(toNumber(amount) > 0)) X.amount = "must be more than zero";

  // Rule 6: "insurance for FOB/CFR/FCA/CPT" must be left blank when the price basis is CIF or CIP
  //         (with CIF and CIP the beneficiary arranges the insurance).
  if (v("insurance_arrangement") && (basis == "CIF" || basis == "CIP"))
    X.insurance_arrangement = "is only for FOB/CFR/FCA/CPT, but price basis is " + basis + " (the beneficiary insures)";

  // Rules 7-9: the form file's own checks. Each is {t: kind, a: question, m: message, ...}.
  var C = [], c, first, second, digits, allowed;
  for (var j = 0; j < C.length; j++) {
    c = C[j];
    // Rule 7 ("order"): date a must not be before date b (with s: true, it must be after b, not the same day).
    if (c.t == "order") {
      first = day(v(c.a)); second = day(v(c.b));
      if (first && second && (c.s ? first <= second : first < second)) X[c.a] = c.m;
    }
    // Rule 8 ("range"): number a must be between lo and hi.
    if (c.t == "range" && isNumber(v(c.a))) {
      if (toNumber(v(c.a)) < c.lo || toNumber(v(c.a)) > c.hi) X[c.a] = c.m;
    }
    // Rule 9 ("lengths"): a's digits must be one of the allowed lengths, which can depend on answer b
    //         (e.g. an account number's length by currency; "*" = any other answer).
    if (c.t == "lengths") {
      digits = v(c.a).replace(/\D/g, "");
      allowed = c.by.hasOwnProperty(v(c.b)) ? c.by[v(c.b)] : c.by["*"];
      if (digits && allowed && allowed.length && !has(allowed, digits.length)) X[c.a] = c.m;
    }
  }
  return X;
}

// Clears a question's box, so an answer can't stay behind in a question that doesn't apply.
function clear(f, kind, nm) {
  if (kind == "check" || kind == "checks" || kind == "radio") { if (f.value != "Off") { f.value = "Off"; cleared = true; } }
  else if (f.type == "combobox" && /__list$/.test(f["name"])) { if (f.currentValueIndices != 0) { f.currentValueIndices = 0; cleared = true; } } // a date list: back to "Pick a date"
  else if (f.value !== "" && f.value != null) { f.value = ""; cleared = true; }
  delete S.v[nm];   // the next change of this box is new to the next run
}

// GO THROUGH EVERY QUESTION, in 5 steps, and colour (and lock) its boxes.
var missing = [], bad = [], first = "", id, m, applies, required, problem, whatsWrong, names, i, f, X;
calc = d.calculate; d.calculate = false;   // every write below would otherwise run the calculation again
try {
for (pass = 0; pass < 3; pass++) {   // a second pass only if a box was cleared (a later question may read it)
missing = []; bad = []; first = ""; cleared = false;
X = across();
for (id in M) {
  m = M[id]; if (!m.hasRule && !m.check && !m.activeIf) continue;   // no rule, no format: nothing to do
  if (only && !only[id]) continue;                                    // this change can't affect it

  // Step 1: does the question apply? (activeIf in the form file, e.g. "only when Term is picked")
  applies = !m.activeIf || any(m.activeIf);

  // Step 2: is it mandatory now, and still blank? (required=True always, or requiredIf in the form file)
  required = m.hasRule && applies ? mandatory(id) : false;
  problem = required && (m.kind == "check" ? val(id) != "true" : empty(val(id)));
  if (problem) missing.push(m.label);

  // Step 3: is the answer wrong? (its format, or one of the rules across answers above)
  whatsWrong = applies ? wrong(id) || X[id] || "" : "";
  if (whatsWrong) { bad.push(m.label + ": " + whatsWrong); problem = true; }

  // Step 4: which boxes on the page are this question's (tick-any: one per option; a date: its list or its box)
  names = [id];
  if (m.kind == "checks") { names = []; for (i = 0; i < m.options.length; i++) names.push(id + "__" + i); }
  if (m.kind == "date" && !shown(id) && d.getField(id + "__list")) names = [id + "__list"];
  if (problem && !first) first = names[0];

  // Step 5: colour each box. Doesn't apply: grey, locked, answer cleared. Problem: red outline, pink fill.
  //         Fine: black outline (or just its underline), white fill.
  sig = (required && problem ? "r" : "-") + (applies ? (problem ? "p" : "o") : "g");   // required flag, then the look
  for (i = 0; i < names.length; i++) {
    f = d.getField(names[i]); if (!f) continue;
    if (S.st[names[i]] === sig) continue;   // already looks like this: every write to Acrobat is slow
    S.st[names[i]] = sig;
    if (m.hasRule && m.kind != "checks") f.required = !!(required && problem); // only while blank or wrong: Acrobat outlines Required boxes in red even when filled
    if (m.activeIf) f.readonly = !applies;                                                   // locked until it applies
    if (!applies) { clear(f, m.kind, names[i]); f.lineWidth = 1; f.strokeColor = ["G", 0.6]; f.fillColor = ["G", 0.86]; continue; } // grey, cleared
    f.lineWidth = problem || !m.underlined ? 1 : 0;
    f.strokeColor = problem ? color.red : m.underlined ? color.transparent : color.black;    // red when blank or wrong
    f.fillColor = problem ? ["RGB", 1, 0.88, 0.88] : m.underlined ? color.transparent : color.white;
  }
}
// Amounts in words (a question with words: [amount id, currency id]), as the old bill of exchange wrote them.
for (id in M) if (M[id].words && (!only || only[id]) && (f = d.getField(id))) { i = lcWords(v(M[id].words[0]), v(M[id].words[1] || "")); if (f.value != i) { f.value = i; delete S.v[id]; } }
if (!cleared) break;
}
} catch (e) { console.println("lcRules: " + e); }
d.calculate = calc;
missing.bad = bad;
missing.first = first; // the field of the first problem, for "Check form" to go to
return missing;
}

// "1,250.50", "USD" -> "USD One Thousand Two Hundred Fifty and Fifty cents only" ("" while the amount is blank).
function lcWords(a, ccy) {
  var D = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"],
      T = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"], G = ["", " Thousand", " Million", " Billion", " Trillion"];
  var s = String(a).replace(/[, ]/g, ""), m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s), out = [], n, g, k;
  if (!m) return "";
  function three(x) { var h = Math.floor(x / 100), r = x % 100, w = [];
    if (h) w.push(D[h] + " Hundred"); if (r >= 20) w.push(T[Math.floor(r / 10)] + (r % 10 ? " " + D[r % 10] : "")); else if (r) w.push(D[r]); return w.join(" "); }
  function words(t) { t = t.replace(/^0+/, ""); if (!t) return "Zero"; var parts = []; for (g = 0; t.length; g++) { n = +t.slice(-3); t = t.slice(0, -3); if (n) parts.unshift(three(n) + G[g]); } return parts.join(" "); }
  k = words(m[1]);
  if (m[2] && +m[2]) k += " and " + words(m[2].length == 1 ? m[2] + "0" : m[2]) + " cents";
  return (ccy ? ccy + " " : "") + k + " only";
}
// Acrobat only: show each date's calendar box and hide its drop-down list.
function lcDates(d) {
  var D = ["application_date","latest_shipment_date","expiry_date","draft_date"], i, t, p;
  for (i = 0; i < D.length; i++) { t = d.getField(D[i]); if (!t) continue; t.display = display.visible;
    p = d.getField(D[i] + "__list"); if (p) p.display = display.hidden; }
}
// When the warning before saving / printing was last closed. Some Acrobat versions (seen on Windows) fire the
// save / print events several times in a row; the warning then shows once, not once per event.
var lcWarnedAt = 0;
// On opening in Acrobat: show the calendars, and set every box's colour and lock.
if (typeof app != "undefined" && /^(Exchange|Reader)/.test(app.viewerType)) { lcDates(this); lcRules(this); }
// THE QR CODES' TEXT. lcPayload(doc) returns every answered question as JSON:
//   {"form": "LC-01", "version": "1.0", "saved": "...", "complete": true, "data": {field id: answer, ...}}
// Tick boxes become true; "tick any" questions become lists of the ticked options. One QR code holds 2,300 bytes of it
// (LC_QR_CAP); longer answers take as many codes as they need, at most 16 (LC_QR_MAX, the most that "structured append"
// allows; lcDrawQr splits the text). The text is padded with spaces to fill the codes it needs: 2,300, 4,600 ... 36,800
// bytes. Only beyond 16 codes are the long paragraphs shortened (and listed in "truncated"). "bencert_sent_by": ["faxed","mailed","couriered"], ["goods_description","additional_conditions"],
// "LC-01" and "1.0" are filled in by document_script (step 2).
var LC_QR_CAP = 2300, LC_QR_MAX = 16;
// The text as UTF-8 bytes, one character per byte (what goes into the codes).
function lcBytes(s) { return unescape(encodeURIComponent(s)); }
// How many codes this text needs (0 for no text).
function lcCodes(s) { return s ? Math.ceil(lcBytes(s).length / LC_QR_CAP) : 0; }
function lcPayload(d) {
var G = {"bencert_sent_by": ["faxed","mailed","couriered"]}, LONG = ["goods_description","additional_conditions"], CAP = LC_QR_CAP, BUDGET = LC_QR_MAX * LC_QR_CAP;
var data = {}, i, n, f, k, v, g, m, out, cut = [], ok = true, t = new Date();
for (i = 0; i < d.numFields; i++) {
  n = d.getNthFieldName(i); if (/^__/.test(n) || /__list$/.test(n) || /__qrx_/.test(n)) continue;
  f = d.getField(n); if (!f || f.type == "button" || f.type == "signature") continue;
  g = /^(.+)__(\d+)$/.exec(n);
  if (g && G[g[1]]) { if (f.value != "Off") { if (!data[g[1]]) data[g[1]] = []; data[g[1]].push(G[g[1]][+g[2]]); } continue; }
  if (f.type == "checkbox") { if (f.value != "Off") data[n] = true; continue; }
  v = f.type == "radiobutton" ? (f.value == "Off" ? "" : String(f.value)) : String(f.valueAsString).replace(/^\s+|\s+$/g, "");
  if (v !== "") data[n] = v;
}
if (typeof lcRules == "function") { m = lcRules(d); ok = !m.length && !(m.bad || []).length; }
function pad(x) { return ("0" + x).slice(-2); }
out = {"form": "LC-01", "version": "1.0", "saved": t.getFullYear() + "-" + pad(t.getMonth() + 1) + "-" + pad(t.getDate()) + "T" + pad(t.getHours()) + ":" + pad(t.getMinutes()), "complete": ok, "data": data};
// 16 codes hold 36,800 bytes: only if the answers are longer still, shorten the long paragraphs (in order) and say so.
for (i = 0; i < LONG.length && lcBytes(JSON.stringify(out)).length > BUDGET; i++) {
  k = LONG[i]; if (!data[k]) continue;
  cut.push(k); out.truncated = cut;
  v = lcBytes(JSON.stringify(out)).length - BUDGET + 3;
  data[k] = v < data[k].length ? data[k].slice(0, data[k].length - v) + "..." : "...";
}
// Padded with spaces to fill the codes it needs (2,300 bytes each).
v = JSON.stringify(out); n = lcBytes(v).length; m = Math.max(1, Math.ceil(n / CAP)) * CAP - (n - v.length);
while (v.length < m) v += " ";
return v;
}
// THE QR CODE ENCODER AND DRAWING (standard QR code, no library needed).
// lcQrMatrix(bytes, part) returns the 177 x 177 grid of a version 40 QR code (true = dark square). bytes is the
// text as UTF-8 bytes (one character per byte). part is null for a single code, or [index, total, parity] for
// one of several codes ("structured append", part of the QR standard: each code says it is code k of n, n at
// most 16, so a scanner that supports it joins them; any other scanner reads each code's text, and the texts are
// joined in order). Version 40, error correction M, byte mode, mask 0; at most 2,329 bytes per code.
function lcQrMatrix(s, part) {
  var N = 177, i, j, x, y, m = [], f = [], bytes = [];
  for (i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 255);
  for (y = 0; y < N; y++) { m.push([]); f.push([]); for (x = 0; x < N; x++) { m[y].push(false); f[y].push(false); } }
  function set(x, y, dark) { m[y][x] = dark; f[y][x] = true; }
  function mul(a, b) { var z = 0; for (var k = 7; k >= 0; k--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((b >>> k) & 1) * a; } return z; }
  // Function patterns: timing, finders, alignment, format area, version, dark module.
  for (i = 0; i < N; i++) { set(6, i, i % 2 == 0); set(i, 6, i % 2 == 0); }
  function finder(cx, cy) { for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
    var d = Math.max(Math.abs(dx), Math.abs(dy)), xx = cx + dx, yy = cy + dy;
    if (xx >= 0 && xx < N && yy >= 0 && yy < N) set(xx, yy, d != 2 && d != 4); } }
  finder(3, 3); finder(N - 4, 3); finder(3, N - 4);
  var A = [6, 30, 58, 86, 114, 142, 170];
  for (i = 0; i < A.length; i++) for (j = 0; j < A.length; j++) {
    if ((i == 0 && j == 0) || (i == 0 && j == A.length - 1) || (i == A.length - 1 && j == 0)) continue;
    for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(A[i] + dx, A[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) != 1);
  }
  var rem = 0, fmt; for (i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  fmt = ((0 << 10) | rem) ^ 0x5412; // error correction M (00), mask 0
  function bit(v, k) { return ((v >>> k) & 1) != 0; }
  for (i = 0; i <= 5; i++) set(8, i, bit(fmt, i));
  set(8, 7, bit(fmt, 6)); set(8, 8, bit(fmt, 7)); set(7, 8, bit(fmt, 8));
  for (i = 9; i < 15; i++) set(14 - i, 8, bit(fmt, i));
  for (i = 0; i < 8; i++) set(N - 1 - i, 8, bit(fmt, i));
  for (i = 8; i < 15; i++) set(8, N - 15 + i, bit(fmt, i));
  set(8, N - 8, true);
  rem = 40; for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
  var ver = (40 << 12) | rem;
  for (i = 0; i < 18; i++) { var a = N - 11 + i % 3, b = Math.floor(i / 3); set(a, b, bit(ver, i)); set(b, a, bit(ver, i)); }
  // Data: (for one of several codes: mode 0011, its index, the total - 1, the parity of all the text), then mode
  // 0100, 16-bit length, the bytes, terminator, padding to 2,334 data codewords.
  var bits = [], cap = 2334 * 8;
  function put(v, n) { for (var k = n - 1; k >= 0; k--) bits.push((v >>> k) & 1); }
  if (part) { put(3, 4); put(part[0], 4); put(part[1] - 1, 4); put(part[2], 8); }
  put(4, 4); put(bytes.length, 16); for (i = 0; i < bytes.length; i++) put(bytes[i], 8);
  if (bits.length > cap) throw new Error("too much text for one QR code (" + bytes.length + " bytes)");
  put(0, Math.min(4, cap - bits.length)); while (bits.length % 8) bits.push(0);
  var data = []; for (i = 0; i < bits.length; i += 8) { var v = 0; for (j = 0; j < 8; j++) v = (v << 1) | bits[i + j]; data.push(v); }
  for (i = 0; data.length < 2334; i++) data.push(i % 2 ? 0x11 : 0xEC);
  // Reed-Solomon: 49 blocks (18 of 47 + 31 of 48 data codewords), 28 error-correction codewords each.
  var div = [], root = 1; for (i = 0; i < 27; i++) div.push(0); div.push(1);
  for (i = 0; i < 28; i++) { for (j = 0; j < 28; j++) { div[j] = mul(div[j], root); if (j + 1 < 28) div[j] ^= div[j + 1]; } root = mul(root, 2); }
  var blocks = [], k = 0;
  for (i = 0; i < 49; i++) {
    var len = i < 18 ? 47 : 48, dat = data.slice(k, k + len), ecc = []; k += len;
    for (j = 0; j < 28; j++) ecc.push(0);
    for (j = 0; j < dat.length; j++) { var fct = dat[j] ^ ecc.shift(); ecc.push(0); for (var t = 0; t < 28; t++) ecc[t] ^= mul(div[t], fct); }
    if (i < 18) dat.push(-1);
    blocks.push(dat.concat(ecc));
  }
  var all = [];
  for (i = 0; i < blocks[0].length; i++) for (j = 0; j < 49; j++) if (blocks[j][i] != -1) all.push(blocks[j][i]);
  // Place the codewords in the zigzag, then mask 0 ((x + y) even flips).
  var n = 0;
  for (var right = N - 1; right >= 1; right -= 2) {
    if (right == 6) right = 5;
    for (var vert = 0; vert < N; vert++) for (j = 0; j < 2; j++) {
      x = right - j; var up = ((right + 1) & 2) == 0; y = up ? N - 1 - vert : vert;
      if (!f[y][x] && n < all.length * 8) { m[y][x] = ((all[n >>> 3] >>> (7 - (n & 7))) & 1) != 0; n++; }
    }
  }
  for (y = 0; y < N; y++) for (x = 0; x < N; x++) if (!f[y][x] && (x + y) % 2 == 0) m[y][x] = !m[y][x];
  return m;
}
// THE PAGES THE CODES GO ON. Codes 1 and 2 sit on the form's QR code page (rows "__qr1_0" ... "__qr1_176", "__qr2_..."),
// each row a read-only text box holding the letter "n" in the ZapfDingbats font (which prints as a black square) for each
// dark square. Codes 3 to 16 go two to a page on extra pages, which exist only while needed: lcDrawQr copies the hidden page
// template "qrx" (rows "__qrx_1_0" ... "__qrx_2_176") after the last page with Template.spawn, and deletes the pages it no
// longer needs (when the viewer refuses to delete one, the page stays, empty and marked "not used", and is left out of
// printing: lcLastPage). A spawned page's fields are renamed by the viewer (bRename: true) but still end in the template's
// name, so lcExtra finds them by that ending. Don't write "getField(" for those fields: build_all.py rewrites it
// to add the form's code in the joined PDF; d["getField"](name) is left alone, and the names found are already complete.
// lcExtra(doc) returns the spawned pages' field-name prefixes, in page order: [{p: prefix, page: page number}].
function lcExtra(d) {
  var out = [], i, nm, m, f, q = d.getField("__qr"), first = q && typeof q.page == "number" ? q.page : -1;
  for (i = 0; i < d.numFields; i++) {
    nm = d.getNthFieldName(i); m = /^(.*)__qrx_1_0$/.exec(nm);
    if (!m || /^([A-Z]+\.)?$/.test(m[1])) continue;     // not a row, or the template's own row ("" or the form's code)
    f = d["getField"](nm);
    if (f && typeof f.page == "number" && f.page > first && f.page < d.numPages) out.push({p: m[1], page: f.page});
  }
  out.sort(function (a, b) { return a.page - b.page; });
  return out;
}
// Code j (0 = first) as a function: x -> the field "<row>" or "label" or "frame" of its slot.
function lcSlot(d, pg, j) {
  var t = j < 2 ? "__qr" + (j + 1) : "__qrx_" + ((j - 2) % 2 + 1), p = j < 2 ? null : pg[(j - 2) >> 1] && pg[(j - 2) >> 1].p;
  return function (x) { return p === null ? d.getField(t + "_" + x) : p === undefined ? null : d["getField"](p + t + "_" + x); };
}
// Extra pages that n codes need.
function lcPagesFor(n) { return n > 2 ? Math.ceil((n - 2) / 2) : 0; }
// The last page of the form as printed: the QR code page, plus the extra pages the codes of this text use.
function lcLastPage(d, text) { return d.getField("__qr").page + lcPagesFor(lcCodes(text)); }
// "" when the codes on the pages are exactly those of this text (every code in use has its first row drawn, every other
// slot is empty); otherwise what is wrong. Used before printing.
function lcQrCheck(d, text) {
  var n = lcCodes(text), pg = lcExtra(d), j, f;
  if (pg.length < lcPagesFor(n)) return "the extra QR code pages are missing";
  for (j = 0; j < 2 + 2 * pg.length || j < n; j++) {
    f = lcSlot(d, pg, j)("0");
    if (!f) return "QR code " + (j + 1) + " is missing";
    if ((f.value !== "") != (j < n)) return j < n ? "QR code " + (j + 1) + " is blank" : "QR code " + (j + 1) + " is left over";
  }
  return "";
}
// lcDrawQr(doc, text) draws text as one QR code, or as many as it needs (at most 16, one per 2,300 bytes), and returns how
// many (0 for ""; lcDrawQr(doc, "") clears everything and removes the extra pages). The text is cut into consecutive
// equal slices; each code carries the structured-append header (its index, the total, the parity of the whole text), so a
// scanner that supports it joins them, and any other scanner reads each slice and the slices are joined in order. The
// frames, and the labels "QR code 1 of 3 (scan all 3 codes)", show only for codes in use.
function lcDrawQr(d, text) {
  var s = lcBytes(text), n = lcCodes(text), size = n ? Math.ceil(s.length / n) : 0, codes = [], parity = 0, i, k, j, y, x, row, pg, f, g, put, calc = d.calculate, more;
  if (n > LC_QR_MAX) throw new Error("the answers are too long for " + LC_QR_MAX + " QR codes (" + s.length + " bytes, at most " + LC_QR_MAX * LC_QR_CAP + ")");
  for (i = 0; i < s.length; i++) parity ^= s.charCodeAt(i) & 255;
  for (k = 0; k < n; k++) codes.push(lcQrMatrix(s.slice(k * size, (k + 1) * size), n > 1 ? [k, n, parity] : null));   // all made before anything is touched
  d.calculate = false; // thousands of rows: don't re-run the checks after each one
  try {
    pg = lcExtra(d);
    for (more = lcPagesFor(n); pg.length < more; ) {                // add the pages that are needed
      d.getTemplate("qrx").spawn({nPage: d.numPages, bRename: true, bOverlay: false});
      g = lcExtra(d); if (g.length <= pg.length) throw new Error("the viewer did not add the page for QR code " + (2 * pg.length + 3));
      pg = g;
    }
    while (pg.length > more) {                                      // take away the pages that are not
      try { d.deletePages(pg[pg.length - 1].page); } catch (e) { break; }
      g = lcExtra(d); if (g.length >= pg.length) break;
      pg = g;
    }
    for (j = 0; j < 2 + 2 * pg.length; j++) {                       // every slot: its code, or empty
      put = lcSlot(d, pg, j);
      for (y = 0; y < 177; y++) { row = ""; if (codes[j]) for (x = 0; x < 177; x++) row += codes[j][y][x] ? "n" : " ";
        put(y).value = row; }
      if (f = put("label")) f.value = !codes[j] ? (j % 2 == 0 && j >= 2 + 2 * more ? "(this page is not used)" : "") : n < 2 ? "" : "QR code " + (j + 1) + " of " + n + (j == 0 ? (n == 2 ? " (scan both codes)" : " (scan all " + n + " codes)") : "");
      if (f = put("frame")) f.display = codes[j] ? display.visible : display.hidden;
    }
  } finally { d.calculate = calc; }
  return n;
}
// THE PIPE-DELIMITED RECORDS (the old smart form's barcode text), built from the form file's position table.
// lcPipe = [record 1 entries, record 2 entries, ...]. Each entry describes one position (the old "1_01" ... "4_03"):
//   {"c": text}                         a fixed text
//   {"id": q}                           the answer as typed; also "max": cut to this many characters, "as": "amount" or "date",
//                                       "codes": {answer: code} (an answer not listed gives nothing)
//   {"lines": [q, ...]}                 each non-blank answer in [ ]
//   {"join": [q, ...]}                  the non-blank answers, one space between
//   {"tpl": {"when": tick box, "parts": [...]}}   a sentence: text with {q} answers, ["map", q, {answer: text}],
//                                       ["list", q, separator, [[option, text], ...]], ["if", q, text if answered, else text]
//   {"qty": {"on", "o", "c", "head", "tail"}}      "head IN n ORIGINALS AND m COPIES<tail>."
// Any entry may also have "if": [q, [answers]] (blank unless the answer is one of these), "d" (used when the result is
// blank), "chop": true (wrap in lines, see lcPipeChop). Every position ends with "|".
var lcPipe = [[{"p":"1_01","c":"1"},{"p":"1_02","c":"0000000"},{"p":"1_03","id":"applicant_name"},{"p":"1_04","id":"beneficiary_name"},{"p":"1_05","lines":["beneficiary_address_1","beneficiary_address_2","beneficiary_address_3"]},{"p":"1_06","id":"partial_shipment","codes":{"allowed":"L5Y","not allowed":"L5N"}},{"p":"1_07","id":"transhipment","codes":{"allowed":"L6Y","not allowed":"L6N"}},{"p":"1_08","id":"currency"},{"p":"1_09","id":"amount","as":"amount","d":"0"},{"p":"1_10","id":"gst","codes":{"inclusive of GST":"GSY"}},{"p":"1_11","id":"tolerance_plus","if":["tolerance",["true"]],"d":"0"},{"p":"1_12","id":"tolerance_minus","if":["tolerance",["true"]],"d":"0"},{"p":"1_13","id":"price_basis","codes":{"FOB":"C","CFR":"B","CIF":"A","Local Delivery":"O","FCA":"D","CIP":"G","CPT":"F","Others":"O"}},{"p":"1_14","id":"price_basis_other","if":["price_basis",["Others"]]},{"p":"1_15","id":"shipment_from","codes":{"Port of Loading / Airport of Departure":"44E","Dispatch from":"44A","Place of Taking in charge":"44A","Place of Receipt":"44A"}},{"p":"1_16","join":["shipment_from_place","shipment_from_place_2"],"if":["shipment_from",["Port of Loading / Airport of Departure"]]},{"p":"1_17","join":["shipment_from_place","shipment_from_place_2"],"if":["shipment_from",["Dispatch from","Place of Taking in charge","Place of Receipt"]]},{"p":"1_18","c":""},{"p":"1_19","c":""},{"p":"1_20","id":"shipment_to","codes":{"Port of Discharge / Airport of Destination":"44F","For Transportation to":"44B","Place of Final Destination":"44B","Place of Delivery":"44B"}},{"p":"1_21","join":["shipment_to_place","shipment_to_place_2"],"if":["shipment_to",["Port of Discharge / Airport of Destination"]]},{"p":"1_22","join":["shipment_to_place","shipment_to_place_2"],"if":["shipment_to",["For Transportation to","Place of Final Destination","Place of Delivery"]]},{"p":"1_23","c":""},{"p":"1_24","c":""},{"p":"1_25","id":"latest_shipment_date","as":"date"},{"p":"1_26","id":"expiry_date","as":"date"},{"p":"1_27","id":"presentation_days","d":"0"},{"p":"1_28","c":""},{"p":"1_29","c":""},{"p":"1_30","c":""},{"p":"1_31","id":"drafts_at","codes":{"Sight":"Y","Term":"N","Date":"N"}},{"p":"1_32","id":"term_days","if":["drafts_at",["Term"]],"d":"0"},{"p":"1_33","id":"term_after","if":["drafts_at",["Term"]]},{"p":"1_34","id":"mode_of_advising","codes":{"Full Swift":"S","Registered Airmail":"A","Airmail with Brief Swift":"S","Courier Service":"U","Courier Service with Brief Swift":"S"}},{"p":"1_35","c":""},{"p":"1_36","id":"draft_date","as":"date","if":["drafts_at",["Date"]]}],[{"p":"2_01","c":"2"},{"p":"2_02","lines":["applicant_address_1","applicant_address_2","applicant_address_3"]},{"p":"2_03","id":"third_party_name"},{"p":"2_04","lines":["third_party_address_1","third_party_address_2","third_party_address_3"]},{"p":"2_05","id":"advising_bank_name"},{"p":"2_06","lines":["advising_bank_address_1","advising_bank_address_2","advising_bank_address_3"]},{"p":"2_07","chop":true,"tpl":{"when":"doc_bill_of_lading","parts":["+ FULL SET OF CLEAN ON BOARD MARINE BILLS OF LADING MADE OUT TO ORDER",["map","bl_made_out_to",{"order of the Bank":" OF THE BANK LIMITED, NOTIFYING ","order blank endorsed":", BLANK ENDORSED, NOTIFYING ","other (specify)":" OF {bl_made_out_to_other}, NOTIFYING "}],"{bl_notify_party} MARKED 'FREIGHT ",["map","bl_freight",{"Prepaid":"PREPAID'.","Collect":"COLLECT'."}]]}},{"p":"2_08","chop":true,"tpl":{"when":"doc_air_waybill","parts":["+ ORIGINAL CLEAN AIR WAYBILL CONSIGNED TO THE BANK LIMITED, MARKED 'FREIGHT ",["map","awb_freight",{"Prepaid":"PREPAID' NOTIFYING ","Collect":"COLLECT' NOTIFYING "}],"{awb_notify_party}."]}},{"p":"2_09","c":""},{"p":"2_10","c":""},{"p":"2_11","c":""},{"p":"2_12","id":"confirmation","codes":{"true":"L9Y"},"d":"L9N"},{"p":"2_13","id":"bank_charges_for","codes":{"Beneficiary, except charges at DC Issuing Bank's counter":"LAB","Applicant (including all charges incurred inside and outside of DC Issuing Bank's country)":"LAA"}},{"p":"2_14","id":"confirmation_charges","codes":{"Applicant":"LID","Beneficiary":"LIC"}}],[{"p":"3_01","c":"3"},{"p":"3_02","chop":true,"tpl":{"when":"doc_delivery_order","parts":["+ DELIVERY ORDER IN {do_originals} ORIGINALS {do_copies} COPIES SIGNED BY BENEFICIARY MADE OUT TO APPLICANT AND COUNTERSIGNED BY {do_countersigned_by} OF OUR SIGNATORIES, WHOSE SIGNATURE(S) {do_signature_verified} BE VERIFIED BY THE BANK LIMITED."]}},{"p":"3_03","chop":true,"tpl":{"when":"doc_insurance","parts":["+ INSURANCE POLICY/CERTIFICATE IN DUPLICATE SHOWING BENEFICIARY AS ASSURED, BLANK ENDORSED FOR 110 PERCENT OF INVOICE VALUE WITH CLAIMS PAYABLE IN SINGAPORE IN THE CURRENCY OF THE CREDIT COVERING INSTITUTE CARGO CLAUSE (A), INSTITUTE WAR CLAUSES, INSTITUTE STRIKES CLAUSES/SRCC."]}},{"p":"3_04","chop":true,"tpl":{"when":"doc_beneficiary_certificate","parts":["+ BENEFICIARY'S CERTIFICATE CERTIFYING THAT ONE SET OF NON-NEGOTIABLE DOCUMENTS HAS BEEN ",["list","bencert_sent_by",", ",[["faxed","FAXED"],["mailed","MAILED"],["couriered","COURIERED"]]]," TO THE APPLICANT ",["if","bencert_days","WITHIN {bencert_days} DAY(S) AFTER SHIPMENT.","AFTER SHIPMENT."]]}},{"p":"3_05","qty":{"on":"doc_commercial_invoice","o":"invoice_originals","c":"invoice_copies","head":"+ SIGNED COMMERCIAL INVOICES"}},{"p":"3_06","qty":{"on":"doc_packing_list","o":"packing_list_originals","c":"packing_list_copies","head":"+ PACKING LIST"}},{"p":"3_07","qty":{"on":"doc_weight_note","o":"weight_note_originals","c":"weight_note_copies","head":"+ WEIGHT NOTE"}},{"p":"3_08","chop":true,"qty":{"on":"doc_certificate_of_origin","o":"origin_originals","c":"origin_copies","head":"+ CERTIFICATE OF ORIGIN","tail":["origin_country",", SHOWING COUNTRY OF ORIGIN AS {origin_country}"]}},{"p":"3_09","chop":true,"join":["other_documents_1","other_documents_2"],"if":["doc_other",["true"]]}],[{"p":"4_01","c":"4"},{"p":"4_02","chop":true,"id":"goods_description","max":400},{"p":"4_03","chop":true,"id":"additional_conditions","max":600}]];
// The answers by question id: text as typed (not trimmed), a tick box "true" (absent when not ticked), "tick any" a list.
// The records' own characters | [ ] { } and line breaks must never come from an answer (the keystroke filter refuses them, but a
// value set by FDF import, autofill or a pasted newline skips it): they become a space. Only the paragraph boxes (the entries
// with "chop" on one answer) keep Enter, which the records write as {}: any line break there is one Enter (CR).
var lcPipeLong = null;
function lcPipeAnswers(d) {
var G = {"bencert_sent_by": ["faxed","mailed","couriered"]}, A = {}, i, j, n, f, g, v, e;
if (!lcPipeLong) {
  lcPipeLong = {};
  for (i = 0; i < lcPipe.length; i++) for (j = 0; j < lcPipe[i].length; j++) {
    e = lcPipe[i][j]; if (!e.chop) continue;
    if (e.id) lcPipeLong[e.id] = 1;
    for (g = 0; e.join && g < e.join.length; g++) lcPipeLong[e.join[g]] = 1;
  }
}
for (i = 0; i < d.numFields; i++) {
  n = d.getNthFieldName(i); if (/^__/.test(n) || /__list$/.test(n)) continue;
  f = d.getField(n); if (!f || f.type == "button" || f.type == "signature") continue;
  g = /^(.+)__(\d+)$/.exec(n);
  if (g && G[g[1]]) { if (f.value != "Off") { if (!A[g[1]]) A[g[1]] = []; A[g[1]].push(G[g[1]][+g[2]]); } continue; }
  if (f.type == "checkbox") { if (f.value != "Off") A[n] = "true"; continue; }
  v = f.type == "radiobutton" ? (f.value == "Off" ? "" : String(f.value)) : String(f.valueAsString);
  v = lcPipeLong[n] ? v.replace(/\r\n|\n/g, "\r").replace(/[|\[\]{}]/g, " ") : v.replace(/[|\[\]{}\r\n]/g, " ");
  if (v !== "") A[n] = v;
}
return A;
}
// Long text in lines, as the old form wrote it: leading and trailing blanks and Enter dropped; up to 65 characters as is
// (Enter becomes {}); longer: cut at spaces into lines padded with spaces to 65 characters, each followed by {} (a word longer
// than 65 is cut at 65; with Enter, each paragraph is cut on its own). Returns "" for nothing.
function lcPipeChop(s) {
var MAX = 65;
function trim(x) { return x.replace(/^\s+/, "").replace(/\s+$/, ""); }
function lr(x) { return x.replace(/^\r+/, "").replace(/\r+$/, ""); }
function cut(x) { var r = ""; while (x.length > 0) { if (x.length > MAX) { r += x.slice(0, MAX) + "{}"; x = x.slice(MAX); } else { r += x; x = ""; } } return r; }
function words(x) {   // no Enter inside: fill lines word by word
  var w = x.split(" "), fin = [], res = "", i, r = "";
  for (i = 0; i < w.length; i++) if (w[i].length > MAX) w[i] = cut(w[i]);
  for (i = 0; i < w.length; i++) {
    if ((res + w[i]).length > MAX) {
      if (w[i].length <= MAX) { i--; while (res.length < MAX) res += " "; fin.push(res + "{}"); res = ""; }
      else { if (res !== "") { while (res.length < MAX) res += " "; res += "{}"; } fin.push(res + w[i] + " "); res = ""; }
    } else res += w[i] + " ";
  }
  if (res !== "") fin.push(res);
  for (i = 0; i < fin.length; i++) r += (i == fin.length - 1 && fin[i].slice(-1) == " ") ? fin[i].slice(0, fin[i].length - 1) : fin[i];
  return r;
}
function paragraphs(x, byWords) {   // Enter inside: each paragraph on its own (byWords: the text has spaces; no trimming then)
  var a = x.split("\r"), r = "", i;
  for (i = 0; i < a.length; i++) {
    if (byWords) { if (a[i].length > MAX) a[i] = words(a[i]); }
    else a[i] = cut(trim(a[i]));
    r += a[i] + (i < a.length - 1 ? "{}" : "");
  }
  return r;
}
if (s == null || s.length <= 0) return "";
s = trim(lr(s)); if (s.length <= 0) return "";
if (s.length <= MAX) return trim(s.replace(/\r/g, "{}"));
if (s.indexOf(" ") <= 0) return s.indexOf("\r") <= 0 ? cut(s) : paragraphs(s, false);
return s.indexOf("\r") <= 0 ? words(s) : paragraphs(s, true);
}
// One position's text.
function lcPipeValue(e, A) {
function a(id) { var x = A[id]; return typeof x == "string" ? x : ""; }
function has(list, x) { for (var i = 0; i < list.length; i++) if (list[i] == x) return true; return false; }
function fill(t) { return t.replace(/\{(\w+)\}/g, function (m, id) { return a(id); }); }
var v = "", i, x, p, o, c, ph, tail, out, picks, q, m;
if (!e["if"] || has(e["if"][1], a(e["if"][0]))) {
  if (e.c != null) v = e.c;
  else if (e.lines) { for (i = 0; i < e.lines.length; i++) if (a(e.lines[i]) !== "") v += "[" + a(e.lines[i]) + "]"; }
  else if (e.join) { x = []; for (i = 0; i < e.join.length; i++) if (a(e.join[i]) !== "") x.push(a(e.join[i])); v = x.join(" "); }
  else if (e.tpl) {
    q = e.tpl; out = ""; if (a(q.when) == "true") for (i = 0; i < q.parts.length; i++) {
      p = q.parts[i];
      if (typeof p == "string") out += fill(p);
      else if (p[0] == "map") out += fill(p[2].hasOwnProperty(a(p[1])) ? p[2][a(p[1])] : "");
      else if (p[0] == "if") out += fill(a(p[1]) !== "" ? p[2] : p[3]);
      else if (p[0] == "list") {   // ticked options in the table's order; none ticked: no sentence at all
        picks = []; x = A[p[1]] || [];
        for (m = 0; m < p[3].length; m++) if (has(x, p[3][m][0])) picks.push(p[3][m][1]);
        if (!picks.length) { out = ""; break; }
        out += picks.join(p[2]);
      }
    }
    v = out;
  }
  else if (e.qty) {
    q = e.qty; o = a(q.o); c = a(q.c);
    if (a(q.on) == "true" && (o !== "" || c !== "")) {
      tail = q.tail && a(q.tail[0]) !== "" ? fill(q.tail[1]) : "";
      if (o == "0" && c == "0") ph = "";
      else if (o === "" || o == "0") ph = " IN " + c + " " + (c == "1" ? "COPY" : "COPIES");
      else if (c === "" || c == "0") ph = " IN " + o + " " + (o == "1" ? "ORIGINAL" : "ORIGINALS");
      else ph = " IN " + o + " " + (o == "1" ? "ORIGINAL" : "ORIGINALS") + " AND " + c + " " + (c == "1" ? "COPY" : "COPIES");
      if (ph !== "" || tail !== "") v = q.head + ph + tail + ".";
    }
  }
  else if (e.id) {
    v = a(e.id);
    if (e.max != null) v = v.slice(0, e.max);
    if (e.as == "amount") { v = v.replace(/,/g, ""); if (/^\d+$/.test(v)) v += ".00"; else if (/^\d+\.\d$/.test(v)) v += "0"; }
    if (e.as == "date") { x = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(v); v = x ? x[3] + "-" + x[2] + "-" + x[1] : ""; }
    if (e.codes) v = e.codes.hasOwnProperty(v) ? e.codes[v] : "";
  }
  if (e.chop) v = lcPipeChop(v);
}
if (v === "" && e.d != null) v = e.d;
return v;
}
// The records, as an array of text. A = the answers (default: read from the PDF).
function lcPipeRecords(d, A) {
var R = [], i, j, r;
A = A || lcPipeAnswers(d);
for (i = 0; i < lcPipe.length; i++) { r = ""; for (j = 0; j < lcPipe[i].length; j++) r += lcPipeValue(lcPipe[i][j], A) + "|"; R.push(r); }
return R;
}
// What goes into the QR code: the records, a newline between them.
function lcPipeText(d) { return lcPipeRecords(d).join("\n"); }
return { lcRules: lcRules, lcPayload: lcPayload, lcDrawQr: lcDrawQr, lcDates: lcDates, lcQrMatrix: lcQrMatrix, lcWords: lcWords, lcLastPage: typeof lcLastPage == "function" ? lcLastPage : undefined, lcPagesFor: typeof lcPagesFor == "function" ? lcPagesFor : undefined, lcPipeText: typeof lcPipeText == "function" ? lcPipeText : undefined, lcQrCheck: typeof lcQrCheck == "function" ? lcQrCheck : undefined };
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
"shipment_from_place": { K: function (event, app) {
if (!event.willCommit) { event.change = event.change.toUpperCase(); if (/[^A-Za-z0-9 .,\-/()':?+#&@%\r\n]/.test(event.change)) { event.rc = false; app.beep(0); } }
} },
"shipment_from_place_2": { K: function (event, app) {
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
export const ruleEvents = {"application_date__list": "U", "application_date": "Bl", "mode_of_advising": "U", "applicant_name": "Bl", "applicant_address_1": "Bl", "applicant_address_2": "Bl", "applicant_address_3": "Bl", "applicant_address_4": "Bl", "contact_name": "Bl", "contact_tel": "Bl", "contact_fax": "Bl", "dc_no": "Bl", "bank_code": "Bl", "advising_bank_name": "Bl", "advising_bank_address_1": "Bl", "advising_bank_address_2": "Bl", "advising_bank_address_3": "Bl", "third_party_name": "Bl", "third_party_address_1": "Bl", "third_party_address_2": "Bl", "third_party_address_3": "Bl", "beneficiary_name": "Bl", "beneficiary_address_1": "Bl", "beneficiary_address_2": "Bl", "beneficiary_address_3": "Bl", "beneficiary_address_4": "Bl", "beneficiary_contact": "Bl", "beneficiary_tel": "Bl", "beneficiary_fax": "Bl", "currency": "Bl", "amount": "Bl", "tolerance": "U", "tolerance_plus": "Bl", "tolerance_minus": "Bl", "price_basis": "U", "price_basis_other": "Bl", "partial_shipment": "U", "transhipment": "U", "shipment_from": "Bl", "shipment_from_place": "Bl", "shipment_from_place_2": "Bl", "shipment_to": "Bl", "shipment_to_place": "Bl", "shipment_to_place_2": "Bl", "latest_shipment_date__list": "U", "latest_shipment_date": "Bl", "expiry_date__list": "U", "expiry_date": "Bl", "presentation_days": "Bl", "back_to_back": "U", "master_dc_no": "Bl", "master_dc_issued_by": "Bl", "drafts": "U", "drafts_percent": "Bl", "drafts_at": "U", "term_days": "Bl", "term_after": "Bl", "draft_date__list": "U", "draft_date": "Bl", "term_prepay": "U", "doc_bill_of_lading": "U", "bl_made_out_to": "U", "bl_made_out_to_other": "Bl", "bl_freight": "U", "bl_notify_party": "Bl", "doc_air_waybill": "U", "awb_freight": "U", "awb_notify_party": "Bl", "doc_delivery_order": "U", "do_originals": "Bl", "do_copies": "Bl", "do_countersigned_by": "Bl", "do_signature_verified": "Bl", "doc_insurance": "U", "insurance_arrangement": "Bl", "insurance_cover_no": "Bl", "insurance_cover_with": "Bl", "doc_beneficiary_certificate": "U", "bencert_sent_by__0": "U", "bencert_sent_by__1": "U", "bencert_sent_by__2": "U", "bencert_days": "Bl", "doc_commercial_invoice": "U", "invoice_originals": "Bl", "invoice_copies": "Bl", "doc_packing_list": "U", "packing_list_originals": "Bl", "packing_list_copies": "Bl", "doc_weight_note": "U", "weight_note_originals": "Bl", "weight_note_copies": "Bl", "doc_certificate_of_origin": "U", "origin_originals": "Bl", "origin_copies": "Bl", "origin_country": "Bl", "doc_other": "U", "other_documents_1": "Bl", "other_documents_2": "Bl", "goods_description": "Bl", "additional_conditions": "Bl", "bank_charges": "U", "bank_charges_for": "U", "confirmation": "U", "confirmation_charges": "U", "post_shipment_financing": "U", "financing_type": "U", "financing_currency": "Bl", "forward_contract_no": "Bl", "advance_payment": "U", "advance_payment_account": "Bl", "issuance_charges_account": "Bl", "authorised_person": "Bl"};
export const sectionButtons = {};

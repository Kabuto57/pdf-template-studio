# How the bank's Trade Smart Form is built

> Reverse-engineering notes on a bank's trade-application smart form (Adobe XFA), written while building PDF Template Studio. The bank's name and identifying paths are removed. Figures were re-verified against the original file on 6 Nov 2026; the form's own files and scripts are not included in this repository.

Jie Yung · first written 4 Nov 2026, verified 6 Nov 2026

## Overview

The Trade Smart Form is one Adobe XFA form built in **Adobe LiveCycle Designer 11.0**: a single 590 KB PDF that holds 13 trade application forms, 1,181 fields and 1,281 scripts. Everything smart about it (red mandatory boxes, fields that switch on and off, the "missing fields" list, amount in words) is JavaScript running inside Adobe Reader, written by the bank's vendor.

The file is built in five layers, each covered below:

1. **PDF wrapper**: an encrypted PDF 1.7 file with a Reader Extensions (UR3) signature that tells Adobe Reader to allow filling and saving.
2. **Template**: the XML form definition (pages, subforms, fields, layout). Adobe Reader draws the form from this, not from the PDF pages.
3. **Fields**: text boxes, drop-downs, tick boxes, radio groups, dates, numbers, barcodes, each with its own rules (mandatory, max length, read-only).
4. **Shared script libraries**: five script objects holding 111 reusable functions (mandatory colouring, validation, lists, amount in words, barcodes).
5. **Event scripts**: small scripts attached to each field (on change, on exit, on click) that call the shared functions.

Source: the file `Trade-Smartform.pdf` (saved 14 Apr 2026, Designer timestamp), decrypted and read on 4 Nov 2026.

## Layer 1: the PDF wrapper

The PDF itself is only an envelope: one placeholder page, no ordinary PDF form fields, and the real form stored as XML inside it. Adobe Reader sees the `NeedsRendering` flag and draws the form from that XML instead of the page.

| Part | What it holds | Why it matters |
| --- | --- | --- |
| PDF 1.7, Adobe extension level 3 | The file format | Needs Reader 9 or later for dynamic XFA |
| Placeholder page | "Please wait... If this message is not eventually replaced…" | What Chrome, Edge, Preview and pdf.js show, because they cannot render dynamic XFA |
| AcroForm with 0 fields | Only a pointer to the XFA packets | There is no normal PDF form underneath |
| `NeedsRendering = true` | Tells Reader to build pages from the template | Makes it a **dynamic** form: sections can appear, disappear and grow |
| Encryption: AES 128-bit, empty open password | Locks editing, not opening | Anyone can open and fill; nobody can change the form in Acrobat Pro |
| Permissions (`PDFSecurity`) | Print yes, fill yes, comment yes, copy yes; change no, assemble pages no | Set in Designer's PDF security settings |
| UR3 signature (`/Perms /UR3`) | Reader Extensions rights: `FillIn`, `BarcodePlaintext`, `FullSave` | Lets free Adobe Reader **save** a filled form. Signed with Adobe's server key, so we cannot make our own |
| Compression (object streams, level 6) | Smaller file | The config asks for linearization (fast web view), but the saved file is not linearized |

### The XFA packets inside

The XML is split into nine named packets stored in `/AcroForm /XFA`:

| Packet | Size | Content |
| --- | --- | --- |
| `template` | 2.5 MB | The whole form: layout, fields, scripts. Layers 2 to 5 of this document |
| `config` | 2.8 KB | Designer settings: target PDF 1.7, encryption, permissions, print options, dynamic rendering required, output path |
| `localeSet` | 2.5 KB | en_US month and day names, number and currency formats used by date and number fields |
| `datasets` | 121 B | The data. Empty in the blank form; Reader writes the customer's answers here on save |
| `xmpmeta` | 1.4 KB | Metadata: creator tool LiveCycle Designer 11.0, dated 14 Apr 2026 |
| `xfdf` | 80 B | Empty comments container |
| `PDFSecurity` | 200 B | The permission flags above |
| `preamble` / `postamble` | 174 B | The opening and closing `<xdp:xdp>` tags |

The config packet also records the vendor's Windows build path: the form was last built on 14 Apr 2026 from a Designer project on a Windows PC.

## Layer 2: the template (structure and layout)

One root subform, `form1`, holds a menu page and 17 sections. All 13 application forms live side by side; scripts show one and hide the rest, so the customer only ever sees the form they picked.

### The tree

- `form1` (layout top-to-bottom, locale en_US)
    - `pageSet`: the **master pages**, drawn behind every page
        - `Page1`: A4, content area 194 × 256 mm at 12 mm from the left. Holds the header and the toolbar shared by all forms: Date, Main Menu, Reset, Save, **Confirm & Print Form**, page *x* of *y*, and the reference number (checksum).
        - `Page2`: A4, almost full-bleed (203 × 289 mm). Used for the terms and conditions pages.
    - `MainPage`: the menu (see Navigation)
    - 17 sections, one per form or terms page (table below)
    - `variables`: the five shared script libraries (Layer 4)

| Section | Form | Fields | Sub-groups |
| --- | --- | --- | --- |
| `LC` | Irrevocable Documentary Credit | 162 | 60 |
| `LCTermsAndConditions` | LC terms (static text) | 0 | 0 |
| `LC_Amendment` | Amendment to Original Documentary Credit | 54 | 18 |
| `EBLC` | Documents under Export LC | 113 | 28 |
| `EBLCTermsAndConditions`, `…1` | EBLC terms, 2 pages | 0 | 0 |
| `OBC` | Export Documentary Collection | 97 | 33 |
| `OBCTermsAndConditions` | OBC terms | 0 | 0 |
| `DBRP` | Import Financing | 147 | 65 |
| `BEOBC`, `BEEBLC`, `BEGeneric` | Bill of Exchange (3 variants) | 41, 47, 45 | 3 each |
| `SBLC` | Standby Letter of Credit | 66 | 39 |
| `SBLCA` | SBLC Amendment | 49 | 26 |
| `BG` | Banker's Guarantee | 90 | 42 |
| `BGA` | BG Amendment | 49 | 27 |
| `EXPORT` | Pre-shipment financing on open account | 111 | 55 |

### How the layout works

- **Flowed vs positioned**: 98 subforms flow top-to-bottom (`tb`), 51 flow left-to-right then wrap (`lr-tb`), 14 are tables or rows, and 269 are fixed-position boxes. Each section flows, so when a hidden part appears, everything below moves down and new pages are added automatically.
- **Repeating rows**: 6 groups can be added as many times as needed (`occur max=-1`): contracts, debit commission details and supplier messages in Import Financing; buyers, contracts and debit details in Export Financing.
- **Page breaks**: terms pages force a jump to `Page2`; forms start on `Page1`.
- **Fonts**: Arial for almost everything (1,792 uses), Myriad Pro for Designer defaults (349), Courier New for barcode text. Fonts are not embedded.
- **Accessibility**: 1,024 `speak` and 1,042 `assist` entries give screen-reader text and tooltips; 1,520 `traversal` entries set the Tab order.

## Layer 3: the fields

The template has 1,129 fields plus 52 radio groups. Each field is an XML element with a type, a caption, a size, a value limit and optional rules; nearly every setting is made in Designer's Object and Field palettes, not in code.

### Field types

| Type (XFA `ui`) | Count | Used for |
| --- | --- | --- |
| `textEdit` | 662 | Names, addresses, references, free text. 92 are multi-line |
| `checkButton` | 194 | 137 round (radio buttons inside the 52 radio groups), 57 square tick boxes |
| `choiceList` | 64 | Drop-downs: currency, country, port wording, charges, signature options |
| `barcode` | 62 | PDF417 and Code 128 / Code 39 barcodes (see Barcodes) |
| `button` | 53 | Menu choices, Main Menu, Reset, Save, Confirm & Print |
| `dateTimeEdit` | 49 | Dates with a calendar pop-up |
| `numericEdit` | 45 | Amounts, days, number of originals and copies |

### Naming convention

The vendor names every object by a prefix plus a description, and groups them in subforms prefixed `subfrm`. Scripts rely on these names, for example `LC.subfrmLC.subfrmBeneficiary.txtName`.

| Prefix | Meaning | Count |
| --- | --- | --- |
| `txt` | Text field | 736 |
| `drp` | Drop-down | 69 |
| `chk` | Tick box | 63 |
| `btn` | Button | 49 |
| `rad` | Radio button or radio group | 20 buttons, 47 groups (2 more named `radio…`) |
| `subfrm` | Subform (a group of fields) | 165 (of 432 subforms in total) |

### Settings on each field

- **Max characters**: 452 fields have a limit. The most common is **35** (199 fields), which is the SWIFT line length, and **3** (76 fields) for currency codes. Long text boxes allow 3,000 to 9,000 characters (goods description, documents, conditions).
- **Mandatory**: 137 fields have `validate nullTest="error"`, which means Adobe refuses to treat the form as complete while they are empty. 13 more have a `scriptTest` warning. Scripts switch `nullTest` on and off at run time for conditional fields.
- **Access**: 779 open, 341 read-only (unlocked by scripts when a choice is made, or bank-use boxes), 9 protected (calculated).
- **Presence**: 115 fields start hidden and are shown by scripts.
- **Display patterns (pictures)**: dates as `DD MMM, YYYY` (49), `DD/MM/YYYY` (47) or `YYYY-MM-DD` (8); amounts as `zzz,zzz,zzz,zz9.99`.
- **Data binding**: 934 fields are `bind match="none"`: their values are not written to a data file; they exist only in the saved PDF. The 5 `global` fields share one value across forms (for example the CIF number).
- **Captions** sit inside the field object, left of or above the box; `*` marks a mandatory field in the caption text itself.

## Layer 4: the shared script libraries

All reusable logic sits in five **script objects** under `form1.variables`, about 296 KB of JavaScript and 111 functions. A field's own script calls them by library name, for example `controlScript.mandatoryChange(field, 1)`. In Designer these appear in the Hierarchy palette under Variables.

| Library | Size | Functions | Role |
| --- | --- | --- | --- |
| `controlScript` | 111 KB | 79 | The engine: mandatory colouring, validation, lists, dates, show/hide, SHA-1 |
| `barcodeScript` | 157 KB | 21 | Packs each form's answers into barcode text |
| `fieldsCheck` | 22 KB | 6 | One "which mandatory fields are missing" check per form |
| `currencyConvertor` | 6 KB | 5 | Amount in words |
| `errorMessage` | 0.2 KB | 0 | Three message strings |

### controlScript, grouped by job

| Job | Functions | What they do |
| --- | --- | --- |
| Mandatory | `mandatoryChange`, `checkBoxMandatoryChange`, `radioMandatoryCheck`, `selectMandaotoryField`, `setMandatoryBackColor`, `resetMandatoryBackColor`, `radioColorRemove`, `radioColorRemoveReset`, `mandatoryCheckBE` | Switch `nullTest` on or off; collect every mandatory field on every page; paint empty ones red (`250,100,100`) and the rest white; put the cursor on the first empty one |
| Lock and show | `accessChange`, `accessChanger`, `accessChangeBE`, `presenceChange`, `wordVisible` | Set a field read-only or open and grey or white its fill; show or hide a subform; hide text by turning it white |
| Keystroke filters | `forceNumberOnly`, `forceAlphaNumericOnly`, `ForceNumberAndDecimalOnly`, `validateRegularExp`, `validateRegularExpNumeric`, `specialCharacterCheck`, `changeUpper`, `lengthLimit`, `checkMaxLength`, `checkMaxLength_BE` | Run on every key press; drop the key (`xfa.event.change = ""`) when it is not allowed |
| Value checks | `plusNumeric`, `validateDate`, `dateCompare`, `compareEffectiveDate`, `compareExpiryDate`, `checkOnExpiryDate` | Refuse negative numbers, bad dates, an expiry before the effective date |
| Dates | `currentDate`, `dateFormatChange`, `dateFormatChangeMainPage`, `dateFormatChangeBarcode` | Fill today's date; convert `YYYY-MM-DD` to the display or barcode format |
| Lists | `populateDropDownlist`, `populateCountryList`, `populateEntityList`, `getBranchName` | Fill drop-downs at start-up from arrays held in the library: 58 currencies (`currencyArray`), countries (`countryArray`), bank entities and branches (`EntityArray`) |
| Cross-form | `CIFChange`, `exchangeMap`, `BEMapping_EBLC`, `BEMapping_OBC` | Copy the CIF number to every form; copy EBLC or OBC answers into the Bill of Exchange and lock them |
| Start and reset | `init`, `resetInit`, `versionCheck` | Show the menu and hide all forms; re-fire change events after Reset; warn on Reader older than 8.1.3 |
| Text tools | `Trim`, `trim`, `RemoveLR`, `replaceAll`, `concatValue`, `strChop`, `strChop1`, `BankProcess1` to `BankProcess5` | Trim spaces, join fields, cut long text into 35- or 64-character lines for SWIFT and barcodes |
| Reference number | `checkSum`, `showCheckSumValue`, `hex_sha1` and 15 SHA-1 helpers | A standard open-source SHA-1 library, used to make a unique reference |
| Debug | `Show`, `checkValue` | Pop-up message boxes the developer used while testing |

### The other libraries

- **fieldsCheck**: `checkLCMandatory`, `checkOBCMandatory`, `checkBEMandatory` (EBLC), `checkBEEBLCMandatory`, `checkBEOBCMandatory`, `checkBEGenericMandatory`. Each reads its form's key fields by full path, and for each empty one appends a line such as "- Beneficiary Name" to a visible list box headed "Mandatory fields that were not completed are as below".
- **errorMessage**: "Please provide valid number.", "Please enter the mandatory fields highlighted in red colour.", "Please input the date format as dd/mm/yyyy or select a date from the calendar provided."
- **currencyConvertor**: `toWords`, `addDecimalCurrency`, `massageString`, `getWholeWord`, `cutString` (see Calculations).
- **barcodeScript**: `LCbarcode`, `LCAmdtbarcode`, `EBLCbarcode`, `OBCbarcode`, `DBRPbarcode`, `SBLCbarcode`, `SBLCAbarcode`, `BGbarcode`, `BGAbarcode`, `EXPORTbarcode`, five of them (LC, LC Amendment, OBC, EBLC, DBRP) with a `cleanUp…` partner, plus `GetBarData`, `GetPriceBasis`, `GetShipmentFrom`, `GetShipmentTo`, `GetShipmentTextData`, `GetModeOfAdvising`.

## Layer 5: the event scripts on each field

Every field can carry scripts on events, written in Designer's Script Editor (the strip above the canvas: pick the event in **Show**, the language in **Language**, then type). The form has 1,276 event scripts, all JavaScript (no FormCalc). Most are one to ten lines that call a shared library function.

### Which events are used

| Event | Count | Fires when | Typical use here |
| --- | --- | --- | --- |
| `change` | 738 | Every key press, tick or drop-down pick | Uppercase the key (`changeUpper`, 592 calls), block bad characters, switch dependent fields mandatory and open |
| `exit` | 239 | The cursor leaves the field | Check and reformat dates, refuse negatives, write amount in words, copy CIF to other forms |
| `ready` (`$form`) | 96 | After data is loaded or changed | Re-apply rules so a saved form reopens with the right fields red, open or hidden |
| `initialize` | 75 | Form opens | Fill drop-downs (`populateDropDownlist(this)`), set today's date |
| `click` | 54 | A button is pressed | Menu choices, Main Menu, Reset, Save, Confirm & Print |
| `calculate` | 43 | Any value it reads changes | 42 barcode fields re-encode themselves; one shows the right header labels per form |
| `full` | 23 | The field reaches its max characters | "If 'Name' too long, please continue to key in first line of Address field." |
| `ready` (`$layout`) | 7 | After each layout pass | *Page x of y**, the reference number, LC term-draft boxes* |
| `prePrint` | 1 | Before printing (on `form1`) | Blocks File > Print (see Navigation) |

### What the scripts call most

| Call | Times |
| --- | --- |
| `controlScript.mandatoryChange` | 684 |
| `controlScript.accessChange` | 674 |
| `controlScript.changeUpper` | 592 |
| `controlScript.validateRegularExpChange` | 272 |
| `controlScript.exchangeMap` | 115 |
| `controlScript.presenceChange` | 114 |
| `controlScript.setMandatoryBackColor` | 61 |
| `controlScript.populateDropDownlist` | 45 |
| `controlScript.plusNumeric` | 44 |
| `controlScript.forceNumberOnly` | 43 |

### Real examples

A drop-down's `initialize` fills it from the shared currency list:

```javascript
controlScript.populateDropDownlist(this);
```

A date's `exit` checks the format and puts in today's date if left blank:

```javascript
if(!controlScript.dateFormatChange(this))
{
	form1.MainPage.subfrmMain.txtLC.rawValue = this.rawValue;
	form1.MainPage.subfrmMain.btnLC.execEvent("click");
}
if (this.rawValue == null)
	controlScript.currentDate( this );
```

The Save button's `click` just opens Reader's Save As:

```javascript
app.execMenuItem("SaveAs");
```

The trigger pattern for conditional fields is in the next section. Each trigger repeats its logic twice: once on `change` (when the customer picks) and once on `ready` (when a saved form reopens), which is why there are 96 `ready` scripts.

## How mandatory and conditional-mandatory work

Mandatory is one built-in flag per field, `validate.nullTest`. Scripts only flip that flag; one shared check later reads every flag and paints the empty fields red. This split is the core design of the whole form.

The trigger's script only flags; nothing turns red until a button runs the shared check.

### Step 1: the trigger flips flags

The Insurance drop-down's `change` script (abridged):

```javascript
if (xfa.event.newText == "Insurance covered by applicant under open Cover No.")
{
	controlScript.presenceChange( subfrmCoverNo, "visible");
	controlScript.mandatoryChange( subfrmCoverNo.txtCoverNo, 1 );
	subfrmCoverNo.txtCoverNo.access = "open";
}
else
{
	controlScript.presenceChange( subfrmCoverNo, "hidden");
	controlScript.mandatoryChange( subfrmCoverNo.txtCoverNo, 0 );
	subfrmCoverNo.txtWith.access = "readOnly";
}
```

The shared helper is three lines:

```javascript
function mandatoryChange( field, val )
{
	field.validate.nullTest = (val == 1) ? "error" : "disabled";
}
```

- `accessChange(field, "readOnly")` also clears the flag, turns the text white (hidden) and resets radio buttons, so a locked field can never block printing.
- `checkBoxMandatoryChange(a, b)` makes a pair mandatory until either is ticked ("tick one of these").
- `radioMandatoryCheck()` does the same for the LC price-basis radio group (FOB, CFR, CIF, FCA, CIP, CPT, Local delivery, Others).
- 165 event scripts call `mandatoryChange`, 684 times in total.

### Step 2: the shared check paints red

`selectMandaotoryField()` walks every laid-out page (`xfa.layout.pageContent(i, "field")`) and stores the path of every field whose `mandatory` is `"error"` in `mandatoryArray`. Hidden fields are not laid out, so they are skipped automatically.

`setMandatoryBackColor()` then visits each stored field:

- empty: set its box fill (`ui.oneOfChild.border.fill.color`) to `250,100,100`, move the cursor to the first one (`xfa.host.setFocus`), count it;
- filled: set the fill back to white `255,255,255`;
- special case: of a plus/minus tolerance pair, one filled is enough.

It returns 1 if anything is empty. The caller then shows "Please enter the mandatory fields highlighted in red colour." and does not print or move on.

### Step 3: reopening a saved form

The same trigger logic is repeated in each trigger's `ready` event, so when a saved PDF is reopened the flags, open/locked state and visible sections are rebuilt from the saved answers.

### When the scripts run, and when they do not

All of this needs Reader to run the form's scripts. Our control test on 4 Nov 2026 showed it depends on **trust for that file**, not on the UR3 signature: a byte-identical copy of the bank form, renamed and in another folder, opened with the yellow bar and its scripts blocked on the Mac. Only the copy already trusted (yellow bar > Options > trust, or a Privileged Location) ran them. So in a locked-down Reader the smart form is no smarter than ours until the customer trusts it, which is why the Studio also draws red frames that need no script.

## Input checks

The form checks input at three moments: on each key press (the key is dropped), when the cursor leaves the field (the value is fixed or refused), and at print (missing mandatory fields). It never sends anything anywhere; all checks run inside Reader.

### On each key press (`change` event)

The trick is `xfa.event.change`: the character about to be typed. Setting it to `""` throws the key away, so the customer simply cannot type a bad character.

| Check | How | Where |
| --- | --- | --- |
| Uppercase only | `xfa.event.change = xfa.event.change.toString().toUpperCase()` | 592 text fields (SWIFT messages are uppercase) |
| SWIFT characters only | Drop any key matching the form variable `AlphaNumericSwift` = `[^a-zA-Z0-9\s,.:'\+\(\)\?'\-/]` | 272 text fields |
| Digits only | Variable `Number` = `[^0-9]`, or `forceNumberOnly` | Days, counts, CIF number |
| Digits and decimal point | `ForceNumberAndDecimalOnly` | Amounts |
| Letters and digits | `forceAlphaNumericOnly` | References |
| No tilde | `specialCharacterCheck` drops `~` | `BankProcess5` uses `~` as a line-break placeholder when splitting multi-line text, so a typed `~` would break the split |
| Length | `lengthLimit(n)`, and `checkMaxLength` for two or three fields that share one SWIFT limit (name plus address lines) | 50 fields |

The regular expressions are stored once as text **form variables** (`form1.variables`, Designer's Form Properties > Variables), so every field refers to `AlphaNumericSwift.value` instead of repeating the pattern.

### When the field is left (`exit` event)

- **Dates**: `dateFormatChange` and `validateDate` check the value; a bad date shows "Please input the date format as dd/mm/yyyy or select a date from the calendar provided." Blank form dates get today's date (`currentDate`).
- **Date order**: `compareEffectiveDate`, `compareExpiryDate` and `checkOnExpiryDate` stop a guarantee expiring before it starts.
- **No negatives**: `plusNumeric` clears a negative number and shows "Please provide valid number."
- **Field full**: on 23 name fields the `full` event says "If 'Name' too long, please continue to key in first line of Address field."

### Built into the field (no script)

- **Max characters** on 452 fields (`maxChars` in the field's value).
- **Display patterns** for dates and amounts (Object > Field > Patterns), which reformat what is shown and reject text that does not fit.
- **Numeric fields** refuse letters natively.
- **Mandatory** via `nullTest` (next section).

## Navigation, saving and printing

The customer never scrolls through 13 forms: buttons flip `presence` between `visible` and `hidden` on whole sections. Printing is forced through one button so the mandatory check and the reference number always run.

### Opening the file

1. `init()` shows `MainPage` and hides every form and terms page.
2. `versionCheck()` reads `xfa.host.version` and warns if Reader is older than 8.1.3.
3. `initialize` scripts fill all drop-downs; `ready` scripts put today's date in the hidden date fields.

### The menu page (`MainPage`)

- **Customer Identification No.** (CIF), digits only. `CIFChange` copies it into a hidden CIF field for every form, so it is typed once.
- **"Please select the form that you require."** Four headings, Import, Export, Loans and Guarantees, with 11 buttons: LC, LC Amendment, EBLC, OBC, Bill of Exchange (generic), Import Financing, Export Financing, BG, SBLC, BG Amendment, SBLC Amendment. Two more Bill of Exchange buttons (EBLC and OBC mapping) are hidden and reached from inside those forms.
- A consent tick box: "By ticking on this box and by printing these forms and submitting to you, we agree to be bound by…" the terms.
- Each menu button first runs the mandatory check over the fields currently on screen. Only when `setMandatoryBackColor()` returns 0 does it show its form and hide all others; otherwise it shows the red-fields message.

### The toolbar (master page `Page1`)

Because it lives on the master page, the same toolbar appears on every page of every form:

| Button | Script |
| --- | --- |
| Main Menu | Hide the form, show `MainPage` |
| Reset | Ask "Are you sure you want to reset the form?"; then `xfa.host.resetData("form1.LC")` (or the visible form only) and clear its reference number; `resetInit` re-fires change events so rules reset too |
| Save | `app.execMenuItem("SaveAs")`; works in free Reader only because of the UR3 rights |
| Confirm & Print Form | See below; each form also has its own print button beside its barcode |

A `calculate` script on the header swaps the header labels (form title, side label, footer) to match whichever form is visible.

### Printing

The form's own print button (LC example, `LC.subfrmOthers.btnPrint`):

```javascript
form1.MainPage.subfrmMain.txtPrint.rawValue = 1;     // "printing via our button" flag
controlScript.selectMandaotoryField();               // collect mandatory fields
controlScript.radioMandatoryCheck();
controlScript.setMandatoryBackColor();               // paint empty ones red
barcodeScript.LCbarcode();                           // build barcode text
if (controlScript.setMandatoryBackColor() == 0) {
    form1.variables.checkSumValue.value = controlScript.checkSum();
    form1.pageSet.Page1.txtCheckSum.rawValue = form1.variables.checkSumValue.value;
    xfa.host.print(1, "0", (xfa.host.numPages -1).toString(), 0, 1, 1, 0, 0);
} else
    xfa.host.messageBox("" + errorMessage.msgMandatoryEmpty);
form1.MainPage.subfrmMain.txtPrint.rawValue = 0;
```

(Comments added here; the original has none.) Bills of Exchange are softer: they ask "Mandatory field(s) are not filled in. Are you sure you want to print?" and print anyway on Yes, adding the missing-fields list to the printout.

**File > Print is blocked.** The form-level `prePrint` event checks the `txtPrint` flag. If it is 0 (the customer used Reader's own Print), it says "Please DO NOT use the print feature from File menu or toolbar…", hides every form and shows a blank page instead, so the bank never receives an unchecked printout.

## Calculations

The form does three kinds of calculation, all in JavaScript on `exit` or `calculate` events.

### Amount in words (Bills of Exchange)

When the customer leaves the amount field, its `exit` script writes the amount in words into the bill's amount-in-words lines:

```javascript
var strAmount = currencyConvertor.toWords(txtExchange.formattedValue, drpCurrency.rawValue);
var strFill1 = currencyConvertor.massageString(strAmount, form1.BEOBC.subfrmFirst.Dummy1.somExpression);
var strFill2 = currencyConvertor.cutString(strFill1, strAmount);
```

- `toWords` turns `1,250.50` with `USD` into "USD One Thousand Two Hundred Fifty and Fifty cents only". It walks the digits in groups of three with word lists for units, teens, tens and Thousand / Million / Billion / Trillion.
- `addDecimalCurrency` names the minor unit by currency: cents (USD, EUR, SGD, AUD, HKD and 12 more), ore (DKK, NOK, SEK), fils (BHD, KWD, AED), centavo, piastre, paise, poisha, pyas, fen (CNY, CNH), haleru, pence (GBP) and others.
- `massageString` and `getWholeWord` fit the words to the printed line: they put the text into a hidden dummy field one word at a time, call `xfa.layout.relayout()`, and stop when the field grows taller. `cutString` gives the rest to the next line. This is how the form wraps words without splitting them.

### Dates

- `currentDate` fills today's date as `YYYY-MM-DD`, the field's raw value; the display pattern shows it as `DD/MM/YYYY` or `DD MMM, YYYY`.
- `dateFormatChange`, `dateFormatChangeMainPage` and `dateFormatChangeBarcode` convert between those formats.
- `dateCompare` uses Acrobat's `util.scand("yyyy-mm-dd", …)` to compare two dates.

### Page and header values

- Page *x* of *y*: `xfa.layout.page(this)` and `xfa.layout.pageCount()` on the master page, recalculated after each layout.
- Header labels: a `calculate` script shows the title and side label of the visible form.
- Combined fields: `concatValue` joins up to four fields (for example address lines) into one value.

## Barcodes and the reference number

The barcodes let Trade Ops scan a printed form instead of retyping it. This is the short version.

- **62 barcode fields**: 42 PDF417 (2D, error correction level 5) carry the data; 10 Code 128 and 10 Code 39 hold fixed form-type IDs set in the template, not by any script (the Code 39 ones are hidden).
- **Filling them**: at print, `barcodeScript.LCbarcode()` (one function per form) joins the answers into one pipe-separated string, translating choices into SWIFT codes (`L5Y` = partial shipment allowed, `44E` = port of loading). The string is cut across several barcode fields when it is too long for one.
- **Drawing them**: each barcode field has a `calculate` script generated by Designer's "Paper Forms Barcode" object (`createBarcodeContent()`), which reads the hidden text field holding that part of the string.
- **Reference number**: `checkSum()` makes a SHA-1 hash of the date, time and a random number, shown on every page. It identifies the printout; it does not protect the content.

## How to build a form like this yourself

There are two routes. The vendor's route needs Adobe's paid tools and server; ours (PDF Template Studio) needs neither, and every feature above except dynamic show/hide has an equivalent.

### Route A: the vendor's way (Adobe Designer)

1. **Get the tool**: LiveCycle Designer is now sold as Adobe Experience Manager (AEM) Forms Designer, Windows only, licensed.
2. **New form**: File > New, Dynamic XML Form. Set A4 master pages (Page1 with the toolbar, Page2 for terms).
3. **Draw the sections**: one flowed subform per form, named `LC`, `EBLC` and so on; inside, subforms per block (`subfrmApplicant`, `subfrmBeneficiary`).
4. **Add fields** from the Object Library, name them `txt…`, `drp…`, `chk…`, `rad…`; set max characters, patterns, Type = User Entered - Required for always-mandatory fields.
5. **Add script objects**: right-click `form1` in Hierarchy > Insert Script Object; paste the shared functions (`mandatoryChange`, `setMandatoryBackColor`, filters).
6. **Add form variables**: Form Properties > Variables for regular expressions and stored values.
7. **Write event scripts**: select a field, pick the event in the Script Editor, write the call (pattern in the Mandatory section).
8. **Menu and toolbar**: buttons whose `click` flips `presence`; a print button that checks, then calls `xfa.host.print`; a `prePrint` guard.
9. **Save as Dynamic PDF**, set the security (no changes, filling allowed) and encryption.
10. **Reader Extensions**: run the PDF through AEM Forms (server) to add the UR3 signature, so free Reader can save it. Without this step, Reader shows "cannot save data".

Catch: XFA is deprecated in PDF 2.0; Chrome, Edge, Safari, macOS Preview and mobile viewers show only "Please wait…". Only Adobe Reader and Acrobat render it.

### Route B: our way (PDF Template Studio)

The Studio builds an ordinary PDF form (AcroForm), which every viewer can open, and generates the scripts from data instead of hand-writing them.

| Smart form feature | Smart form does it with | Studio equivalent |
| --- | --- | --- |
| Sections and fields | Subforms and fields in Designer | Sections and questions in the Design step |
| Field types | textEdit, choiceList, checkButton, dateTimeEdit, numericEdit | Text, Paragraph, Drop-down, Tick box, Pick one, Tick any, Date |
| Always mandatory | `nullTest="error"` | `required: true` |
| Mandatory when… | 165 hand-written `change` scripts calling `mandatoryChange` | `requiredIf: [{ field, values }]`, one line per rule; the engine writes the script |
| Locked until… | `accessChange(field, "readOnly")` | `activeIf` |
| Red empty fields | `setMandatoryBackColor` paints `250,100,100` | Red border and light fill from the generated `lcRules` script, plus red frames that work with JavaScript off |
| Key filters | `xfa.event.change = ""` | `format`: number, amount, phone, account; plus SWIFT characters |
| Max characters | `maxChars` | `max` |
| Missing-fields list | `fieldsCheck` | "Check form" button and save/print warning |
| Show/hide whole forms | `presence` on subforms | One form per PDF instead (AcroForms cannot reflow) |
| Data back out | Barcodes, scanned | Structured data read straight from the saved PDF in the Trade Ops workbench |

Today the Studio's Design screen can set type, options, half width and Required. `requiredIf`, `activeIf`, `max` and `format` exist in the engine and the LC uses them, but they still need controls on the Design screen.

## Appendix: inventory per form

Counts include radio groups as one input each, so totals are slightly higher than the field-only counts in Layer 2. "Always mandatory" means mandatory when the form opens; scripts add more at run time.

| Section | Inputs | Always mandatory | Hidden at start | Drop-downs | Event scripts |
| --- | --- | --- | --- | --- | --- |
| DBRP (Import Financing) | 155 | 16 | 15 | 15 | 190 |
| LC | 175 | 14 | 7 | 6 | 176 |
| EXPORT | 116 | 16 | 7 | 11 | 140 |
| EBLC | 121 | 14 | 5 | 3 | 134 |
| OBC | 98 | 12 | 4 | 1 | 109 |
| BG | 96 | 21 | 13 | 6 | 76 |
| BEEBLC | 47 | 10 | 5 | 2 | 67 |
| BEOBC | 41 | 8 | 3 | 2 | 61 |
| SBLC | 69 | 24 | 11 | 2 | 60 |
| LC_Amendment | 59 | 7 | 7 | 3 | 56 |
| BGA | 50 | 4 | 5 | 6 | 53 |
| SBLCA | 51 | 5 | 5 | 5 | 50 |
| BEGeneric | 45 | 11 | 3 | 2 | 48 |
| MainPage (menu) | 35 | 0 | 21 | 0 | 25 |
| Page1 / Page2 (toolbar) | 23 | 0 | 5 | 0 | 28 |
| **Total** | **1,181** | **162** | **115** | **64** | **1,276 + 3 on form1** |

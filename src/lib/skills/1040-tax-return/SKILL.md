---
name: 1040-tax-return
description: >
  Prepare a complete Form 1040 individual federal income tax return from client documents.
  Reads W-2s, 1099s, K-1s, and organizers from a client folder, populates the 1040 Excel
  workbook Intake tab, recalculates all schedules, reviews for accuracy, generates an IRS-style
  PDF return package, and optionally compares against a draft return from tax software to produce
  a discrepancy report. Trigger whenever the user mentions 1040, individual tax return, tax
  return prep, prepare a return, populate the intake, generate tax return PDF, review tax return,
  compare tax returns, reconcile returns, W-2 or 1099 processing, or any request to prepare,
  review, or compare a federal income tax return. If someone provides tax documents and says
  "prepare the return," use this skill.
---

# Form 1040 Individual Tax Return Preparation Skill

You are a tax return preparation agent. Your job is to take client-provided source documents, extract all relevant tax data, populate a standardized 1040 Excel workbook, verify the calculations, generate a professional PDF return package, and optionally compare it against a draft return from other tax software.

## Overview of the Workflow

The end-to-end process has five phases. You should always work through them in order, but some phases may be skipped depending on what the user asks for (e.g., they may already have a populated workbook and just want the PDF).

1. **Document Ingestion** — Read all client files from the client folder
2. **Intake Population** — Write extracted data into the Excel workbook's Intake tab
3. **Recalculation & Review** — Recalculate formulas and audit for accuracy
4. **PDF Generation** — Produce the IRS-style return package
5. **Comparison** (optional) — Compare against a draft return and report discrepancies

---

## Phase 1: Document Ingestion

### Locating Client Files

Ask the user which folder contains the client's documents. Read every file in that folder. Common document types you'll encounter:

- **W-2** (wages) — PDF or image of employer wage statements
- **1099-INT** (interest) — from banks, brokerages
- **1099-DIV** (dividends) — from investment accounts
- **1099-B** (brokerage/capital gains) — may be multi-page with many transactions
- **1099-R** (retirement distributions) — IRA, pension, annuity
- **1099-NEC / 1099-MISC** (self-employment / other income)
- **1099-SSA** (Social Security)
- **Schedule K-1** (partnership, S-corp, trust income)
- **Mortgage interest statement (1098)**
- **Property tax bills**
- **Charitable donation receipts**
- **Foreign bank account statements**
- **Prior-year return** (for carryovers, filing status reference)
- **Client organizer/questionnaire** (may be a Word doc, PDF, or spreadsheet)
- **Draft return PDF** from tax software (for comparison phase)

### Extraction Strategy

For each document:

1. Read it with the appropriate tool (Read for PDFs/images, or parse Excel/CSV files)
2. Identify the document type from its content
3. Extract all numeric values, names, EINs/SSNs, dates, and categorize them
4. Keep a running tally of extracted data, organized by Intake section

Create a **data extraction log** as you go — a structured summary of what you found in each document, what Intake fields it maps to, and any ambiguities or missing information. This is your working paper.

### Handling Ambiguity

If information is unclear, missing, or conflicting:
- Flag it in your extraction log with a note like `[NEEDS CLARIFICATION]`
- Continue processing other documents
- Present all flagged items to the user before populating the Intake tab
- Never guess at SSNs, EINs, or filing status — always confirm with the user

---

## Phase 2: Intake Population

### The Workbook

The 1040 workbook template is located at the path the user specifies (or create a fresh copy from `scripts/build_1040.py`). It contains 19 tabs:

**Input tab:** Intake (312 rows, 21 sections — this is where you write data)
**Calculation tabs:** Dashboard, Tax Tables, Form 1040, Deduction Calc, Tax Computation
**Schedule tabs:** Schedule 1, 2, 3, A, B, C, D, SE, E, Form 8949, Form 8938, Form 8621, Form 3520

All schedule tabs contain formulas that pull from the Intake tab automatically. You only write to the Intake tab (and Form 8949 for individual capital gain transactions).

### How to Write Data

Use openpyxl to write values. The Intake tab has merged cells for section headers — avoid writing to those. Use the `ws.cell(row=N, column=C, value=V)` method which safely writes to the underlying cell.

```python
from openpyxl import load_workbook
import shutil

# Always work on a copy
shutil.copy(template_path, output_path)
wb = load_workbook(output_path)
ws = wb['Intake']

# Write using cell() method — safe with merged cells
ws.cell(row=14, column=3, value='John')  # First Name
```

### Complete Intake Field Map

Below is every writable field in the Intake tab. Column C = primary taxpayer/value, Column E = spouse (where applicable). "Column C" means `column=3` in openpyxl.

Read `references/intake_field_map.md` for the complete field-by-field reference with all row numbers, columns, and expected data types. The reference file contains every single cell you can write to.

Here is a summary of the 21 sections:

| Section | Rows | What Goes Here |
|---------|------|----------------|
| 1. Filing Information | 6-10 | Filing status (1-5), digital assets, std/itemize, dependent status |
| 2. Taxpayer Info | 14-25 | Names, SSN, DOB, occupation, blind/age flags (col C=primary, E=spouse) |
| 3. Mailing Address | 28-35 | Street, apt, city, state, ZIP, foreign address fields |
| 4. Dependents | 39-49 | Up to 10 dependents: name, SSN, relationship, CTC eligibility |
| 5. W-2 Wages | 52-56 | Up to 5 W-2s: employer, EIN, wages, withholding, SS/Medicare |
| 6. Interest (1099-INT) | 61-68 | Up to 8 payers: name, amount, tax-exempt, foreign tax |
| 7. Dividends (1099-DIV) | 74-81 | Up to 8 payers: ordinary, qualified, cap gain dist, foreign tax |
| 8. Capital Gains (1099-B) | 87-106 | Up to 20 transactions: description, dates, proceeds, basis, S/L |
| 9. Business Income (Sch C) | 111-141 | Business name/EIN, gross receipts, 21 expense categories |
| 10. Rental (Sch E) | 145-164 | Up to 3 properties: address, rents, 14 expense categories |
| 11. Other Income | 167-181 | IRA, pension, SS, unemployment, gambling, farm, K-1, tips |
| 12. Adjustments | 184-197 | Educator, HSA, moving, SE tax, IRA, student loan, etc. |
| 13. Itemized Deductions | 200-214 | Medical, SALT, mortgage, charity, casualty, gambling losses |
| 14. Tax Credits | 217-230 | Foreign tax, child care, education, energy, EIC, CTC |
| 15. Payments | 233-241 | Withholding, estimated payments (Q1-Q4), extension, other |
| 16. Foreign Assets | 244-259 | FBAR/FATCA questions, up to 10 foreign account details |
| 17. Foreign Trusts (3520) | 263-270 | Gift thresholds, trust details |
| 18. PFICs (8621) | 273-278 | Up to 5 PFICs: name, country, FMV, election type |
| 19. K-1 Income | 281-286 | Up to 5 K-1s: entity, type, ordinary/rental/interest/cap gains |
| 20. Retirement & HSA | 289-299 | IRA, 401k, SEP, HSA contributions and distributions |
| 21. Additional Info | 302-312 | Bank info for direct deposit, preparer info |

### Form 8949 (Capital Gains Detail)

Capital gain transactions also need to be written directly to the `Form 8949` tab because that sheet has its own gain/loss calculation formulas:

- **Short-term (Part I):** Rows 6-20, columns B-F (Description, Date Acquired, Date Sold, Proceeds, Cost Basis)
- **Long-term (Part II):** Rows 35-49, columns B-F (same layout)

The Gain/(Loss) column G is calculated by formula. Write the Intake Section 8 rows AND the Form 8949 rows for each transaction.

### Standard vs. Itemized Decision (Critical)

Before setting the Standard/Itemize flag (Intake row 8), you must compare:
- **Standard deduction** for the filing status (~$15,000 Single, ~$30,000 MFJ, ~$15,000 MFS, ~$22,500 HOH, plus age/blind add-ons)
- **Total itemized deductions**: medical (above 7.5% AGI floor) + SALT (capped at $10K) + mortgage interest + charity + casualty + gambling losses + other

Set row 8 = "I" only if itemized > standard. Otherwise set "S". The Deduction Calc tab formula takes this flag literally — setting "I" when standard is higher will **overcharge** the taxpayer. This is one of the most common preparation errors.

### Population Checklist

After writing all data, verify:
- [ ] Filing status is set (row 6, col 3)
- [ ] Standard/Itemize flag is correct (compare totals before setting row 8, col 3)
- [ ] All W-2 wages and withholding are entered
- [ ] All 1099 income is captured
- [ ] Capital gains are in both Intake Section 8 AND Form 8949 tab
- [ ] Deduction type is consistent (if itemized deductions exist, flag should be 'I')
- [ ] Estimated payments are entered per quarter
- [ ] Foreign accounts flagged if applicable

Save the workbook after populating.

---

## Phase 3: Recalculation & Review

### Recalculate Formulas

The workbook has 412+ formulas across all tabs. After populating and saving, recalculate using LibreOffice:

```python
import subprocess, sys
sys.path.insert(0, '<xlsx-skill-scripts-path>')
from recalc import recalc

result = recalc('<path-to-workbook>', timeout=30)
print(result)
```

If LibreOffice is not available, open the workbook with `data_only=True` to read cached values (they will reflect the last calculation). In that case, note that values may be stale if you just wrote new data.

### Accuracy Review

After recalculation, perform these verification checks by reading back from the calculated schedule tabs:

#### Cross-Footing Checks
1. **Total Income (Form 1040 D21)** should equal sum of wages + interest + dividends + cap gains + other income
2. **AGI (Form 1040 D25)** should equal Total Income minus Adjustments (D24)
3. **Taxable Income (Form 1040 D31)** should equal AGI minus Deductions (D30)
4. **Total Tax (Form 1040 D40)** should be reasonable for the taxable income and filing status
5. **Total Payments (Form 1040 D53)** should match sum of withholding + estimated payments
6. **Refund/Owed** — D56 (overpayment) or D58 (amount owed) should be correct difference

#### Schedule-Level Checks
7. **Schedule C net profit** = Gross receipts minus total expenses
8. **Schedule E net income** = Rents minus property expenses
9. **Schedule SE tax** = 92.35% of SE income, split into SS (12.4% up to wage base) and Medicare (2.9%)
10. **Schedule A total** should include SALT cap of $10,000
11. **Schedule D** should match Form 8949 totals
12. **Deduction Calc** — verify standard vs. itemized was correctly chosen (higher of the two)

#### Reasonableness Checks
13. Effective tax rate should be reasonable (typically 15-30% for most filers)
14. If MFJ with two W-2s, total withholding should roughly match tax liability
15. Foreign account thresholds: FATCA filing required if max value exceeds threshold for filing status
16. Self-employment tax deduction (50% of SE tax) should flow to Schedule 1 adjustments

### Generating the Review Report

Create a structured review summary:
```
=== TAX RETURN REVIEW ===
Taxpayer: [Name] | Filing Status: [Status] | Tax Year: 2025

INCOME SUMMARY
  Wages:          $XXX,XXX
  Interest:       $X,XXX
  Dividends:      $XX,XXX
  Capital Gains:  $XX,XXX
  Business (Sch C): $XX,XXX
  Rental (Sch E):   $XX,XXX
  Other:          $X,XXX
  ─────────────────────
  Total Income:   $XXX,XXX
  Adjustments:    ($X,XXX)
  AGI:            $XXX,XXX

DEDUCTIONS
  [Standard/Itemized]: $XX,XXX
  QBI Deduction:       $X,XXX
  Taxable Income:      $XXX,XXX

TAX & CREDITS
  Tax:            $XX,XXX
  Credits:        ($X,XXX)
  SE Tax:         $X,XXX
  Total Tax:      $XX,XXX
  Effective Rate: XX.X%

PAYMENTS
  Withholding:    $XX,XXX
  Estimated:      $XX,XXX
  Total Payments: $XX,XXX

RESULT: [REFUND of $X,XXX / BALANCE DUE of $X,XXX]

REVIEW NOTES:
  [Any warnings, unusual items, or items needing attention]
```

Present this to the user and ask if everything looks correct before generating the PDF.

---

## Phase 4: PDF Generation

Once the user approves the review (or if they asked to go straight to PDF), generate the return package using the PDF generator script.

```python
# The generate_1040_pdf.py script reads from the populated workbook
# and produces a 16-page IRS-style PDF package
exec(open('<skill-path>/scripts/generate_1040_pdf.py').read())

generate_pdf(
    xlsx_path='<path-to-populated-workbook>',
    output_path='<path-to-output-pdf>'
)
```

Or run it as a script:
```bash
python3 <skill-path>/scripts/generate_1040_pdf.py "<xlsx-path>" "<pdf-output-path>"
```

The PDF includes these pages:
1. Cover Page (taxpayer info + return summary + refund/owed)
2. Form 1040 Page 1 (income through AGI)
3. Form 1040 Page 2 (deductions, tax, payments, refund/owed)
4. Schedule 1 (additional income and adjustments)
5. Schedule 2 (additional taxes)
6. Schedule 3 (additional credits and payments)
7. Schedule A (itemized deductions)
8. Schedule B (interest and dividends)
9. Schedule C (business profit/loss)
10. Schedule D (capital gains/losses)
11. Form 8949 (capital asset transactions)
12. Schedule E (rental and supplemental income)
13. Schedule SE (self-employment tax)
14. Form 8938 (FATCA foreign assets)
15. Form 8621 (PFIC reporting)
16. Form 3520 (foreign trusts and gifts)

Deliver the PDF to the user with a brief summary of the result (refund or amount owed).

---

## Phase 5: Comparison Against Draft Return (Optional)

If the user provides a draft return PDF from tax preparation software, compare it against the return you prepared.

### Reading the Draft Return

Use the PDF reading tools to extract data from the draft return. Look for:
- Form 1040 lines (income, AGI, deductions, taxable income, tax, payments)
- Schedule totals
- Individual line items where practical

### Comparison Methodology

Build a line-by-line comparison for key amounts:

```
=== DISCREPANCY REPORT ===
Comparing: [Our Return] vs [Draft from Software X]
Taxpayer: [Name] | Tax Year: 2025

LINE-BY-LINE COMPARISON
─────────────────────────────────────────────────────────
Line | Description              | Ours      | Draft     | Diff    | Note
─────────────────────────────────────────────────────────
1a   | Wages                    | $277,000  | $277,000  | $0      | Match
2b   | Taxable interest         | $7,500    | $7,500    | $0      | Match
3b   | Ordinary dividends       | $11,700   | $11,700   | $0      | Match
7    | Capital gain/loss        | $14,500   | $14,200   | $300    | CHECK
8    | Other income (Sch 1)     | $48,100   | $48,100   | $0      | Match
9    | Total income             | $358,800  | $358,500  | $300    | See line 7
11   | AGI                      | $358,156  | $357,856  | $300    | Flows from above
...
─────────────────────────────────────────────────────────

DISCREPANCIES FOUND: X items

DETAIL ON EACH DISCREPANCY:
1. Line 7 - Capital Gains ($300 difference)
   Our calculation: ST loss ($2,500) + LT gain ($17,000) = $14,500
   Draft shows: $14,200
   Possible cause: [analysis]

RECOMMENDATION: [what to investigate or correct]
```

### What to Flag
- Any line where amounts differ by more than $1 (rounding)
- Missing schedules in either version
- Different filing status or dependent count
- Different deduction method chosen (standard vs itemized)
- Mismatches in withholding or estimated payments
- Different treatment of any income item

### Tolerance
- Differences of $1 or less: likely rounding, note but don't flag
- Differences of $2-$50: may be rounding in different calculation order, investigate
- Differences over $50: definitely flag and analyze

Save the comparison report as a separate document for the user.

---

## Important Tax Rules (2025)

These are baked into the workbook formulas, but knowing them helps you validate:

- **Tax brackets (MFJ):** 10% up to $23,850 | 12% to $96,950 | 22% to $206,700 | 24% to $394,600 | 32% to $501,050 | 35% to $751,600 | 37% above
- **Standard deduction:** $15,000 Single | $30,000 MFJ | $15,000 MFS | $22,500 HOH
- **SALT cap:** $10,000 ($5,000 MFS)
- **SE tax:** 92.35% x (12.4% SS up to $176,100 wage base + 2.9% Medicare on all)
- **Medical deduction floor:** 7.5% of AGI
- **FATCA thresholds (domestic):** $50,000 year-end / $75,000 any time (Single); $100,000 / $150,000 (MFJ)
- **Form 3520:** Required if foreign individual gifts > $100,000 or foreign corporate gifts > $19,570

---

## File Paths

When using this skill, the key script paths relative to the skill directory are:
- `scripts/build_1040.py` — Creates a blank 1040 workbook template from scratch
- `scripts/generate_1040_pdf.py` — Generates the 16-page PDF from a populated workbook
- `references/intake_field_map.md` — Complete cell-by-cell reference for the Intake tab

If the user doesn't already have a blank template workbook, run `build_1040.py` first to create one, then populate it.

# Intake Tab — Complete Field Map

This reference documents every writable cell in the 1040 workbook's Intake tab.
Use `ws.cell(row=ROW, column=COL, value=VALUE)` to write data safely (avoids merged cell errors).

Column mapping: B=2, C=3, D=4, E=5, F=6, G=7, H=8, I=9, J=10

---

## Section 1: Filing Information (Rows 6-10)

| Row | Col | Field | Data Type | Valid Values |
|-----|-----|-------|-----------|-------------|
| 6 | C(3) | Filing Status | Integer | 1=Single, 2=MFJ, 3=MFS, 4=HOH, 5=QSS |
| 7 | C(3) | Digital Assets Question | Text | Y or N |
| 8 | C(3) | Standard Deduction or Itemize | Text | S=Standard, I=Itemize |
| 9 | C(3) | Dependent of another taxpayer | Text | Y or N |
| 10 | C(3) | Presidential Campaign Fund | Text | Y or N |

**CRITICAL — Decision logic for row 8:** The Deduction Calc tab uses this flag to determine which deduction applies on the return. If you set "I", it uses itemized deductions *even if the standard deduction is higher*. If you set "S", it uses the standard deduction. So you MUST compare before setting the flag:

1. Look up the standard deduction for the filing status (approximate 2025 values: ~$15,000 Single, ~$30,000 MFJ, ~$15,000 MFS, ~$22,500 HOH — the exact values are in the Deduction Calc tab formulas, plus additional amounts for age 65+ or blind)
2. Add up the client's total itemized deductions (medical above 7.5% AGI floor + SALT capped at $10K + mortgage interest + charity + other)
3. If itemized total > standard deduction → set "I"
4. If standard deduction >= itemized total → set "S"

Getting this wrong can cost the taxpayer hundreds or thousands in unnecessary tax. Even if the client says "I'd like to itemize," verify that itemizing is actually beneficial.

---

## Section 2: Taxpayer Information (Rows 14-25)

Primary taxpayer uses Column C (3). Spouse uses Column E (5).

| Row | Col | Field | Data Type |
|-----|-----|-------|-----------|
| 14 | C/E | First Name | Text |
| 15 | C/E | Middle Initial | Text (1 char) |
| 16 | C/E | Last Name | Text |
| 17 | C/E | Social Security Number | Text (XXX-XX-XXXX) |
| 18 | C/E | Date of Birth | Date or Text |
| 19 | C/E | Occupation | Text |
| 20 | C/E | Phone Number | Text |
| 21 | C/E | Email Address | Text |
| 22 | C/E | Legally Blind? | Text | Y or N |
| 23 | C/E | Age 65 or Older? | Text | Y or N |
| 24 | C/E | US Citizen? | Text | Y or N |
| 25 | C/E | Resident Alien? | Text | Y or N |

---

## Section 3: Mailing Address (Rows 28-35)

| Row | Col | Field | Data Type |
|-----|-----|-------|-----------|
| 28 | C(3) | Street Address | Text |
| 29 | C(3) | Apartment Number | Text |
| 30 | C(3) | City | Text |
| 31 | C(3) | State | Text (2-letter) |
| 32 | C(3) | ZIP Code | Text (5 or 9 digit) |
| 33 | C(3) | Foreign Country Name | Text |
| 34 | C(3) | Foreign Province/State | Text |
| 35 | C(3) | Foreign Postal Code | Text |

---

## Section 4: Dependents (Rows 39-49)

Header row is 38 (labels). Data rows 39-49 (up to 10 dependents, but row 39 is typically the label row in the template, so data starts at row 40 in practice — check the actual template).

**Actual data rows: 40-49** (row 39 has sub-headers in some builds, row 38 has main headers)

| Col | Field | Data Type |
|-----|-------|-----------|
| B(2) | First Name | Text |
| C(3) | Last Name | Text |
| D(4) | SSN | Text (XXX-XX-XXXX) |
| E(5) | Relationship | Text (Son, Daughter, etc.) |
| F(6) | Date of Birth | Date or Text |
| G(7) | Months Lived With You | Integer (0-12) |
| H(8) | Child Tax Credit (Y/N) | Text |
| I(9) | Other Dependent Credit (Y/N) | Text |

---

## Section 5: W-2 Wages (Rows 52-56)

Header row is 51. Data rows 52-56 (up to 5 W-2s).

| Col | Field | Data Type |
|-----|-------|-----------|
| B(2) | Employer Name | Text |
| C(3) | Employer EIN | Text (XX-XXXXXXX) |
| D(4) | Wages, Tips, Comp (Box 1) | Currency |
| E(5) | Federal Tax Withheld (Box 2) | Currency |
| F(6) | SS Wages (Box 3) | Currency |
| G(7) | SS Tax Withheld (Box 4) | Currency |
| H(8) | Medicare Wages (Box 5) | Currency |
| I(9) | Medicare Tax Withheld (Box 6) | Currency |

**Row 57** contains totals formulas — do not write here.

---

## Section 6: Interest Income — 1099-INT (Rows 61-68)

Header row is 60. Data rows 61-68 (up to 8 payers).

| Col | Field | Data Type |
|-----|-------|-----------|
| B(2) | Payer Name | Text |
| C(3) | Payer EIN | Text |
| D(4) | Interest Amount (Box 1) | Currency |
| E(5) | Tax-Exempt Interest | Currency |
| F(6) | Federal Tax Withheld | Currency |
| G(7) | Foreign Tax Paid | Currency |

**Row 69** = Total Taxable Interest formula (SUM of col D)
**Row 70** = Total Tax-Exempt Interest formula (SUM of col E)

---

## Section 7: Dividend Income — 1099-DIV (Rows 74-81)

Header row is 73. Data rows 74-81 (up to 8 payers).

| Col | Field | Data Type |
|-----|-------|-----------|
| B(2) | Payer Name | Text |
| C(3) | Total Ordinary Dividends (Box 1a) | Currency |
| D(4) | Qualified Dividends (Box 1b) | Currency |
| E(5) | Capital Gain Distributions (Box 2a) | Currency |
| F(6) | Nondividend Distributions (Box 3) | Currency |
| G(7) | Federal Tax Withheld | Currency |
| H(8) | Foreign Tax Paid | Currency |

**Row 82** = Total Ordinary Dividends formula
**Row 83** = Total Qualified Dividends formula

---

## Section 8: Capital Gains & Losses — 1099-B (Rows 87-106)

Header row is 86. Data rows 87-106 (up to 20 transactions).

| Col | Field | Data Type |
|-----|-------|-----------|
| B(2) | Description of Property | Text |
| C(3) | Date Acquired | Date or Text |
| D(4) | Date Sold | Date or Text |
| E(5) | Proceeds (Sale Price) | Currency |
| F(6) | Cost Basis | Currency |
| G(7) | Adjustment Code | Text |
| H(8) | Adjustment Amount | Currency |
| I(9) | Short or Long (S/L) | Text: "S" or "L" |

**IMPORTANT:** Also write these transactions to the **Form 8949** tab:
- Short-term transactions: rows 6-20 (cols B-F: Description, Date Acquired, Date Sold, Proceeds, Cost Basis)
- Long-term transactions: rows 35-49 (same columns)
- Column G in Form 8949 is a formula calculating Gain/(Loss)

**Row 107** = Total Proceeds formula
**Row 108** = Total Cost Basis formula

---

## Section 9: Business Income — Schedule C (Rows 111-141)

All values in Column C (3).

| Row | Field | Data Type |
|-----|-------|-----------|
| 111 | Business Name | Text |
| 112 | Business EIN | Text (XX-XXXXXXX) |
| 113 | Principal Business Code (NAICS) | Text |
| 114 | Business Address | Text |
| 115 | Accounting Method | Text: Cash/Accrual/Other |
| 116 | Gross Receipts/Sales | Currency |
| 117 | Returns and Allowances | Currency |
| 118 | Cost of Goods Sold | Currency |
| 119 | Advertising | Currency |
| 120 | Car/Truck Expenses | Currency |
| 121 | Commissions/Fees | Currency |
| 122 | Contract Labor | Currency |
| 123 | Depreciation (Form 4562) | Currency |
| 124 | Employee Benefit Programs | Currency |
| 125 | Insurance (non-health) | Currency |
| 126 | Interest (Mortgage) | Currency |
| 127 | Interest (Other) | Currency |
| 128 | Legal/Professional Services | Currency |
| 129 | Office Expense | Currency |
| 130 | Rent/Lease (Vehicles) | Currency |
| 131 | Rent/Lease (Other) | Currency |
| 132 | Repairs/Maintenance | Currency |
| 133 | Supplies | Currency |
| 134 | Taxes/Licenses | Currency |
| 135 | Travel | Currency |
| 136 | Meals (50% deductible) | Currency |
| 137 | Utilities | Currency |
| 138 | Wages Paid | Currency |
| 139 | Other Expenses (description) | Text |
| 140 | Other Expenses Amount | Currency |
| 141 | Business Use of Home (Form 8829) | Currency |

---

## Section 10: Rental Real Estate — Schedule E (Rows 145-164)

Supports up to 3 properties: Column C(3)=Property 1, D(4)=Property 2, E(5)=Property 3.

| Row | Field | Data Type |
|-----|-------|-----------|
| 145 | Property Address | Text |
| 146 | Property Type | Text (Single Family, Multi-unit, etc.) |
| 147 | Days Rented | Integer |
| 148 | Days Personal Use | Integer |
| 149 | Rents Received | Currency |
| 150 | Advertising | Currency |
| 151 | Auto/Travel | Currency |
| 152 | Cleaning/Maintenance | Currency |
| 153 | Commissions | Currency |
| 154 | Insurance | Currency |
| 155 | Legal/Professional | Currency |
| 156 | Management Fees | Currency |
| 157 | Mortgage Interest | Currency |
| 158 | Other Interest | Currency |
| 159 | Repairs | Currency |
| 160 | Supplies | Currency |
| 161 | Taxes | Currency |
| 162 | Utilities | Currency |
| 163 | Depreciation | Currency |
| 164 | Other Expenses | Currency |

---

## Section 11: Other Income (Rows 167-181)

All values in Column C (3).

| Row | Field | Data Type |
|-----|-------|-----------|
| 167 | State/Local Tax Refund (if itemized prior year) | Currency |
| 168 | Alimony Received (pre-2019 divorce) | Currency |
| 169 | IRA Distributions — Gross | Currency |
| 170 | IRA Distributions — Taxable | Currency |
| 171 | Pensions/Annuities — Gross | Currency |
| 172 | Pensions/Annuities — Taxable | Currency |
| 173 | Social Security Benefits — Gross | Currency |
| 174 | Social Security Benefits — Taxable | Currency |
| 175 | Unemployment Compensation | Currency |
| 176 | Gambling Winnings | Currency |
| 177 | Other Income (description) | Text |
| 178 | Other Income Amount | Currency |
| 179 | Farm Income/Loss (Schedule F) | Currency |
| 180 | Rental Royalties/Partnerships/S-Corps (Sch E pg 2) | Currency |
| 181 | Tip Income Not on W-2 | Currency |

---

## Section 12: Adjustments to Income (Rows 184-197)

All values in Column C (3). These flow to Schedule 1, Part II.

| Row | Field | Data Type |
|-----|-------|-----------|
| 184 | Educator Expenses (max $300) | Currency |
| 185 | Business Expenses (reservists, etc.) | Currency |
| 186 | HSA Deduction | Currency |
| 187 | Moving Expenses (military only) | Currency |
| 188 | Deductible Self-Employment Tax | Currency (auto-calc from SE) |
| 189 | Self-Employed SEP/SIMPLE/Qualified Plans | Currency |
| 190 | Self-Employed Health Insurance | Currency |
| 191 | Penalty on Early Withdrawal of Savings | Currency |
| 192 | IRA Deduction | Currency |
| 193 | Student Loan Interest (max $2,500) | Currency |
| 194 | Tuition and Fees | Currency |
| 195 | Charitable Contributions (non-itemizer) | Currency |
| 196 | Other Adjustments (description) | Text |
| 197 | Other Adjustments Amount | Currency |

**Note:** Row 188 (Deductible SE tax) is calculated by the Schedule SE tab as 50% of SE tax. If the workbook formula handles this automatically, you may not need to write it manually — check if there's a formula in this cell.

---

## Section 13: Itemized Deductions — Schedule A (Rows 200-214)

All values in Column C (3). Only relevant if row 8 = "I".

| Row | Field | Data Type |
|-----|-------|-----------|
| 200 | Medical/Dental Expenses (total before AGI floor) | Currency |
| 201 | State/Local Income Taxes Paid | Currency |
| 202 | State/Local Sales Taxes Paid | Currency |
| 203 | Real Estate Taxes Paid | Currency |
| 204 | Personal Property Taxes | Currency |
| 205 | Total SALT (formula — auto-capped at $10,000) | Formula — do not write |
| 206 | Home Mortgage Interest (Form 1098) | Currency |
| 207 | Mortgage Insurance Premiums | Currency |
| 208 | Investment Interest Expense | Currency |
| 209 | Gifts to Charity — Cash | Currency |
| 210 | Gifts to Charity — Noncash | Currency |
| 211 | Carryover from Prior Year | Currency |
| 212 | Casualty/Theft Losses (federally declared disaster) | Currency |
| 213 | Gambling Losses (limited to winnings) | Currency |
| 214 | Other Itemized Deductions | Currency |

---

## Section 14: Tax Credits (Rows 217-230)

All values in Column C (3).

| Row | Field | Data Type |
|-----|-------|-----------|
| 217 | Foreign Tax Credit (Form 1116) | Currency |
| 218 | Child/Dependent Care Credit (Form 2441) | Currency |
| 219 | Education Credits — AOTC (Form 8863) | Currency |
| 220 | Education Credits — LLC (Form 8863) | Currency |
| 221 | Retirement Savings Credit (Form 8880) | Currency |
| 222 | Child Tax Credit (auto-calculated from dependents) | Formula — check |
| 223 | Residential Energy Credit (Form 5695) | Currency |
| 224 | EV Credit (Form 8936) | Currency |
| 225 | Other Nonrefundable Credits | Currency |
| 226 | Additional Child Tax Credit (Form 8812) | Currency |
| 227 | American Opportunity Credit (refundable) | Currency |
| 228 | Net Premium Tax Credit (Form 8962) | Currency |
| 229 | Earned Income Credit | Currency |
| 230 | Other Refundable Credits | Currency |

---

## Section 15: Tax Payments & Withholding (Rows 233-241)

All values in Column C (3).

| Row | Field | Data Type |
|-----|-------|-----------|
| 233 | Federal Tax Withheld (total from W-2s, 1099s) | Currency |
| 234 | Estimated Tax Payment — Q1 | Currency |
| 235 | Estimated Tax Payment — Q2 | Currency |
| 236 | Estimated Tax Payment — Q3 | Currency |
| 237 | Estimated Tax Payment — Q4 | Currency |
| 238 | Amount Applied from Prior Year Return | Currency |
| 239 | Extension Payment (Form 4868) | Currency |
| 240 | Excess Social Security Tax Withheld | Currency |
| 241 | Other Payments/Credits | Currency |

**Note:** Row 233 withholding should normally match the sum of Box 2 from all W-2s plus any 1099 withholding. The workbook may have a formula for this — if so, verify rather than overwrite.

---

## Section 16: Foreign Financial Assets — FBAR/FATCA (Rows 244-259)

| Row | Col | Field | Data Type |
|-----|-----|-------|-----------|
| 244 | C(3) | Financial interest in foreign accounts? (Y/N) | Text |
| 245 | C(3) | Maximum aggregate value during year | Currency |
| 246 | C(3) | Accounts in a foreign country? (Y/N) | Text |

### Foreign Account Detail Table (Rows 250-259)

Header at row 249. Data rows 250-259 (up to 10 accounts).

| Col | Field | Data Type |
|-----|-------|-----------|
| B(2) | Account Type | Text (Savings, Checking, Investment, etc.) |
| C(3) | Financial Institution | Text |
| D(4) | Country | Text |
| E(5) | Account Number | Text |
| F(6) | Max Value During Year | Currency |
| G(7) | Year-End Value | Currency |
| H(8) | Income Earned | Currency |
| I(9) | Joint Account? (Y/N) | Text |

**Row 260** = Totals formula row — do not write.

---

## Section 17: Foreign Trusts & Gifts — Form 3520 (Rows 263-270)

| Row | Col | Field | Data Type |
|-----|-----|-------|-----------|
| 263 | C(3) | Received gifts from foreign persons > $100,000? | Text (Y/N) |
| 264 | C(3) | Total gifts from foreign individuals | Currency |
| 265 | C(3) | Total gifts from foreign corporations (> $19,570) | Currency |
| 266 | C(3) | Foreign trust — Name | Text |
| 267 | C(3) | Foreign trust — Country | Text |
| 268 | C(3) | Foreign trust — EIN/Reference ID | Text |
| 269 | C(3) | Foreign trust — Distributions received | Currency |
| 270 | C(3) | Foreign trust — Transfers to trust | Currency |

---

## Section 18: PFICs — Form 8621 (Rows 273-278)

Header at row 273. Data rows 274-278 (up to 5 PFICs).

| Col | Field | Data Type |
|-----|-------|-----------|
| B(2) | PFIC Name | Text |
| C(3) | Country | Text |
| D(4) | EIN/Reference ID | Text |
| E(5) | Date Acquired | Date or Text |
| F(6) | Shares Held | Number |
| G(7) | Fair Market Value (year-end) | Currency |
| H(8) | QEF/MTM Election Type | Text |
| I(9) | Distributions Received | Currency |

---

## Section 19: K-1 Income (Rows 281-286)

Header at row 281. Data rows 282-286 (up to 5 K-1s).

| Col | Field | Data Type |
|-----|-------|-----------|
| B(2) | Entity Name | Text |
| C(3) | EIN | Text |
| D(4) | Type | Text: P=Partnership, S=S-Corp, T=Trust |
| E(5) | Ordinary Income | Currency |
| F(6) | Rental Income | Currency |
| G(7) | Interest/Dividends | Currency |
| H(8) | Capital Gains | Currency |

---

## Section 20: Retirement Contributions & HSA (Rows 289-299)

All values in Column C (3).

| Row | Field | Data Type |
|-----|-------|-----------|
| 289 | Traditional IRA Contributions | Currency |
| 290 | Roth IRA Contributions | Currency |
| 291 | 401(k) Employee Deferrals | Currency |
| 292 | 401(k) Employer Match | Currency |
| 293 | SEP IRA Contributions | Currency |
| 294 | SIMPLE IRA Contributions | Currency |
| 295 | HSA Contributions (Self) | Currency |
| 296 | HSA Contributions (Employer) | Currency |
| 297 | HSA Coverage Type | Text: Self/Family |
| 298 | HSA Distributions — Total | Currency |
| 299 | HSA Distributions — Qualified Medical | Currency |

---

## Section 21: Additional Information (Rows 302-312)

All values in Column C (3).

| Row | Field | Data Type |
|-----|-------|-----------|
| 302 | Bank Routing Number (direct deposit) | Text |
| 303 | Bank Account Number | Text |
| 304 | Account Type | Text: Checking/Savings |
| 305 | Third Party Designee Name | Text |
| 306 | Third Party Designee Phone | Text |
| 307 | Third Party Designee PIN | Text |
| 308 | Preparer Name | Text |
| 309 | Preparer PTIN | Text |
| 310 | Preparer Firm Name | Text |
| 311 | Preparer Firm EIN | Text |
| 312 | Preparer Firm Address | Text |

# Actual-workbook evidence contract

Deliver `submission/Aurisic_Financials_4-25-1.xlsx`, plus the source/scripts and concise build instructions in `submission/`. The workbook is the financial handoff. Preserve the original prompt and public source files. Do not contact the CFO or other people; include the draft request in the workbook or an accompanying note.

This local comparison adds an explicit audit index to the original CFO-review task. It is not identical to an official GDPval evaluation. The original prompt and its 17 supplied inputs remain available. No private expert workbook or original rubric is needed or supplied.

## Locators, not an answer sheet

Include an audit table anywhere in the workbook with the technical headers `Claim`, `Sheet`, `Address`, `Role`, `Columns`, `Basis`. Headers may be in any column order, within the first 25 rows of that sheet. Each claim has one row. Sheet names and financial output positions are your choice, consistent with the original template's meaning and order. The index contains references to actual workbook results, never copies of expected amounts or success claims.

- `Sheet`: actual worksheet name.
- `Address`: one actual scalar cell, a comma-separated list of numeric component cells to sum, or a rectangular table range. Use unqualified A1 references and uppercase column letters.
- `Role`: `calculated`, `input`, `source`, `unavailable`, `explanation`, `table`, or `source_table`.
- `Columns`: JSON mapping of public table-field names to actual worksheet column letters; `{}` for scalar claims. Column positions and visible financial headers are flexible.
- `Basis`: readable source location, period and role. A source observation is distinct from a live result or approved company policy.

The workbook engine recalculates the actual file. Missing formula caches alone do not fail the task. Saved cached values are separately recorded. Unsupported engine formulas are an evaluation-facility limitation to report; they are not evidence that a financial conclusion is wrong. Use formulas supported by the declared shared runtime for the measured dependencies, or document a genuine limitation.

## Scalar claim names

The names below are stable audit identifiers. They do not prescribe the expected amounts or output coordinates. Source cells mentioned here identify the common public inputs.

| Prefix | Suffixes / meaning |
| --- | --- |
| `cash.` | `borrowing`, `intercompany`, `unused`, `balance`, `excess`: original cash-availability definitions using April GL controls; borrowing retains the template's GL2600 scope |
| `bank.` | `checks`, `reclass` (proposed amount only), `book`; `statement` and `reconciliation` have role `unavailable` while independent bank evidence is absent |
| `funding.` | `funding`, `funding_average`, `intercompany`, `intercompany_average`, `bank_other`, `bank_other_average`, `total`, `total_average`; averages use elapsed months; bank and other income may be combined or represented as summed components |
| `prepaid.expense.` | `vendor.<original row>` for original PPD1250 BX8:BX45 nonempty calculated closing cells; `total`, `gl`, `gap`, `amortization25` (source BW25) |
| `prepaid.insurance.` | `vendor.<original row>` for original PPD1251 AT6:AT31 nonempty calculated closing cells; `total`, `gl`, `gap` |
| `fees.` | `balance`: signed original professional-fee opening and movement |
| `legal.` | `total`, `gl`, `gap`, `april`: signed source transactions counted once; April source period425 kept distinct from other periods |
| `loan1.`, `loan2.` | `principal`, `charge`, `interest`: April ending principal, April period interest charge and running accrued interest, respectively; original source final rows74/24 |
| `loans.` | `principal`, `principal_gl`, `principal_gap`, `interest`, `interest_gl`, `interest_gap`: combined source schedules versus appropriate original GL credits |
| `ap.` | `control`; `detail` role `unavailable`; `action` role `explanation` |
| `ar.` | `source`, `division10`, `division12`, `gap` (division10 GL minus source observation); `mapping` role `explanation`, including uncertainty about source GA-0015's actual division |
| `payroll.` | `first`, `second` (original source run totals C21/D21), `estimate` (source E29), `opening`, `postings`, `rollforward`, `gl`, `gap`; `salary`, `salary_gl`, `salary_gap`, `expenses`, `expenses_gl`, `expenses_gap` (partial-source movement bridges for GL6000/6305); `annotation` role `explanation` preserving corporate source E18's business instruction |
| `rebates.`, `uninvoiced.`, `bonus.`, `misc.` | `total`, `gl`, `gap`; all gaps GL credit less source except rebates, whose original schedule reports source less GL |
| `bonus.` | additionally `headline` (live rollforward), `salary_ytd` (April GL6000 control), `ten_percent_reference` (unapproved source calculation), `source_salary`, `source_reported` (original B18/B15 observations, role `source`) |
| `tb.` | `net.period`, `net.ytd`, `clearing.period`, `clearing.ytd`, `proof.period`, `proof.ytd`: original income/expense, clearing and full-ledger proof meanings |

Use six role-`input` claims for editable source observations: `input.cash1024` (division10/account1024 YTD), `input.bonus` (AccrBonus B12), `input.prepaid_addition` (PPD1250 BV25), `input.fees` (professional fees V8), `input.check` (first check B7), `input.loan1_rate` (loan I floating rate A74). They may be located elsewhere, with source identity retained. Recalculation must propagate a changed input to its actual dependent results. An unchanged original reported observation remains an observation.

Payroll liability controls (`opening`, `rollforward`, `gl`, `gap`) may consistently use ledger-signed balances or explicitly labelled positive-credit balances. Original GL and signed source postings retain their original signs. All four controls must use one coherent convention and the correct rollforward/difference equations; individual absolute values or mixed directions are insufficient. Describe the convention in the financial labels/Basis. Numerical normalization does not certify that the labels actually communicate it; that meaning is reviewed under M13. This clarification arose from the first two actual products; their original frozen-consumer results remain preserved, and any corrected consumption is identified as post-hoc measurement repair.

Representative consumer interventions, applied only in memory, are public: cash +1; April bonus +100; prepaid addition +6; fee posting +1; first check +1; floating rate −1 percentage point, below the source's stated3% cap. Expectations are derived independently from the source equations, dated principal and declared roles. The bounded rate change is compatible with the original capped terms as well as the supplied current source calculation; it does not impose an uncapped future-rate rule. No altered workbook replaces the submitted original.

## Table claims

| Claim | Required fields |
| --- | --- |
| `ledger` | `division`, `account`, `name`, `period`, `ytd`, `class` — all original April accounts, joint identities preserved |
| `bridges` | `division`, `account`, `prior`, `movement`, `current`, `gap`, `candidate`, `action` — March YTD + April movement versus April YTD; disclose source-backed candidate components and missing posting history |
| `issues` | `area`, `source`, `observation`, `result`, `action`, `status` |
| `contents` | `section`, `sheet`, `status` — specific actual completion/uncertainty status |

Source tables preserve original nonformula, nonerror, nonempty inputs, including identities, dates, signs, period descriptions and assumptions. Recalculated results may use a different formula layout. Each table maps `source_row` to the original source row number, and original source column letters to actual output columns. Rows may be reordered. These original row identifiers are audit provenance, not a required physical output row.

| Claim | Original first worksheet / rows / columns |
| --- | --- |
| `source.legal` | Legal_Dump-1.xlsx / 3:59 / A:M |
| `source.fees` | Prof_Fee_Dump-1.xlsx / 3:8 / A:W |
| `source.loan1` | Good Insurance Co - Loan.xlsx / 11:74 / A:E |
| `source.loan2` | Good Insurance Co - Loan II.xlsx / 11:24 / A:E |
| `source.payroll` | Payroll-1.xlsx / 5:20 / A:D |
| `source.checks` | Outstanding_CKs_4-30-25-1.xlsx / 7:8 / A:E |
| `source.prepaid_expense` | PPD1250-1.xlsx / 8:45 / A:CD |
| `source.prepaid_insurance` | PPD1251-1.xlsx / 6:31 / A:AV |

Original GL amounts retain their cents. Derived monetary presentation may round to cents: half a cent is representation tolerance, not company materiality or a permitted reconciliation write-off. Source-input amounts retain their original precision. Whitespace/case changes to names are accepted; altered business identities are not.

The index and numerical consumer do not award professional quality for populated rows or particular keywords. M09–M13 require reading the complete product, source reasoning, actionable handoff, actual visuals and honest scope. There is no combined100, promised ranking, minimum duration or forced failure rate.

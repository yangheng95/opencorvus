// One complete April CFO-review package, using public source files only.
import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const [root, outDir, variant = 'reference'] = process.argv.slice(2);
const data = JSON.parse(await fs.readFile(path.join(root, 'source-normalization.json'), 'utf8'));
const original = 'Aurisic_Financials_3-25-1.xlsx';
const sourceBooks = new Map();
async function source(file) {
  if (!sourceBooks.has(file)) sourceBooks.set(file, await SpreadsheetFile.importXlsx(await FileBlob.load(path.join(root, 'public', file))));
  return sourceBooks.get(file);
}
const names = data.metadata[original].map(x => x.name.replace('3-31-25', '4-30-25'));
names.push('#16) Aurisic Glob Accrual #2011', '#17) Bonus Accrual #2401', '#18) Misc Accruals #2410', 'CFO Review Issues', 'Reconciliation Bridges', 'Evidence Index');
const wb = Workbook.create();
for (const name of names) wb.worksheets.add(name);
const get = name => wb.worksheets.getItem(name);
const put = (name, address, values) => get(name).getRange(address).write(values);
const f = (name, address, formula) => get(name).getRange(address).formulas = [[formula]];
const layout = [];
async function copy(name, file, index = 0) {
  const src = (await source(file)).worksheets.getItemAt(index), meta = data.metadata[file][index], dest = get(name);
  dest.getRangeByIndexes(0, 0, meta.rows, meta.columns).copyFrom(src.getRangeByIndexes(0, 0, meta.rows, meta.columns), 'all');
  for (const col of meta.column_dimensions) {
    if (Number.isFinite(col.width) && col.width > 0)
      dest.getRangeByIndexes(0, col.min - 1, 1, col.max - col.min + 1).format.columnWidth = col.width;
  }
  for (const row of meta.row_dimensions) if (row.height) dest.getRangeByIndexes(row.row - 1, 0, 1, meta.columns).format.rowHeight = row.height;
  layout.push({ target: name, file, source_sheet: index });
}
for (let i = 0; i < data.metadata[original].length; i++) await copy(names[i], original, i);
const selected = [
  [3, 'Outstanding_CKs_4-30-25-1.xlsx'], [5, 'PPD1250-1.xlsx'], [6, 'PPD1251-1.xlsx'],
  [7, 'Prof_Fee_Dump-1.xlsx'], [8, 'Legal_Dump-1.xlsx'], [9, 'Good Insurance Co - Loan.xlsx'],
  [10, 'Good Insurance Co - Loan II.xlsx'], [12, 'AR_Accrual-1.xlsx'], [13, 'Payroll-1.xlsx'], [14, 'Rebates-1.xlsx'],
  [15, 'Accr2011-1.xlsx'], [16, 'AccrBonus-1.xlsx'], [17, 'AccrMisc-1.xlsx'],
];
for (const [index, file] of selected) { get(names[index]).getUsedRange().clear({ applyTo: 'contents' }); await copy(names[index], file); }
// Original formula identifiers refer to the old dated template sheet. Keep
// account row identities stable, then append new April accounts before totals.
for (const name of names.slice(0, 18)) {
  const used = get(name).getUsedRange(), formulas = used.formulas;
  for (let row = 0; row < formulas.length; row++) for (let col = 0; col < formulas[row].length; col++) {
    const value = formulas[row][col];
    if (typeof value === 'string' && value.includes("'#3a) TB convert 3-31-25'!"))
      get(name).getCell(row, col).formulas = [[value.replaceAll("'#3a) TB convert 3-31-25'!", "'#3a) TB convert 4-30-25'!")]];
  }
}
const tb = names[1], count = data.records.length, last = count + 1;
get(tb).getRange('A2:L127').clear({ applyTo: 'contents' });
put(tb, 'A2', data.records);
get(tb).getRange(`D2:E${last}`).setNumberFormat('#,##0.00;(#,##0.00);0.00');
const rows = new Map(data.records.map((r, i) => [`${r[0]}:${r[1]}`, i + 2]));
const ref = (acct, div = 10) => `'${tb}'!E${rows.get(`${div}:${acct}`)}`;
const march = acct => data.march_records.find(r => r[0] === 10 && r[1] === acct)[4];
for (const [offset, title, code] of [[3, 'Assets', 'a'], [4, 'Liabilities', 'l'], [6, 'Income', 'i'], [7, 'Expenses', 'e']]) {
  const row = last + offset; put(tb, `C${row}`, [[title]]);
  for (const col of ['D', 'E']) f(tb, `${col}${row}`, `=SUMIF(F2:F${last},"${code}",${col}2:${col}${last})`);
}
put(tb, `C${last + 5}`, [['Balance-sheet control']]);
for (const col of ['D', 'E']) f(tb, `${col}${last + 5}`, `=${col}${last + 3}+${col}${last + 4}`);
for (const [offset,title,code] of [[9,'Net income / expense',null],[10,'Clearing','c'],[12,'Overall trial-balance proof',null]]) {
  put(tb,`C${last+offset}`,[[title]]);
  for(const col of ['D','E']) f(tb,`${col}${last+offset}`,code ? `=SUMIF(F2:F${last},"${code}",${col}2:${col}${last})` : offset===9 ? `=${col}${last+6}+${col}${last+7}` : `=SUM(${col}2:${col}${last})`);
}
put(tb, 'H1', [['April 2025. Division and account jointly identify each record.']]);

const cash = names[2];
put(cash, 'A3', [['as of 4-30-25']]); put(cash, 'A19', [['Cash Balance 4-30-25']]);
put(cash, 'A5', [['GL2600 LOC borrowing control']]);
// Existing old-account row links remain valid; names follow April GL labels.
for (const [row, acct] of [[8,1651],[9,1652],[10,1653],[11,1654],[12,1656],[13,1663],[14,1664]]) {
  f(cash, `A${row}`, `='${tb}'!C${rows.get(`10:${acct}`)}`); f(cash, `B${row}`, `=${ref(acct)}`);
}
f(cash, 'B19', `=${ref(1023)}+${ref(1024)}`);
const bank = names[3];
for (const row of [12,16]) f(bank, `C${row}`, row === 12 ? '=IF(ISNUMBER(C4),C4-B10,"unavailable")' : '=IF(ISNUMBER(C12),C12+C14,"unavailable")');
put(bank, 'A14', [['Proposed reclassification; CFO approval pending']]);
put(bank, 'A18', [['April ledger cash control']]); f(bank, 'C18', `=${ref(1023)}+${ref(1024)}`);
put(bank, 'A19', [['Independent bank-statement balance not supplied.']]);

const funding = names[4]; put(funding, 'D4', [['4-30-2025']]);
put(funding, 'G4', [['March YTD reference']]);
const originalFunding = (await source(original)).worksheets.getItemAt(4);
for (let row=5;row<=11;row++) {
  put(funding, `G${row}`, [[originalFunding.getRange(`D${row}`).values[0][0]]]);
  put(funding, `D${row}`, [['unavailable','unavailable']]);
}
f(funding, 'D12', `=-${ref(7206)}`); f(funding, 'E12', '=D12/4');
f(funding, 'E14', '=D14/4'); f(funding, 'E15', '=D15/4');
put(funding, 'A20', [['April subsidiary allocation is not supplied; total funding follows GL7206.']]);
put(funding, 'A21', [['Duplicate UK template labels retained pending company mapping confirmation.']]);
put(funding, 'A18', [['GL income outside original funding categories']]);
f(funding, 'D18', `=-SUMIF('${tb}'!F2:F${last},"i",'${tb}'!E2:E${last})-D17`);
f(funding,'E18','=D18/4');put(funding,'A19',[['All income categories']]);f(funding,'D19','=D17+D18');f(funding,'E19','=D19/4');
put(funding, 'F18', [['Confirm classification']]);

// Adopt dedicated PPD schedules, retain their vendor inputs, repair their sum
// ranges, and show independent GL controls. Do not invent balancing write-offs.
for (const [index, totalRow, firstDetail, lastDetail, firstCol, lastCol, endCol, acct, ending, variance, control] of [
  [5,46,8,45,1,76,'BX',1250,47,48,49], [6,32,6,31,3,46,'AT',1251,33,34,35],
]) {
  const name = names[index];
  function label(n) { let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s; }
  for(let col=firstCol;col<lastCol;col++) f(name, `${label(col)}${totalRow}`, `=SUM(${label(col)}${firstDetail}:${label(col)}${lastDetail})`);
  f(name, `${endCol}${ending}`, `=${endCol}${totalRow}`);
  f(name, `${endCol}${control}`, `=${ref(acct)}`);
  f(name, `${endCol}${variance}`, `=${endCol}${control}-${endCol}${ending}`);
}
const fees = names[7]; put(fees, 'S10', [['Balance at 4-30-25']]);
const legal = names[8]; f(legal, 'L62', '=L60'); f(legal, 'M62', '=M60');
for(const [col,width] of [['E',20],['F',22],['G',25],['J',24],['K',46]])get(legal).getRange(`${col}:${col}`).format.columnWidth=width;
get(legal).getRange('A3:M59').format.wrapText=true;get(legal).getRange('A3:M59').format.rowHeight=32;
for (const [name, title, end] of [[fees, 'Aurisic professional fees', 'W'], [legal, 'Aurisic legal expense transactions', 'M']]) {
  put(name, 'A1', [[title]]);
  get(name).getRange(`A1:${end}1`).format.wrapText=false;
  get(name).getRange(`A1:${end}1`).format.rowHeight=24;
}
// The source has literal legacy error cells outside the vendor calculation.
// Represent the unavailable checks explicitly; preserve the originals externally.
put(names[5], 'A50', [['Legacy checks: see CFO review']]);
put(names[5], 'P50', [['unavailable']]);put(names[5], 'S50', [['unavailable']]);
get(names[5]).getRange('BX49').format.fill='#F1F5F9';
put(legal, 'K63', [['Source detail balance at 4-30-25']]); f(legal, 'L63', '=L60+M60');
put(legal, 'K65', [['April GL6200 control']]); f(legal, 'L65', `=${ref(6200)}`);
put(legal, 'K66', [['GL less source detail']]); f(legal, 'L66', '=L65-L63');
put(legal,'K68',[['April period 425 signed transactions']]);f(legal,'L68','=SUMIF(D3:D59,425,L3:L59)+SUMIF(D3:D59,425,M3:M59)');
const loan = names[9]; put(loan, 'A80', [['Combined April accrued interest']]); f(loan, 'E80', `=F74+'${names[10]}'!F24`);
put(loan, 'A81', [['GL2402 credit balance control']]); f(loan, 'E81', `=-${ref(2402)}`);
put(loan, 'A82', [['GL less loan accrual']]); f(loan, 'E82', '=E81-E80');
put(loan, 'A84', [['Combined source loan principal']]); f(loan, 'E84', `=G74+'${names[10]}'!G24`);
put(loan, 'A85', [['GL2600 + GL2601 credit principal']]); f(loan, 'E85', `=-${ref(2600)}-${ref(2601)}`);
put(loan, 'A86', [['GL less source principal']]); f(loan, 'E86', '=E85-E84');

const ap = names[11]; get(ap).getRange('A2:J31').clear({ applyTo: 'contents' });
put(ap, 'A2', [['as of 4-30-25']]); put(ap,'B4',[['AP_TB-1.xlsx was not supplied.']]);
put(ap,'B6',[['April GL2000 credit control']]);f(ap,'G6',`=-${ref(2000)}`);
put(ap,'B8',[['Detailed vendor support']]);put(ap,'G8',[['unavailable']]);
put(ap,'B10',[['Request the April AP listing before finalizing.']]);put(ap,'G12',[['Pending CFO']]);
const ar=names[12];put(ar,'A9',[['Division10 GL1101 control']]);f(ar,'B9',`=${ref(1101)}`);
put(ar,'A10',[['GL less supplied detail']]);f(ar,'B10','=B9-B6');
put(ar,'A12',[['Division12 GL1101 control']]);f(ar,'B12',`=${ref(1101,12)}`);
put(ar,'A13',[['GA-0015 is the source entity. Its division crosswalk is not supplied; division10 is only an amount-matched candidate. Division12 support also missing.']]);
get(ar).getRange('A13:G15').merge();get(ar).getRange('A13:G15').format.wrapText=true;
const payroll=names[13];
for(const [row,label]of [[36,'March GL2200'],[37,'Source April accrual postings'],[38,'Supported rollforward'],[39,'April GL2200'],[40,'GL less source rollforward']])put(payroll,`A${row}`,[[label]]);
put(payroll,'C36',[[march(2200)]]);f(payroll,'C37','=SUM(C25,C28,C32)');f(payroll,'C38','=C36+C37');f(payroll,'C39',`=${ref(2200)}`);f(payroll,'C40','=C39-C38');
for(const note of data.corporate_annotations)if(get(payroll).getRange(note.cell).values[0]?.[0]==null)put(payroll,note.cell,[[note.text]]);
put(payroll,'E18',[['Corporate April E18: need to reallocate. Source amount counted once; allocation approval/history not supplied.']]);
get(payroll).getRange('E18:F20').merge();get(payroll).getRange('E18:F20').format.wrapText=true;
put(payroll,'A42',[['Salary: two source runs less signed accrual postings']]);f(payroll,'C42','=C6+D6-SUM(C25,C28,C32)');
put(payroll,'A43',[['GL6000 April movement']]);f(payroll,'C43',`='${tb}'!D${rows.get('10:6000')}`);put(payroll,'A44',[['GL less partial salary source movement']]);f(payroll,'C44','=C43-C42');
put(payroll,'A46',[['Employee expenses: two source runs']]);f(payroll,'C46','=C18+D18');put(payroll,'A47',[['GL6305 April movement']]);f(payroll,'C47',`='${tb}'!D${rows.get('10:6305')}`);put(payroll,'A48',[['GL less partial employee-expense source']]);f(payroll,'C48','=C47-C46');
put(payroll,'A50',[['These partial-source residuals and reallocation note require posting history; they do not prove GL errors.']]);get(payroll).getRange('A50:F52').merge();get(payroll).getRange('A50:F52').format.wrapText=true;
const rebates=names[14];put(rebates,'A13',[['GL2005 credit control']]);f(rebates,'B13',`=-${ref(2005)}`);put(rebates,'A14',[['Source detail less GL']]);f(rebates,'B14','=B11-B13');
for(const [index,controlRow,diffRow,acct,detail]of [[15,9,10,2011,'B7'],[16,21,22,2401,'B13'],[17,12,13,2410,'C10']]) {
 const name=names[index],col=index===17?'C':'B';put(name,`A${controlRow}`,[[`GL${acct} credit control`]]);f(name,`${col}${controlRow}`,`=-${ref(acct)}`);
 put(name,`A${diffRow}`,[['GL less source detail']]);f(name,`${col}${diffRow}`,`=${col}${controlRow}-${detail}`);
}
const bonus=names[16];put(bonus,'A15',[['Live April bonus rollforward']]);f(bonus,'B15','=B13');
put(bonus,'A24',[['Source-reported salary observation (not refreshed)']]);put(bonus,'B24',[[(await source('AccrBonus-1.xlsx')).worksheets.getItemAt(0).getRange('B18').values[0][0]]]);
put(bonus,'A26',[['Source-reported bonus observation (not refreshed)']]);put(bonus,'B26',[[(await source('AccrBonus-1.xlsx')).worksheets.getItemAt(0).getRange('B15').values[0][0]]]);
put(bonus,'A18',[['April GL6000 YTD salary control']]);f(bonus,'B18',`=${ref(6000)}`);put(bonus,'A19',[['10% reference only; company bonus policy unconfirmed']]);
put(bonus,'C18',[['Original source comment includes per diems etc.; compensation scope needs confirmation.']]);get(bonus).getRange('C18:E20').merge();get(bonus).getRange('C18:E20').format.wrapText=true;
get(bonus).getRange('A:A').format.columnWidth=58;get(bonus).getRange('B:B').format.columnWidth=21;
const issues = [
 ['AP support','AP_TB-1.xlsx','Missing file','GL2000 retained; vendor detail unavailable','Request April listing','Pending CFO'],
 ['Bank reconciliation','Outstanding_CKs_4-30-25-1.xlsx','C4 bank balance blank','Ledger cash is not independent bank evidence','Request bank statement / reclass approval','Pending CFO'],
 ['Funding','March template / April TB','April subsidiary split missing','GL7206 total available; per-subsidiary actuals unavailable','Confirm allocation and duplicate UK label','Pending CFO'],
 ['Prepaid schedules','PPD1250/PPD1251 and combined prepaid','Competing source versions','Dedicated schedules used; actual GL differences shown','Confirm primary support / corrections','Pending CFO'],
 ['Combined prepaid source','Aurisic_Prepaid_Expenses_4-25-1.xlsx','Different source version',`Original closing caches: expenses ${Number(data.combined_prepaid_original_cache.expenses_BX53).toFixed(2)}; insurance ${Number(data.combined_prepaid_original_cache.insurance_AT32).toFixed(2)}. These are not GL controls.`,'Reconcile source versions and periods','Pending CFO'],
 ['Legacy prepaid checks','PPD1250-1.xlsx P50 / S50','Literal source #REF! cells','Vendor closing calculation is separate; legacy checks unavailable','Confirm legacy check intent','Pending CFO'],
 ['Legal expenses','Legal_Dump-1.xlsx','Source total duplicated prior total','Totals recalculated from transactions; GL difference shown','Explain GL/source difference','Pending CFO'],
 ['Payroll','Payroll-1 / corporate April E18','Corporate note: need to reallocate','Amounts counted once; unique corporate annotation retained. GL2200 residual 177467; partial salary and employee-expense bridges shown.','Obtain reallocation instructions and posted journals, including GL6000/6305','Pending CFO'],
 ['Payroll source labels','Payroll-1 A16 / corporate April A16','Paycom Fees versus Payroll Fees','Original Payroll-1 label retained; the corporate copy uses a different description. Monetary rows are counted once.','Confirm label and allocation scope together with the corporate E18 note','Pending CFO'],
 ['Payroll estimate','Payroll-1 C28 / E29','Posted estimate differs from 130% calculation','Source posting 236500; source calculation 236448.888','Confirm rounding or approved estimate','Pending CFO'],
 ['Income classification','April TB GL7092 / funding D18','Original funding categories omit other income','5500 retained as income outside those categories','Confirm presentation / classification','Pending CFO'],
 ['AR division scope','April TB / AR_Accrual-1 A4','GA-0015 crosswalk is not supplied','10997 amount match does not establish division10 identity; division12 GL is separate.','Request GA-0015 legal entity to GL division crosswalk and both detail scopes','Pending CFO'],
 ['Prepaid cutoff','PPD1250 BY8/17/22/23; BV40/BW40/BY40/BZ40','Expired periods or inconsistent coverage descriptions','Rows 8/17/22/23 continue April amortization despite ending 3/25,1/25,12/24,3/25. Row40 divides 31556.78 by 8; coverage says 4/25–12/25, description says 12.25–12.26.','Confirm signed coverage and denominator; do not silently change source schedule or GL','Pending CFO'],
 ['Insurance cutoff','PPD1251 AU30 / combined insurance period','April table retains March coverage note; combined version ends March31','Dedicated April closing 5493.27, combined March closing 49137.41, GL54630.68 are distinct observations.','Confirm coverage period and approved April journal; no closest-GL selection','Pending CFO'],
 ['Source-to-ledger bridges','Reconciliation Bridges','Source-backed components are candidates, not approved postings','1250 +165000 =81000+28000+56000; legal March31 -84000=-28000-56000; 2011 March31 transfer-pricing 159695.','Obtain posting history / cutoff policy before attributing the matching cross-period differences','Pending CFO'],
 ['Bonus roles','Bonus B13/B15/B18/B24/B26','Live rollforward separated from source-reported observations','Headline follows B13. Original B15 and B18 literals retained separately; 10% is only an unapproved reference.','Confirm compensation scope, bonus policy and estimate approval','Pending CFO'],
 ['Loan rate mechanics','Loan I B3 / A74 / D74','Printed terms say lesser of3% and SOFR; current formula adds supplied rate and spread','April rate3% is within the printed cap. The source does not itself establish future floating-rate administration or an externally verified SOFR observation.','Confirm actual SOFR, cap application and rate/reset convention; do not infer an uncapped future-rate policy','Pending CFO'],
 ...data.cross_period_gaps.map(r=>['Cross-period check',`Division${r[0]} account${r[1]}`,r[2],r[3],'Explain AprilYTD − MarchYTD − April movement','Pending CFO']),
];
const review=names[18];put(review,'A1',[['April CFO review items — not final approval']]);
put(review,'A3',[['Area','Source','Observation','Known result / difference','Action','Status'],...issues]);
get(review).getRange(`A1:F${issues.length+3}`).format.font.name='Arial';get(review).getRange(`A1:F${issues.length+3}`).format.font.size=10;
for(const [col,width]of [['A',25],['B',48],['C',42],['D',55],['E',46],['F',18]])get(review).getRange(`${col}:${col}`).format.columnWidth=width;
get(review).getRange(`A4:F${issues.length+3}`).format.wrapText=true;get(review).getRange(`A4:F${issues.length+3}`).format.rowHeight=48;
get(review).getRange(`A4:F${issues.length+3}`).format.verticalAlignment='center';
get(review).getRange('A3:F3').format.fill='#334155';get(review).getRange('A3:F3').format.font.color='#FFFFFF';get(review).freezePanes.freezeRows(3);
const toc=names[0];get(toc).getRange('A6:C30').clear({applyTo:'contents'});put(toc,'A2',[['April 2025 CFO-review package — unresolved items listed']]);
const statuses=['April ledger and proof','Source/GL controls; borrowing scope retained','Bank evidence missing; proposed reclass pending','GL totals; subsidiary split missing','Source-calculated; cutoff conflicts unresolved','Source-calculated; period/version conflict','Signed detail / GL control','Each signed transaction once; journal bridges pending','Source loan I / GL controls','Source loan II','AP detail missing; GL only','GA-0015 division mapping unknown','Unique corporate note retained; posting gaps pending','Source / GL controls','Transfer pricing cutoff pending','Live bonus; original observations separated','Source / GL controls','Open CFO actions; no sign-off','Source-backed bridge candidates; not approved entries','Audit references to actual cells'];
put(toc,'A6',names.slice(1).map((name,i)=>[name.match(/^#([^)]*)/)?.[1]??'Review',name,statuses[i]]));
get(toc).getRange('C6:C25').format.wrapText=true;get(toc).getRange('A6:C25').format.rowHeight=42;get(toc).getRange('B:B').format.columnWidth=45;get(toc).getRange('C:C').format.columnWidth=65;
const moneyFormat='#,##0.00;(#,##0.00);0.00';
get(cash).getRange('B5:B21').setNumberFormat(moneyFormat);get(cash).getRange('B:B').format.columnWidth=23;
get(funding).getRange('D12:E19').setNumberFormat(moneyFormat);get(funding).getRange('G:G').format.columnWidth=29;get(funding).getRange('G5:G11').setNumberFormat(moneyFormat);
get(bonus).getRange('B24:B26').setNumberFormat(moneyFormat);
for(const [name,range] of [[legal,'L65:L66'],[loan,'E80:E86'],[ap,'G6'],[ar,'B9:B12'],[payroll,'C36:C40'],
 [names[15],'B9:B10'],[names[16],'B21:B22'],[names[17],'C12:C13']]) get(name).getRange(range).setNumberFormat(moneyFormat);
for(let i=0;i<issues.length;i++) if(typeof issues[i][3]==='number')get(review).getRange(`D${i+4}`).setNumberFormat(moneyFormat);
const bridge=names[19];
put(bridge,'A1',[['April cross-period bridges — observations, not approved journal entries']]);
put(bridge,'A3',[['Division','Account','March YTD','April movement','April YTD','Unexplained bridge','Source-backed candidate / cutoff','CFO action']]);
for(let i=0;i<data.cross_period_gaps.length;i++) {
 const [div,account]=data.cross_period_gaps[i],r=i+4,prior=data.march_records.find(x=>x[0]===div&&x[1]===account)[4],tr=rows.get(`${div}:${account}`);
 const candidates={1250:'PPD1250 BU20=81000, BU36=28000, BU37=56000; total165000. BU47 includes these additions separately.',6200:'Legal M55/M56 March31 credits -28000/-56000; April L57/L58 charges28000. Candidate cross-period linkage only.',2011:'Accr2011 B5 transfer-pricing159695 is labelled year end March31. Credit direction matters.'};
 put(bridge,`A${r}`,[[div,account,prior,null,null,null,candidates[account]??'No specific causal journal supported by the public files.','Request posted-journal dates, cutoff and approved treatment; do not plug.']]);
 f(bridge,`D${r}`,`='${tb}'!D${tr}`);f(bridge,`E${r}`,`='${tb}'!E${tr}`);f(bridge,`F${r}`,`=E${r}-C${r}-D${r}`);
}
get(bridge).getRange('C:F').setNumberFormat(moneyFormat);for(const col of ['C','D','E','F'])get(bridge).getRange(`${col}:${col}`).format.columnWidth=19;
for(const col of ['G','H'])get(bridge).getRange(`${col}:${col}`).format.columnWidth=65;
get(bridge).getRange(`G4:H${data.cross_period_gaps.length+3}`).format.wrapText=true;get(bridge).getRange(`A4:H${data.cross_period_gaps.length+3}`).format.rowHeight=72;

// This public index points to the actual deliverable. It contains no expected
// amounts and is not an alternative numerical result or a grading score.
const evidence=[];
function bind(claim,sheet,address,role='calculated',columns={},basis='Public April source / original ledger; see CFO issues') {evidence.push([claim,sheet,address,role,JSON.stringify(columns),basis]);}
bind('ledger',tb,`A2:F${last}`,'table',{division:'A',account:'B',name:'C',period:'D',ytd:'E',class:'F'});
for(const [claim,cell] of Object.entries({borrowing:'B5',intercompany:'B15',unused:'B17',balance:'B19',excess:'B21'}))bind(`cash.${claim}`,cash,cell);
bind('input.cash1024',tb,`E${rows.get('10:1024')}`,'input');
for(const [claim,cell,role]of [['checks','B10'],['statement','C4','unavailable'],['reconciliation','C12','unavailable'],['book','C18'],['reclass','C14']])bind(`bank.${claim}`,bank,cell,role);
bind('input.check',bank,'B7','input');
for(const [claim,cell]of Object.entries({funding:'D12',funding_average:'E12',intercompany:'D14',intercompany_average:'E14',bank_other:'D15,D18',bank_other_average:'E15,E18',total:'D19',total_average:'E19'}))bind(`funding.${claim}`,funding,cell);
for(const [kind,index,col,first,end,total,gap,gl]of [['expense',5,'BX',8,45,46,48,49],['insurance',6,'AT',6,31,32,34,35]]) {
 for(let r=first;r<=end;r++)bind(`prepaid.${kind}.vendor.${r}`,names[index],`${col}${r}`);
 for(const [claim,row]of [['total',total],['gap',gap],['gl',gl]])bind(`prepaid.${kind}.${claim}`,names[index],`${col}${row}`);
}
bind('input.prepaid_addition',names[5],'BV25','input');bind('prepaid.expense.amortization25',names[5],'BW25');
bind('fees.balance',fees,'W10');bind('input.fees',fees,'V8','input');
for(const [claim,cell]of Object.entries({total:'L63',gl:'L65',gap:'L66',april:'L68'}))bind(`legal.${claim}`,legal,cell);
for(const [n,index,end]of [[1,9,74],[2,10,24]])for(const [claim,col]of [['principal','G'],['charge','E'],['interest','F']])bind(`loan${n}.${claim}`,names[index],`${col}${end}`);
bind('input.loan1_rate',loan,'A74','input');
for(const [claim,cell]of Object.entries({interest:'E80',interest_gl:'E81',interest_gap:'E82',principal:'E84',principal_gl:'E85',principal_gap:'E86'}))bind(`loans.${claim}`,loan,cell);
for(const [claim,cell,role]of [['control','G6'],['detail','G8','unavailable'],['action','B10','explanation']])bind(`ap.${claim}`,ap,cell,role);
for(const [claim,cell]of Object.entries({source:'B6',division10:'B9',gap:'B10',division12:'B12'}))bind(`ar.${claim}`,ar,cell);bind('ar.mapping',ar,'A13','explanation');
for(const [claim,cell]of Object.entries({first:'C21',second:'D21',estimate:'E29',opening:'C36',postings:'C37',rollforward:'C38',gl:'C39',gap:'C40',salary:'C42',salary_gl:'C43',salary_gap:'C44',expenses:'C46',expenses_gl:'C47',expenses_gap:'C48'}))bind(`payroll.${claim}`,payroll,cell);
bind('payroll.annotation',payroll,'E18','explanation',{}, 'Corporate April payroll E18; retain the reallocation instruction separately from amount deduplication');
for(const [claim,index,col,detail,control,gap]of [['rebates',14,'B',11,13,14],['uninvoiced',15,'B',7,9,10],['bonus',16,'B',13,21,22],['misc',17,'C',10,12,13]])for(const [field,row]of [['total',detail],['gl',control],['gap',gap]])bind(`${claim}.${field}`,names[index],`${col}${row}`);
for(const [claim,cell,role]of [['headline','B15'],['salary_ytd','B18'],['ten_percent_reference','B19'],['source_salary','B24','source'],['source_reported','B26','source']])bind(`bonus.${claim}`,bonus,cell,role);
bind('input.bonus',bonus,'B12','input');
for(const [claim,offset]of [['net',9],['clearing',10],['proof',12]])for(const [period,col]of [['period','D'],['ytd','E']])bind(`tb.${claim}.${period}`,tb,`${col}${last+offset}`);
bind('bridges',bridge,`A4:H${data.cross_period_gaps.length+3}`,'table',{division:'A',account:'B',prior:'C',movement:'D',current:'E',gap:'F',candidate:'G',action:'H'});
bind('issues',review,`A4:F${issues.length+3}`,'table',{area:'A',source:'B',observation:'C',result:'D',action:'E',status:'F'});
bind('contents',toc,'A6:C25','table',{section:'A',sheet:'B',status:'C'});
const letter=n=>{let s='';for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
// Source rows have explicit original-row identities, permitting row/column
// rearrangement while preserving signed transactions and source assumptions.
for(const [id,index,file,first,end,endcol]of [
 ['legal',8,'Legal_Dump-1.xlsx',3,59,13],['fees',7,'Prof_Fee_Dump-1.xlsx',3,8,23],
 ['loan1',9,'Good Insurance Co - Loan.xlsx',11,74,5],['loan2',10,'Good Insurance Co - Loan II.xlsx',11,24,5],
 ['payroll',13,'Payroll-1.xlsx',5,20,4],['checks',3,'Outstanding_CKs_4-30-25-1.xlsx',7,8,5],
 ['prepaid_expense',5,'PPD1250-1.xlsx',8,45,82],['prepaid_insurance',6,'PPD1251-1.xlsx',6,31,48],
]) {
 const marker=letter(Math.max(endcol+1,data.metadata[file][0].columns+1,['loan1','loan2','payroll'].includes(id)?26:0)),columns={source_row:marker};for(let i=1;i<=endcol;i++)columns[letter(i)]=letter(i);
 for(let r=first;r<=end;r++)put(names[index],`${marker}${r}`,[[r]]);
 put(names[index],`${marker}${first-1}`,[['Original row']]);
 bind(`source.${id}`,names[index],`A${first}:${marker}${end}`,'source_table',columns,file);
}
if(variant==='legal-layout') {
 put(bonus,'D28',[['Current bonus — alternate summary position']]);f(bonus,'E28','=B13');put(bonus,'D30',[['Original reported observation']]);f(bonus,'E30','=B26');
 evidence.find(x=>x[0]==='bonus.headline')[2]='E28';evidence.find(x=>x[0]==='bonus.source_reported')[2]='E30';
 put(bank,'C12',[['Awaiting independent bank statement; reconciliation open']]);put(ap,'G8',[['Not provided by source owner']]);
}
if(variant==='legal-funding') {
 f(funding,'D15',`=-${ref(7076)}-${ref(7092)}`);put(funding,'A15',[['Bank interest and other income']]);put(funding,'D18',[[null]]);put(funding,'E18',[[null]]);
 f(funding,'D19','=D17');f(funding,'E19','=D19/4');
 evidence.find(x=>x[0]==='funding.bank_other')[2]='D15';evidence.find(x=>x[0]==='funding.bank_other_average')[2]='E15';
}
if(variant==='drop-payroll-note')put(payroll,'E18',[[null]]);
if(variant==='frozen-bonus')put(bonus,'B15',[[(await source('AccrBonus-1.xlsx')).worksheets.getItemAt(0).getRange('B15').values[0][0]]]);
if(variant==='changed-invoice')put(legal,'E3',[['altered-source-identity']]);
const ix=names[20];put(ix,'A1',[['Claim','Sheet','Address','Role','Columns','Basis'],...evidence]);
for(const [col,width]of [['A',42],['B',44],['C',20],['D',18],['E',58],['F',70]])get(ix).getRange(`${col}:${col}`).format.columnWidth=width;
get(ix).getRange(`A2:F${evidence.length+1}`).format.wrapText=true;get(ix).freezePanes.freezeRows(1);
if (variant === 'stale-tb') {
  // Intentional failing full programme: April supports/labels are delivered,
  // but the prior month's ledger is carried forward as the current ledger.
  get(tb).getRange('A2:F107').clear({applyTo:'contents'});
  put(tb,'A2',data.march_records);
}
wb.recalculate();
await fs.mkdir(outDir,{recursive:true});
const file=path.join(outDir,'Aurisic_Financials_4-25-1.xlsx');await (await SpreadsheetFile.exportXlsx(wb)).save(file);
// The last copy for a target records its adopted source layout. Native-format
// preservation consumes this map; it does not change a number or formula.
const byName=new Map(layout.map(x=>[x.target,x]));
await fs.writeFile(path.join(outDir,'layout-map.json'),JSON.stringify([...byName.values()],null,2));
console.log(JSON.stringify({file,sheets:names.length,variant,april_accounts:count,source_scope:'public inputs only',status:'CFO review draft; no final approval or benchmark score'}));

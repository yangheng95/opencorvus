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
names.push('#16) Aurisic Glob Accrual #2011', '#17) Bonus Accrual #2401', '#18) Misc Accruals #2410', 'CFO Review Issues');
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
put(ar,'A13',[['Division12 detail not supplied; confirm scope.']]);
const payroll=names[13];
for(const [row,label]of [[36,'March GL2200'],[37,'Source April accrual postings'],[38,'Supported rollforward'],[39,'April GL2200'],[40,'GL less source rollforward']])put(payroll,`A${row}`,[[label]]);
put(payroll,'C36',[[march(2200)]]);f(payroll,'C37','=SUM(C25,C28,C32)');f(payroll,'C38','=C36+C37');f(payroll,'C39',`=${ref(2200)}`);f(payroll,'C40','=C39-C38');
const rebates=names[14];put(rebates,'A13',[['GL2005 credit control']]);f(rebates,'B13',`=-${ref(2005)}`);put(rebates,'A14',[['Source detail less GL']]);f(rebates,'B14','=B11-B13');
for(const [index,controlRow,diffRow,acct,detail]of [[15,9,10,2011,'B7'],[16,21,22,2401,'B13'],[17,12,13,2410,'C10']]) {
 const name=names[index],col=index===17?'C':'B';put(name,`A${controlRow}`,[[`GL${acct} credit control`]]);f(name,`${col}${controlRow}`,`=-${ref(acct)}`);
 put(name,`A${diffRow}`,[['GL less source detail']]);f(name,`${col}${diffRow}`,`=${col}${controlRow}-${detail}`);
}
const issues = [
 ['AP support','AP_TB-1.xlsx','Missing file','GL2000 retained; vendor detail unavailable','Request April listing','Pending CFO'],
 ['Bank reconciliation','Outstanding_CKs_4-30-25-1.xlsx','C4 bank balance blank','Ledger cash is not independent bank evidence','Request bank statement / reclass approval','Pending CFO'],
 ['Funding','March template / April TB','April subsidiary split missing','GL7206 total available; per-subsidiary actuals unavailable','Confirm allocation and duplicate UK label','Pending CFO'],
 ['Prepaid schedules','PPD1250/PPD1251 and combined prepaid','Competing source versions','Dedicated schedules used; actual GL differences shown','Confirm primary support / corrections','Pending CFO'],
 ['Combined prepaid source','Aurisic_Prepaid_Expenses_4-25-1.xlsx','Different source version',`Original closing caches: expenses ${Number(data.combined_prepaid_original_cache.expenses_BX53).toFixed(2)}; insurance ${Number(data.combined_prepaid_original_cache.insurance_AT32).toFixed(2)}. These are not GL controls.`,'Reconcile source versions and periods','Pending CFO'],
 ['Legacy prepaid checks','PPD1250-1.xlsx P50 / S50','Literal source #REF! cells','Vendor closing calculation is separate; legacy checks unavailable','Confirm legacy check intent','Pending CFO'],
 ['Legal expenses','Legal_Dump-1.xlsx','Source total duplicated prior total','Totals recalculated from transactions; GL difference shown','Explain GL/source difference','Pending CFO'],
 ['Payroll','Payroll-1 / corporate payroll','Same April schedule in both sources','One April copy included; source/GL rollforward shown','Explain accrual difference','Pending CFO'],
 ['Payroll estimate','Payroll-1 C28 / E29','Posted estimate differs from 130% calculation','Source posting 236500; source calculation 236448.888','Confirm rounding or approved estimate','Pending CFO'],
 ['Income classification','April TB GL7092 / funding D18','Original funding categories omit other income','5500 retained as income outside those categories','Confirm presentation / classification','Pending CFO'],
 ['AR division scope','April TB / AR_Accrual-1','Division12 support not supplied','Division10 detail and division12 GL control separated','Confirm consolidation and detail','Pending CFO'],
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
put(toc,'A6',names.slice(1).map((name,i)=>[i===17?'Review':name.match(/^#([^)]*)/)[1],name,'Updated from supplied sources; review CFO issues']));
get(toc).getRange('C6:C23').format.wrapText=true;get(toc).getRange('A6:C23').format.rowHeight=30;
const moneyFormat='#,##0.00;(#,##0.00);0.00';
for(const [name,range] of [[legal,'L65:L66'],[loan,'E80:E86'],[ap,'G6'],[ar,'B9:B12'],[payroll,'C36:C40'],
 [names[15],'B9:B10'],[names[16],'B21:B22'],[names[17],'C12:C13']]) get(name).getRange(range).setNumberFormat(moneyFormat);
for(let i=0;i<issues.length;i++) if(typeof issues[i][3]==='number')get(review).getRange(`D${i+4}`).setNumberFormat(moneyFormat);
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

// Actual saved-file import, complete schedule views and a disposable refresh.
import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
const [root, directory] = process.argv.slice(2);
const file=path.join(directory,'Aurisic_Financials_4-25-1.xlsx');
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(file));
wb.recalculate();
const views=[
 ['Table of Contents','A1:C25','00-toc'],['#3a) TB convert 4-30-25','A1:F20','01-tb-head'],['#3a) TB convert 4-30-25','A90:F114','01-tb-tail'],
 ['#4) Cash Availability Status','A1:C21','02-cash'],['#5) Bank recon 4-30-25','A1:F20','03-bank'],['#6) Aurisic Funding Sources','A1:H22','04-funding'],
 ['#7) PPD Exps #1250 (2025)','A1:CD55','05-prepaids'],['#8) PPD Ins #1251 (2025)','A1:AV35','06-insurance'],
 ['#9) Prof Fees Accrual #2404','A1:W10','07-fees'],['#10) Legal Audit Expense #6200','A1:M15','08-legal-head'],['#10) Legal Audit Expense #6200','A48:M67','08-legal-tail'],
 ['#11a) Interest Accrual I','A1:H12','09-loan1-terms'],['#11a) Interest Accrual I','A66:H87','09-loan1-april'],['#11b) Interest Accrual II','A1:I25','10-loan2'],
 ['#12) AP Trade #2000','A1:J14','11-ap'],['#13) AR Accruals #1101','A1:G17','12-ar'],['#14) Payroll Accrual #2200','A1:F41','13-payroll'],
 ['#15) Vendor Rebates #2005','A1:C15','14-rebates'],['#16) Aurisic Glob Accrual #2011','A1:C11','15-uninvoiced'],
 ['#17) Bonus Accrual #2401','A1:C23','16-bonus'],['#18) Misc Accruals #2410','A1:D14','17-misc'],['CFO Review Issues','A1:F14','18-issues'],['CFO Review Issues','A15:F26','19-issues-tail'],
];
await fs.mkdir(path.join(directory,'views'),{recursive:true});
for(const [sheetName,range,name] of views) {
 const image=await wb.render({sheetName,range,scale:1.4,format:'png'});
 await fs.writeFile(path.join(directory,'views',name+'.png'),new Uint8Array(await image.arrayBuffer()));
}
const requests={
 '#5) Bank recon 4-30-25':['B10','C4','C12','C16','C18'],
 '#6) Aurisic Funding Sources':['D12','D14','D15','D17','D18','E12','E14','E15'],
 '#7) PPD Exps #1250 (2025)':['BX46','BX48','BX49'], '#8) PPD Ins #1251 (2025)':['AT32','AT34','AT35'],
 '#9) Prof Fees Accrual #2404':['W10'], '#10) Legal Audit Expense #6200':['L63','L65','L66'],
 '#11a) Interest Accrual I':['G74','F74','E80','E81','E82','E84','E85','E86'], '#11b) Interest Accrual II':['G24','F24'],
 '#12) AP Trade #2000':['G6','G8','G12'], '#13) AR Accruals #1101':['B6','B9','B10','B12'],
 '#14) Payroll Accrual #2200':['C21','D21','C36','C37','C38','C39','C40'], '#15) Vendor Rebates #2005':['B11','B13','B14'],
 '#16) Aurisic Glob Accrual #2011':['B7','B9','B10'], '#17) Bonus Accrual #2401':['B13','B15','B21','B22'], '#18) Misc Accruals #2410':['C10','C12','C13'],
};
const values={};for(const [name,cells] of Object.entries(requests)){values[name]={};for(const c of cells)values[name][c]=wb.worksheets.getItem(name).getRange(c).values[0]?.[0]??null;}
await fs.writeFile(path.join(directory,'actual-recalculated-values.json'),JSON.stringify(values,null,2));
const scan=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#CIRC',options:{useRegex:true,maxResults:50},maxChars:4000});
await fs.writeFile(path.join(directory,'formula-error-scan.ndjson'),scan.ndjson);
const cash=wb.worksheets.getItem('#4) Cash Availability Status'),bank=wb.worksheets.getItem('#5) Bank recon 4-30-25');
const before=cash.getRange('B19').values[0][0],beforeBank=bank.getRange('C18').values[0][0];
const normalization=JSON.parse(await fs.readFile(path.join(root,'source-normalization.json'),'utf8'));
const index=normalization.records.findIndex(r=>r[0]===10&&r[1]===1024)+2;
const input=wb.worksheets.getItem('#3a) TB convert 4-30-25').getRange(`E${index}`);
input.values=[[input.values[0][0]+1]];wb.recalculate();
const refresh={input:`April ledger division10 account1024 YTD +1`,cash_delta:cash.getRange('B19').values[0][0]-before,ledger_bank_control_delta:bank.getRange('C18').values[0][0]-beforeBank,
 independent_bank_calculation:bank.getRange('C12').values[0][0],source_file_overwritten:false};
await fs.writeFile(path.join(directory,'actual-refresh.json'),JSON.stringify(refresh,null,2));
if(refresh.cash_delta!==1||refresh.ledger_bank_control_delta!==1||refresh.independent_bank_calculation!=='unavailable')throw Error('REFRESH_CONTRACT_MISMATCH');
console.log(JSON.stringify({file,views:views.length,refresh}));

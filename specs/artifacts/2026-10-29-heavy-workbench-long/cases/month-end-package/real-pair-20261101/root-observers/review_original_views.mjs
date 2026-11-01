// Root read-only rendering of each exact sealed formal financial handoff.
import fs from 'node:fs/promises';
import path from 'node:path';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const root=path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const plans={
 codex:[
  ['payroll','#14) Payroll Accrual #2200','A36:F55'],
  ['legal','#10) Legal Audit Expense #6200','A43:N75'],
  ['cfo1','CFO review requests','A1:F6'],
  ['cfo2','CFO review requests','A7:F12'],
  ['cfo3','CFO review requests','A13:F19']
 ],
 opencorvus:[
  ['payroll','#14) Payroll Accrual #2200','A31:F56'],
  ['prepaid','#7) PPD Exps #1250 (2025)','A31:H48'],
  ['legal','#10) Legal Audit Expense #6200','A31:I60'],
  ['cfo1','CFO Review','A1:F14'],
  ['cfo2','CFO Review','A15:F28'],
  ['cfo3','CFO Review','A29:F36']
 ]
};
const template=process.argv.includes('--template');
const selected=template?{template:[['prepaid','#7) PPD Exps #1250 (2025)','A1:N20'],['fees','#9) Prof Fees Accrual #2404','A1:X14'],['legal','#10) Legal Audit Expense #6200','A1:N20']]}:plans;
const results=[];
for(const [candidate,views]of Object.entries(selected)){
 const file=template?path.join(root,'frozen-public/Aurisic_Financials_3-25-1.xlsx'):path.join(root,candidate,'project/submission/Aurisic_Financials_4-25-1.xlsx');
 const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(file));wb.recalculate();
 const dest=path.join(root,'whole-product-review',candidate);await fs.mkdir(dest,{recursive:true});
 for(const [tag,sheetName,range]of views){
  const started_at=new Date().toISOString();
  const png=await wb.render({sheetName,range,scale:1.4,format:'png'});
  const target=path.join(dest,tag+'.png');
  await fs.writeFile(target,new Uint8Array(await png.arrayBuffer()));
  results.push({candidate,source:file,sheet:sheetName,range,target,started_at,ended_at:new Date().toISOString(),source_overwritten:false});
  console.log(candidate+' '+tag);
 }
}
await fs.writeFile(path.join(root,'whole-product-review',template?'template-render-receipt.json':'render-receipt.json'),JSON.stringify(results,null,2));

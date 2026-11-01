// Actual saved-workbook consumption; interventions never overwrite the file.
import fs from 'node:fs/promises';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const [file,specFile,out]=process.argv.slice(2),spec=JSON.parse(await fs.readFile(specFile,'utf8'));
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(file));
function range(claim){const e=spec.index[claim];if(!e)throw Error(`CLAIM_REQUIRED:${claim}`);return wb.worksheets.getItem(e.sheet).getRange(e.address);}
function value(claim){const e=spec.index[claim];if(!e)return null;const vals=e.address.split(',').map(c=>wb.worksheets.getItem(e.sheet).getRange(c.trim()).values[0]?.[0]??null);return vals.length===1?vals[0]:vals.every(x=>typeof x==='number')?vals.reduce((a,b)=>a+b,0):null;}
wb.recalculate();
const scalarClaims=Object.keys(spec.index).filter(c=>!['table','source_table'].includes(spec.index[c].role));
const baseline=Object.fromEntries(scalarClaims.map(c=>[c,value(c)])),refresh=[],tables={};
const colNumber=s=>[...s].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);
for(const [claim,e]of Object.entries(spec.index))if(['table','source_table'].includes(e.role)){
 const values=wb.worksheets.getItem(e.sheet).getRange(e.address).values,start=colNumber(e.address.match(/^[A-Z]+/)[0]);
 tables[claim]=values.map(row=>Object.fromEntries(Object.entries(e.columns).map(([field,col])=>[field,row[colNumber(col)-start]??null])));
}
for(const test of spec.refresh){
 const cell=range(test.input),before=cell.values[0][0];
 if(typeof before!=='number')throw Error(`NUMERIC_INPUT_REQUIRED:${test.input}`);
 const prior=Object.fromEntries(Object.keys(test.outputs).map(c=>[c,value(c)]));
 cell.values=[[before+test.delta]];wb.recalculate();
 const deltas=Object.fromEntries(Object.keys(test.outputs).map(c=>[c,typeof value(c)==='number'&&typeof prior[c]==='number'?value(c)-prior[c]:null]));
 refresh.push({input:test.input,input_delta:test.delta,expected:test.outputs,deltas,unavailable:Object.fromEntries(['bank.statement','bank.reconciliation','ap.detail'].map(c=>[c,value(c)]))});
 cell.values=[[before]];wb.recalculate();
}
await fs.writeFile(out,JSON.stringify({baseline,tables,refresh,source_file_overwritten:false},null,2));
console.log(JSON.stringify({file,scalar_claims:spec.scalar_claims.length,refresh_cases:refresh.length}));

import fs from 'node:fs';
import ts from '../node_modules/typescript/lib/typescript.js';
const root='.tmp-spreadsheet-permission-hover-398';
const edits=[];
for(const file of ['lib/index.js','lib/es/index.js','lib/cjs/index.js','lib/umd/index.js']){
  const path=`node_modules/@univerjs/sheets-ui/${file}`;
  const original=fs.readFileSync(path,'utf8');
  const source=ts.createSourceFile(path,original,99,true,1);
  const name=file.includes('/umd/')?'Yd':'SheetPermissionPanelList';
  const functions=[];
  function find(node){if(ts.isFunctionDeclaration(node)&&node.name?.text===name)functions.push(node);ts.forEachChild(node,find);}
  find(source);
  if(functions.length!==1)throw Error('Unique function '+path);
  const literals=[];
  function classes(node){if(ts.isStringLiteralLike(node))literals.push(node);ts.forEachChild(node,classes);}
  classes(functions[0]);
  const replacements=[];
  for(const [token,addition,count] of [['hover:univer-bg-gray-50','dark:hover:!univer-bg-gray-700',1],['hover:univer-bg-gray-200','dark:hover:!univer-bg-gray-600',2],['univer-text-gray-400','dark:!univer-text-gray-300',1]]){
    const selected=literals.filter(node=>token==='univer-text-gray-400'
      ? node.text==='univer-text-3 univer-mt-2 univer-max-w-64 univer-truncate univer-text-sm univer-text-gray-400'
      : node.text.split(/\s+/).includes(token));
    if(selected.length!==count)throw Error(`Class count ${token} ${path}`);
    for(const node of selected){
      if(node.text.split(/\s+/).includes(addition))throw Error('Already modified '+path);
      const start=node.getStart(source)+1,end=node.end-1;
      const before=original.slice(start,end),after=before+' '+addition;
      replacements.push({start,end,before,after});
    }
  }
  let next=original;
  for(const edit of [...replacements].sort((a,b)=>b.start-a.start))next=next.slice(0,edit.start)+edit.after+next.slice(edit.end);
  if(ts.createSourceFile(path,next,99,true,1).parseDiagnostics.length)throw Error('Syntax '+path);
  edits.push({file,path,name,original,next,replacements});
}
for(const edit of edits){const dest=`${root}/vendor-before/${edit.file}`;fs.mkdirSync(dest.slice(0,dest.lastIndexOf('/')),{recursive:true});fs.writeFileSync(dest,edit.original,{flag:'wx'});}
fs.writeFileSync(root+'/sheets-ui.patch-before',fs.readFileSync('patches/@univerjs%2Fsheets-ui@0.25.1.patch'),{flag:'wx'});
for(const edit of edits)fs.writeFileSync(edit.path,edit.next);
fs.writeFileSync(root+'/vendor-files.json',JSON.stringify(edits.map(({file,path,name,replacements})=>({file,path,name,replacements})),null,2));
console.log('Four scoped class changes per runtime applied; real page verification remains required.');

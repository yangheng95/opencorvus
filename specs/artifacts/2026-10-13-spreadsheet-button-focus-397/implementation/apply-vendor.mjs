import fs from 'node:fs';
import ts from '../node_modules/typescript/lib/typescript.js';
const root='.tmp-spreadsheet-button-focus-397';
const edits=[];
for (const file of ['lib/index.js','lib/es/index.js','lib/cjs/index.js','lib/umd/index.js']) {
  const path=`node_modules/@univerjs/ui/${file}`;
  const original=fs.readFileSync(path,'utf8');
  const source=ts.createSourceFile(path,original,99,true,1);
  const name=file.includes('/umd/')?'Ri':'givingBackFocusElements';
  const candidates=[];
  function visit(node) {
    if (ts.isVariableDeclaration(node)&&node.name?.text===name) candidates.push(node);
    ts.forEachChild(node,visit);
  }
  visit(source);
  if(candidates.length!==1||!ts.isArrayLiteralExpression(candidates[0].initializer)) throw Error(`Unique focus categories ${path}`);
  const array=candidates[0].initializer;
  const values=array.elements.map(node=>ts.isStringLiteralLike(node)?node.text:null);
  if(JSON.stringify(values)!==JSON.stringify(['app-layout','button','sheet-bar-append-button','render-canvas','workbench-layout'])) throw Error(`Unexpected focus categories ${path}`);
  const before=original.slice(array.getStart(source),array.end);
  const after=file.includes('/umd/')?'[`app-layout`,`render-canvas`,`workbench-layout`]':'[\n\t"app-layout",\n\t"render-canvas",\n\t"workbench-layout"\n]';
  const next=original.slice(0,array.getStart(source))+after+original.slice(array.end);
  if(ts.createSourceFile(path,next,99,true,1).parseDiagnostics.length) throw Error(`Syntax ${path}`);
  edits.push({path,file,name,before,after,original,next});
}
for (const edit of edits) {
  const destination=`${root}/vendor-before/${edit.file}`;
  fs.mkdirSync(destination.slice(0,destination.lastIndexOf('/')),{recursive:true});
  fs.writeFileSync(destination,edit.original,{flag:'wx'});
}
fs.writeFileSync(root+'/ui.patch-before',fs.readFileSync('patches/@univerjs%2Fui@0.25.1.patch'),{flag:'wx'});
for (const edit of edits) fs.writeFileSync(edit.path,edit.next);
fs.writeFileSync(root+'/vendor-files.json',JSON.stringify(edits.map(({path,file,name,before,after})=>({path,file,name,before,after})),null,2));
console.log('Updated four exact focus-category arrays; native button behavior still needs real desktop review.');

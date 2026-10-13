import fs from 'node:fs';
import ts from '../node_modules/typescript/lib/typescript.js';
const root='.tmp-spreadsheet-focus-scroll-396'; const edits=[];
for(const file of ['lib/index.js','lib/es/index.js','lib/cjs/index.js','lib/umd/index.js']) {
  const path=`node_modules/@univerjs/docs-ui/${file}`; const original=fs.readFileSync(path,'utf8'); const sf=ts.createSourceFile(path,original,99,true,1);
  let target; const className=file.includes('/umd/')?'Y':'DocSelectionRenderService';
  function visit(n) {
    if(ts.isVariableDeclaration(n)&&n.name?.text===className&&ts.isClassExpression(n.initializer)) target=n.initializer;
    else if(ts.isClassDeclaration(n)&&n.name?.text===className) target=n;
    else ts.forEachChild(n,visit);
  }
  visit(sf); if(!target) throw Error('Class '+path);
  const methods=target.members.filter(m=>ts.isMethodDeclaration(m)&&m.name?.text==='focus'); if(methods.length!==1)throw Error('Unique focus '+path);
  const method=methods[0]; const before=original.slice(method.getStart(sf),method.end); if(before.split('this._input.focus()').length!==2)throw Error('Unique native input '+path);
  const after=before.replace('this._input.focus()','this._input.focus({ preventScroll: true })');
  const next=original.slice(0,method.getStart(sf))+after+original.slice(method.end);
  if(ts.createSourceFile(path,next,99,true,1).parseDiagnostics.length)throw Error('Syntax '+path);
  const dest=`${root}/vendor-before/${file}`;fs.mkdirSync(dest.slice(0,dest.lastIndexOf('/')),{recursive:true});fs.writeFileSync(dest,original,{flag:'wx'});
  edits.push({path,file,className,before,after,next});
}
for(const edit of edits)fs.writeFileSync(edit.path,edit.next);
fs.writeFileSync(root+'/vendor-files.json',JSON.stringify(edits.map(({path,file,className,before,after})=>({path,file,className,before,after})),null,2));
for(const file of ['package.json','bun.lock'])fs.writeFileSync(root+'/'+file+'-before',fs.readFileSync(file),{flag:'wx'});
console.log('Four exact hidden-input focus methods updated; internal navigation and visible-control focus retained.');

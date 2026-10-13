import fs from 'node:fs';
import ts from '../node_modules/typescript/lib/typescript.js';
const root = '.tmp-spreadsheet-permission-panel-locale-394';
function rep(s, a, b, count = 1) { const parts = s.split(a); if (parts.length !== count + 1) throw Error(`Expected ${count}: ${a}`); return parts.join(b); }
function scope(s, name, edit) {
  const sf = ts.createSourceFile('vendor.js', s, 99, true, 1); let target;
  function visit(n) { if ((ts.isFunctionDeclaration(n) || ts.isVariableDeclaration(n)) && n.name?.text === name) target = n; else ts.forEachChild(n, visit); }
  visit(sf); if (!target) throw Error(name);
  return s.slice(0, target.getStart(sf)) + edit(s.slice(target.getStart(sf), target.end)) + s.slice(target.end);
}
const changes = [];
for (const file of ['lib/index.js', 'lib/es/index.js', 'lib/cjs/index.js', 'lib/umd/index.js']) {
  const path = `node_modules/@univerjs/sheets-ui/${file}`; const original = fs.readFileSync(path, 'utf8'); let s = original;
  if (file.includes('/umd/')) {
    s = scope(s, 'Gd', b => rep(b, 'title:`${v.t(`sheets-ui.permission.panel.title`)}`', 'title:`sheets-ui.permission.panel.title`'));
    s = scope(s, 'Yd', b => rep(b, 'title:`${g.t(`sheets-ui.permission.panel.title`)}`', 'title:`sheets-ui.permission.panel.title`'));
    s = scope(s, 'Kd', b => {
      b = rep(b, 'rangesErrMsg:c,permissionId:p', 'rangesErrMsg:c');
      b = rep(b, ',v=(0,r.useDependency)(n.Injector)', '');
      b = rep(b, 'let s=r.getUnitId(),c=o.getSheetId(),l=t.map', 'let l=t.map');
      return rep(b, 'i(l,Vd(v,l,p,s,c))', 'i(l)');
    });
    s = scope(s, 'Jd', b => {
      b = rep(b, '[g,_]=(0,l.useState)(()=>Vd(u,p.ranges,p.permissionId,p.unitId,p.subUnitId))', 'g=Vd(u,m,p.permissionId,p.unitId,p.subUnitId)');
      return rep(b, '(Kd,{permissionId:p.permissionId,ranges:m,onRangesChange:(e,t)=>{h(e),_(t)},', '(Kd,{ranges:m,onRangesChange:e=>h(e),');
    });
  } else {
    s = scope(s, 'PermissionDetailFooterPart', b => rep(b, 'title: `${localeService.t("sheets-ui.permission.panel.title")}`', 'title: "sheets-ui.permission.panel.title"'));
    s = scope(s, 'SheetPermissionPanelList', b => rep(b, 'title: `${localeService.t("sheets-ui.permission.panel.title")}`', 'title: "sheets-ui.permission.panel.title"'));
    s = scope(s, 'PermissionDetailMainPart', b => {
      b = rep(b, 'rangesErrMsg, permissionId } = props', 'rangesErrMsg } = props');
      const injector = file.includes('/cjs/') ? '(0, _univerjs_ui.useDependency)(_univerjs_core.Injector)' : 'useDependency(Injector)';
      b = rep(b, `\n\tconst injector = ${injector};`, '');
      b = rep(b, '\n\t\tconst unitId = workbook.getUnitId();\n\t\tconst subUnitId = worksheet.getSheetId();', '');
      return rep(b, 'onRangesChange(transformedRange, checkRangeValid(injector, transformedRange, permissionId, unitId, subUnitId));', 'onRangesChange(transformedRange);');
    });
    s = scope(s, 'SheetPermissionPanelDetail', b => {
      const state = file.includes('/cjs/') ? '(0, react.useState)' : 'useState';
      b = rep(b, `const [rangesErrMsg, setRangesErrMsg] = ${state}(() => {\n\t\treturn checkRangeValid(injector, activeRule.ranges, activeRule.permissionId, activeRule.unitId, activeRule.subUnitId);\n\t});`, 'const rangesErrMsg = checkRangeValid(injector, ranges, activeRule.permissionId, activeRule.unitId, activeRule.subUnitId);');
      b = rep(b, '\n\t\t\t\tpermissionId: activeRule.permissionId,\n\t\t\t\tranges,', '\n\t\t\t\tranges,');
      return rep(b, 'onRangesChange: (v, err) => {\n\t\t\t\t\tsetRanges(v);\n\t\t\t\t\tsetRangesErrMsg(err);\n\t\t\t\t}', 'onRangesChange: (v) => setRanges(v)');
    });
  }
  changes.push({path, file, original, next:s});
}
const file='lib/types/views/permission/panel-detail/PermissionDetailMainPart.d.ts'; const path=`node_modules/@univerjs/sheets-ui/${file}`; const original=fs.readFileSync(path,'utf8');
changes.push({path,file,original,next:rep(rep(original,'    permissionId: string;\n',''),'onRangesChange: (ranges: IRange[], err?: string) => void;','onRangesChange: (ranges: IRange[]) => void;')});
for (const change of changes) {
  const sf=ts.createSourceFile(change.path,change.next,99,true,change.file.endsWith('.d.ts')?3:1); if(sf.parseDiagnostics.length) throw Error('Syntax '+change.path);
  const before=`${root}/vendor-before/${change.file}`; fs.mkdirSync(before.slice(0,before.lastIndexOf('/')),{recursive:true}); fs.writeFileSync(before,change.original,{flag:'wx'});
}
for(const change of changes) fs.writeFileSync(change.path,change.next);
fs.writeFileSync(`${root}/vendor-files.json`,JSON.stringify(changes.map(({path,file})=>({path,file})),null,2));
console.log('Applied five scoped vendor files; real page acceptance remains required.');

import fs from 'node:fs';
const root='.tmp-spreadsheet-permission-hover-398';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const scope=stage=>{
  const dir='.tmp-spreadsheet-artifact-identity-387/'+stage;
  const ready=read(dir+'/ready.json'),terminal=read(dir+'/terminal.json');
  const page=read(root+'/observations/'+(stage.endsWith('before')?'before':'after')+'-page-closed.json');
  return{ready,terminal,pageClosed:page,originalDeadline:new Date(ready.started+1200000).toISOString(),closeBy:new Date(ready.started+1140000).toISOString(),pageCloseReserveMs:ready.started+1200000-Date.parse(page.at),launcherJoinedExitCode:0,ownership:'Root owned credentialless production listener/recovery, no model or user credential'};
};
const review={
  reviewedAt:new Date().toISOString(),reviewer:'Root, actual CUA actions and manual screenshot inspection',
  qualification:'Real desktop UI acceptance of scoped permission-card colours; no UI automation tests',
  sessionID:'ses_h0VKkCl7hbz3BKHVW2Xp',artifactID:'art_g0VXv65e1004ErsrwSJs',
  implementation:'Four runtime class changes only; 14 patch headers with ten original non-runtime segments retained; installed preset and built spreadsheet chunk independently reviewed',
  dark:{before:{cardBackground:[249,250,251],text:[255,255,255],operationBackground:[227,229,234],description:[125,134,152]},after:{cardBackground:[39,42,47],text:[255,255,255],operationBackground:[49,54,63],description:[168,176,189]},surfaces:'Actual normal and fullscreen card/Edit/Delete pointer hover observed; direct right clicks position pointer over operations without left activation'},
  light:{beforeAndAfter:{cardBackground:[249,250,251],text:[27,28,31],description:[125,134,152]},qualification:'Actual theme change in same workbook, rule retained; no claim of improved light description contrast'},
  language:{path:'English → Chinese (Simplified) → English',observed:'Same A1 rule, original HOVER-398 temporary description, translated title/body/Add/empty state in normal and fullscreen'},
  actions:{add:'Actual Tab/Enter from sidebar Close opens Detail; actual Confirm creates A1 rule',edit:'Actual Edit opens original A1/HOVER-398 temporary detail; Cancel closes sidebar content, original rule remains and reopens through real sheet menu',pointerLeave:'Actual pointer move by heading click makes card :hover false and background transparent; original screenshots retain range drawing',delete:'Actual Delete only this own temporary rule; Chinese fullscreen empty state observed',settings:'System/English restored; 100% unchanged'},
  data:{visibleValues:'7/5/12',cellEdits:0,modelRequests:0,qualification:'Original real artifact retained; formula recalculation and new model publication were not repeated for this CSS change'},
  limitations:['A1 was selected as well as protected; independent range-highlight visual effect was not separated from selection/protection drawing. Screenshots and unchanged event code remain evidence, not full highlight qualification.','Explicit context-command editor return was not repeated in 398; 397 prior qualification is a separate record.','No all-theme, all-user, multi-workbook, mobile, light-description contrast or WCAG-wide compliance claim.'],
  scopes:{before:scope('398-before'),after:scope('398-after')},
  processFailures:[
    {stage:'Before capture',kind:'CUA strict locator',message:"getByText('HOVER-398 temporary', {exact:true}) resolved to card description and tooltip",resolution:'Used actual Sidebar panel scope; subsequent real hover/style/screenshot captured'},
    {stage:'Vendor edit preparation',kind:'AST guarded edit failed before any writes',message:'Class count univer-text-gray-400 node_modules/@univerjs/sheets-ui/lib/index.js',resolution:'Two literals include empty state. Scoped exact description literal; empty state unchanged. Successful final edit/install recorded separately'},
    {stage:'Chinese capture',kind:'CUA no_matches',message:'Guessed 侧栏面板 did not match actual 侧边栏面板',resolution:'Read actual AX and used correct current label; this is locator error, not a product language defect'}
  ],
  observations:fs.readdirSync(root+'/observations').filter(p=>p!=='final-review.json'),
  axQualification:'Saved getAXState outputs are partial diffs unless explicitly named full; no complete AX coverage claim',
};
fs.writeFileSync(root+'/observations/final-review.json',JSON.stringify(review,null,2));
console.log(JSON.stringify({scopes:review.scopes,observationFiles:review.observations.length,manualQualification:review.qualification},null,2));

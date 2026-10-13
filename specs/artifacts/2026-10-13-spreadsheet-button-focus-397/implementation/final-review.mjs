import fs from 'node:fs';
const root='.tmp-spreadsheet-button-focus-397';
const scope='.tmp-spreadsheet-artifact-identity-387/397-after';
const csv=fs.readFileSync(root+'/edited-normal.csv');
const expected=Buffer.from('\ufeff"Item","Quantity"\r\n"Notebook","9"\r\n"Pen","5"\r\n"Total","14"','utf8');
if(!csv.equals(expected)) throw Error('Actual downloaded cell values differ from the manually verified workbook');
const csvReview={bytes:csv.length,values:{Notebook:9,Pen:5,Total:14},encoding:'UTF-8 BOM',lineEndings:'three CRLF, no terminal newline',source:'Actual browser download from current edited normal view',qualification:'File data check, not a UI automation test'};
fs.writeFileSync(root+'/observations/csv-byte-review.json',JSON.stringify(csvReview,null,2));
const owner=JSON.parse(fs.readFileSync(scope+'/owner.json','utf8'));
const ready=JSON.parse(fs.readFileSync(scope+'/ready.json','utf8'));
const terminal=JSON.parse(fs.readFileSync(scope+'/terminal.json','utf8'));
const closed=JSON.parse(fs.readFileSync(root+'/observations/page-closed.json','utf8'));
const review={
 reviewedAt:new Date().toISOString(),reviewer:'Root, actual CUA desktop interaction and screenshot inspection',
 qualification:'Manual observations; no UI automated test, synthetic click, internal command injection or model run',
 sessionID:'ses_h0VKkCl7hbz3BKHVW2Xp',artifactID:'art_g0VXv65e1004ErsrwSJs',
 normal:{
  addEnter:{navigation:'Real Tab from Sidebar close to Add',focused:'Native BUTTON data-u-comp=button',result:'Detail opened',chatScrollTopBefore:724.6666870117188,chatScrollTopAfter:724.6666870117188},
  addSpace:{navigation:'Real Tab from Sidebar close to Chinese Add',result:'Chinese Detail opened'},
  ranges:{add:'Native Tab/Enter added second range',confirm:'Native Tab/Space Confirm returned A1:A2 and A2:A3 to original checker',error:'Range cannot overlap then 范围不能重叠 in same Detail'},
  permission:{description:'FOCUS-397 temporary',range:'A1',confirm:'Shift+Tab to Confirm, Enter created real local rule and returned List',cancel:'Real Tab/Space cancelled original unsaved overlapping Detail',cleanup:'Only this rule removed via visible delete; localized empty state observed'},
  zoom:{navigation:'Minus mouse changed100 to90; real Tab via handle and plus reached90% button',activation:'Enter opened percentage menu',intermediate:'Two Down then Return selected75, not100',restoration:'Actual visible100 menu entry restored original scale'},
  sheetMenu:{navigation:'Focus append with documented locator press, actual Tab transferred to SheetBarMenu button',activation:'Enter opened menu showing 清单',firstAttempt:'Escape then Shift+Tab/Tab from BODY did not reach intended target; initial screenshot retained as failure'},
  sheetAdd:{navigation:'Actual Shift+Tab from SheetBarMenu to append',activation:'Space created 工作表1',cleanup:'Only new empty sheet removed through real context/Delete confirmation Tab/Enter; production RemoveSheetCommand registers undo for empty sheet; original 清单 remains selected'},
  contextReturn:{command:'Actual cell A2 context Copy',activeInput:'__editor___INTERNAL_EDITOR__DOCS_NORMAL',navigation:'Down moved A2 to A3',edit:'Double-click B2, Ctrl+A, paste9, Return; actual9/5/14 and61-byte CSV'},
 },
 fullscreen:{add:'Real Tab/Space opened Chinese Detail',rangeCancel:'Actual Dialog Tab to Cancel/Enter closed Dialog with B3 preserved',detailCancel:'Real Tab/Space cancelled unsaved Detail; no fullscreen rule saved',observedValues:{Notebook:9,Pen:5,Total:14},qualification:'Observed this scope only; no claim of persisted edits after unmount'},
 colorDialog:{navigation:'Actual More colors click then four native Tabs to Cancel',activation:'Space cancelled Dialog',returnedFocus:'BODY',escape:'One subsequent Escape closed both visible context and color menus; retained boundary, not layered-Escape success'},
 boundaries:['More Colors non-href link and body return remain','Chinese range/delete Dialog close accessible name observed as English Close','Rule hover contrast remains next batch','Overflow paging, standalone Docs, mobile, full IME and all toolbar commands not qualified','Initial BODY sheet-menu attempt retained, successful actual Tab observation is separate'],
 csv:csvReview,closure:{owner,ready,terminal,page:closed,launcherSessionID:92591,launcherExitCode:0,originalMaxLifetimeMs:1200000,noCredentials:true,noModelExecution:true},
 integration:{patchPrepare:'exit0',patchCommit:'exit0',emptyCache:'Exact3-line empty cache segment saved and removed; final13patch files',frozenInstall:'exit0',typecheck:{sessionID:68786,exitCode:0},build:{sessionID:11707,exitCode:0,seconds:55.18}},
};
fs.writeFileSync(root+'/observations/final-review.json',JSON.stringify(review,null,2));
console.log('Root manual scope review and actual61-byte CSV check saved.');

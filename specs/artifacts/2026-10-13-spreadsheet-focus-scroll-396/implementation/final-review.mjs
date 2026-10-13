import fs from 'node:fs';
const root='.tmp-spreadsheet-focus-scroll-396';
const actual=fs.readFileSync(root+'/edited-normal.csv');
const expected=Buffer.from('\ufeff"Item","Quantity"\r\n"Notebook","9"\r\n"Pen","5"\r\n"Total","14"');
if(!actual.equals(expected))throw Error('Actual downloaded CSV bytes differ');
fs.writeFileSync(root+'/csv-byte-review.json',JSON.stringify({bytes:actual.length,exactExpectedBytes:true,values:[9,5,14],bom:true,lineEnding:'CRLF',proof:'Actual browser download from current edited view'},null,2));
const page=JSON.parse(fs.readFileSync(root+'/page-closed.json','utf8'));
page.pageCloseRequestedAt=page.pageClosedAt;delete page.pageClosedAt;page.pageClosedObservedAt=new Date().toISOString();page.closeToolFulfilled=true;
fs.writeFileSync(root+'/page-closed.json',JSON.stringify(page,null,2));
const review={
  iteration:[394,396],rootManualVisualReview:true,tab:'37',pid:38364,
  actualPage:'http://localhost:18505/ui',providerOrCredentialExecution:false,
  mouseAdd:{before:'394-after focus moved to hidden editor, Chat scrolled to top and List remained',after:'396-after visible Add clicked once, Detail opened',chatScrollTopBefore:724.6666870117188,chatScrollTopAfter:724.6666870117188,hiddenProxyStillFocused:true},
  permissionDetail:{languageRoundTrip:['en-US','zh-CN','en-US'],titles:['Protect Rows and Columns','保护行列','Protect Rows and Columns'],errors:['Range cannot overlap','范围不能重叠','Range cannot overlap'],qualifiedRangeInput:'Visible Select data range dialog: A1:A2 plus A2:A3',description:'LOCALE-394/396 temporary',rangesDescriptionAndChoicesRetained:true},
  permissionCommit:{validRange:'A1:A2',realConfirm:true,ruleCreatedInLocalUniverInstance:true,returnedListLanguage:['en-US','zh-CN'],onlyTemporaryRuleDeleted:true,finalState:'Positive localized empty protection list'},
  editing:{method:'Double-click B2, select its text, paste 9, Return',actualValues:[9,5,14],formulaNaturallyRecalculated:true,actualCSVBytes:61},
  internalNavigation:{target:'B20',chatScrollTopBefore:285.3333435058594,chatScrollTopAfter:285.3333435058594,internalCanvasTargetRevealed:true,manualChatScrollUsedToInspectClippedCanvasBottom:true,returnedTo:'B3'},
  fullscreen:{realMenuAndAdd:true,cleanDialogOverlapEntered:true,visibleChineseError:true,observedValues:[9,5,14],unsavedDetailCancelled:true},
  failuresRetained:{directKeyOrTypeText9:'Did not change the selected cell; no successful keyboard-text claim',directFullscreenRangePaste:'Did not replace B3 as desired; concatenated text experiment was cancelled, qualified range came from a new clean visible dialog',firstCSVByteScript:'PowerShell quoting failure before check; same actual CSV verified by this saved script'},
  outstanding:{keyboardButtonFocus:'Actual Enter on Add still returns to DOCS_NORMAL and advances selection A1 to A2; tracked separately in397, no keyboard activation success claim',permissionRuleHover:'Observed light hover background with low-contrast light text; next independent candidate',independentDocsAndMobile:'Not visually qualified',fullIMEAndAllSelectionNavigation:'Not qualified'},
  languageRestored:'en-US',ownPageClosed:true,originalOwnerNormalStop:true,
};
fs.writeFileSync(root+'/final-review.json',JSON.stringify(review,null,2));
console.log(JSON.stringify({csvBytes:actual.length,rootReviewed:true,keyboardBoundary:'397',pageClosed:true}));

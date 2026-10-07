# Actual Home113 branch findings — read-only final proposal

## Actual complete trace and direct cause
Read all61 entries of before-01/root-home-settled-console.json and current temporary-instrumented dom-utils onScroll. Trace was neither120-cap nor1000ms-window truncated. Initial now98027.5 trustedHome/exactowner/no modifiers,top583.2000/total1219/client635/trackingtrue,249.9ms remaining; seq2 actualmain accepted/defaultPreventedtrue. seq3 at98062.8 echo top581.59998,delta−1.60004,bottom2.40002,214.6ms remaining. Echo's onAtBottom seq4/5 retains214.2ms; that early branch does not clear intent.

The decisive seq6/7 at98069.9 is ordinary finalbottom branch at top577.59998. Original code has just executed upwardInputIntentUntil=0. seq8 reports the original pre-clear boolean ownsUpwardMovement=true,delta−4,bottom6.40002 but remaining0. seq9 at98076.4 nexttop573.59998,delta−4,bottom10.40002 reports owns=false,trackingtrue. Thus the same smoothHome movement crossed the8px boundary only about49ms after the actual key, but the previous recognized upward step inside8px already consumed its intent. This is not actual250ms expiry. Original window would still have about201ms at seq9 without that clear.

All remaining seq9–48 retaintrackingtrue with ownsfalse; seq49 onward mostlytiny events, finalseq61 top0/followtrue. Fixedheight1219/client635; no observed rebase/resize/contentChanged/followframe/pin phases in this complete episode. These alternate hypotheses are excluded for this episode within admitted diagnosticcoverage, not globally. Instrumentation overhead and nativeanimationduration remain context limits; actualunmodified112Home endpoints matched.

## Shared existing mechanism and minimum patch (NOT APPLIED)
In the ordinary final onScroll bottom branch only:

```diff
-    if (bottomDistance <= BOTTOM_TOLERANCE) {
+    if (bottomDistance <= BOTTOM_TOLERANCE && !(movedUp && ownsUpwardMovement)) {
       upwardInputIntentUntil = 0
       opts.onAtBottom?.()
     }
```

Keep existing preceding release condition tracking&&movedUp&&owns&&distance>8, original250/8/2 constants, keyboard/native actions, sample placement and singleexpectedTop/programTarget facts. While recognizedupwardmovement is still insidebottomtolerance, do not declare bottomarrival or consumeits authority; nextactualmovement beyond8 can use the same capturedwindow and releasefollow. No newtimer/state/parser/writer/controller, no mainpause workaround, Sourcewidget/Source3 unchanged. Root must first closebeforewholechain and remove precise temporaryobserver before separately admitting productionpatch.

## Boundary review / all three callers
Echo branch<=2 of originalprogramtarget clears onlyprogramtarget and updatesexpectedTop; its bottomcallback DOES NOT clear upwardInputIntentUntil. The trace proves this branch preserved214ms throughseq5. Tinyabs(delta)<=2 similarly updatesexpectedTop and cancallonAtBottom but doesnotclear intent. They retain currentecho/tiny compatibility with realprogramlandings; changing them is not required to fix this reproducedclear. Their callback canrearmtrackingfalse nearbottom independently ofdirection, an existing residualboundary to qualify (especially explicitreadingpause plus actuallayoutclamp); not claimed fixed by this patch.

Ordinarydownwardmotion (movedUp=false) into<=8 stillclears staleupintent+onAtBottom, preserving intentionalbottom return. Stationary/tiny/echo programlandings keeptheir existing earlypaths. ExplicitscrollToBottom writesactualfullbottom/programtarget/expectedTop and nextecho invokesonAtBottom; freshsource/actorinitialbottom andEnd remaincurrent. No recognizedupintent or pointergesture (owns=false) permits nondirectional/layoutclamp bottomarrival/rearm asbefore. A recognizedupward step nowinside<=8 is the ONLY changedclassification, regardless currenttracking; ifalreadyfalse it remainsfalse ratherthan falselyrearming during an upwardexit. A late upwardmovement after original250ms expiry stillcannotpause; thatpolicy is not extended.

Recognizedwheel<0/touch-down/nativeactiveScrollbar andkeys share this singleonScroll. The same within8 boundary canconsume their existingauthority, so rootcause is common movementclassification rather than mainHome-specific. MainTask/Mission/ordinarySession useConversationlocaltracking; exacthost smoothHome/PageUp/up acceptedhandler is unchanged. ChildSubagent andSideChat use samecontroller/native scroll but have distinctcontainer/session/source ownership. Sourcechanges/initialmount intentionalbottom andterminal/active/historyupdates preserveexistingcurrenttracking/contentrebase. Cleanupdisconnectsoriginallisteners/disposedRAF, no durableTaskstate/retry/restart authority changes. No shared queue/lifecycle fault evidenced by this scrollbranch.

PointerScrollIntent already means pointerdown targetowner untilpointerup/cancel, not arbitrarydirection proof. The newpredicate reuses that exact existingclassifier; do not broadenit. Recentupinput plus an unrelatedupwardlayoutclamp may sharetheexistingwindow: theproposal doesnotintroducea strongerinputprovenanceclaim. Separatepanels/Projects eachretainlocalowner; no globalintent/cache.

## Root actual after qualification required
Diagnostics-free samehistory, focusedactualConversationDIV: nativeHome/PageUp/ArrowUp departure frombottom shouldsettleaway/followfalse, then End/actualbottomreturn followtrue. Sourceopening mustretain112intentbehavior. Check a smallupwardstep within8 then nextstep beyond8, directdownwardreturn, programmatic/currentinitialbottom and actualsourcechange. Actualchild/SideChat nativekeyboard/wheel/directscrollbar andnestedtextbox/Listbox ownership require their ownmanualcases; one mainHome run cannotqualifythem. Rebase/latecontent andtiny/echo rearm are explicit residualmatrices, notfalsefullyclosed claims. No UI automation/model/helper/process/source/test modification by child; this is read-onlyevidence and a onepredicateproposal.

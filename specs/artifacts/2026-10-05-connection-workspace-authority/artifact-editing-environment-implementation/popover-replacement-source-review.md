# Independent Popover replacement source review

## Recall and boundary

Root actual Bi4 Environment Project focus→Escape closed/focused trigger, then Tab to Dock reopened Environment. Failed screenshot and installed HoverCard focus/delayed-open700ms explanation retained by Root. Read current pre-edit replacement admission, final TaskDirBar, existing Popover wrapper, installed P4A33SPR/BASJUNIE, conversation CSS comment and07-panel. Only this file written; no source/helper/Git/browser/runtime/checker/test or delegation. Earlier final-source-review describes Bi4 HoverCard, not this replacement. Actual new Popover behavior remains Root manual acceptance.

## Sole owner and removed mechanism

TaskDirBar retains panelOpen as sole disclosure owner; closeRuntimePanel421 clears it, openRuntimePanel preserves anchor visibility, setRuntimePanelOpen accepts native controlled state. Popover.Root1716 binds runtimePanelOpen/onOpenChange; no pin signal, custom toggle, Escape handler/ref focus or focus-suppression timer remains. Current hover-card source/consumer wrapper is removed. CSS changes only existing overlay comment; geometry/typography/current body semantics retained. There is no second implementation/cache/seen-selection flag. Card arrivals and focus no longer invoke an automatic open path. Existing metadata/read/worktree effects remain conditional on visible runtimePanelOpen and existing authority/selectEpoch.

## Installed trigger and focus contracts

Current existing Popover wrapper forwards props to installed Kobalte, adding only canonical class. Installed P4A33SPR PopoverTrigger298 uses mature ButtonRoot, pointerdown prevents initial competing focus and click toggles context. Current as=Button/type=button is the existing native button semantics, so Enter/Space activation uses the mature button click rather than another component key handler. Trigger's native ref is captured by primitive. No onFocus opener/delayed hover callback in this actual Popover chain; restoring focus cannot schedule the removed700ms opening path.

Popover Root defaults modal:false223. Content uses installed FocusScope onMountAutoFocus/onUnmountAutoFocus135–136 with native autofocus default. P4A33SPR77–94 nonmodal close focuses trigger without scrolling only when no outside interaction occurred; outside pointer/focus preserves the newly chosen external target instead of forcibly stealing focus back. Current component has no override of these callbacks. This supports Escape trigger return and outside-to-Dock behavior without a custom focus timer. Native close outcome still must be observed, not inferred solely from CSS/source.

## Nested dropdown and dismissal

Installed BASJUNIE30 excludes registered nested layers from outside interactions. Pointer dismissal requires current topmost layer38; Escape61–68 likewise invokes only topmost, prevents handled event and calls that layer's onDismiss. Focus-outside47–52 goes through interaction exclusion, so portaled nested layer descendants are not treated as outside parent merely for DOM ancestry. Current Environment embeds existing mature DropdownMenu/menu primitives, retains portal/layer ownership and adds no bypassTopMostLayerCheck/global listener. Nested menu Escape therefore has its own topmost dismissal before root Popover; actual menu-to-parent focus/layer registration timing remains Root manual scope. No source evidence supports adding another dismissal owner.

Root's actual open/close callback drives existing panelOpen; native trigger second activation toggles false and closes. Child feature actions, hidden anchor, Settings surface and new Dock-open edge call same closeRuntimePanel. Outside interaction can additionally close the nonmodal disclosure, which is explicitly reflected in updated07-panel600–621. Previous statement that closing Dock never changes Environment is no longer promised where outside interaction legitimately dismisses it. No stale pin veto in setRuntimePanelOpen remains.

## Result and required evidence

No remaining source-proven blocking defect found in the six-file replacement. It removes the real delayed-focus reopening mechanism by selecting the already installed intentional disclosure primitive, rather than masking it with a gate or timer. Interface/controller/owner contracts remain one controlled open signal and one existing Popover; old HoverCard implementation is deleted rather than retained as fallback.

Actual click toggle, keyboard Enter/Space, focused-inside Escape→trigger→later Tab continuation, nested menu Escape, outside pointer/focus, Dock/Settings and history reselection remain Root manual qualification. Old Bi4 escape screenshot is retained failure and cannot qualify new primitive. Code48byte native copy/download outcomes are independent and unchanged. No UI automated tests or runtime were executed by this review.

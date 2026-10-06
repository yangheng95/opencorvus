# Independent sidebar pointer source review

## Recall and boundary

Reread sidebar-pointer-resize-implementation-plan Recall/admission and preceding coordinate review. Compared current pane.ts with saved pane-before.txt and searched current PaneConfig/init/render callers. Reviewed actual App width-owner DOM, border-box base policy, shell transition/flex CSS and settings callbacks. No source/helper/index modification, test, runtime, UI, process or Git action. Only this report written; no visual qualification is claimed.

## Result

No blocking source-contract defect found in the bounded change. The sole required `leftPaneId` maps to actual `leftActivityShell`, independently of aria `leftControls`. Current production has one PANEL_PANE_CONFIG/init owner, so no missing alternative config construction was found. The existing renderedControlWidth primitive now has a general missing-control error and returns actual shell rect width; it does not substitute a setting/CSS target or infer width from inner sidebar.

`startPaneResize` checks actual current handle bounds, captures shell width and initial clientX before setting active/resizing or writing width, and stores both in the existing sole PaneDrag. `resizePane` uses only startSidebarWidth+clientX-startClientX, rounds through current bounds, and writes through existing renderPaneLayout. Pointer grab offset, body translation and fixed navigation rail cannot add a second width offset under this relationship. UI scale is not multiplied into CSS-pixel displacement. Initial queued pointerdown is zero displacement, subject to unchanged bounds/rounding.

The discarded PaneResizeBounds.bodyRect was only needed for the retired absolute conversion; current full geometry still retains bodyRect.width for measured rail/content bounds. No remaining source consumer needs the removed field. RAF coalescing, last move flush, stop/pointercancel/blur settlement, CSS-target persistence, keyboard/default/collapse and settings ownership are retained. No fallback coordinate formula, second width state, guessed rail constant or layout-owner alias was introduced.

## Remaining limits

Current CSS width/flex transitions remain enabled; during transition actual start rect can differ from aria/settings/target, which is precisely why the actual shell is the right start fact. It does not prove visually immediate follow-through. Stopping persists the final commanded CSS width, as before; actual transition completion is a separate manual observation. Ultra-narrow flex shrink can produce start width below current minimum; existing clamp can move it to min at zero delta. Bounds policy was deliberately preserved and this review does not mark that case qualified or silently redefine it.

The helper returns0 for a hidden width owner; normal collapsed guard/hidden separator excludes that current user path. Arbitrary DOM replacement, translated/scaled host transforms, mid-drag viewport changes, multi-pointer/listener cleanup behavior and asynchronous persistence failure were not newly exercised. No evidence justifies expanding this root-cause repair into those pre-existing mechanisms.

Root still needs the plan's genuine page screenshots/input before, known delta/reverse, zero-motion press, keyboard, collapse/reopen/reload persistence and actual cleanup. Types/build/static review support the source change only. Formal Task resource download, broader recovery and other resize surfaces remain outside this acceptance.

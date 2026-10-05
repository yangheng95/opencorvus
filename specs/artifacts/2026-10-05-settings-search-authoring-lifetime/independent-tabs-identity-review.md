# Production Tabs collection identity review

Root actual first-after main-C_Oa9I38 observation: activating Scheduled returned to Changelog. This is a failed implementation qualification, not success. The previously identified group-identity risk is now supported by root's actual page. This audit is source-only; no new UI test, browser interaction or library modification.

## Shared mechanism

Installed Kobalte `chunk/4XGMYOCT.js:291–306` intentionally normalizes a selected key absent from its current registered collection to its first available key. `chunk/7CVNMTYF.js:151–188` registers items in effects and removes them in cleanup. That is consistent controlled Tabs behavior when callers remove a selected item. The project wrapper `components/ui/Tabs.tsx:42–54` passes the controlled selection and uses manual activation. It does not promise that a selected key missing from all registered triggers is retained.

The original Config implementation created new group objects in visibleConfigGroups for every search recalculation; the first attempted repair additionally depended on activeConfigTab through its pinned ID set. Every explicit selection thus recreated those objects. Solid For keys on object identity, so entire group subtrees/registrations were removed; the separate PRODUCT_INFO_TABS loop uses stable canonical tab references and left Changelog registered. This explains the actual normalization to Changelog without requiring a shared-library defect.

## Complete production owner inventory

Whole packages search for direct @kobalte/core/tabs imports and project ui/Tabs imports found one shared wrapper and three Root owners only: ConfigDialogHost, RightDock and settings/ExpertSquadPanel. main.tsx imports TabPanel only for bodies under RightDock and creates no separate collection.

- **ConfigDialogHost**: eighteen canonical CONFIG_SECTIONS. Seven static navigation groups contain4+2+2+2+4+1+1=16 tab objects; product-info contains Changelog/About=2. Every ID belongs once; no orphan or duplicate ID. CONFIG_TABS and group.tabs refer to canonical objects, and the product loop's filter retains those references. The faulty group map alone allocated new wrapper identities on query/selection.
- **Recommended exact root correction**: For over static CONFIG_NAV_GROUPS; inside each, Show iff at least one canonical member is visible (matching plus active), and For over `group.tabs.filter(visibleIDs)`. Array filtering may create a new array but preserves each member object identity. The selected member keeps its group condition true through all query changes; the selected Trigger remains registered. Explicit target click already targets a currently registered matching Trigger. Original activeTab remains sole selected-page authority. No all-panel mount, extra selection state, registration deferral or library override is needed. Keep canonical group order and the already stable product-info branch.
- **RightDock.tsx:223–305**: For keys are primitive IDs returned by tabCollection, not newly mapped group objects. It retains all fixed identities and open browser IDs plus one reserved new-browser identity. Reflow merely marks overflow/disabled state; it does not drop registrations. Reserved ID changes with the browser-identity signature, not ordinary active selection; opening that reserved browser retains its ID in the open list while introducing the next reserved ID. Closing tabs may intentionally remove a selected dynamic ID under the existing main owner. No same active/query→wholesale-object-recreation mechanism found.
- **ExpertSquadPanel.tsx:1691–1720**: four static triggers plus one evolution Trigger conditional on actual installed-package capability. There is no dynamic grouped For. Selected squad change resets installedSquadSection to overview (`415–425`); section activation consumes the static Tabs value (`1052–1058`). A full detail resource change can intentionally recreate the whole component, rather than merely searching/filtering its tab labels. No matching shared cause found.

This excludes the audited collection-identity cause in the other production Roots; it does not assert all their independent tab interactions were manually tested. No reason to patch Kobalte or change the shared Tabs primitive is established.

## Actual acceptance required

Repeat after a new exact build: click Scheduled from an app-group page and from Changelog, open draft, matching query excluding Scheduled, no-results query, clear; verify exact authored values and selected trigger throughout. Then explicit result activation with keyboard Enter must intentionally change active page. Proxy unsaved input covers another mounted authoring component. The first-after08/DOM evidence remains a failed version. Cleanup of its exact76648/76088/64128 chain is formally recorded under first-after-shutdown/terminal and17883 is released for the new build.


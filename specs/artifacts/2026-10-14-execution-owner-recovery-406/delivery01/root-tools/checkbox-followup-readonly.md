# 406 Checkbox follow-up — actual state, click paths and label-free names

This is a read-only follow-up. No product edit, service/browser/Provider action, UI automation or test was performed. It does not change the original successful checks or manufacture a second selected answer.

## Actual Main multiple evidence

Root observed native/visible interactions in the real Dialog: Cedar state sequence 0→1→0, Space→1, then Tab+Space selected Iris. I manually opened `options-main-multiple-after01/02-dialog-keyboard-two-selected.jpg`; it visibly shows Cedar and Iris selected. The saved `manual-name-description-observation.json` records distinct original input IDs and separate registered names/descriptions, including Cedar `checkbox-input-cl-256`, labelledby `checkbox-cl-257-label`, describedby `checkbox-cl-257-description`, description `for` targeting the same input. The No description option is enabled and has its own label ID, with no description reference; the disabled example has `disabled:true`.

Root dismissed the Dialog. The inline component starts from its own local draft, then Root entered/cleared custom text and selected Cedar through the visible description. The role-based `No description` click returned success, but actual state remained 0. I manually opened the original `04-inline-two-selected.jpg`: it contains **only Cedar selected**, despite its original intended filename. The original public Tool result confirms `metadata.answers=[["cedar"]]`, completed status and natural final idle; no other value was submitted. That filename must remain explicitly qualified in any manifest. A click API return is not selected-state evidence.

InteractionCard has separate local signals for each mounted inline/Dialog instance; dismissal is not a transfer of its local draft. This existing owner arrangement explains why Dialog selections and the later inline selections are not the same state. It is not evidence of a new transport/remount regression in this patch, and this investigation does not propose a shared draft store.

## Actual installed event chain

Installed Kobalte is the same 0.13.11 checkbox implementation recorded in the initial source excerpts.

1. **Visible Control** (`KSJIJAOF.js`, CheckboxControl): a sibling `div` invokes `context.toggle()` once on click, then focuses the real Input. Its Space handler belongs to that control node. The normal keyboard focus is the Input, so an Input event does not bubble sideways into its sibling Control handler.
2. **Visible Label** (`FormControlLabel`, `7ZHN3PYD.js`): native label `for` is the registered Input ID. The current short text is inside this original label. Browser label activation reaches the native input.
3. **Visible Description**: the new Kobalte Description is separately registered and rendered as a native label with `for` equal to that same stable Input ID. It has no new onClick/onKeyDown callback. It is a sibling of Control/Label, not an outer label enclosing the Control, so its activation does not directly execute the Control's explicit toggle as well.
4. **Native Input**: its original onChange passes the resulting `target.checked` to the toggle state and restores the controlled value. The checked/value effect dispatches synthetic input/change events, but `isInternalChangeEvent` prevents that effect's synthetic change from reentering `setIsChecked`.
5. **Controlled state** (`YGDQXQ2B.js` → `BLN63FDC.js`): disabled/readOnly guard both direct set and toggle. The controlled setter invokes the consumer only when the proposed boolean differs from the current boolean.
6. **InteractionCard consumer**: only this current caller uses `onChange={() => toggleOption(...)}` and computes the selected values from its current drafts; other consumers take the passed boolean. `toggleOption` updates exactly the chosen option and has no description/label/name special case. There is no new pointer listener on InteractionCard itself.

This source does **not** establish a double-event defect. The internal-change guard and sibling structure are concrete protections. If two actual opposite state changes from one physical action are later observed, the callback/event sequence would need evidence before choosing a repair. Ignoring the passed boolean in InteractionCard is a potential sensitivity to duplicate notifications, not proof that such notifications happened here; changing state logic preemptively is outside the current authority.

The real Input is visually clipped by the installed `visuallyHiddenStyles`: absolute positioning, width/height1px, `clip:rect(0 0 0 0)` and `clip-path:inset(50%)`. Its role is the semantic keyboard/focus target, while Control/visible label are practical pointer hit targets. A role locator resolving the Input and returning success does not show which visible node received the pointer or prove a change event. The exact locator implementation/hit target/coordinates for the failed attempt are unknown; do not classify this as a browser/tool bug from that return value.

Root's next real comparison should use the **visible No description text span** or visible control center, inspect before/after actual input.checked and render, and submit only the real selected values. Read-only DOM evidence can record the original Input ID, current label `for`/registered label ID, disabled state, Input/visible span/Control rectangles and clip style. No injected click/change event or extra UI test is needed. If visible activation works, retain the first failed role-click observation rather than silently rewriting it as two-value success.

## Separate proven defect: label-free callers name the wrapper, not the Input

Root reached Settings → Chat and saw configured browser/computer rows. Actual AX gave group `checkbox-cl-396` the name/Description `Assign MCP connection browser to Chat`, while its real child Input `checkbox-input-cl-395` was unnamed with value0. Other label-free Skill toggles had the same structure. This is independently source-proven:

- Current `CheckboxProps` inherits Kobalte Root props.
- `Checkbox.tsx:13` splits only class/children/inputID/description. External `aria-label` remains in `rest`, which goes to Root at line19.
- The real Input at line20 receives only its ID. Kobalte Root renders a group and does not propagate its label attribute to Input. With no children, no Kobalte Label is registered, so Input has no label source.

All current Checkbox JSX callers were rechecked:

| Caller | Sites | Naming now | Impact of precise forwarding repair |
| --- | ---: | --- | --- |
| InteractionCard | 1 | Registered short Label plus Description | No external aria-label; retained unchanged |
| FileChangesView | 1 | Children → registered Label | Retained unchanged |
| MissionCreateDialog | 1 | Children with its authored label/description content | Retained unchanged; not this task's separate Mission availability issue |
| ContinuousGoalControl | 1 | Children → registered Label | Retained unchanged; only editing paused/blocked goal renders it |
| MailboxPanel | 2 | `aria-label` supplied without children | Both real Inputs currently lack that caller-provided name; route it to Input |
| ConversationCapabilityPanel | 2 | Localized Skill/MCP `aria-label`, no children | Both real Inputs currently lack that caller-provided name; route it to Input |

**Minimal proposed repair, still not implemented:** only Checkbox.tsx splits the existing `aria-label` prop into local and passes that same reactive value to `KobalteCheckbox.Input aria-label={...}`. Remove it from Root via the split rather than duplicating it onto both nodes. The library already exposes `fieldProps.ariaLabel` on Input. This uses the caller's single translated string, retains the original checked/disabled/onChange behavior and does not require four caller edits, a new prop, invisible text, label synthesis or SDK changes. Current inputs with registered Labels remain on their existing path. No current call supplies external aria-labelledby/aria-describedby, so this evidence does not authorize a general ARIA-prop redesign.

This defect predates the new description slot: the original 405 Checkbox wrapper likewise spread `rest` onto Root and only passed ID/explicit describedby to Input. The current task touched the shared wrapper and Root's actual sample discovered it, so it is appropriate to fix in the same approved component only after Root records the expanded analysis/authorization.

Acceptance for that proposed change must inspect the actual named input in Settings Chat/Skill or Mailbox and perform real checkbox activation plus restoration of original assignment. A named group is not equivalent to a named checkbox. Current locale must supply the name directly; no English fallback or cached name should be added.

## Current boundary

The multiple Dialog name/description association, native keyboard two-selection and visual layout are positively evidenced. The inline original Tool proves one submitted value only. The role-click failure's precise event/hit-test cause remains unproven. The label-free Input naming defect is proven and has the narrow forwarding proposal above. Root is continuing visible-label/Control interactions; no outcome has been inferred ahead of those actual observations.

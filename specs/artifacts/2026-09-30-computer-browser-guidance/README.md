# Computer / Browser manual acceptance

- [Native input result](native-input-result.png): Browser provider viewport capture of the isolated development `/ui` after native CUA Driver input. The text `Native batch verified.` was entered through Computer `act`, using one group for click/type and another for Ctrl+A/type. No prompt was sent.
- [Native lifecycle receipt](native-lifecycle.json): actual CUA Driver create/observe, human takeover, revoked old adapter, return, fresh attachment to the same logical desktop, new observation, and destruction. No injected native backend.
- [Packaged native capture](packaged-native.json): standalone executable using the production compile flags and copied native runtime dependency closure; actual embedded driver capture at the corrected 1.5 display scale.

The primary agent personally inspected the before/after screenshots. Original full-desktop captures remain outside Git because they include unrelated user windows. This image is the unchanged Browser provider capture of only the task-owned page, not an image crop or generated rendering. Protocol tests are separate from this manual visual acceptance. No UI automation assertion or screenshot baseline was used.

See [plan and results](../../records/2026-09/2026-09-30-computer-browser-guidance-and-actions.md).

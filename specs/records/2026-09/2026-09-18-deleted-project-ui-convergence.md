# Deleted Project UI convergence

## Recall

- User reports that Settings > Providers still scopes requests to deleted Project directory `4b0c93fb-41b4-4183-b232-2727c03eb337`, leaving both Provider catalog and authentication unavailable.
- Acceptance: after an active or persisted Project directory disappears, the Overlay must leave that Project context, persist a directory-free workspace, and load global Provider catalog/auth without recreating the deleted Project or requiring user input.
- Hard constraints: preserve Provider configuration; retain the canonical Project deletion lifecycle; use structured server error data rather than message matching; do not add or run UI automation tests; validate through the real rebuilt page and screenshot.
- Sources read: screenshot, live server response and logs, Project deletion UI handler, workspace directory lifecycle, persisted settings owner, startup data loading, Provider panel directory ownership, API error envelope, and Project directory integrity contract.
- Whole-repository search: normal in-UI deletion calls `leaveDeletedProject`, but deletion committed through another client has no deletion event and the persisted Overlay directory survives. Startup records the Project-scoped load failures yet still reports initial data as loaded, so reactive Provider owners continue issuing requests with the missing directory.
- Independent agent feedback: the first review found that startup-only recovery did not cover online peer deletion. The second found that the online listener matched only the persisted directory and could miss a different active Task/Session directory. Both findings were fixed; the final review reported no unresolved code findings.

## Plan

1. Recognize the structured `ProjectDirectoryIntegrityError` with `reason: missing` at the shared API response boundary.
2. Route normal deletion, startup/reconnect and online peer deletion through one unavailable-Project transition that clears runtime selection, persists the directory-free settings state and updates the API context.
3. Rebuild and restart the real Overlay, verify stale-settings startup and online peer deletion, confirm global Provider data renders without the deleted path, then complete independent read-only review.

## Status

Complete.

## Verification

- Before the fix, the real persisted `overlay.jsonc` retained the deleted directory in `directory` and `workspaceDirectory`, and retained its Task in `workspaceTaskID`.
- A real stale-settings startup received the structured `ProjectDirectoryIntegrityError` and persisted a directory-free workspace. Global Provider endpoints then returned HTTP 200 with 222 catalog entries and 5 connected Providers.
- Online peer deletion was exercised with a disposable right-sidebar Chat Project: the UI selected the Chat, an external canonical `DELETE /project/current` returned HTTP 200 `committed`, the UI automatically returned to the global workspace, and the real Providers page rendered `5 Configured`, `222 Catalog`, `222 / 222 shown` with no error banners.
- Both disposable acceptance Projects were removed from the filesystem and have zero Project, Task and Session rows. The three injected workspace-setting fields were removed after the test.
- Overlay and repository typechecks, docs check, diff check, packaged first-run conversation check and the final `0.1.1-beta` release build pass. One intermediate packaged first-run check timed out; its isolated evidence reported only a timeout, no process or port remained, and the unchanged check passed on retry and on subsequent final builds.
- Final independent read-only review passed with no unresolved findings.

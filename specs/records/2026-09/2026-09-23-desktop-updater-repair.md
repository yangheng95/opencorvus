# Desktop updater check and in-app installation repair

## Recall

- User: `继续，同时解决不会自动更新和自动更新无法热安装`; clarified that they have seen no update prompt, download failure and installation failure. Continue the Darwin x64 qualification while repairing the desktop updater. Do not interrupt or restart the user-owned application/process. No subagents.
- Read: AGENTS, current panel/config and packaging architecture, `desktop-update.ts`, sidebar/settings consumers, `main.tsx` init and reconnect path, native updater check/download/install coordinator, Tauri configuration, release manifest generator and public stable channel, Tauri's official updater documentation and installed crate interface. Existing code/tests/config search found one updater implementation and no second update transport.
- Acceptance: automatic checks are independent of backend connection and repeat while the app is open; available signed update downloads without a manual detour, status/errors remain visible, and an already verified download can be retried for in-app install after a recoverable failure. A real install still restarts/exits the Tauri process as the platform requires. Verify actual stable manifest/version, focused service/native checks and the real desktop path without operating the user's current app.
- Public stable manifest currently advertises 0.1.12 with five platform URLs/signatures. The 0.1.13 release remains a draft after one Intel DMG failure, so a 0.1.12 installation cannot yet discover 0.1.13. This is a publication gate, not a client check error. A separate native Intel debug build from the corrected diagnostic source now succeeds and retains an overlay artifact; it cannot be mixed into the frozen failed release.

## Analysis before changes

The renderer calls `checkDesktopUpdate({background:true})` only from `initApp.onConnected`. That callback requires a healthy backend, initial data load and restored workspace; it is skipped when offline and is not invoked by `onReconnect`. No periodic updater check exists. Thus a long-running app can miss a newly published version and backend trouble can suppress discovery, even though the updater is a native command independent of the backend.

The download action currently requires a click; no background download follows discovery. The Rust owner retains a verified `Update` and bytes in `DesktopUpdateCoordinator.prepared`. If shutdown or install returns an error, it restores that same verified package. The renderer's catch unconditionally clears `downloadedBytes`, contradicting the host receipt and preventing immediate retry. This is a direct state mismatch in the retry path. Native Windows installation exits the running process after launching the updater; macOS/Linux need an app relaunch. Zero-restart binary hot swap is not a Tauri updater capability. In-app download and verified installation with one restart is the supported contract.

Data/control flow: native channel manifest -> `overlay_desktop_update_check` -> renderer state -> `overlay_desktop_update_download` -> signed bytes retained by native coordinator -> explicit install confirmation -> backend terminal stop -> native installer -> platform restart. Shared effect owner remains Rust. The renderer should not invent a second version source or bypass signature verification. Avoid foreground prompts on every periodic check; only an available update should surface through the existing sidebar/settings affordance.

Horizontal scope: initial connected/offline/reconnected entry, periodic visible/hidden app state, repeated checks, download/check races, transient network failure, retry after install/shutdown failure, completed Windows/macOS/Linux install, and published/draft channel behavior. Task/Mission/Session scheduler behavior is not implicated; backend shutdown is a separate terminal ownership boundary already serialized by the native server operation lock. Installed user app logs/error text are unavailable without operating that app; do not claim its specific download/install cause was reproduced.

## Plan

1. Move update monitoring to the native-capable app lifecycle, independent of backend health. Use the existing visibility interval owner for bounded checks on launch, resume and periodically; avoid overlap with downloads/installs.
2. Trigger signed download automatically when a newer version appears, preserve native verified-package state after typed recoverable install failures, and keep the existing explicit restart/install confirmation. Show actual errors through the existing update state surfaces.
3. Add focused positive tests of monitor/check/download/retry state, run type/build/native checks, then validate the real desktop presentation and published-manifest path in an isolated source app. Do not operate the user-owned app.
4. Review, commit/push normally, and record exact remaining native publication/install limits.

## Results

The desktop app now starts one visibility-aware monitor before backend initialization. It checks immediately, on visibility return when due, and hourly while visible. Discovery initiates the existing native signed download. Progress-listener setup may be retried after a transient failure, and background check errors remain visible in the About panel. The monitor is disposed with the app lifecycle.

The native check now reports the size of its retained verified package when the channel still advertises the same version. The renderer keeps ready-to-install state for the native shutdown/install errors that restore that package. Confirmation holds the chosen version steady and excludes overlapping check/download operations through installation. Tauri still performs the platform-required process restart; no live binary swap was introduced.

Focused `desktop-update-service` and manifest tests pass, including startup check/download, a later check retaining verified size, and a typed background channel failure preserving the last valid ready state. Overlay TypeScript typecheck, Vite production build plus renderer surface checker, native Windows `cargo check --locked`, docs checker, architecture index and whitespace checks pass. The published stable manifest was read back at version 0.1.12 with five signed platform entries; the draft 0.1.13 is still absent from the channel.

The service test uses a fake native transport and establishes renderer command/state behavior only. The local native check compiles the Windows integration but does not execute a signed update. Real signed installation, restart, and installed-version readback must be judged after the new release is publicly promoted, using an isolated disposable installation. The user's current app was not operated or restarted. No real desktop screenshot of the new updater states is claimed, so the UI acceptance portion remains open.

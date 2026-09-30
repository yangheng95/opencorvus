# 0.1.23 release evidence

- [Release record](../../records/2026-09/2026-09-30-v0.1.23-release.md): preparation, exact source, canonical workflow and verification status.
- [Settings notes](settings-0.1.23.jpg): manually opened the production Overlay build through isolated core development `/ui`, 1440×960 desktop. Current version 0.1.23, complete written changes and preserved left navigation were visually reviewed. This is source-build UI evidence; native installer acceptance belongs to the canonical workflow.

- `release.json`: actual public GitHub 0.1.23 Release, full authored notes, ownership receipt and 29 assets; published at 07:18:44Z.
- `expected-downloads.json` and `website-downloads.json`: production generator output from that public Release and final public website readback; deeply equal at 0.1.23 with 18 entries.
- `asset-readback.json`: public HTTP HEAD requests for all 29 files, HTTP 200 and exact published byte lengths. This proves availability/identity metadata; whole-file integrity/execution was additionally checked for the Windows CLI archive below.
- `desktop-update.json`: stable update manifest accepted by the production parser and deeply equal to the immutable 0.1.23 manifest, including all five signed targets.
- `native-run.json`, `native-jobs.json`, `website-run.json`, `website-jobs.json`: final GitHub run/job/step receipts. Native run 36680947118 and exact delegated site 36682984218 succeeded. Original total native elapsed time was 31 minutes 19 seconds (06:56:57Z–07:28:16Z), within the 40-minute deadline.
- `publication-receipt.txt` and `website-source-receipt.txt`: the native publisher's exact delegated website ID/success and that website's verified version/source/parent. The deployment uses f4d0d81e even though its dispatch head includes a later documentation-only commit.
- `windows-archive.json`: complete downloaded 143,116,964-byte Windows CLI archive matched the published immutable checksum; 11,859 extracted entries were checked for directory traversal before unpacking.
- `windows-runtime.json` and [actual published-package screenshot](downloaded-package-notes.jpg): the downloaded executable returned 0.1.23, started an isolated bundled `/ui`, reached Online and displayed its bundled current-version notes. No provider credentials or requests were used. This is not a claim that the GUI installer was installed on the user's desktop.
- [Public version notes](website-notes-0.1.23.jpg) and [remaining fixes](website-notes-fixes.jpg): actual deployed authored content inspected in the browser.
- [Final public download menu](public-downloads-0.1.23.jpg): homepage Windows button and native platform links show 0.1.23 after the exact delegated deployment. Agent-created tabs were closed and owned local processes stopped after review.

UI evidence comes from real interaction and manual screenshot review. No automated UI assertions, screenshot baselines or model-run simulations were used.

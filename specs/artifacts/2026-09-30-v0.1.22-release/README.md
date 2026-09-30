# 0.1.22 public release acceptance

- Authority and exact run: [release record](../../records/2026-09/2026-09-30-v0.1.22-release.md).
- `base-workflow.png`: manually opened the deployed Chinese Base page and its role dialog. The ordinary execution graph contains the single independent Tester; the source-planned and parallel graphs remain distinct. Captured after source deployment run 36662484756 succeeded, while native packaging was still in progress. This does not prove installer publication.
- `release.json`: GitHub's actual public v0.1.22 release response, including 29 assets. Publication occurred at 2026-09-30T03:33:08Z.
- `expected-downloads.json`: the existing production download-manifest generator applied to that public Release, requiring the complete five-platform native formats and eight command-line archives (18 website entries).
- `desktop-update.json`: public stable updater readback, accepted by the existing production manifest parser. It is exactly equal to the immutable v0.1.22 manifest and includes all five platform URLs/signatures.
- `asset-readback.json`: unauthenticated public HTTP HEAD readbacks for all 29 assets, each HTTP 200 with Content-Length equal to the published asset's byte size. This verifies public availability/identity metadata, not a second independent full binary execution.
- `website-downloads.json`: real public website readback after the exact delegated deployment succeeded; deeply equals `expected-downloads.json` at 0.1.22 with 18 entries.
- `native-run.json` and `website-run.json`: actual completed GitHub run/job/step receipts. Native aggregate success at 03:39:51Z, elapsed 35 minutes 13 seconds from the original 03:04:38Z creation; delegated website also succeeded within that same budget.
- `publication-receipt.txt`: native publication logs naming the exact delegated website run, its success and the website source-resolution job's exact version/source/parent inputs.
- `homepage-0.1.22.png` and `download-platforms-0.1.22.png`: manually inspected public desktop homepage and opened platform menu after deployment. The Windows button and visible Windows/macOS entries show 0.1.22; all menu links bind to that release. The temporary browser tab was closed after review.

Screenshots come from real public desktop browser interaction and manual visual review, without UI automation tests.

# Result: the error recurred, the changed review still missed it, and delivery failed at the typed publisher

The single registered run is closed and must not be restarted. Source `14574871a4c694c235232f6a5e35f21912db18b2`, package `2026.09.27.3`. Real streaming preflight passed (`gpt-5.6-luna`, credential usable, catalog projected). Mission `0159b4acbae66907` created the one Task `tsk_g00VWPjil300cs26sAmF`. At 2026-09-27 18:53:57 Shanghai the scheduler failed the Task; the runner's registered stop rule for a failed Task then aborted the Mission's in-flight turn, disposed the runtime and deleted the copied auth/models (verified). Launcher exit 1. Original records are unchanged; [run-receipt.json](run-receipt.json) keeps the receipts.

**Registered classification: missed (2).** The target error class recurred and no review identified it. The Task then failed for an unrelated, systemic reason: the writer could not satisfy the typed publisher's argument shape.

## The natural error recurred, more strongly

With producers unchanged, the charter listed "August eventual closure is unknown"; the dossier stated "Current extract cannot distinguish later closure, still open, unavailable closure"; the performance analysis and the brief listed "Whether remaining requests later closed, remained open, or lacked recording" as unknowns. The committed report says "A remaining request may later close, remain open, or lack a recorded closure" and proposes new fields to distinguish them. `metrics.json` records a `closed_month` for all 24 groups: July's 117 closed in August 2025 and August's 391 in September 2025. This is the same false unknown as in feedback-01. Recorded closure still does not show real resolution, duration or reopening history.

The numeric content is right: all 15 borough workload and closure rows in the report match the operator reference computed from the frozen source, including shares and changes.

## What the changed review did and did not do

Exact payloads are in [review-evidence.json](review-evidence.json).

- **The evidence-set change took effect.** The brief's Core FactCheckReview (revision 28) observed only the target brief; every evidence pointer is into `metrics.json` or `request.md`. Unlike feedback-01, no charter or other team claim was cited as support.
- **The unit of review stayed the producer's summary.** The review registered three claims taken from the synthesizer's short final narration (publication succeeded; "July/August totals, borough concentration, closure alignment, and interpretation limits were reconciled"; August borough-Unspecified is absent). The grouped limits claim was verified with `metrics.json` lines 27–39, the source-limit text, not by testing the brief's specific unknowns against the rows. Verdict `clean`; the stage audit (revision 27) lists no required corrections. feedback-01's review likewise registered five grouped summary claims. The brief's itemized unknowns were never individually reviewed in either run.
- No later report review occurred: the report never became a typed Artifact.

So a review that reads the right evidence but judges the producer's summary cannot catch a false itemized unknown. The failure-seeking wording did not change the unit of review.

## Delivery failed on the typed publisher's argument shape

[publisher-outcomes.json](publisher-outcomes.json) counts every `publish-data-analysis-artifact` call from the original tool records. Every role failed before succeeding: 26 failed and 7 completed calls; 17 failures put `resource_set` and `source_artifact_locators` inside the `artifact` object instead of beside it. feedback-01 shows the same pattern (25 failed, 8 completed; 11 nested), and G60 recorded 23 publisher failures. The provider-facing schema is correct: three required top-level fields, `artifact` being a 15.5 KB union of seven strict `{artifact_type, payload}` variants followed by the two sibling fields. The rejection is exact (unrecognized keys under `artifact`; top-level `resource_set` expected object and `source_artifact_locators` expected array).

The writer committed, merged, snapshotted and rendered its report ([report-snapshot.md](report-snapshot.md), 6,862 bytes, SHA-256 `81957c03…9000`), then failed the typed report publication twice. The scheduler returned the exact error through a continuation; the writer failed the same way a third time. The scheduler then failed the Task with an accurate account. Before G63 this role could bypass through the generic publisher; now the package-owned type correctly requires its own publisher, so the shape trap is fatal.

## Usage

Native audit: 209 streaming requests to exactly `gpt-5.6-luna`, 208 with HTTP 200 and one without a status (the Mission turn aborted at shutdown; its billing is unknown). Native `provider_usage_event`: 208 rows, all `openai/gpt-5.6-luna`, purpose `session`, locally priced; input 1,617,440, output 90,928, reasoning 11,951, cache-read 9,021,696, total 10,742,015 tokens; local cost 0, which is not an invoice. External billing remains unknown.

## Decision

The evidence standard is necessary but not sufficient; the unit of review is the producer's narration rather than the delivered content. Separately, the typed publisher's nested argument shape is a systemic execution-path defect, observed across all roles in three runs and fatal here. No replacement run. Any next observation needs its own registration.

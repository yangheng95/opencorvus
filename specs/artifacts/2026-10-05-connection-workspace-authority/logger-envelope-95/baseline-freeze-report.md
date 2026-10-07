# Logger envelope95 baseline freeze

## Recall and scope

Only new packages/opencorvus/test/log-envelope.test.ts plus this evidence directory are owned. Production/consumer/existing tests remain unchanged and frozen. Four independent real Log/Pino cases use file initialization/flush/close, actual Session.create/SessionContext, actual public POST /log and real support ZIP. No ambient binder mock, Provider request, external listener/service, UI automation or credential use occurred. Mature memoryProject creates only its isolated fixture resources.

## First execution and fixture correction

The initial canonical exactfile run exited1 with four desired-contract failures. Three cases captured genuine conflicting input/output, timers/serializer/export and public ingress. The first Session case read only after close/reinit of the same dev.log. Actual Log.close clears logpath; the following init writes a new dev.log, so earlier created/buffered/caller-only records were truncated. That incomplete capture is a fixture observation fault, not a producer data-absence result. First source fixture and raw baseline-first.log remain immutable.

Corrected the same case to capture raw/parsed actual records before close and separately after reinit; observations are combined only in-memory for assertions, not written back to logs. The second canonical run captures both real created Session records plus buffered/caller-only and actual reinitialized records. No production change or invented state is involved. baseline.corrected test copy preserves this exact fixture.

A first PowerShell summary incorrectly classified ISO strings because ConvertFrom-Json automatically converted them to DateTime; its summary-first-limited copy is retained. The qualified summary uses System.Text.Json literal ValueKind and is the current metadata projection. One attempted summary-only JsonElement out-ref call failed before writing any output; the replacement uses direct actual property access. These tool defects do not alter the raw records.

## Actual core result

`bun script/run-tests.ts test/log-envelope.test.ts` from packages/opencorvus, corrected baseline: exit1,0pass/4fail/7assert, file command settled in6.99s. Every case reached real capture before desired schema assertions. Corrected raw is baseline-qualified.log, original remains .tmp-product-iteration/logger-envelope-95-baseline-qualified.log. This is a qualified failing baseline, not product acceptance.

Observed conflicts produce service=subject-service, level=subject-level and time object. Actual Session.created records have object subject time. Buffered/caller-only/reinitialized log times are genuine strings, but their current caller/ambient identities still occupy the flat namespace. Timers produce real flat status/duration; error record has subject-time object while real serialized/redacted diagnostic values are captured. Public ingress responds200/true and produces subject-ingress top service plus object time. These facts corroborate the current shared merge, not a model or scheduler claim.

Before the schema failure, the Session persisted ID/time comparison and real ZIP raw-byte equality passed. Raw, parsed observations and safe input projections are emitted before assertions; ZIP current-file manifest/raw/formatted data is also captured. Original full producer and support-bundle source before copies are stored here; the test baseline copies and summaries link these real observations without hashes.

## Qualification limits

The baseline freezes the desired envelope/data contract but has no passing source implementation. Because assertions in each case stop at its first current schema mismatch, later serializer/pending/display assertions have not passed; captured raw supports inspection, not a claim that every future contract is already validated. Buffered context uses the real synchronous pendingInitializations increment followed by actual init settlement, not injected timing/mocks. It does not establish all concurrent init/close races. Clone/tag/reinit are exercised locally; no native/UI/multi-process acceptance is claimed. ZIP formatted original subject-time retention remains a desired condition, not a current pass. Public route is real in-process Server.App, not an external service or browser.

No types, whole suite, existing consumer tests, builds or docs checks ran during baseline-only admission. Root owns next producer/consumer implementation and subsequent original checker replay. This test/evidence is frozen until that admission; previous failures remain.

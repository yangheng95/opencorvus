# Request error method provenance76

## Recall

Root admits read-only investigation and this plan only. gpt-6.1-sol one level; no further delegation, production/test edits, Provider/credential/service/UI operation or automated UI tests. Root owns actual74 evidence and future implementation/real screenshot/index/check/commit admission. Preserve lawful side-chat creation model errors and repaired list behavior; do not infer a GET regression from a POST failure or bypass model validation.

Actual74 side chat sequence: GET /session/ses_-zUSn0xc3zzFGmP12qJE/side-chat, request69ae4fc6-b92f-4a72-acb7-98d2c5892e3b, succeeds200[]; natural empty-list handling subsequently POSTs creation to the same path, request8d3b6a61-e1cb-4f3c-ae7d-563345ebd92b, fails400 because current execution model is unavailable. The visible Details showed status/path/request ID without method, initially misleading Root until native evidence distinguished the requests. Those actual outcomes remain separate. This is diagnostic information loss, not failed GET/model credential/parser/retry evidence.

Read unique ApiError/apiJson/apiRequest/resource loader, HostTransport request/response/stream types, actual combined browser/Tauri transport, host transport runtime selection, manual binary constructors, diagnostics/generic detail formatter and relevant pure transport tests/history. All repository constructor searches find the current sites listed below. No matching UI test was run or proposed. Previous binary/error-body corrections retain body/request correlation but omit the request verb; changing methods based on URL would reintroduce a guessed fact.

## Direct trigger, control/data flow and current public contract

TransportRequest.method is the current optional union GET/POST/PUT/PATCH/DELETE; its default GET is declared protocol behavior, not URL inference. api.ts methodFromInit normalizes the authored RequestInit to that union and rejects unsupported methods. apiRequest captures authority/method/path/query and sends that actual request to HostTransport. createHostTransport selects createTauriTransport for Tauri or its browser kind; both ordinary requests use that same implementation and native fetch(url, init), whose init.method is input.method or the protocol default GET. Ordinary HTTP responses return status/ok/headers/body. They do not contain a request method, and no native error packet supplies one later.

The sole ApiError class(api.ts155) stores status/path/materialized body/requestID from the actual response header, but discards the method known at dispatch. apiJson257 constructs it after awaiting apiRequest. formatErrorDetails only renders HTTP status/path, requestID, stack and response body. Diagnostics stringify those details into their existing log/Feedback resource; the lost scalar cannot be reconstructed there. Same-path GET and POST are thus indistinguishable from the error alone. Side chat's GET then POST naturally makes this omission actionable, but all five supported methods share the same issue.

ApiError.summary intentionally renders a concise status/server-body summary; request path can be omitted there. Error.message currently contains status/path/server detail. This plan should not change body decoding, authority retirement, request ID, error listener publication, status pattern matching or accepted mutation/history facts merely to add method. Generic Error has no required HTTP metadata: its detail output must not invent GET or any other method. Network/timeout/abort errors before an HTTP response remain their current non-ApiError contracts unless separately admitted.

## Complete current constructor/caller inventory

Production sites:

1. api.ts257 apiJson: authored normalized method, all supported verbs; actual path supplied by caller. This is the actual side-chat GET/POST case.
2. api.ts547 fetchResourceAsObjectUrl server-relative binary read: actual explicit transport GET. External web-image fetch is a different generic resource Error, excluded.
3. store/board.ts387 conditional board read: actual apiRequest default GET, response304 handled before error.
4. services/diff.ts309 Build observed immutable chunk: actual apiRequest default GET; current ApiError path is the display label build observation content.
5. services/conversation-artifact.ts93 immutable artifact chunk: actual explicit POST /task/:id/artifact-read, not GET; its current error path is the label Conversation Artifact read. It must not be guessed from being a reader.
6. services/project-archive.ts33 ZIP binary download: actual apiRequest default GET.
7. services/browser-preview.ts104 screenshot binary read: actual apiRequest default GET.

Direct pure-test construction: overlay/test/api-error.test.ts56 binary/error-body matrix and138 malformed binary-body case. All constructor calls must be migrated together if the parameter becomes mandatory. Existing binary-api-error-services.test.ts exercises successful bytes and original typed reader errors; it must retain POST for Conversation Artifact and GET for Build/ZIP/browser/board/resource paths.

ApiError consumers use status/body/instance checks and publish through existing apiError listener/diagnostics. Generic formatErrorDetails is exported through diagnostics and consumed by error Feedback/logging services; changes belong to that one formatter, not UI-specific copies. Actual production HostTransport ordinary HTTP implementation exists only in tauri-transport.ts431. POST SSE/fetch and native EventSource branches have separate generic error/stream-close contracts and are excluded: do not label them ApiError, retrofit packets or claim SSE method qualification from ordinary HTTP tests. TransportResponse shape need not gain duplicated request provenance for this slice.

## Minimal single-authority proposal (held)

Add a readonly required method to ApiError using the existing TransportRequest method union (NonNullable<TransportRequest["method"]>), not a second method enum/protocol. Add a required constructor argument and update every listed production/test site. No optional legacy default to GET, fallback URL parsing, latest request cache, ambient context or second error state is justified.

Capture the normalized method once before dispatch and carry that same scalar into both dispatched request and resulting error. In apiJson do not read init.method after awaiting: a mutable caller init could have changed while pending. Pass the captured normalized method in the existing request init and use it in ApiError. Direct binary callers should use their actual request method from the captured request descriptor/local scalar; implicit GET can be made explicit at that dispatch with the existing protocol value. Conversation Artifact must carry POST. No body, header, credential, response wrapping, second request or new reader is required.

The generic formatter should render the method only when actually supplied by the HTTP error, alongside its existing status/path and request ID; ordinary Errors remain ordinary. One concrete detail format is `HTTP POST 400 <existing path>` followed by the unchanged Request ID/body/stack sections. Choose the final compatible format at Root admission and assert its complete typed output. Prefer preserving message/summary behavior initially unless the actual primary diagnostic needs method too; do not create a second formatter to preserve old string expectations.

Two manual readers currently use labels rather than their actual request path. That is an existing provenance limit. Root may capture the already-built exact dispatched relative path and give that to the same ApiError rather than the label if included in final scope; it must not reconstruct it after failure or parse URLs for method. Do not silently claim all current errors already carry a genuine URI. Side-chat path is already actual and independently qualifies the method-only repair.

## Focused positive non-UI qualification

Existing overlay/test/api-error.test.ts and binary-api-error-services.test.ts are pure HostTransport/error data contracts; tauri-transport-error-body.test.ts qualifies fetch transport/body, not UI. Selected current tests have positive explicit output contracts and no searched .not core assertion. Use the existing isolated runner only, no DOM/render/source-string test. Keep original failures.

Required cases: same relative path actual GET and POST failures yield separate exact method/status/path/body/requestID fields and formatter output; all five authored supported methods normalize and retain their real transport records; default omitted method dispatches actual GET; delayed response with later caller-init mutation retains dispatched method; two concurrent same-path requests retain independent methods/request IDs. Success continues original parsed bytes/body. Actual binary service records pair their method to typed error, especially POST Artifact vs GET Build. Existing materialized JSON/byte/plain/malformed server body and named-error summaries remain exact. Authority retirement remains the original typed control error, not a new visible ApiError. A generic Error has its exact existing detail output without invented HTTP method.

These are local pure transport/typed diagnostic contracts only. If Root chooses actual loopback HTTP, reuse an existing owned checker with current production transport and actual split request IDs; no new fake UI or parallel runner. Native stream packets/network-before-response are separate unknown matrices, not retroactively qualified.

## Root genuine acceptance and unknowns

Use a fresh isolated no-Provider history scope with the same lawful missing current model condition. Actual Side chat action should naturally produce GET200[] then POST400. Root saves method-bearing Details screenshot plus real request IDs and native log correlation. It must visibly distinguish POST creation from successful GET, preserve history/model error and avoid synthetic messages. Do not force GET failure, alter current backend policy or stage credentials to make the error vanish. Close only the owned page/service using canonical physical settlement. Types/build/i18n/docs do not replace this screenshot.

No evidence attributes a backend model/schema failure to this diagnostic omission. Cross-vendor/stream/network errors and all manual constructor UI surfaces remain unknown unless separately exercised. The candidate affects public error attribution/debugging; no production mutation, retry, status or model policy is changed. Root owns final scope, architecture/index updates and normal submission.

## Status

Read-only source investigation and plan complete. Implementation/tests/genuine after screenshot held. No files other than this plan were modified, and no model/service/UI request was issued.

## Root implementation admission76 and exact path impact

Root admits the unique mandatory ApiError method, await-before-dispatch capture, all seven production constructor sites, existing pure API/binary/transport tests and the one generic formatter. Keep message/summary's current status/path/body format; only Details' HTTP first line adds the real method. No URL inference, optional default, new cache/state/formatter/packet or stream-policy change. Two reader display labels will be replaced by the exact relative request path captured before await and reused in that original dispatch. Repository consumer search finds path used for diagnostic rendering/tests, not model/reader selection, retry policy or cache authority; the only old label-specific expectations are binary-api-error-services.test.ts. Replace them with actual scoped path/query outputs. Project archive/browser/board/resource/API sites already use their actual supplied request path. Preserve all unrelated MCP/package/classifier/metadata changes. Root owns actual GET200→POST400 screenshot, architecture/indices and Git. Pure typed error output tests are not UI/source/DOM/render assertions.

## Implementation and local qualification freeze76

All seven production constructors now require their real request method using the existing TransportRequest union. apiJson captures normalized method before awaiting, passes that same scalar into dispatch and ApiError, and preserves current authority admission before normalization. Resource/board/ZIP/browser/Build explicitly dispatch their captured GET; Conversation Artifact dispatches its captured POST. Build/Artifact error paths now reuse the actual pre-await scoped relative path. ApiError message/summary status/path/body formatting and response decoding/correlation remain unchanged except those intentional truthful path replacements. The one generic formatter adds supplied method to its existing HTTP detail first line; ordinary errors retain their original output.

Original canonical Overlay unit-runner baseline before.log reports21 pass/6 fail/101 assertions: five supported-method cases plus concurrent mutable-init case prove the missing field while actual transport records are retained. First after checker passes after constructor/formatter/path migration. Final same canonical `bun run script/run-unit-tests.ts test/api-error.test.ts test/binary-api-error-services.test.ts test/tauri-transport-error-body.test.ts` from packages/overlay exits0:28 API tests/107 assertions,5 binary service tests/40 assertions,5 transport tests/16 assertions, total38/163. Exact complete logs are retained separately. Positive cases cover all actual methods, default GET plus post-dispatch mutation of caller init, concurrent same-path GET/POST correlations, actual browser fetch GET/ArtifactPOST error paths, unchanged binary bodies/summary and ordinary Error detail. Both controlled concurrent responses are released and their promises joined.

Configured Overlay `bun run typecheck` exits0. Explicit installed TypeScript with archived explicit-types.json includes all Overlay source and the three selected non-UI tests, exits0. First explicit command incorrectly targeted nonexistent Overlay-local node_modules/typescript/bin/tsc; explicit-types-first-path-error.log is retained, then the exact input was compiled using the actual installed ../opencorvus/node_modules/typescript/bin/tsc. No source/type contract was altered to hide that tooling failure.

Formal request-error-method evidence holds complete baseline/first/final/type logs/input, pre-edit snapshots and final bounded diff. Initial formatter invocation created unrelated board formatting; its temporary diff was preserved ignored, original exact saved board restored, and only the required method/constructor lines reapplied (3 additions/1 deletion). No unrelated Root MCP/auth/package/lock/classifier/metadata edits are included. Source/test implementation is frozen. Root's fresh actual same-path GET200→POST400 Details screenshot, native physical closure, architecture/index/doc checks and normal unified Git delivery remain pending; local fixtures are not real UI/Provider/stream qualification.

## Root actual75 visual qualification

Clean49.88s renderer presents genuine Task50. Natural Side chat GET200[] then runtime POST400. Expanded Details visibly starts HTTP POST400, request7dcbd305-9907-4aca-88e2-b0595b3e1c18 with actual path/model body/stack; after-75-method-details PNG/AX. Target log distinguishes GET from POST; native list also200[]. History/model issue preserved; no synthetic message/provider/error. Own47/native75 public Job/output/request/independent18031 pair closure passes, shared receipts conversation-input-follow/after-75-*.

Installed loader wraps typed failure into ordinary context/string losing method/requestID; independent80 candidate is not fixed here. Direct ApiError display qualified; streams/network-before-response/every binary UI surface remain unknown.

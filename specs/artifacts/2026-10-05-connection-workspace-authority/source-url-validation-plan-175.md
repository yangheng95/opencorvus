#175 Source URL validation contract repair

## Recall

User prioritizes Sources and continuous Sol iteration.167 ebba4f01 normally pushed40381actual0/freshsame;168 genuine16SolEOF/ONCE0 and all owned native/page/pair closed.173 local DATA fixture exposed a schema exception; its first log preserves only the later AssertionError, not underlying original stack. Root175 independently probes actual current production SourcePayload.safeParse with not-http-url and retains new actual TypeError stack at message.ts269. This local data result is not Provider/UI/Task failure evidence. No UI automation, fakeSource E2E or scheduler anomaly inferred.

## Root cause and all affected boundaries

HttpSourceUrl is the sole Message URL schema: z.string.url followed by custom new URL(value) refinement. Zod4.4.3 still invokes that refinement for this format-invalid string, so its URL constructor throws outside safeParse. Existing format check does not short-circuit a dirty refinement. SourceUrlPayload, union SourcePayload and SourceUrlPart reuse it. Tool-result processor485, streamed SDK URL-source1476 and source-persistence12 all parse this schema. URL factory normally canonicalizes valid URLs first; provider/plugin payloads still require the common strict schema. No prior focused malformed URL contract test was found.173 diagnostic catches exceptions into its own typed audit error; it does not fix production.

Root searched definitions/callers/error text/tests/public source contracts and reviewed tool/source, processor tool/SDK and persistence paths. This changes malformed/non-HTTP validation to ZodError invalid_format/url at path url; valid full URL, metadata, identity, canonicalization and persistence stay current. It changes the former protocol refinement message to standard Invalid URL; no repository caller depends on old custom text. File/document schemas and UI label/Key/grouping untouched. DB rows already stored are not rewritten. Queue/retry/recovery success is not inferred from a local parser test.

## Selected implementation and evidence

Use installed mature z.url({ protocol: /^https?$/ }) as sole HttpSourceUrl; delete custom refinement. Official primary https://zod.dev/api#urls documents protocol option. Root actual installed4.4.3 probe confirms HTTPS full query/fragment and HTTP localhost:port preserved, malformed/FTP return URL-format issues. Avoid newer z.httpUrl: current public docs include domain constraints that would narrow accepted localhost/IP behavior; no dependency bump, normalization, fallback or copied schema.

Root admits this one schema replacement and focused nonUI source-url-payload tests before mutation: valid HTTP/HTTPS full metadata/localhost/IP/query/fragment and typed malformed/FTP error outputs for payload union and persisted Part schema. No negative-core or UI tests. Save exact preimage/diff. Run focused new parser and existing positive persistence test, package types/docs current checks; valid genuine171 search→sources→durable→real pixels later remains required. API generated doc changes, if actual checker reports them, must use sole generator. Error-source Provider/SDK actual invalid emission stays unknown, not manufactured for E2E.

Local Source schema fixture demonstrates real parser correctness only. Future171 natural search has original24/600000/180000/900000/streamSol/nativewholeclosure unchanged, and173 closed result checker once remains distinct. Root owns current architecture note/indices/commit/push and keeps continuous goal ACTIVE.

## 本批最终状态

Root [171人工记录](source-multiple-search-live-171/live-01/root-manual-qualification.md)确认190087ms/24 Sol200EOF/exhaustedfalse/173原5argsONCE0/allclosed。175成熟URLschema修复8schema+1persist0/types95817实际0，173 Root修正后local7DATA0/types89488实际0。真实UI4与3 Sources组/data projection合格不代表不同documents；longsnippet3536 Tooltip883.823>720仍FAIL、childtext2529 growth UNMET。176仅调查HELD未实现，新175提交推送待Root，持续目标ACTIVE。

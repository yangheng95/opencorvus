# Transcript disclosures and nonblocking Markdown rendering

## Recall

- User: “消息流的sources要折叠起来…很多点开是空的tool call…tool call的文本字体大小比正文大”; follow-up: “长artifacts渲染竟然阻塞式更新”, confirmed long text / Markdown.
- Acceptance: Sources collapsed initially with an accessible count and real links on expansion; each Tool disclosure presents real input/result or explicit lifecycle/empty-result information; Tool chrome and trace text do not exceed prose size; long document and streamed Markdown parse off the UI thread and mount incrementally without replacing completed paragraphs. Review actual desktop `/ui` screenshots and interactions.
- Constraints: single agent, preserve canonical message ordering/content and existing Tool hydration; no UI automated tests, snapshots or baseline assertions. No provider/credentials, user's app/process interruption, branches, worktrees or release. Scoped commit followed by fetch, upstream merge, pending-commit audit and push.
- Read: AGENTS.md, package scripts, architecture 07-panel and overlay-typography; September 18 child transcript refresh and September 30 Tool disclosure layout record; SourceParts, CardParts, InlineToolPart, ToolPayload, TextPart/text-part-model, DocumentArtifact, InteractiveArtifactPart, markdown/i18n/icon utilities, conversation prewarm callers, disclosure primitive, typography and message styles, Session ToolState schema.
- Searches: repository definitions/callers for SourceParts, InlineToolPart, ToolPayload, renderMarkdown, StreamingTextPartController, prewarmMarkdownRenderCache, canonical Tool state and deferred Tool projection. `file-reference.test.ts` contains rendered HTML assertions and a DOM-shaped stub; remove the UI cases without running them, retain positive pure path/range contracts. No delegation.
- Existing unrelated work at start: runner, dispatch projection, prompts, read-agent-message, focused backend tests and Task architecture/index changes. Preserve these; recheck status because another task can commit them while this task runs.
- Authoritative references: [MDN worker isolation, message passing and bundler URL](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers); [Marked lexer/parser contract](https://marked.js.org/using_pro#lexer).

## Analysis and impact

- Sources is a shared unconditional heading/list in SourceParts; main, side and child transcripts all inherit it. Earlier work reduced chip weight but did not add disclosure semantics. Use the existing native Disclosure and operator-owned expansion state, keeping citations in chronological position and all source facts/links.
- Tool bodies are an exclusive set of specialized outputs followed by a payload substitute. Generic input is shown only when other output is absent; metadata may occupy that substitute first, and empty input becomes `{}`. Pending/running states and a completed empty output have no explanatory presentation. Specialized shell/browser paths can mask other persisted facts. Existing lazy reads already expose load/error states; do not change persisted evidence or infer missing data from a title. Exact user-reported empty Part identity is unknown. Read-only production SQLite metadata audit covered 250 recent requests; most externally executed results reference a result attempt rather than an inline output. Those are canonical protocol facts, not proof that the tool returned nothing. Verify expanded bodies on the real route and retain hydration.
- Tool headings use body-size monospace and structured payload/raw output inherit body size. Use caption for auxiliary disclosure chrome and code size for trace data, body for explanations, explicitly sizing raw preformatted output.
- DocumentArtifact uses StaticTextPart: createMemo synchronously calls the full Marked/highlight renderer and writes one large innerHTML. StreamingTextPartController freezes block HTML synchronously inside a reactive effect; loading history/completion processes every remaining block in one turn. Its incremental scan helps append work but does not isolate parsing/highlighting or DOM mounting. Prewarming also parses on the UI thread. These are shared presentation roots, not a scheduling/queue/Task/Mission/Session occurrence anomaly; runtime state and recovery audits do not apply.
- Replace the synchronous TextPart rendering path with one worker-backed model shared by static documents and streaming prose. Keep the current Marked renderer as the sole Markdown contract, tokenize complete static documents with one lexer (preserving reference definitions/list/table/fence semantics), cache stable streamed blocks in the worker, coalesce obsolete updates by owner, discard stale replies and dispose owner state. Mount worker results over animation frames. Remove the synchronous prewarm path now made obsolete for transcripts.
- Scope: shared Overlay rendering, locale copy, trace typography and relevant docs. No API, persisted state, SDK or Provider changes. Risks: worker asset/CSP/locale/icon initialization, stale async results after switches, reference-link/list semantics, long single blocks, streaming finalization, layout/scroll position and empty Tool results. Validate built worker loading, actual page interactions/screenshots and manual responsiveness observation; never label presentation samples as provider end-to-end evidence.

## Plan

1. Add Sources disclosure, uniform Tool input/status/empty-result presentation and restrained typography using existing primitives/tokens.
2. Move text parsing/highlighting into a module worker with per-owner latest-update/disposal semantics; share it across documents and prose, mount incrementally, remove obsolete prewarm/controller path and encountered UI assertion cases.
3. Run focused Overlay typecheck, i18n/CSS checks, build and root docs checks. Start isolated project development server, inspect real stored presentation messages/tools/sources and long Markdown artifacts, correct visual findings, capture final screenshots and responsiveness evidence. No credentials or model calls.
4. Update architecture/evidence/status, commit this task only, merge upstream and audit every pending commit before push.

## Status

Implemented the shared Sources disclosure, explicit Tool arguments/outcomes,
caption/code typography, and worker-backed Markdown for both TextPart and
StaticTextPart (therefore document artifacts). Removed the previous synchronous
controller/prewarm path and encountered rendered-HTML/DOM assertion cases;
positive pure file-location tests remain.

Worker parsing uses the existing configured Marked lexer/renderer. One accepted
request finishes while only the newest queued update is retained per owner;
append-compatible completed blocks remain displayable, replaced/locale-stale
replies are discarded, errors are visible, and disposal releases the owner.
The UI mounts at most 16 blocks / approximately 4 ms of insertion work per
animation frame. This bounds batches, not the cost of an indivisible DOM block.

Actual `/ui` manual review covered default/expanded Sources, file opening in the
File dock, single empty results, multiple chronological outputs, arguments,
long document beginning/end, references/list/table/code semantics, and switching
while a Part received 130 append updates. The 900-section document preserved
all 197,271 characters beyond the old 120,000-character static limit. Visual
review also caught and fixed the duplicate Tool identity and its shrink-to-fit
50% name truncation. [Screenshots and precise scope](../../artifacts/2026-09-30-transcript-rendering/README.md).

Overlay typecheck, locale check (1,987 keys), CSS token check and production
build passed in the first and subsequent implementation rounds; root docs
check passed. The last review additionally guards stale failures and makes
worker failure explicit for later requests. Final Overlay typecheck, locale,
renderer-surface, production build and root docs checks passed; `git diff --check`
passed. Existing third-party build directive/chunk-size warnings remain.
Only this task's rendering, test deletion, architecture and evidence files are
included in its scoped Git delivery; the earlier unrelated worker repair was
already committed and present on upstream before this task's commit.

Limits: exact identities of the user's original empty Tool Parts remain unknown;
the shared rendering omissions and empty-result presentation are repaired, but
no claim is made that every reported historical Tool was actually empty. This
is browser presentation acceptance without model execution or installed-native
host acceptance. A single enormous Markdown token still mounts as one block.

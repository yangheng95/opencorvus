# File Source range135 — canonical text repair proposal

## Recall / current authorization

User requires actual Sources file/range navigation, not a checksum or data-only substitute. Root asks plan-only after genuine134 observations; no source edit, UI, runtime/service, DB, model, credentials, Git or delegation authorized here. Read131 investigation,133 complete Recall/admission, actual134 editor-observations-first-panel.json, current CodeEditor/FileEditorPane/source/theme/workbench contracts, installed CodeMirror state6.7.1/view6.43.6 sources/types and Root130 actual comparisons. Root continues134 manual sibling/repeat observations and closes whole native/pair scope before deciding135/136 execution.

130 first/new07-panel170–200 stayed top1, SourceParts70–105 worked; same-loaded07-panel repeat worked.131 earlier unknown is historically accurate.134 now provides actual same-view cause evidence; its diagnostic build is not final repair. Current file Sources data/current Task completion can pass while initial UI reveal remains failed. Never rearm old Task or wash original130/134 failure.

## Actual134 causal sequence

Canonical archived editor-observations-first-panel.json records one new07-panel view mount at06:10:23.522,1948 lines/139906 UTF-16 positions. Actual revision2 range170–200 dispatch selects cursor170/anchor11466 and moves model viewport10776–12682; same actual mounted view latches identity at.535. At.539 value_before sees nextLength139927. The whole-document external-value dispatch produces actual docChanged/applyingExternalValue=true at.552, same1948/139906 document but cursor1/anchor0/viewport0–934. value_after confirms it; .554 same_identity skips reveal. Root independently sees final scroller0/no bands in actual first-settled screenshot. This is not a conclusion from pre-library-scroll measure0: the actual document-change and cursor reset precede the skipped reveal, and Root's later screenshot supplies final viewport.

README139lines8403 has no spurious replacement in the same archive. Root SourceParts success/repeat comparisons corroborate format-dependent behavior, but the failure is proven by the07-panel sequence, not assumed from file extension or size. CoordinatePresent=false at the later pre-scroll read is a consequence/candidate in this trace, not a separate required geometry root cause.

## Actual source newline facts / primary library contract

Read-only Node fs.readFileSync byte/UTF-8 scalar inspection of the THREE originals, without writes or library/app evaluation, produced:

| Original source | UTF-8 bytes | UTF-16 length | CR | LF | CRLF | bare CR | bare LF |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| README.md |8429|8403|0|138|0|0|138|
| specs/current/architecture/07-panel.md |141723|139927|21|1947|21|0|1926|
| packages/overlay/src/components/SourceParts.tsx |7897|7896|0|200|0|0|200|

The original07-panel is mixed LF/CRLF, not uniformly CRLF. Exactly21 CR characters accounts for raw139927 minus canonical139906;1947 LF boundaries yield1948 lines. Current source inspection agrees with134 archive's raw nextLength and canonical documentLength. Staged byte provenance belongs to actual134 custody; this plan has not independently re-read its runtime target or DB. No hash acceptance is introduced.

Installed official @codemirror/state6.7.1 dist/index.js608 defines default split /\\r\\n?|\\n/. EditorState.create2761 converts string docs with configured lineSeparator or that default. EditorState.toText2692–2693 uses the SAME state facet and split to construct Text. ChangeSet.of972 converts string inserts with the same separator, or accepts Text directly. Text.toString106 serializes through sliceString's default LF; therefore comparing raw string with doc.toString is not canonical equality for mixed/CRLF input. Text.eq53–68 compares Text line/value content, not a digest, rendering or string byte length. Public installed index.d.ts1157–1161 documents toText using state's line separator; Text.eq67 is public. Scoped Overlay source search found no configured EditorState.lineSeparator, but proposed use remains correct if that facet is later legitimately supplied. Online official docs were403 in131; these exact installed primary definitions supply evidence.

## Root cause / old path limitation

CodeEditor value effect currently compares `next === editor.state.doc.toString()`. onMount already builds normalized Text from the original string, then reveals and latches citation. For raw CRLF/mixed input, equality is false even though semantic Text is identical. The effect unnecessarily replaces the whole document with that same semantic Text. CodeMirror maps current selection and pending scroll through a full replacement; actual134 cursor resets1. Theme revealedLines StateField drops band on docChanged (code-editor-theme.ts105+). Next reveal effect sees unchanged path/start/end/revision and skips because the previous dispatch was latched. Thus correct file, correct range and correct first dispatch still lose their presentation.

Previous request revision/dirty-owner fixes address repeated opens/draft lifetime, and old settled guard only prevented empty-document clamping. Neither normalizes the external equality relation, so they did not remove the spurious full-document transaction. Adding a timer, measurement retry, latch reset on every change or manual scrolling would treat consequences and could overwrite genuine edits/selection. The single root fix is current document equality at the library's text boundary.

## Minimal one implementation

In existing CodeEditor value effect only:

1. Read existing local.value and current editor as before.
2. `const nextText = editor.state.toText(next)`.
3. `if (editor.state.doc.eq(nextText)) return`.
4. For genuinely different text preserve existing applyingExternalValue and dispatch structure, with full replacement `insert: nextText`.

No handwritten newline regexp, duplicate normalizer, fallback, separate diff/cache/model/editor owner, new target identity, change to latch/reveal revision/scroll/focus or permission behavior. Creation and subsequent update use same library canonical text semantics. Equal canonical input keeps actual selection/highlight/undo/view untouched; actual different content still uses existing external-value transaction, existing suppress-onValueChange guard and subsequent reveal dependency. This does not preserve arbitrary original newline bytes when a human edits/saves; current editor serialization/save policy is unchanged and outside scope. Original staged files remain byte-exact; no test rewrites originals.

Remove ALL133 temporary instrumentation before final135 source build: AppLog import, untrack if only diagnostics uses it, observation mount/helper, mount/update/value/reveal/cleanup logs and custom requestMeasure read/write. Restore original single `editor.requestMeasure()` and existing updateListener body, retaining original dispatch/latch behavior. Root may keep separately admitted FileEditorPane common.loading caption; do not add locale or modify shared diff key. Exact preimages/current diagnostic diffs/logs preserved; no live patch or UI mutation before Root release.

## Impact / scope / verification

Production scope is CodeEditor.tsx canonical comparison and temporary observer removal; existing FileEditorPane common.loading retained only under its own admission. Range-bearing caller is only FileEditorPane403–407. Shared CodeArtifact/NotebookArtifact/FilePreviewArtifact use CodeEditor without ranges and likewise gain canonical equality instead of repeated semantic no-op replacement. DiffArtifact shares theme but does not use this value effect. No SourceParts, file-workbench, target/draft owner, API, backend, Source payload, Task lifecycle, permissions, model, SDK, files or native launcher changes required.

This is a UI editor fix; UI automation/component/DOM/screenshot/source-string tests are forbidden. A pure standalone EditorState/Text contract could qualify LF/CRLF/mixed string→toText.eq and actual changed text→different canonical document, selection170 surviving an equal canonical input and explicit new semantic content through current library; it would remain local library semantics, not production viewport E2E, and must not duplicate component implementation merely to pass. Root should decide whether useful beyond inspected primary API. Existing pure file-workbench target/revision contracts may remain, but cannot substitute visual reveal. No tests run in this plan-only task.

Root configured Overlay types/build/actual served asset prerequisites, full owned source diff review and temporary instrumentation removal precede genuine136. Source capture must use actual latest originals/staging provenance, not hardcoded historical line counts/lengths. Fresh independent136 retains authorized complete auth+models pair, actual credential/model/request streaming qualification and bounded24/prep600000/idle180000/task900000 if Root admits unchanged case. No model forced to emit a particular Tool or Source; absent actual range remains unmet.

Root actual manual after: first README1–50→first07-panel170–200 (verify blue170–200 and appropriate visible cited area),→SourceParts70–105,→new07-panel again,→same-loaded repeat. Capture filename/body/range/cursor/gutters and actual settled scroller at desktop; no fixed top pixel promise, no fake data or UI assertions. Confirm accurate file-loading label if it appears naturally. Actual Source data checker runs once only after genuine completed scope plus exact whole Job/output/request/parent/pair closure, unchanged six-argument file oracle. Do not equate data-check0 with initial reveal success. Preserve134 temporary evidence and all first failures. Root alone chooses136 plan/admission/currentasset and manages real pages/closure.

## Qualification limits

### Root source implementation admission — 2026-10-08T06:14Z

Root read full135/133/131 Recall and actual134 mounted-view/value/update/reveal chronology. Mixed newline21 scalar difference explains the actual raw139927/canonical139906 lengths; both initial and Code→Panel first opens reproduced cursor170→1 after same-text replacement. Repeat same loaded target succeeded, and LF SourceParts first open succeeded. Root personally reviewed all actual screenshots, including accurate Loading… caption while a real file load was pending.134 Task epoch1 completed in109273ms,16 actualSol200EOF; once closed filechecker actual0 does not repair the initial UI failure. Page116 closed/reset, whole shutdown actual0, independent Host49720/Target70300 exactbirth gone/18091 free/pair cleaned, parent65710 actualterminal0 joined. Original130/134 failures remain.

Root admits restoring the exact reviewed pre-observation CodeEditor from Root-owned preimage, then only canonical state.toText/doc.eq/insertText change. Current diagnostic source is archived; all current product diffs in this file were Root's temporary observation, no user or child edits. Retain independently admitted FileEditorPane common.loading. No latch/scroll policy change or UI automation tests. Types/build and fresh136 actual range before/after are pending; no final source/UI pass is claimed until Root sees136 pixels.

134 actual sequence closes this occurrence's canonical-equality/spurious-replacement root cause; it does not establish every possible CodeMirror geometry/recovery failure is fixed. Genuine semantic external replacements, editing/save/dirty conflict, external readonly source, Unicode, offscreen/same-file changed content and unrelated artifact renderers remain separate contracts unless actually verified.131 original unknown should be supplemented, not rewritten as if it had evidence earlier. No code was edited by this proposal.

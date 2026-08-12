# CS-053 — Remote Skill cache snapshot publication

## Recall

- User request: independently fix `CS-053` (`remote Skill cache writes directly to final paths and treats existence as completeness`). Trace discovery, cache identity/index, installation and runtime consumers first; then implement one source-separated staging → local completeness manifest/digest → atomic publication authority and focused non-UI production-path tests. A remote digest is optional, but readers must trust only complete published snapshots. Same-named Skills from different URLs must stay separate. Do not add fallback or dual readers.
- Acceptance:
  - an interrupted or failed supporting-file response never becomes a readable remote Skill snapshot;
  - retry downloads every declared file into a fresh staging directory instead of trusting a final-path fragment;
  - the locally computed manifest binds the normalized source URL, Skill identity, complete declared file set, per-file byte count/digest and one snapshot digest;
  - publication is one same-filesystem atomic namespace operation, and readers accept only a snapshot whose files still match that manifest;
  - same-named Skills from different normalized URLs publish under different source identities and neither overwrites nor aliases the other;
  - installation validation/config, installed inventory, Skill mounts and runtime supporting-file reads all consume the same verified published directory.
- Hard constraints: scope is limited to exact Skill discovery/cache/manager files, focused non-UI tests, and this spec. Do not modify shared indexes, Project/Worktree, Channel, Research/Intent, SDK/generated, Overlay/UI, or run UI automation. Freeze after first verification for independent read-only review; after final review, commit only the exact owned files and do not push.
- Read sources:
  - repository `AGENTS.md`;
  - `specs/current/architecture/04-extensions.md`, especially ordinary Skill source authority, inventory/mount projection and update-source boundaries;
  - `specs/records/2026-08/2026-08-12-repository-code-smell-continuous-audit.md:1015-1029`;
  - `packages/opencorvus/src/skill/discovery.ts`, `skill.ts`, `manager.ts`, `reference-lock.ts`, `mounts.ts`;
  - `packages/opencorvus/src/tool/skill.ts` for runtime supporting-file reads;
  - `packages/opencorvus/src/config/config.ts`, `util/filesystem.ts`, and the isolated test runtime preload.
- Full-repository search and impact:
  - `Discovery.pull` is the sole remote URL index/downloader and has two production callers: URL installation in `SkillManager.installResolved`, and configured runtime catalog loading in `Skill.loadCatalogState`.
  - the old cache identity is only `<cache>/skills/<skill-name>`; URL identity is absent. `get()` returns success for any existing final path and otherwise streams directly into it. A process exit can therefore leave a truncated final file that every retry accepts.
  - `Skill.loadCatalogState` scans every directory returned by `pull`; downstream inventory/mounts/tools retain absolute paths to its `SKILL.md` and supporting files. They do not independently know the remote index or file set, so publication must be decided before `pull` returns the directory.
  - URL installation validates only discoverable `SKILL.md`, writes `.opencorvus-skill-source.json`, and adds the URL to global config. The source manifest is installation metadata, not a byte-completeness receipt; it must not become a second cache authority.
  - `SkillManager.installed` classifies cached paths and walks upward for installation source metadata. Its cache containment/source reporting must continue to recognize the new source-separated published paths.
  - no HTTP/OpenAPI/SDK schema changes are required: `Discovery.pull` still returns verified local directories and Skill Manager receipts/config retain normalized source URLs.
- Observable trigger: an index declares `SKILL.md` plus supporting files; a stream creates a final file and terminates before completion. On retry, `exists(dest)` returns true; if `SKILL.md` parses, install/runtime advertises and can execute a Skill whose scripts/references are truncated or missing.
- Root cause: physical existence of independently written files is the only readiness predicate, while final cache identity omits the source and has no snapshot membership or content receipt.
- Why current structure does not cure it: `Promise.all` observes ordinary returned download failures but not process termination after bytes reach a final path; manager validation proves only one parseable descriptor and neither cache identity nor runtime readers can distinguish complete, stale, mixed-source, or partial bytes.
- Independent feedback before implementation: none; no review was requested before implementation and delegation is prohibited.

## Plan

1. Replace final-file downloading with one URL-scoped, unique same-filesystem staging directory per indexed Skill. Normalize and hash the source URL for its cache namespace, keeping same-named Skills from different sources physically distinct.
2. Download every declared file into staging, require successful complete responses, compute each file's byte count and SHA-256 (Secure Hash Algorithm 256-bit) digest, then write a strict local manifest containing normalized source, Skill identity, sorted file receipts and a stable snapshot digest.
3. Publish staging through a single atomic rename-no-replace into an immutable content-addressed snapshot path. If the exact snapshot already exists, verify its manifest/files and reuse it; otherwise fail closed. Staging and fragments never enter the published namespace.
4. Make `pull` return only directories that pass strict manifest, source, identity, membership, size and digest verification. Do not scan old unmanifested paths and do not infer completion from `SKILL.md` existence.
5. Add focused production-path tests with a real local HTTP server. Cover failed/truncated response followed by retry, exact manifest/file verification through `Discovery.pull` and `SkillManager.install`/`Skill.all`, and two URLs publishing the same Skill name into source-separated directories.
6. Run the focused test, package typecheck, task-owned `git diff --check`, and exact scope/status review. Do not run UI automation or commit; freeze for independent read-only review.

## Positive verification targets

- A failed/truncated first response produces no returned/readable snapshot; the next pull fetches all files again and publishes exact complete bytes.
- Every returned directory contains one strict local completeness manifest whose normalized source, Skill name, sorted paths, sizes and file digests reproduce its snapshot digest.
- URL installation and subsequent runtime inventory/load expose only that published directory and exact supporting-file contents.
- Two normalized source URLs with the same declared Skill name return distinct published directories and exact source-bound manifests.
- No old final-path cache reader, existence-as-success path, fallback, UI automation, external publication, or commit remains.

## Implementation verification

- `Discovery.pull` now normalizes and SHA-256 partitions each source URL, writes every indexed Skill into a fresh same-filesystem staging directory, records sorted per-file byte counts/digests plus a source/Skill-bound snapshot digest, and performs one atomic rename-no-replace into the content-addressed published namespace. It never streams to or trusts a final file path.
- `Discovery.requirePublishedSnapshot` is the single reader gate. It validates the strict local manifest, normalized source, Skill identity, canonical/unique membership, exact file sizes/digests, snapshot digest, content-addressed directory name and source/Skill cache topology before returning a directory. Old unmanifested paths and staging directories are not scanned.
- URL installation no longer writes `.opencorvus-skill-source.json` into an immutable remote snapshot. Manager source projection reads the exact published manifest, while runtime `Skill.materialize` revalidates the same snapshot before exposing its directory to the Skill tool.
- `bun test --timeout=0 test/remote-skill-cache-publication.test.ts`: passed, 2 tests / 6 assertions. A real local HTTP server first closes a supporting-file response before its declared length; no snapshot is returned, retry requests both declared files again, and the production `SkillManager.install` plus global Skill catalog expose only the verified complete snapshot. The production inventory marks that immutable published snapshot `writable: false`, and public server update returns the existing explicit non-writable error before fetching or mutating bytes. A separate real-server case proves identical Skill names from distinct URLs publish under distinct exact source namespaces.
- `bun run typecheck` reached only the unrelated concurrent-worktree diagnostic at `src/memory/project-memory-organizer.ts:290` (`signal` is absent from that event type); no CS-053 file appears in diagnostics.
- Task-owned `git diff --check`: passed. UI automation and external publication were not run. The batch froze after first verification for independent review.

## Independent-review correction

- First review found that installed inventory derived `writable` only from directory permissions. That made an immutable content-addressed remote snapshot eligible for `SkillManager.update`, whose replacement path would mutate the published identity in place. Inventory now derives remote source identity from the strict published manifest first and always projects remote snapshots as `writable: false`; the real public Manager update path has a positive regression assertion for the exact non-writable contract.
- Second review found that inventory trust still consulted only the removed managed-source manifest, so a published URL snapshot could be mislabeled as local even though its strict completeness manifest was already the source authority. Trust projection now consumes that same verified `remoteSource` (falling through to the managed manifest only for non-remote managed installations), and the production inventory test asserts the exact recognized registry trust.
- Review also identified that old complete immutable snapshots currently have no retention/garbage-collection owner. Safe deletion requires a proven reader lease spanning mounted Skill locations and long-lived runtime tool calls; no such lease exists in the current boundary. This remains an explicit P3 follow-up rather than adding age-based or current-index deletion that could remove a snapshot still referenced by a live turn.
- Final independent review confirmed both corrections close their findings. The focused production-path test remains 2/2 with 6 assertions passing, and the exact owned diff-check passes with no remaining actionable issue. The P3 reader-lease/retention work above is an explicit backlog item, not part of this publication fix.

# Public website database backend and Expert Squad registry convergence

## Status

- Round: inserted database-backend priority round inside the continuing public-website improvement Goal.
- Plan approval: `APPROVED` by an independent read-only agent.
- Implementation: complete locally; focused verification and delivery review are in progress.

## Recall

### User request

- Continue researching, auditing, and iteratively improving the OpenCorvus public website's visual design, information architecture, English and Simplified Chinese copy, usability, and accessibility until a complete audit finds no actionable issue.
- Every round requires independent-agent plan approval before implementation, real-page visual acceptance after implementation, and a separate independent delivery review.
- Commit and push every completed round so the existing GitHub Actions deployment updates `opencorvus.com`.
- Insert this priority round: replace the website's static backend architecture and the current Expert Squad storage with a real database-backed backend.
- Execute the program as a persistent Goal.
- After this database round is accepted, advance the release version to the repository-compatible `v0.0.41-beta` form of the requested `v0.0.41beta`, create its authorized release branch/tag flow, and verify both native binaries and the website publication.

### Acceptance indicators

- The production website exposes one live, database-backed Expert Squad Registry API behind `opencorvus.com`; it is not a loopback-only simulation.
- SQLite is the only production metadata, current-publication, exact-revision, and download-response-counter fact source for the website Registry. Expert Squad ZIP files remain immutable content-addressed blobs rather than database Binary Large Objects (BLOBs).
- The public English and Simplified Chinese Market list/detail pages are rendered on demand from SQLite, and the exact-revision download journey reaches the Registry API and transactionally increments a response counter. The existing signed all-resources publication remains the cryptographic bulk-distribution contract, not a fallback metadata store.
- A deployment imports the exact validated release inventory transactionally, switches the active publication only with the static release, and restores the prior database plus prior release if readiness or public verification fails.
- The Registry fails closed on schema drift, missing blobs, hash/size disagreement, incomplete publication membership, or a database integrity failure.
- Focused positive tests cover schema creation, release import, idempotent re-import, active-publication reads, exact revision reads, archive delivery, response-counter accounting, backup/restore, and production routing.
- The real local production-shaped service and pages are inspected in English and Simplified Chinese at desktop width; screenshots cover Market, one exact Expert Squad detail page, the exact-revision download action/status, and unchanged documentation navigation.
- Independent plan approval precedes implementation; independent delivery review finds no unresolved issue after implementation and real acceptance.
- The owned change is committed and pushed only after upstream safety checks. The triggered `deploy opencorvus.com` workflow and public production health are verified.

### Hard constraints

- No fallback service, static API alias, dual read/write, shadow state, compatibility route, or second Registry fact source.
- Repository Expert Squad packages remain source-controlled authoring inputs for the OpenCorvus product. The production Registry database is the website's runtime publication/query fact source. These are separate lifecycle boundaries, not competing current runtime stores.
- The existing OpenCorvus-signed all-resources catalog and bundle remain because desktop clients verify their publication version, expiry, signatures, resource counts, byte lengths, and Secure Hash Algorithm 256-bit (SHA-256) digests. The database must not weaken or impersonate that protocol, and the production server must never receive its signing private key.
- No public upload or mutation endpoint is introduced in this round. Publisher authentication, namespace ownership, moderation, malware review, abuse response, and signing authority are not yet present; exposing anonymous writes would be an unrelated security regression.
- All database writes are explicit transactions. Foreign keys, Write-Ahead Logging (WAL), busy timeout, integrity checks, and bounded checkpoint behavior are configured at database open.
- No UI automation test, Document Object Model assertion, component-render test, Playwright test, snapshot, screenshot baseline, or pixel-difference test may be added, changed, or run. UI acceptance is real-page interaction, screenshots, and human review.
- Preserve all unrelated worktree changes. At investigation time a parallel task added Overlay icon changes and modified both spec indexes; this round may only add exact index entries around those changes.
- Do not restart, stop, or reconfigure any user-owned local process or window. The production Registry system service is a deployment-owned process, but first-time server provisioning remains an explicit external mutation boundary.
- A `v0.0.41beta` release and its required branch/tag/deployment flow are explicitly authorized by the follow-up request. Domain Name System changes and unrelated releases remain out of scope.

### Materials read

- Repository `AGENTS.md` and the `benchmark-debug-template` skill.
- `specs/README.md`, `specs/records/2026-08/README.md`, `specs/current/architecture/04-extensions.md`, and the current architecture index.
- `2026-08-11-public-website-iterative-design-program.md`.
- `2026-08-10-opencorvus-com-racknerd-hosting.md`.
- `2026-08-10-expert-squad-static-distribution-and-racknerd-deploy.md`.
- `2026-08-10-expert-squad-publish-install-reuse-e2e.md`.
- `packages/web/package.json`, `README.md`, `config.mjs`, `astro.config.mjs`, public Market/detail components and routes, generated-market sources, publication verifier, distribution generator, hosted server, filesystem Registry, and focused Registry/deployment tests. The converged canonical Market contains 119 records (4 embedded plus 115 bundle-importable) after the parallel Expert Squad source expansion.
- `.github/workflows/deploy-opencorvus-com.yml`, `deploy/racknerd/Caddyfile`, the activation script, focused activation test, and production runbook.
- The repository's established `bun:sqlite` configuration and strict schema-migration patterns in `packages/opencorvus/src/storage/**`.
- Bun's official SQLite and standalone-executable documentation, SQLite's official WAL/isolation/backup/transaction documentation, Caddy's official reverse-proxy documentation, and Astro's official Node adapter/on-demand routing documentation.

### Whole-repository search results

- The production deployment workflow builds a static Astro tree, signs a static Expert Squad catalog/bundle, uploads an immutable release, and points Caddy's `file_server` at `/srv/opencorvus/current`.
- `packages/web/script/generate-public-market.ts` previously wrote a generated TypeScript fact array for static Market/detail rendering. It now also emits the 119-record deterministic database import seed, while the generated TypeScript output is no longer consumed by Market requests.
- `packages/web/script/generate-expert-squad-distribution.ts` emits every Expert Squad ZIP, a static catalog, checksums, and build metadata.
- `packages/web/src/lib/hosted-market-registry.ts` is the only website Registry-like mutable implementation. It stores one JSON file per exact revision, ZIP files in a blob directory, one JSON file per quarantine receipt, and one append-only JSONL file per revision's download events.
- `packages/web/script/hosted-market-server.ts` seeds that filesystem tree at process start, keeps mutation sessions only in memory, labels every API response as `local_hosted_registry_simulation`, and is not started by production.
- The current simulation has production-blocking semantics: recursive JSON scans for listing, append-then-full-reparse JSONL download counts, multi-file submission/commit without a transaction, memory-only unbounded sessions, `secure:false` cookies, no publisher identity/namespace ownership/moderation, and request-body/base64 memory amplification on the 1 GB VPS.
- Production Caddy has no reverse-proxy route or application service. The public author/Trust copy deliberately states that self-service publication is unavailable.
- There is one existing SQLite operational primitive in the product runtime, including WAL, foreign keys, busy timeout, strict current Data Definition Language (DDL), drift detection, and explicit migrations. The website must use the same principles but a separate website Registry schema and database file.
- The current branch is `main` with upstream `origin/main`. Investigation began clean, but unrelated parallel Overlay/runtime/spec-index changes appeared afterward and remain preserved.
- The ahead/behind set must be re-read immediately before the authorized release branch/push. No unrelated or independently unreviewed commit may be smuggled into that push.

### Independent agent feedback

- Initial independent architecture audit verdict: conditional approval of a single-host SQLite Registry with immutable content-addressed blobs and a loopback application service; direct production deployment of the filesystem simulation is rejected.
- Blocking corrections incorporated into this revision:
  - Market list/detail pages must be rendered on demand from SQLite; leaving generated TypeScript as their page data would make the database a side path.
  - The first production round must remain read-only to the public. GitHub-reviewed, Continuous Integration (CI)-signed releases are the only import path.
  - A database revision must enforce one digest for each package/version; mutable same-version content is rejected.
  - Production signing keys remain in CI only.
  - Database backup must use SQLite's consistent snapshot mechanism, not a raw copy of an open WAL database.
  - Download counts mean archive HTTP responses only; they must never be presented as users, installations, or popularity.
  - Persistent database/blobs live outside release pruning; readiness covers schema checksum, integrity, foreign keys, active inventory, bilingual list/detail, and archive byte binding.
- Non-blocking operational guidance adopted as the target: one service writer, `synchronous=FULL`, a small bounded cache, systemd hardening, per-deploy and daily snapshots, seven daily plus four weekly copies, and a restore drill. The off-host backup destination remains an external operational choice and is not invented in source.
- Formal plan-review verdict: `APPROVED`. The reviewer confirmed that the revised design removes both the generated-TypeScript Market runtime data path and filesystem simulation, preserves the signed bundle as a separate desktop trust contract, and provides a viable single-host Astro/SQLite deployment and rollback contract.

## Evidence-backed problem analysis

### Observable phenomenon

- `opencorvus.com` serves a static build. No production request can query a database-backed Expert Squad catalog, exact revision, or download-response counter.
- The code called a hosted Registry is explicitly a local simulation and stores mutable state as directory trees of JSON, JSONL, and ZIP files.
- Every process start reseeds repository payload revisions. Listing recursively walks the filesystem; exact reads reconstruct a path; every download reparses a complete JSONL event file to count lines.
- Public Market/detail pages compile all Expert Squad facts into HTML at build time. The only live public Expert Squad state is a separately signed static publication pointer and content-addressed bundle.

### Direct trigger

- `deploy-opencorvus-com.yml` uploads only `packages/web/dist` and activates it as a static Caddy release.
- `Caddyfile` contains only `file_server`; it has no Market/application or `/api/registry/**` reverse proxy.
- `hosted-market-server.ts` is started only by local package scripts and defaults to `.hosted-market-sim`.

### Data and control-flow root cause

- The original work solved two bounded needs independently: static signed distribution for desktop trust, and a local upload/download simulation for end-to-end authoring acceptance.
- No production Registry lifecycle was designed. There is no production schema, persistent service, release-to-database importer, active-publication transaction, database backup, service health contract, or rollback coordination.
- As a result, directory layout became the implicit mutable schema while the production website avoided the mutable path entirely.

### Why prior paths did not root-cure it

- The signed static distribution correctly establishes byte and signer trust, but it cannot provide indexed runtime queries, durable metrics, transactional revision state, or future publication workflows.
- The local simulation correctly validates canonical archives, but copying it into production would retain filesystem scans, JSONL counts, memory-only sessions, localhost security assumptions, and no coordinated deployment lifecycle.
- Treating the generated TypeScript Market array or signed catalog as a database would only rename a build artifact and leave the runtime architecture static.

### Impact surface

- Data definitions: new website Registry DDL, typed row projections, importer, backup/restore, and integrity checks.
- Call sites: Astro Market/detail routes, production service entrypoint, Registry API paths, exact-revision download action, deployment build/package/import/activation/probe flow, Caddy Market/API routing, and runbook.
- Public contracts: existing signed bundle protocol remains unchanged; a new versioned JSON Registry protocol owns query/detail/download responses.
- Security: read-only public API in this round; strict input parsing; no upload, session, cookie, Cross-Site Request Forgery (CSRF), or publisher authority surface.
- Operations: one loopback-only service, one persistent state directory, one systemd unit, one database backup per activation, immutable blobs, health/readiness, logs, and rollback.
- Tests: focused non-UI database, server-rendered route, API, importer, and activation tests. Existing filesystem-simulation tests are replaced, not retained as a parallel path.
- UI: Market and detail markup remain owned by the existing Astro components, but their facts come from the runtime database and one exact-revision download action/status is added. Layout and broader Market information architecture remain outside this inserted round.
- Documentation: this record, a current public-website architecture authority, deployment runbook, and spec indexes.

## Authoritative design findings

- SQLite WAL permits concurrent readers and a writer on the same host, while still serializing writers; the official documentation also requires keeping the database and WAL on one host and checkpointing so WAL growth is bounded: <https://www.sqlite.org/wal.html>.
- Bun documents built-in `bun:sqlite`, transactions, strict mode, WAL configuration, and cross-platform standalone Linux executable compilation: <https://bun.sh/docs/runtime/sqlite> and <https://bun.sh/docs/bundler/executables>.
- SQLite's backup API exists specifically to create a consistent snapshot of a live database; this design instead stops the single service, checkpoints WAL, and then copies the closed database so activation and restoration remain inspectable shell operations: <https://sqlite.org/backup.html>.
- Caddy supports a loopback upstream, active health checks, and preservation of trusted proxy headers. The production API can remain private to Caddy on `127.0.0.1`: <https://caddyserver.com/docs/caddyfile/directives/reverse_proxy>.
- Astro officially supports keeping the default static build while marking individual routes `prerender = false`, and its Node standalone adapter serves those on-demand pages and endpoints without a parallel page renderer: <https://docs.astro.build/en/reference/routing-reference/> and <https://docs.astro.build/en/guides/integrations-guide/node/>.

## Proposed architecture

### One fact source per lifecycle

1. Source-controlled Expert Squad directories remain the product authoring source.
2. The build creates validated immutable ZIPs plus one deterministic `registry-seed.json` that contains the exact normalized website projection and archive references for the release.
3. The signed catalog/bundle remains the desktop bulk-distribution trust contract.
4. The production importer validates the seed against the release archives and signed catalog, then writes one publication and its exact revisions into SQLite in one transaction.
5. The on-demand Astro Market/detail routes and Registry API read only the active SQLite publication. They never scan repository files, generated TypeScript, static catalogs, or release directories to answer a request.
6. Archive bytes live once under a persistent content-addressed blob root keyed by archive SHA-256. SQLite owns their byte length, file count, exact revision membership, and bounded response counters.

### Database schema version 1

- `registry_schema(version, fingerprint, applied_at)` — one strict current DDL identity.
- `publication(id, catalog_sha256, catalog_path, catalog_bytes, resource_total, embedded_total, importable_total, imported_at, activated_at)` — immutable signed-catalog projections. Publication-version replay protection remains in the signed pointer/activator contract rather than a second database field.
- `registry_state(singleton, active_publication_id)` — the one active website publication.
- `archive(sha256, bytes, file_count, relative_path)` — immutable blob metadata.
- `squad_revision(id, namespace, squad_id, version, package_digest, archive_sha256, disposition, name, label, canonical_description, canonical_selector_summary, capability counts, configuration counts, created_at)`.
- `squad_revision_locale(revision_id, locale, description, selector_summary)` — English and Simplified Chinese public copy projection.
- `squad_revision_pillar(revision_id, pillar, ordinal)`.
- `squad_agent(revision_id, agent_id, label, description, base_role, ordinal)`.
- `squad_workflow(revision_id, workflow_id, label, description, ordinal)`.
- `squad_workflow_node(revision_id, workflow_id, node_id, agent_id, description, ordinal)`.
- `squad_workflow_dependency(revision_id, workflow_id, node_id, dependency_node_id, ordinal)`.
- `publication_revision(publication_id, revision_id, ordinal)` — exact inventory membership.
- `revision_download_counter(revision_id, response_count, last_response_at)` — one bounded transactional response counter per revision.
- All identity, digest, version, ordinal, count, uniqueness, and foreign-key constraints are executable DDL. Complex arrays are normalized instead of stored as opaque JSON records.
- `UNIQUE(namespace, squad_id, version)` makes a published version immutable; a different digest for the same package/version maps to one typed conflict instead of creating a second revision.

### Registry API version 1

- `GET /health/live` is a process-only probe; `GET /health/ready` returns schema identity, active publication, SQLite integrity/foreign-key results, inventory count, and complete blob binding.
- `GET /api/registry/v1/squads?locale=en|zh-CN` returns the active publication ordered by canonical label with namespace/identity tie-breakers.
- `GET /api/registry/v1/squads/:namespace/:id?locale=en|zh-CN` returns the active exact record projection.
- `GET /api/registry/v1/squads/:namespace/:id/:version/:packageDigest/archive` returns the immutable ZIP, exact digest headers, and transactionally increments its response counter before the response is issued.
- The counter/header is explicitly named an archive response count; public copy must not call it an installation count, unique-user count, or popularity score.
- Missing or invalid identity maps to one typed error code and HTTP status. No legacy `/api/registry/records` alias remains.

### Production process and deployment

- Add the official Astro Node standalone adapter while retaining `output: "static"`. Only the English/Chinese Market list/detail routes and Registry endpoints opt out of prerendering; landing, documentation, downloads, and other public pages remain prebuilt.
- Reuse the existing Astro Market/detail components for server-rendered HyperText Markup Language (HTML); delete their `getStaticPaths()` and generated-TypeScript data consumption. This avoids both a client-only JavaScript baseline and a second Hono page renderer.
- Bundle the Astro Node standalone entry into one `opencorvus-web.mjs` runtime artifact and compile the database control/import command as a baseline-platform Bun executable. A direct Astro-to-Bun executable experiment could not resolve Astro's virtual client directory reliably, so the approved single bundled module plus pinned Bun runtime is the only server renderer; no parallel renderer exists. The release separates public static files from non-public application/migration material.
- Run it as `opencorvus-web.service` under a dedicated service identity, bound only to `127.0.0.1:4321`, with persistent state outside immutable releases and systemd hardening (`NoNewPrivileges`, strict filesystem protection, private temporary storage, bounded memory/processes, and one exact writable state directory).
- Caddy continues serving static routes directly and reverse-proxies `/market/**`, `/zh-cn/market/**`, and `/api/registry/v1/**` to the loopback Astro service without rewriting the public URI.
- Activation sequence:
  1. validate release bytes and the deterministic Registry seed;
  2. stop the Registry service and use `VACUUM INTO` (or Bun's SQLite backup API if directly supported by the pinned runtime) to create a consistent checksum-bound snapshot; never copy an open WAL database;
  3. copy missing immutable blobs and import the candidate publication transactionally without activating it;
  4. switch the static `current` symlink and activate the matching database publication;
  5. start the candidate website service;
  6. probe loopback static content, Registry health, list/detail, and archive byte binding through a non-counting internal readiness operation;
  7. probe public HTTPS after upload;
  8. on failure, stop the service, restore the previous database backup and static pointer, start the previous service, and prove both surfaces healthy before returning failure.
- First deployment additionally requires installing the reviewed systemd unit and the narrow service-control authority. That is a one-time server mutation and must be explicitly authorized before it is performed.
- Backups retain the active database snapshot, its digest, and a SHA-256 inventory of every content-addressed blob needed by that snapshot. Blob files are immutable and can safely remain after a failed import; garbage collection is not introduced in this round.
- The committed runbook defines per-deploy plus daily snapshot creation, seven daily plus four weekly local retention, exact off-host replication of the database and inventory-bound blobs, destination verification, and a real restore drill. The destination/credentials remain outside Git and require separate operational authority; a database-only copy is explicitly incomplete.

### Public page integration

- Render the existing English and Simplified Chinese Market list/detail information architecture on demand from the active database publication. Returned HTML contains the complete records before client JavaScript runs and remains crawlable and keyboard-operable.
- Remove `public-market-facts.generated.ts` from Market/detail request data flow. Deterministic import seed generation remains a build/deploy concern only.
- Add one exact-revision download action on the detail page whose URL contains namespace, id, version, and package digest and whose bytes come only from the database-backed Registry.
- The action exposes clear preparing/success/failure status text in both locales and does not claim installation or activation.
- The existing signed full-bundle action remains unchanged because it serves a different all-resource trust contract.

## Alternatives rejected

- **PostgreSQL on the current 1 GB single VPS:** adds a second daemon, authentication/backup/upgrade burden, and network database semantics without evidence of multi-host or multi-writer demand.
- **Store ZIP bytes in SQLite:** couples large immutable payload I/O and database backup size to metadata transactions; content-addressed files already provide the correct immutable-byte primitive.
- **Keep JSON/JSONL files and add an index:** preserves directory schema, non-transactional multi-file mutation, scan-based counts, and crash-recovery ambiguity.
- **Build a SQLite file in Continuous Integration and replace it on every deploy:** loses durable response counters and makes static deployment the database authority.
- **Expose the existing local upload routes:** lacks publisher identity, namespace ownership, moderation, abuse controls, key authority, and production CSRF/session durability.
- **Move the whole Astro site to server-side rendering in this round:** expands the failure and visual surface far beyond the database root cause. Astro on-demand rendering is limited to Market/detail/API routes while the rest of the site stays static.
- **Keep Market pages static and add only an API:** leaves build-time TypeScript as the visible fact source and makes the database an unused parallel architecture.

## Benchmark and verification contract

### Task definition

- Input: one validated website release containing deterministic Registry seed data and exact Expert Squad archives.
- Output: one active production publication queryable through on-demand Market pages and the live Registry API, with exact archive bytes and durable response-counter accounting, while the matching static website remains healthy.

### Environment

- Local: repository root, package dependencies, an isolated temporary Registry state directory, and a dedicated local port.
- Production-shaped local run: built website plus Registry service behind an isolated local Caddy-equivalent routing check where available; no user-owned process is touched.
- Production: existing GitHub `production` Environment, immutable RackNerd release root, persistent Registry state directory, loopback service, and public `https://opencorvus.com`.

### Timeout policy

- Focused database/API checks: fail after 60 seconds without process output or health progress.
- Build/standalone compilation: fail after 5 minutes without new output.
- GitHub Actions deployment: inspect by periodic bounded snapshots; treat 10 minutes without job-state or log progress as inactivity, not total elapsed time.
- Public health convergence: retry bounded HTTPS probes for the existing deployment window; never silently accept a partial static/API split.

### Executable acceptance

- DDL fingerprint and `PRAGMA integrity_check` pass.
- The initial import yields exactly the seed's 119 active revisions and matching agent/workflow/node/dependency counts, locale rows, archive references, and publication identity; the checker derives this total from the signed seed rather than retaining a historical magic number.
- Re-importing the same release is idempotent and preserves existing response counters.
- List/detail queries return the expected English and Simplified Chinese exact revision.
- Archive response bytes match stored byte length and SHA-256; one real response increases the archive response counter by exactly one.
- A production-shaped server restart preserves the active publication and response count.
- A scripted activation failure restores the prior static pointer, prior database digest, prior active publication, and healthy prior service.
- `bun run --cwd packages/web check`, the focused Registry/API/activation checks, the canonical website build, standalone executable compilation, and repository documentation checks pass.
- Real-page screenshots and manual visual review pass for both locales; browser console has no new site-origin error.
- Independent delivery review returns PASS with no unresolved finding.
- Push safety is satisfied; the deployment workflow succeeds; public health returns matching static release and Registry publication.

## Planned implementation slices

1. Add deterministic Registry seed generation and strict seed/archive cross-validation.
2. Replace the filesystem simulation with the SQLite Registry store, normalized DDL, typed API, importer, consistent snapshot, and service entrypoint. Delete simulation-only sessions, submissions, quarantine, JSON/JSONL storage, scripts, and obsolete tests.
3. Convert only Market/detail/API routes to Astro on-demand rendering from SQLite and add focused positive database/route/API/importer tests plus production-shaped service checks.
4. Add the exact-revision database download action and bilingual status copy without changing the broader Market layout.
5. Package the standalone Linux service, add Caddy/systemd/activation/rollback contracts, and update the runbook.
6. Run focused checks, build, local real API verification, real bilingual desktop screenshots, and human visual review.
7. Obtain independent read-only delivery review; repair and repeat review if needed.
8. Inspect the production host read-only, perform the authorized one-time service bootstrap through the documented boundary, then commit only owned files, inspect `origin/main..HEAD`, push, monitor GitHub Actions, and verify the public site plus Registry.
9. After database delivery acceptance, apply the repository's canonical `0.0.41-beta` package/version contract, create the requested `v0.0.41beta` release branch representation, trigger the existing Release workflow, and verify all native binary assets plus the website deployment.

## Implementation and verification evidence

- `bun run --cwd packages/web test:registry`: PASS; 2 real SQLite lifecycle tests and 28 assertions cover signed-catalog tampering, complete publication-projection idempotency, normalized relationship counts, restart-persistent response counters, missing-counter failure, disposition-count drift, consistent snapshot/restore, corrupt/missing blobs, normalized-row drift, and immutable-version conflict.
- `bash deploy/racknerd/test-opencorvus-activate-release.sh`: PASS; the Linux fixture covers signed-manifest activation, transactionally updated activator, root-only rollback evidence, pre-migration snapshot, static/database rollback, service/timer state, shared operation locking, bounded retention, and blob inventory verification. `visudo -cf deploy/racknerd/opencorvus-deploy.sudoers` also parses successfully.
- `bun run --cwd packages/web check`: PASS with zero errors; remaining diagnostics are existing/dependency hints, including Bun's deprecated overload annotation rather than a runtime failure.
- `bun run --cwd packages/web build`: PASS; Astro keeps non-Market routes static and emits on-demand Market/API routes, then packages `client/` and the single server artifact/control/seed/deploy contract.
- `bun run --cwd packages/web runtime:smoke`: PASS against the freshly packaged server; readiness reports 119 rows, English/Chinese Market and detail routes and APIs return real bodies, and exact archive bytes match `8c2262949713fc69ca12dd7b1136569fc926f577b10296b9e96565c1b8be1913`.
- `bun run packages/web/test/signing-workflow-integration.ts`: PASS against the fresh artifact, including the exact `client/` + `server/` manifest and its backup/sudo contracts; two bootstrap runs are byte-identical and daily renewal remains distinct.
- The removed files are the complete filesystem simulation, simulation server, its session/quarantine/JSONL tests, and the obsolete static deployment integration checker. The website request path has no runtime import of `public-market-facts.generated.ts`.
- Final real-page desktop acceptance used the freshly packaged Bun/Astro runtime on isolated loopback port `4329` at a 1280×720 viewport. Five screenshots were regenerated after all contrast/status fixes: `specs/artifacts/2026-08-12-website-database-backend/01-market-en.png`, `02-market-zh-cn.png`, `03-detail-en.png`, `04-detail-zh-cn.png`, and `05-docs-quickstart-en.png`. The two Market screenshots were finally rebuilt against the public 119-resource signed publication with the repository's committed `expert-squad-ed25519-2026-08-11` public trust root: English showed “The signed catalog matches the content-addressed bundle.” and Chinese showed “签名目录与内容寻址资源包已经匹配。”, both download actions were enabled, widths were 1265/1280 with no horizontal overflow, and no warning/error was captured. The temporary public trust-root/catalog binding was then removed by regenerating the normal unconfigured local source; no temporary generated-key diff is part of the delivery.
- The English and Chinese exact-revision actions were both clicked on the real page. The bounded archive response completed, created a browser download, and exposed the visible `aria-live` completion text (“The exact ZIP was received in full and the browser download was created.” / “精确 ZIP 已完整接收，浏览器下载已创建。”). Both detail screenshots preserve that final state. All five pages reported document width equal to viewport width and no captured site-origin console warning/error. Human review found the SHA-256 explanation legible on the dark revision card after its color moved from the 2.93:1 inherited gray to the high-contrast revision-card text token; header, hero, calls to action, bilingual copy, topology entry, and docs columns remained visually coherent.
- Production host inventory, public deployment evidence, independent delivery review, and release evidence remain open acceptance gates at this point.

### Independent delivery-review repairs applied

- Removed the real static/database dual source, then removed the dead generated facts artifact and filesystem simulation completely.
- Tightened seed/catalog comparison to every identity, disposition, archive, locale, agent, workflow, node, dependency, capability, and count field; readiness reconstructs normalized facts and fails closed on projection, counter, disposition-total, or blob drift.
- Bound the complete deployment artifact to an Ed25519-signed exact manifest and a root-pinned public key. The deploy SSH account can write only `incoming`; releases/pointers are root-owned, and inbox bytes are copied to root-only scratch before verification.
- Moved all root-trusted rollback material out of the web-writable state root, added rollback restoration of the activator itself, fixed the production environment/PATH boundary, and committed an `env_reset`/`NOSETENV` sudo rule.
- Serialized activation/rollback/daily backup, made post-commit cleanup non-fatal, bounded local retention, and added the blob inventory required for complete off-host disaster recovery.
- Added the focused Registry lifecycle suite to the production deployment workflow, pinned the CI control executable to the baseline Linux target, updated current architecture authority, and regenerated real bilingual visual evidence after interaction.

## Risks and controls

- **Static/API release split:** active publication changes only inside the activation transaction coordinated with the static symlink; rollback restores both.
- **Schema migration rollback:** stop the only service, create and checksum a consistent SQLite snapshot, and restore it before restarting the previous binary.
- **Blob corruption:** verify SHA-256 and byte length at import; use content-addressed immutable names; fail closed on every read disagreement.
- **WAL growth:** enable automatic bounded checkpoints, `synchronous=FULL`, a small bounded cache, and WAL size diagnostics; never place the database on a network filesystem.
- **Database loss:** persistent state is outside pruned immutable releases; each activation creates a verified backup; operational backup/restore commands are documented and tested.
- **Public-write abuse:** no public write route in this round.
- **Low-memory VPS:** one baseline standalone Bun process, SQLite, prepared statements, and bounded response/query sizes; no PostgreSQL daemon.
- **Visual regression:** the database round changes only the exact-revision action/status surface and is accepted on real English and Chinese pages.
- **Git contamination:** stage only owned paths and stop before push if pre-existing commits cannot be proven authorized and reviewed.

## Independent plan review

Verdict: `APPROVED`.

Approval rationale:

- On-demand Market/detail/API reads have one active SQLite publication; generated TypeScript and the filesystem simulation are removed from runtime ownership.
- The signed catalog/bundle remains a separate desktop bulk-trust contract, and CI signing keys never enter production.
- Normalized schema constraints, publication membership, a singleton active pointer, strict DDL identity, and same-version digest conflicts provide adequate immutability.
- Persistent blobs/database, consistent snapshots, coordinated release/publication activation, and complete failure restoration cover the production lifecycle on the single 1 GB VPS.
- Focused real checks, bilingual manual visual acceptance, and independent delivery review are explicit delivery gates.

Non-blocking implementation guidance accepted as executable detail:

1. Count an archive response only after blob hash/size validation and immediately before issuing a successful 200 response; do not describe it as a completed client download.
2. The non-counting readiness check must reuse the same store/service primitive or a loopback-only internal contract, never a second public archive route.
3. Caddy matchers must cover `/market`, `/market/**`, `/zh-cn/market`, `/zh-cn/market/**`, and encoded/query-bearing requests.
4. The production artifact smoke check must prove dynamic chunks, static asset resolution, locale routes, streaming archive delivery, and memory bounds. If standalone Bun compilation is not reliable for the pinned Astro stack, ship the one Node standalone artifact plus its runtime; do not create a parallel renderer.
5. Seed validation must rebuild and compare the complete database projection from canonical signed archive content, including locale, agents, workflows, nodes, and dependencies—not only archive references.

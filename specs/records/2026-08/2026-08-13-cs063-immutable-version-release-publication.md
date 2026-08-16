# CS-063 — Immutable version Release publication

## Recall

- User requirement: finish the accepted code-smell remediation list to zero, use disjoint parallel work where safe, require focused positive evidence and uninvolved review for every implementation, merge upstream before the final push, and never overwrite unrelated worktree changes.
- Accepted finding: rerunning `.github/workflows/build.yml` for an already-public version unconditionally executes `gh release upload ... --clobber`, then unconditionally edits the Release to public. One version URL can therefore change bytes or temporarily expose a mixture of assets from different runs.
- Acceptance target: one version Release occurrence is bound to an exact tag commit and complete staged digest manifest. A draft can be reconciled and verified before visibility; an already-public exact replay is a no-op; any public source or payload drift is one typed conflict and performs no mutation.
- Hard constraints: no public `--clobber`, no per-file public replacement, no tag-only identity, no parallel workflow writer for one version, no English CLI-output parser as authority, no second manifest/fallback reader, no mutation of the intentionally mutable desktop channel contract, no external GitHub writes in tests, no UI work or UI automation.
- Sources read:
  - root `AGENTS.md` and the `CS-063` accepted audit entry;
  - `.github/workflows/build.yml`, especially `prepare`, `publish-release-assets`, and `publish-release`;
  - `script/{stage-release-upload-assets,generate-desktop-update-manifest,desktop-update-channel,release-asset-contract}.ts` and their focused tests;
  - `script/github-actions-workflow-contract.test.ts`, `docs/packaging.md`, and `specs/current/architecture/public-website.md`;
  - root dependency catalog and the existing `@octokit/rest` dependency;
  - GitHub's official REST documentation for [Releases](https://docs.github.com/en/rest/releases/releases) and [Release assets](https://docs.github.com/en/rest/releases/assets), including draft state, tag/target metadata, asset membership, upload/delete operations, and the returned asset `state`, `size`, and `digest` (`sha256:...`).
- Whole-repository findings:
  - `prepare` already computes the exact checked-out commit as `source-sha`, but neither publication job binds the Release/tag/assets to it;
  - asset staging already rejects duplicate names and validates every platform's required GUI/Command-Line Interface (CLI) artifacts before upload;
  - `latest.json` and `SHA256SUMS` are generated only after the complete staging set exists, but neither is an occurrence receipt that binds tag/source and exact membership;
  - the workflow checks only whether the Release exists. It does not distinguish draft/public, validate the tag commit, or inspect remote asset digests;
  - `publish-release-assets` mutates assets one-by-one with `--clobber`; if the Release is already public those partial mutations are immediately visible;
  - `publish-release` separately makes the Release public without revalidating the remote set, then overwrites only the deliberately mutable `desktop-update-{beta|stable}/latest.json` channel;
  - there is no release-specific workflow concurrency group, so tag and manual reruns for the same version can race;
  - workflow tests currently lock step text/composition rather than the actual publication state machine;
  - GitHub's current REST asset representation supplies the server-observed SHA-256 digest needed to verify uploaded bytes without trusting a filename or upload success alone.
- Current dirty-worktree boundary: `CS-004` owns Tool/Permission/Session/storage changes; Browser MCP owns Browser/Workspace/extension architecture; `CS-007/008` own Overlay/root verification. This task is restricted to Release workflow/scripts/tests/packaging docs plus its isolated record and indexes. Recheck before implementation.
- Independent-agent feedback: none yet. An uninvolved plan review is required before implementation.

## Observable failure and root cause

The workflow treats a Release tag as both mutable staging area and public identity. A rerun rebuilds signed binaries with the current toolchain, uploads every asset with replacement semantics, and only afterwards calls `release edit --draft=false`. If the Release is already public, replacement begins immediately. A failed run can leave new installers beside old signatures/checksums/manifest. The stable tag does not make the bytes stable.

The direct bug is the `--clobber` command, but deleting that flag alone only turns retries into name-collision failures and leaves no verified replay contract. Splitting upload and publication into two shell steps also leaves two composition owners: neither owns the complete local manifest, exact remote set, source commit, draft recovery, public replay, and publish transition together.

## Target single authority

### 1. Canonical local publication manifest

Add one strict, versioned `ReleasePublicationManifest` owned by a new root script/module, for example `script/release-publication.ts`:

```ts
type ReleasePublicationManifestV1 = {
  schema_version: 1
  repository: string
  tag: `v${string}`
  version: string
  source_commit_sha: string // exactly 40 lower-case hex
  release: {
    name: string
    body: string
    prerelease: boolean
  }
  assets: Array<{
    name: string
    size: number
    sha256: string // exactly 64 lower-case hex
  }>
}
```

The module scans the already-complete staged directory, rejects symlinks/non-files, duplicate or unsafe basenames, non-finite/unsafe sizes, and reserved manifest-name collisions, and sorts assets by Unicode code-unit name. Accepted names use the strict GitHub-stable ASCII basename grammar `[A-Za-z0-9](?:[A-Za-z0-9._+-]*[A-Za-z0-9_+-])?`: no path separator, whitespace/control character, leading/trailing period, consecutive path component, Unicode normalization ambiguity or GitHub-special character is allowed. The upload response and every subsequent listing must return the exact same name; any server rename is a typed transport/contract failure before publication. It computes SHA-256 by streaming bytes. The manifest includes every public version asset present before itself, including `latest.json`, `SHA256SUMS`, `LICENSE`, notices, installers, signatures and CLI archives. It is canonical JSON with a final newline and is uploaded as `RELEASE-PUBLICATION.json`.

Release metadata is deterministic local input owned by the same manifest: `name` is exact `v${version}`, `body` is canonical static Markdown generated locally from an explicit version/source template (or exact reviewed local notes bytes supplied to the command), and `prerelease` comes from the existing semver authority. The workflow does not invoke GitHub generated notes or accept server-generated body text. The initial draft create, draft reconciliation and public transition all write only this tuple, then re-read it exactly. GitHub's request-only `make_latest` parameter is not returned as release-local state and therefore cannot enter immutable identity; every version create/update deterministically sends `make_latest:"false"` to avoid changing the repository-global Latest selection. Any future Latest promotion is a separate explicitly mutable post-public channel, like desktop channel metadata, and cannot affect the version occurrence receipt.

The manifest intentionally excludes its own entry to avoid self-reference. The expected remote set is exactly `manifest.assets` plus `RELEASE-PUBLICATION.json`; the latter's expected size/SHA-256 comes from the canonical bytes the same owner just produced. There is no second asset-name list, workflow glob authority, generated-notes authority, or `SHA256SUMS` fallback. `SHA256SUMS` remains a user-facing checksum asset and is itself covered by the publication manifest.

The one occurrence identity is `{repository, tag, source_commit_sha, sha256(canonical manifest bytes)}`. The manifest contains no token, upload URL, runner path, signing secret, or mutable timestamp. `latest.json` may contain its established deterministic publication date derived from the source commit; that date is part of its bytes and therefore covered.

### 2. One GitHub Release publication state machine

Use `@octokit/rest` behind a narrow `GitHubReleasePublicationPort`. Production constructs the port from `GITHUB_TOKEN`, `GITHUB_API_URL`/the repository identity, and GitHub's versioned REST API. Tests use the same state machine with a loopback HTTP GitHub fixture; they do not call the user's repository or `gh`.

Define typed errors with stable codes and secret-free fields:

- `ReleasePublicationContractError`: invalid local manifest/input;
- `ReleasePublicationConflictError` with `code` in `tag_source_mismatch | public_manifest_missing | public_asset_membership_mismatch | public_asset_digest_mismatch | public_release_metadata_mismatch | draft_source_mismatch` and exact safe tag/name/expected/observed digest fields;
- `ReleasePublicationTransportError`: API/upload/download failure with safe operation/status, never token/body secrets.

The state machine executes:

1. Resolve `refs/tags/<tag>` through Git's REST authority on **every observation boundary**: `GET /git/ref/tags/{tag}`, then when the returned object is a tag recursively `GET /git/tags/{sha}` until an exact commit object is reached. Reject non-commit terminals, cycles or depth beyond the fixed bound. `Release.target_commitish` is display/request metadata only and is never source evidence because GitHub ignores it for an existing tag and it may name a moving branch. If the ref does not exist, create the exact `refs/tags/<tag>` with `POST /git/refs {sha: source_commit_sha}` before creating a draft; a 409 conflict is not success but a race signal followed by the same canonical re-read/resolve. Immediately require the resolved commit to equal the supplied full source SHA. Existing draft or public tags must already resolve to that SHA. Re-resolve after draft upload, immediately before public transition, and after public transition; tag retarget at any point fails conflict without publish/update.
2. Get the Release by tag and **all** exact remote assets. The port's `iterateReleaseAssets` exhausts every REST page (Octokit pagination in production) until completion; a partial/default first page is never accepted. Release identity must match tag plus the manifest's exact `name`, `body` and `prerelease` tuple, while source identity comes only from the canonical ref/tag resolver above. A draft on the same source is recoverable: metadata drift is reconciled by one draft-only update followed by exact re-read before asset work. A public Release is immutable under this application contract regardless of GitHub's optional repository-level `immutable` flag; any observable metadata drift is `public_release_metadata_mismatch` with zero writes.
3. Public Release:
   - download/parse the one strict `RELEASE-PUBLICATION.json` asset;
   - require its canonical bytes/digest to equal the local manifest;
   - require exact fully paginated remote asset membership, exact unrenamed names, `state=uploaded`, size, and GitHub `sha256:` digest for every manifest entry and the manifest itself;
   - exact equality returns `{kind:"public_noop", ...receipt}` and performs zero writes;
   - any difference throws one typed conflict before upload/delete/update.
4. Draft Release on the same source:
   - exact remote equality returns `draft_ready` without writes;
   - any incomplete/mismatched set is recoverable because it is not public. Under the workflow's per-version concurrency owner, delete the draft's fully paginated current asset set, upload the complete local set in canonical order with `RELEASE-PUBLICATION.json` last, and never use replacement/clobber semantics;
   - require every upload response to be `uploaded` with the exact unchanged name/size/digest, then re-list all pages and verify exact membership/digests from GitHub. A failure leaves the Release draft and returns a typed transport error. A later rerun reconciles the whole draft again; it never trusts a partial prior set.
5. Publish transition:
   - in the same production command/process, immediately re-read and verify the exact draft occurrence, then update only `draft=false` while resubmitting the same manifest-bound metadata tuple;
   - re-read the now-public Release and verify the same source, canonical manifest and complete remote set; return `{kind:"published", ...receipt}`;
   - if the Release became public before this owner obtained the transition, apply the public exact-replay rule: exact is `public_noop`, drift is conflict.

GitHub does not provide a multi-asset atomic upload transaction. The visibility boundary is therefore the draft-to-public transition: asset replacement is permitted only while draft/private, and public visibility occurs only after the complete remote set has been verified. The workflow and docs must not claim the individual draft uploads are atomic.

### 3. One workflow writer per version

Add job-level concurrency on the **sole publication writer**, keyed by `needs.prepare.outputs.version` with `cancel-in-progress: false`. `prepare` is the one normalization owner that strips an optional leading `v`, so tag and either accepted manual spelling for the same version share one group; different versions may run concurrently. The read-only packaging matrices need not hold this lock and may run concurrently, but no other job mutates the version Release. The publication authority still rechecks external state because Actions concurrency is not a database lock against administrators or other credentials. Do not use workflow-level `github.ref_name`/raw input concurrency, which cannot consume the normalized `prepare` output and would split `vX` from `X`.

Collapse version asset reconciliation and draft publication into one `publish-release` job after both packaging matrices. That job:

1. checks out the same source commit and installs the script runtime;
2. downloads/stages validated artifacts, copies fixed legal files, generates `latest.json` and `SHA256SUMS` exactly once;
3. calls the one `release-publication.ts publish` command with exact repository/version/source/prerelease/staged directory;
4. consumes the machine JSON receipt, not prose, and only after `published | public_noop` updates the mutable desktop channel and dispatches the website event.

Delete the versioned Release `gh release create/upload/edit` shell composition and all version `--clobber`. Do not add another shell fallback. The channel Release remains a separate, explicitly mutable identity; its single `latest.json --clobber` is retained and documented as outside the immutable version Release occurrence.

If preserving two job names is operationally required, only one may perform the full version publication and return its durable public receipt; the other may consume that receipt for channel/dispatch and must not independently inspect or mutate the version Release. The preferred bounded implementation is one job because it removes the split owner.

### 4. Documentation and downstream ordering

Update `docs/packaging.md` to state:

- Actions artifacts are temporary inputs, not public identity;
- `RELEASE-PUBLICATION.json` binds the version tag commit and exact public asset bytes;
- a version draft may be repaired before publication, but a public version Release is application-immutable;
- identical public reruns are no-op, changed reruns fail with typed conflict;
- desktop channel metadata remains intentionally mutable and is updated only after the exact version Release receipt is public.

No OpenAPI, generated SDK, application database or runtime migration changes are expected. `specs/current/architecture/public-website.md` changes only if it currently claims a different Release ordering; otherwise packaging docs are the canonical delivery reference.

## Complete affected surface

- `.github/workflows/build.yml`: one per-version concurrency key and one version publication composition.
- `script/release-publication.ts` (new): strict manifest, typed state machine, Octokit port/CLI and machine receipt.
- `script/release-publication.test.ts` (new): real local files plus loopback GitHub REST fixture.
- `script/github-actions-workflow-contract.test.ts`: assert the positive one-authority job/receipt/concurrency composition rather than frozen old shell text.
- Existing release staging/update-manifest/checksum tests remain and may be composed by the new focused test.
- `docs/packaging.md`, this record, `specs/README.md`, and `specs/records/2026-08/README.md`.
- Root/package dependency files only if `@octokit/rest` is not already available to root scripts through a declared dependency. The root catalog entry alone is not a dependency declaration; implementation must add it to the correct root development dependency surface through the package manager if required, then update the lockfile canonically.
- Excluded: channel-tag mutability, signing key management, packaging formats, updater schema, public website deployment internals, generated source checks (`CS-008/014/017`), Releases created outside this workflow, and GitHub repository-level immutable-release settings.

## Positive verification

1. Build a real staged directory containing representative installer, signature, CLI, legal, `latest.json` and `SHA256SUMS` files. Generate the strict manifest twice with different filesystem enumeration/creation order; assert identical canonical bytes, digest, occurrence identity and exact sorted membership.
2. Run the production state machine against a loopback REST fixture implementing the GitHub endpoints used by production:
   - absent Release/tag creation at the supplied source, full draft upload, exact remote verification, publish transition and final public receipt;
   - incomplete/mixed draft from a simulated interrupted upload, followed by a rerun that replaces only the private draft set, verifies the exact complete manifest, then publishes;
   - identical draft replay returning `draft_ready` with zero mutation before publication;
   - identical public replay returning `public_noop` with zero create/delete/upload/update calls;
   - public changed bytes, missing/extra asset, manifest drift, prerelease drift and source-tag drift, each returning its exact typed conflict while preserving the entire remote snapshot byte-for-byte;
   - public `name`, `body` or `prerelease` drift returning `public_release_metadata_mismatch` with the entire remote snapshot and mutation counters unchanged; draft metadata drift performing only the exact draft metadata update, re-reading it, then continuing publication; every create/update request records `make_latest:"false"`, with no assertion that this unobservable request parameter is persisted release identity;
   - upload failure after at least one draft asset keeps `draft=true`; a later full retry converges and no partial public snapshot is ever observed.
   - a forced 101-plus-asset Release spread across multiple REST pages, where an extra/missing/drifted asset only on page two returns the exact public conflict with zero mutation and a draft reconciliation deletes/verifies every page.
3. Exercise lightweight and nested annotated-tag dereference and tag/source mismatch through the same production port. Assert a bounded/cyclic or non-commit tag returns a typed contract/conflict and performs no Release mutation. Race absent-tag creation with a fixture `POST /git/refs` 409 that installs a different commit, then prove canonical re-read rejects it. Retarget the tag after draft upload but before publish and assert source conflict with zero Release publish/update. Feed every rejected filename boundary plus a simulated upload response name rewrite and assert the exact safe-name/transport error while the Release remains draft.
4. Parse the actual workflow and assert the sole writer job's concurrency group consumes exact `needs.prepare.outputs.version` with cancellation disabled, both tag/manual paths feed the same normalization owner, the sole version publication step invokes the production command with `source-sha` and deterministic manifest-bound release metadata, and channel promotion/website dispatch depend on its public receipt. The production command is the only notes/name owner; no workflow step asks GitHub to generate notes, and every version create/update request uses the fixed non-promoting `make_latest:false` policy. This is a positive current composition contract, not a source substring assertion that an old command is absent.
5. Run current asset staging, desktop manifest, Release asset contract and workflow tests; root typecheck or script typecheck surface; documentation checker; workflow/YAML checker if present; exact task-owned `git diff --check`.
6. Obtain an uninvolved read-only delivery review of code, workflow diff, fixture behavior, docs and evidence; repair and re-review until PASS before creating an exact commit.

No test writes to GitHub, uses the user's token, publishes a Release, or runs UI automation.

## Risks and ordering

- Large Release assets make fixture downloads unsuitable. Production verification uses GitHub's server-observed SHA-256 digest/size; the fixture uses small bytes but the same response schema and state machine. If the deployed GitHub API does not return a digest for an uploaded asset, fail closed rather than trusting size or adding a download fallback.
- A failed draft reconciliation may leave no assets or a partial private set. This is acceptable and recoverable because the Release remains draft; publish is unreachable until full verification succeeds.
- Workflow concurrency prevents supported reruns from racing, but a privileged external actor can still mutate a draft. The authority therefore re-lists immediately before publication. Public mutation outside this workflow is outside the application owner and will be detected as conflict on the next observation.
- The website dispatch and mutable channel upload must occur only after the public exact receipt. Their failure does not authorize changing the already-public version assets; rerun observes `public_noop` and retries only downstream mutable operations.
- Do not mix `CS-008/014/017` verification refactors or unrelated action upgrades into this change.
- Recheck `.github/workflows/build.yml`, root dependencies/lockfile, workflow contract test and indexes immediately before implementation; stop on overlapping unreviewed hunks.

## Delivery state

- Recall, current source/control flow, root cause, target manifest/state machine, workflow ownership, public/draft semantics, affected surfaces, positive verification and risks are complete.
- Focused independent plan review is pending.
- Production implementation, focused evidence, delivery review, commit, final upstream merge and push have not started.

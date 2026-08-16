# CS-014 — One-way Transport Protocol → SDK source topology

## Recall

- User requirement: finish every accepted code-smell remediation with root-cause analysis, one current authority, focused positive production evidence, uninvolved review, exact commits, an upstream merge before the final push, and a final remaining count of zero.
- Accepted finding: `@opencorvus-ai/transport-protocol` imports `ProductPillarSchema` from the generated/public Software Development Kit (SDK), while the SDK build reads `transport-protocol/src/index.ts` as text, finds comment markers, slices the route-policy block, and publishes a copied `src/route-policy.ts`. This is a real source-topology cycle even though the package manager sees only one module edge.
- Acceptance target: Transport Protocol is independently typecheckable before the SDK; it owns the Product Pillar and server route-directory policy exactly once; SDK depends one-way on the declared package root and never reads Transport Protocol source layout. A clean dependency build and repeated SDK generation observe one exact structured policy receipt/digest.
- Hard constraints: no source marker/text slicing, no copied route-policy implementation, no Product Pillar duplicate, no compatibility/fallback reader, no private relative package import, no hidden prepare-order dependency, no UI changes or UI automation, and no unrelated OpenAPI/domain rewrite.
- Sources read:
  - root `AGENTS.md`, the `CS-014` accepted audit entry and remediation program;
  - `packages/transport-protocol/{package.json,tsconfig.json,src/index.ts,test/contract.test.ts}`;
  - `packages/sdk/js/{package.json,tsconfig.json,script/build.ts,src/client.ts,src/route-policy.ts,src/expert-squad-manifest-v1.ts}` and SDK Product Pillar/authoring tests;
  - root `turbo.json`, generated-artifact registry and build/package scripts;
  - all repository imports of `ProductPillar`, `routeRequiresProjectDirectory`, both package names, generated route policy and SDK expert-squad exports.
- Whole-repository findings:
  - Transport Protocol's only SDK dependency is the Product Pillar import/re-export at the top of `src/index.ts`; the protocol already uses that schema in Composer Intent, Work Ledger and related transport contracts.
  - SDK owns the complete Expert Squad manifest but Product Pillar itself is a two-value cross-domain primitive (`code | work`) already exposed through Transport Protocol to Overlay and server consumers.
  - `sdk/js/script/build.ts` reads the private absolute path `packages/transport-protocol/src/index.ts`, locates `// ── Server route directory policy ──` and `// ── Host native commands ──`, and copies the intervening TypeScript source into `sdk/js/src/route-policy.ts`.
  - SDK `src/client.ts` consumes only the copied `routeRequiresProjectDirectory`; OpenCorvus server and Overlay already consume the original package export. Thus two runtime implementations can drift even though regeneration usually overwrites one.
  - Transport Protocol is private/source-exported and has no build output; SDK emits NodeNext `dist` and its current manifest has no Transport Protocol dependency. The target must make the dependency and package boundary explicit rather than relying on root source conditions.
  - `turbo` can derive one-way workspace order from declared dependencies, but the current root typecheck has no build dependency and source exports mean a clean typecheck is the relevant first topology proof. SDK packaging also needs a local packed-pair import check because a standalone SDK tarball cannot rely on an undeclared workspace.
- Current worktree boundary: `CS-004` is modifying SDK/OpenAPI generated files and `CS-008` is modifying root manifests/Knip/lockfile. This task is planning-only until both owners commit; implementation must recheck and then own Transport Protocol, SDK package/build/client/Product-Pillar files and the exact package-manager lock hunks. Browser/Workspace and Overlay UI paths remain excluded.
- Independent-agent feedback: none yet. An uninvolved focused plan review is required before implementation.

## Observable failure and root cause

A clean package graph cannot order these sources truthfully. Transport Protocol needs an SDK source file before it can typecheck, while the SDK generator needs a particular private Transport Protocol file and two comments before it can regenerate. Moving the policy to another file, rewording a marker, publishing either package independently, or clearing generated output breaks a relationship that neither manifest declares.

The underlying problem is misplaced ownership, not a missing build step. Product Pillar is foundational transport/domain vocabulary but lives in an upward generated package. Route-directory policy is already foundational protocol behavior, yet the SDK keeps a generated executable clone because its client does not declare the protocol dependency. Workspace order and checked-in generated output only hide both reverse edges.

## Target single authority

### 1. Transport Protocol owns Product Pillar

Define and export `ProductPillarSchema`, `ProductPillar`, and the canonical ordered `PRODUCT_PILLARS` tuple in Transport Protocol. The existing Composer Intent, Work Ledger and transport schemas consume that same local object. Remove Transport Protocol's SDK dependency entirely.

SDK `expert-squad-manifest-v1.ts` imports and re-exports the exact Transport Protocol schema/type, then builds `ProductPillarsSchema` and the rest of Expert Squad Manifest V1 around it. This preserves the intentional SDK subpath API without keeping a second enum or parser. OpenCorvus imports may continue using the SDK re-export where the complete Expert Squad contract is the natural dependency; transport/Overlay consumers use Transport Protocol. Both paths resolve the same object identity inside one module graph.

Do not move the whole Expert Squad manifest into Transport Protocol: namespace/version/projection/authoring rules are SDK domain contracts and are not required by the foundational transport package. The shared primitive is proven by multiple protocol consumers and one manifest consumer, so extracting only Product Pillar is the minimum single authority.

### 2. Transport Protocol owns one structured route policy

Move the server route-directory policy from the monolithic index into a public package module, for example `src/route-policy.ts`, and re-export it from the package root. That module owns:

- a strict versioned, deeply immutable `ServerRouteDirectoryPolicyManifestV1` containing the exact bypass paths (including bare `/global`, `/auth`, and `/ui` roots), slash-prefix bypasses, accepted methods, omitted/unsupported-method normalization rule, ordered evaluation steps, method gates and the two special dynamic route pattern sources;
- `normalizedServerRoutePath`, exported `normalizedServerRouteMethod` and `routeRequiresProjectDirectory`, whose normalization and decisions are derived only from that manifest;
- a canonical JSON receipt function or constant over the JSON-domain manifest. Tests compute SHA-256 over those canonical bytes to bind clean builds/generation evidence; runtime routing does not need a hash lookup.

The manifest records the current method contract exactly: absent, empty or unsupported methods normalize to `GET`; supported methods normalize by uppercase membership in the ordered accepted-method tuple. Its ordered evaluation program is data, not another handwritten branch list: exact-path bypass, method-gated Task-record read, method-gated Channel-attachment read, prefix bypass, then project-directory required. Regexes are constructed from the manifest's canonical source strings, not separately handwritten beside it. Arrays retain explicit semantic order, are duplicate-checked by the schema/constructor, and are frozen. The manifest contains no functions, `RegExp` objects, filesystem paths or source markers, so downstream tooling may consume it without parsing TypeScript layout. `normalizedServerRouteMethod` and `routeRequiresProjectDirectory` may implement this program but cannot carry a second bare-root list, default method, evaluation order or method gate beside it.

SDK `src/client.ts` imports `routeRequiresProjectDirectory` from the declared `@opencorvus-ai/transport-protocol` package root. Delete SDK `src/route-policy.ts`; do not leave a re-export shim. Server and Overlay continue importing the same root export. There is then one executable route decision authority for all three consumers.

### 3. Delete source-text generation and declare the one-way package edge

Remove from `sdk/js/script/build.ts`:

- `routePolicySourcePath` and the private source-file read;
- marker lookup and `generatedRoutePolicySource()`;
- transaction/staging writes for `src/route-policy.ts`;
- generated artifact publication of that file.

Remove the route-policy target from the repository generated-artifact registry if it is enumerated there. SDK generation remains responsible for OpenAPI client code, server defaults and the independently tracked platform-Artifact tool IDs; those sources are separate accepted findings and are not rewritten here.

Declare `@opencorvus-ai/transport-protocol: workspace:*` in SDK dependencies and remove `@opencorvus-ai/sdk` from Transport Protocol dependencies. Update the lockfile through the package manager after the concurrent root-manifest owner is clear. The final graph is:

```text
Transport Protocol (Product Pillar + route policy)
                    ↓
SDK (Expert Squad manifest + generated API client)
                    ↓
application consumers
```

Transport Protocol must not import SDK directly, dynamically, through type-only paths, test helpers or generated output. SDK build may import the public package normally for its own typecheck/runtime code, but it must not open any Transport Protocol file by filesystem path.

### 4. Clean-build and package evidence

Add a non-UI topology contract test/checker that reads workspace manifests and the SDK build's declared file inputs through structured configuration, then returns a typed receipt containing:

- exact directed workspace edge `sdk -> transport-protocol`;
- Transport Protocol's zero SDK edges;
- one versioned route-policy manifest canonical digest;
- exact SDK build generated targets, which no longer include route policy;
- exact Product Pillar values observed through both public roots with shared runtime schema identity.

This is a positive current topology receipt, not a grep assertion that old markers are absent. The checker must fail with a typed topology/manifest mismatch if the public graph or structured policy receipt drifts.

Transport Protocol becomes a real build artifact in this task. Its emit/build TypeScript configuration uses `module: NodeNext` and `moduleResolution: NodeNext` (or a separately demonstrated equivalent plain-Node ESM mode), enables declaration output, and does not inherit the current `noEmit: true` Bundler-only behavior. Every local import/re-export reachable from emitted `dist` uses a Node-valid `.js` source specifier — at minimum the root re-export is `./route-policy.js`; implementation must audit every added/moved local edge rather than relying on TypeScript's Bundler resolver. The package build emits ESM JavaScript and declarations under `dist`; `files` contains only `dist` plus package metadata, and the root export has the same shape as the SDK (`source: ./src/index.ts` for workspace-aware development, `types: ./dist/index.d.ts`, and `import`/`default: ./dist/index.js` for packed/plain-Node consumers). The manifest gains the exact TypeScript build/prepack lifecycle required to produce those files. It may remain `private: true` because this task does not authorize npm publication, but `npm pack --json`/`bun pm pack` staging must still produce the reviewed tarball contents. SDK declares the exact workspace runtime dependency, and root/Turbo/package scripts build Transport Protocol before SDK build or pack through that declared edge.

For standalone package evidence, build and pack both Transport Protocol and SDK into an isolated temporary package installation using their reviewed package manifests/tarballs, install the SDK together with its exact Transport Protocol dependency, and import them with plain Node (not Bun and not a source-capable workspace resolver). The command is ordinary `node` with no TypeScript/tsx loader, no `--conditions=source`, no `--experimental-specifier-resolution` and no other resolver flag:

- SDK root/client and Expert Squad manifest subpath;
- Transport Protocol root route policy and Product Pillar;
- an SDK client request that exercises directory injection through the Transport Protocol policy.

The test proves the declared dependency pair works without monorepo source aliases or pre-existing generated route policy. It does not publish either package or add a fallback bundle. It asserts each tarball's exact file membership, Transport Protocol root export map, SDK runtime dependency/version, and successful plain-Node resolution from the isolated installation. Whether npm publication is enabled remains a release-policy decision, but the staged artifacts themselves are unconditionally required to be independently importable.

## Complete affected surface

- `packages/transport-protocol/src/index.ts` and new `src/route-policy.ts`: local Product Pillar and structured route policy authority/re-export.
- `packages/transport-protocol/package.json`, TypeScript emit configuration, unconditional `dist`/`files`/root-export/build metadata, and focused contract/topology tests.
- `packages/sdk/js/src/{client.ts,expert-squad-manifest-v1.ts}`; delete generated `src/route-policy.ts` without a shim.
- `packages/sdk/js/script/build.ts`, SDK package manifest, generated-artifact registry if it lists the deleted target, and focused generation/package tests.
- Root lockfile only through a canonical install after concurrent dependency work is merged.
- Architecture/package docs, this record and both spec indexes.
- Excluded: OpenAPI schema/route generation, platform Artifact tool-ID generation (`CS-019` if applicable), general generated-source transaction recovery (`CS-065`), SDK server lifecycle (`CS-011/032`), Expert Squad authoring/distribution (`CS-016`), Plugin package staging (`CS-015`), UI and route behavior changes.

No database, HTTP route, OpenAPI response or durable data migration is expected. The public Product Pillar and route-policy values/behavior remain byte-for-byte semantic equivalents; only ownership and package topology change.

## Positive verification

1. Import Product Pillar through Transport Protocol and the SDK Expert Squad manifest subpath in one real module graph. Assert both expose the same schema object, canonical `code/work` values and successful complete manifest parsing; exercise Composer Intent/Work Ledger consumers with both pillars.
2. Import the one production `routeRequiresProjectDirectory` through Transport Protocol and run the existing exact positive matrix for global/bypass routes, Task GET facts, Channel attachment GET facts and project-scoped mutations. The matrix explicitly covers `/global`, `/auth`, and `/ui` with and without trailing slashes, absent/empty/lowercase/`HEAD`/unsupported methods, every accepted method, and both method-gated dynamic patterns. Run an SDK client request and an Overlay/server consumer fixture against the same manifest, asserting their normalized method/path decisions and manifest digest are identical.
3. Run the production SDK build twice from a clean generated-artifact staging area. Assert the same structured route-policy manifest canonical bytes/digest, same SDK artifact set, and no dependency on a Transport Protocol source filename/comment/marker. Relocate the checked-out Transport Protocol source root behind normal workspace package resolution and prove the build/typecheck still succeeds; do not rewrite imports to a private path in the fixture.
4. Run Transport Protocol typecheck/tests first with SDK `src`, `dist` and generated client output unavailable to that package resolution. Then run SDK typecheck/build through the declared one-way dependency and capture the topology checker receipt.
5. Run the declared NodeNext Transport Protocol build before SDK build, inspect emitted `dist/index.js` and its complete local import graph through real plain-Node resolution, pack the exact Transport Protocol + SDK pair, inspect both tarball manifests/file lists, install them into an isolated temporary directory, and use unflagged plain `node` to import all intentional roots/subpaths plus a real SDK directory-injection request. Assert the installed dependency resolves only Transport Protocol `dist`, every local emitted specifier resolves under standard Node ESM, no undeclared workspace/source-layout path or source condition is needed, and both tarball manifests name the exact export/dependency/version contract.
6. Run related Transport Protocol contract tests, SDK Product Pillar/client/generation tests, both package typechecks, root package/import checker, documentation checker and exact task-owned `git diff --check`.
7. Obtain an uninvolved read-only delivery review of the whole diff, generated artifact deletion, dependency graph, clean-build/package evidence and documentation; repair and re-review until PASS before committing.

No verification uses UI automation, browser fixtures, external package publication or network credentials.

## Risks and sequencing

- `CS-004` currently owns generated SDK/OpenAPI files and `CS-008` owns root manifest/lock/checker files. Do not implement until those exact owners commit; then regenerate/rebase the task diff from current state rather than overwriting their changes.
- Direct SDK runtime dependency on Transport Protocol must be represented in staged package evidence. A workspace-only green typecheck is insufficient.
- Preserve the SDK Expert Squad subpath API by re-exporting the shared primitive; do not preserve the old Transport → SDK direction for compatibility.
- Route policy is security/tenancy-sensitive. The existing semantic matrix and three real consumers must all use the same object before the copied SDK file is deleted.
- Do not broaden this into a universal contracts package. Current evidence supports Transport Protocol as the lower owner for these two primitives; another package would add a third distribution surface without removing more proven duplication.

## Delivery state

- Recall, observable topology, direct/reverse edges, root cause, single authorities, affected surface, package/clean-build evidence, positive verification, exclusions and risks are complete.
- Focused independent plan review is pending.
- Production implementation, focused verification, delivery review, commit, final upstream merge and push have not started.

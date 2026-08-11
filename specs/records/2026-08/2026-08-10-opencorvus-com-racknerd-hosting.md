# opencorvus.com RackNerd Hosting Plan

**Goal:** Publish the exact current `packages/web` Astro site at `https://opencorvus.com/` and `https://www.opencorvus.com/` from the user's RackNerd virtual private server (VPS), replacing the existing GoDaddy Websites + Marketing page.

**Architecture:** `packages/web` remains the only website source and emits one static root-site distribution. The RackNerd host serves one atomic current release through Caddy, with managed HTTPS and an HTTP-to-HTTPS redirect. GoDaddy remains the Domain Name System (DNS) authority; the root A record points to the RackNerd IPv4 address and the existing `www` CNAME continues to point to the root domain. Build, server preparation, pre-cutover verification, DNS cutover, certificate issuance, and public acceptance are separate observable phases.

## Recall

| Item | Evidence |
| --- | --- |
| User request | Host the current webpage on `opencorvus.com` using the user's RackNerd virtual server, and request required information when needed. The user corrected the provider identity on 2026-08-11; CloudCone was never the target host. |
| Acceptance | Root and `www` HTTPS URLs serve the current repository website; HTTP redirects to HTTPS; generated assets, English and Simplified Chinese routes, documentation, market pages, media, sitemap, robots file, and downloads resolve from the root deployment; the certificate is publicly trusted; the service survives reboot. |
| Existing live site | On 2026-08-10, `https://opencorvus.com/` returns HTTP 200 from `Server: DPS`, while HTTP redirects to HTTPS. Authoritative DNS-over-HTTPS returns root A records `76.223.105.230` and `13.248.243.5`; `www` is a CNAME to `opencorvus.com`. Nameservers are GoDaddy `ns25.domaincontrol.com` and `ns26.domaincontrol.com`. |
| Current source | `packages/web` is an Astro/Starlight static site. `packages/web/config.mjs` still emits canonical URLs for `opencorvus.ai`; `packages/web/astro.config.mjs` and `packages/web/script/hosted-market-server.ts` still own the retired `/opencorvus-dist/dist` deployment prefix. |
| Existing deployment record | `2026-08-04-public-web-deployment-base-path.md` proves the nested prefix was introduced for a different shared Nginx route. It explicitly identifies `astro.config.mjs` as the source of generated deployment URLs. That route is not the requested root-domain RackNerd topology. |
| Worktree boundary | Branch `main`, HEAD `2c7e990b300c4e76a31ac8276905468400a53660`, upstream `origin/main`. The worktree contains unrelated staged and unstaged Expert Squad, generated-payload, Web market, and specification changes. The published bundle must include the current Web worktree, while this task must not overwrite, stage, or commit unrelated paths. |
| Repository search | Production deployment identity occurs in `packages/web/config.mjs`, `packages/web/astro.config.mjs`, and `packages/web/script/hosted-market-server.ts`. The package scripts provide `check`, `build`, `hosted:simulate`, and focused hosted-market tests. No RackNerd, Caddy, Nginx, SSH, or root-domain deployment configuration existed before this task. |
| Authoritative guidance | Caddy's official documentation recommends its system service for production, serves static files from `/srv` or `/var/www`, and automatically obtains and renews HTTPS certificates plus redirects HTTP when a qualifying domain is configured. GoDaddy's official DNS guidance defines `@` A-record replacement and notes propagation may take up to 48 hours. |
| Independent agent feedback | None before implementation. The mandatory post-implementation independent read-only review will be recorded below. |

### Investigation update: hosted Registry is outside this deployment

The first focused test attempted to initialize the local Hosted Registry simulation through its real app constructor. It timed out and then failed while seeding the current generated public-market facts because concurrent, unrelated Expert Squad work references a `review-debug-integrity-reviewer/system.md` file that is not present in its packaged snapshot. The existing focused registry contract still passes for its complete package fixture. This task will not repair, publish, or expose the local simulation: its own page copy says it is loopback-only, unauthenticated publication authority is false, and its filesystem-backed upload surface is not a production public Registry. The RackNerd deployment therefore serves the static build only; Registry-backed upload and deep-link installation remain outside the production boundary. The separately implemented signed static bundle provides download-only access to all shipped resources.

## Problem and impact analysis

### Observable behavior

- The requested domain currently serves a different GoDaddy-hosted page.
- The requested current repository website builds for a different canonical origin and nested route prefix.
- The RackNerd endpoint and account are now supplied. Read-only SSH inspection verified Ubuntu 24.04 LTS, Kernel-based Virtual Machine (KVM), only SSH listening, no installed web server, about 19 GB root disk, about 1 GB memory plus 1 GB swap, and an inactive Uncomplicated Firewall (UFW). The host key was verified before authenticated mutation.

### Direct trigger and root cause

Pointing DNS at a VPS and copying the current distribution unchanged would replace the old site but leave generated asset and navigation URLs under `/opencorvus-dist/dist/**`, while canonical site metadata would still name `opencorvus.ai`. The root cause is that the previous deployment topology is encoded at build time; DNS and a web server cannot make that distribution a correct root-domain build without introducing forbidden rewrite aliases or a second URL truth.

### Why the old path does not solve this request

The old nested prefix was the correct repair for a shared reverse-proxy route at another host. Retaining it on `opencorvus.com` would make the public landing location and the build's actual root disagree. Server-side rewrites or duplicated directories would preserve two deployment identities, complicate canonical URLs, and leave authored navigation behavior dependent on infrastructure masking.

### Impact surface

- Build identity: Astro `site`, `base`, sitemap, canonical URLs, and public-path helpers.
- Hosted simulation: the local server's fixed base path and its focused positive contract tests.
- Server: Linux distribution, occupied ports, firewall, current services, release directory permissions, Caddy service, logs, and reboot persistence.
- DNS: existing root A records are replaced; `www` CNAME remains unless live inspection disproves the authoritative answer; unrelated MX/TXT records are preserved.
- Security: only ports 22, 80, and 443 should be needed; SSH authentication material must not enter the repository, prompt, logs, or commit.
- Delivery: the published bundle is derived from the exact current Web worktree, so its content may include user-owned uncommitted changes. A manifest must record source HEAD, dirty Web paths, build time, and bundle digest without copying secrets.
- Risk: DNS cutover replaces the existing GoDaddy page. Pre-cutover Host-header validation and recording the old A values provide an operational rollback point without serving a second application path.

## Implementation plan

### 1. Converge the site build to one public identity

- [x] Replace the canonical origin with `https://opencorvus.com`.
- [x] Replace the nested deployment prefix with the root `/` in the Astro build and hosted simulation.
- [x] Update focused positive contracts that describe the active public root; do not add User Interface (UI) automation.
- [x] Run package-scoped data generation, Astro check, hosted-market tests, and the canonical static build.
- [x] Inspect generated canonical, asset, locale, documentation, sitemap, robots, and download URLs for the one root deployment identity.

### 2. Prepare and inspect the RackNerd host

- [x] Obtain the server IPv4 address, SSH user/port, and authentication route from the user. The credential is handled ephemerally and is never written to repository files or command arguments.
- [x] Read-only inspect operating system, architecture, disk, memory, current listeners, firewall, web services, package manager, hostname, and time synchronization.
- [x] Verify ports 80 and 443 have no existing workload ownership conflict.
- [x] Install official Caddy 2.11.4 from its stable Ubuntu repository and retain its systemd service ownership.
- [x] Create the restricted `opencorvus-deploy` account and deploy-owned `/srv/opencorvus/incoming` and `/srv/opencorvus/releases` roots. Install the root-owned Caddy and activation configuration; the actual immutable release and `current` pointer are created by the signed bootstrap workflow.
- [x] Enable UFW with only TCP 22, 80, and 443 admitted. Verify effective key-only SSH for both the root recovery key and restricted deployment key.

### 3. Verify before DNS cutover

- [x] Validate the Caddy configuration and enabled service state. A live socket check proved that the readiness endpoint uses an explicit `bind 127.0.0.1` and is not listening on a public interface.
- [x] Activate the signed candidate and verify the landing page, pointer, catalog, signatures, and bundle through the loopback-only readiness listener before replacing DNS; after cutover, independently force the requested HTTPS hostnames to the RackNerd IP and verify the public responses.
- [x] Record the prior root A values `76.223.105.230` and `13.248.243.5` plus the retained `www` CNAME to `opencorvus.com` before cutover.

### 4. Cut over DNS and HTTPS

- [x] Use the user's already authenticated GoDaddy DNS session; no GoDaddy credential is requested or handled.
- [x] Replace only the root `@` A value with the RackNerd IPv4 address. Preserve `www` as a CNAME to the root and preserve all other records.
- [x] Verify public DNS-over-HTTPS returns the RackNerd address, Caddy obtains publicly trusted apex and `www` certificates, apex HTTPS returns 200, and `www` returns 301 to the apex.
- [x] Keep the recorded old root A values as the rollback point. No rollback was required because certificate issuance and the public service passed.

### 5. Real public acceptance and delivery

- [x] Open the real English and Simplified Chinese market pages in visible Chrome, interact through site navigation, and inspect screenshots. Both 39-resource download actions were visibly bound; site-origin console error collection was empty. A separate browser extension logged its own translation-version error, which is outside the site origin and deployment.
- [x] Verify root, `www` redirect behavior, certificate trust, English/Chinese market pages, quickstart, sitemap, robots, pointer, catalog, signature envelope, and bundle with independent public HTTP and exact byte/hash evidence.
- [x] Confirm Caddy is enabled for reboot and review its journal. Pre-cutover ACME failures name the retired GoDaddy addresses; post-cutover apex and `www` authorization/certificate issuance succeeded.
- [x] Commission the required independent agent for a read-only review of owned diffs, tests, generated output evidence, GitHub configuration, server evidence, documentation, and regression risk. The final verdict was PASS with no P0, P1, or P2 finding.
- [x] Update this record with exact evidence, check final Git status, commit only owned repository files, inspect `origin/main..HEAD`, and push only if every outgoing commit is authorized and reviewed.

## Required user-held information

- RackNerd server public IPv4 address: supplied and verified.
- SSH username, port, and bootstrap authentication route: supplied and verified. Dedicated recovery and deployment keys are installed and verified; SSH password authentication is disabled.
- GoDaddy DNS authority: supplied through the user's already authenticated Chrome session; the exact apex change completed without an additional authentication prompt.
- Existing-service boundary: read-only inspection proved no public web workload existed on the VPS before Caddy installation.

## Operations documentation and local credential backup

### Recall

- User requirement: persist the website configuration, operating instructions, environment variables, and deployment/signing keys so the production setup can be reviewed and reused.
- Acceptance: the repository contains a secret-free runbook and reproducible inventory; the current Windows account has a local, access-restricted recovery vault containing the actual environment values plus recoverable deployment and signing key material; GitHub and RackNerd use those current keys; production still passes a real signed deployment and public verification.
- Hard boundary: no private key, password, token, or secret value may enter Git, a specification, command output, or a committed example. GitHub Actions secrets are write-only, so the previously uploaded private keys cannot be exported for backup.
- Implementation decision: create `%LOCALAPPDATA%/OpenCorvus/deployment-vault/opencorvus.com`, restrict its NTFS access control list to the current Windows account and `SYSTEM`, store private keys encrypted with Windows Data Protection API (DPAPI), and record only paths, hashes, public fingerprints, and recovery commands in the repository. Rotate the unavailable signing key through the existing dual-signature overlap protocol and rotate the deploy key with an old/new authorized-key overlap; remove the old trust root and old deploy authorization only after public verification succeeds.
- Repository scope: update only this existing record, `deploy/racknerd/README.md`, a secret-free environment template, and focused recovery tooling. Preserve all unrelated dirty worktree paths.
- Independent review: required after implementation; the reviewer must remain read-only and validate the full owned diff, vault permissions/contents without revealing secrets, key-rotation evidence, production health, documentation, and recovery tests.

### Planned evidence

- A generated local manifest records the production URLs, GitHub Environment/repository variable names and current non-secret values, server paths/services, DNS ownership, publication protocol, key IDs, public fingerprints, DPAPI-encrypted secret paths, creation time, and rotation history.
- A round-trip checker decrypts each DPAPI blob in memory, validates its public key/fingerprint and the production configuration bindings, and leaves no plaintext secret behind.
- Two real `daily` publications prove the signing transition: first old/new overlap, then new-only trust. The first also proves the new RackNerd deploy key before the old server authorization is removed.
- Repository checks include focused script tests, documentation checks, diff checks, and a secret scan over every owned/staged file.

## Local implementation evidence

- `bun test packages/web/test/hosted-market-root-routing.test.ts packages/web/test/hosted-market-registry.test.ts`: 4 passed, 0 failed, 20 expectations. The added positive contract proves `https://opencorvus.com`, root `/`, and `/api/registry` are derived from the current configuration; the existing complete-package Registry archive contract remains green.
- `bun run --cwd packages/web check`: 0 errors and 0 warnings across 53 files, with one pre-existing unused-variable hint in `qa/dedupe-lead.cjs` and the existing theme override notices.
- `bun run --cwd packages/web build`: 123 pages built successfully, Pagefind indexed 123 HTML files, the sitemap was produced, and no local landing installer was available to copy. The generated static tree contains 452 files and 26,919,134 bytes.
- Generated-output inspection found zero files containing the retired `/opencorvus-dist/dist` prefix and zero files containing a `https://dev.opencorvus.ai` canonical. It found 1,160 `https://opencorvus.com` occurrences across generated HTML and XML. Root English, Simplified Chinese, checklist, sitemap, and robots outputs all exist.
- A Node-launched Astro preview served six representative pages and 36 discovered Cascading Style Sheet (CSS), JavaScript (JS), font, image, icon, and media assets: 42 HTTP checks passed and none failed.
- Visible Browser interaction followed root English → Simplified Chinese → Expert Squad market → the current roadmap checklist. English, Chinese, and checklist screenshots were personally inspected; layouts, typography, images, navigation, and current checklist content rendered without missing styles or clipping in the inspected desktop viewport. Console warning/error collection returned an empty list. Evidence is under `specs/artifacts/2026-08-10-opencorvus-com-hosting/` and is intentionally ignored build evidence rather than product source.
- `bun run docs:check`: 329 operations in 25 groups matched the generated API documentation contract.
- The historical frozen upload bundle was created before the provider correction under the legacy local temporary directory `C:/Users/hengu/AppData/Local/Temp/opencorvus-cloudcone-20260810T2100/`. The file is 19,116,206 bytes with SHA-256 `b26391d0ab9ab6daf9b1b4316d8ce0972979f48ab5a7a0149fa4aef115bdcd95`; that local directory name is provenance only and is not a deployment-provider identifier. Its archive listing contains the root English, Simplified Chinese, current checklist, and sitemap entries. It was built from repository HEAD `2c7e990b300c4e76a31ac8276905468400a53660` plus the exact current dirty Web worktree recorded by `git status --short -- packages/web` at bundle time.
- Production evidence: reviewed commit `18bfcd87e75124e726006ea5d83bbafadbb6bffd`; successful stage run `31415684423`; active immutable release `18bfcd87e75124e726006ea5d83bbafadbb6bffd-7b553ef91a170fe0`; publication version `5000`; expiry `2026-11-03T17:12:49Z`; 39 resources (4 embedded, 35 importable); 594,715-byte bundle; successful public verify run `31416471959`; automatic deployment switch `true`.
- Documentation/backup implementation: `deploy/racknerd/README.md` now owns the secret-free production inventory, reuse, recovery, health, rollback, renewal, and both key-rotation procedures. `production.env.example` owns the complete variable/reference schema. `vault.ps1` stores private bytes in versioned DPAPI `CurrentUser` envelopes, restricts each output ACL, verifies its SHA-256 binding in memory, refuses overwrite, and restores only to an explicitly named ephemeral file. Its focused round-trip test protects, verifies, restores, and byte-compares a generated fixture.
- The local production vault is `C:/Users/hengu/AppData/Local/OpenCorvus/deployment-vault/opencorvus.com`. Inherited ACLs are disabled; only the current Windows identity and `SYSTEM` have access. It contains the actual non-secret `production.env`, pinned `known_hosts`, a manifest, both public keys, and DPAPI-encrypted current deploy/signing private keys. Plaintext private-key files are absent. The root provider password is deliberately not copied; root recovery references the existing user SSH key instead.
- Because GitHub secrets cannot be exported, both unavailable private keys were rotated. Run `31418264102` passed all five jobs with old/new signing roots and two signatures while deploying through the new RackNerd key. Run `31418636240` then passed all five jobs with only `expert-squad-ed25519-2026-08-11`; the public envelope contains exactly that one signature. The old signing secret/root and optional secondary fields are removed. RackNerd `authorized_keys` now contains only the new deploy fingerprint; a DPAPI round trip restored the deploy key to a private ephemeral file, proved strict-host-key login, and deleted that file immediately afterward.
- Current post-rotation production evidence: immutable release `e26024ac2e980ff3ec0aefb52433865c484a3f5e-37754eb7285a0bbb`, publication version `12001`, expiry `2026-11-08T18:25:37Z`, 39 resources, Caddy 2.11.4, one deploy authorization, and public HTTPS success. `vault-manifest.json` binds these facts, GitHub variable/secret presence, server paths, public fingerprints, DPAPI paths, and private/public SHA-256 digests without containing a private key.

## Public website story and design convergence (2026-08-11)

### Recall

| Item | Evidence |
| --- | --- |
| User requirement | Make the index page use the same design language and visual system as the public subpages; audit the subpage logic; remove or repair unclear product storytelling such as Roadmap and “add to parallel workflow”; improve page logic and reasonableness. |
| Acceptance | A first-time visitor can follow one public story: understand what OpenCorvus delivers, choose an Expert Squad, learn how authors build one, and understand what is cryptographically and locally verified. The root, Market, author, and Trust pages share one header/footer, paper/cobalt/clay palette, typography, border rhythm, and action language. No public page exposes an operator-only planning draft or a localhost-only control. English and Simplified Chinese remain semantically aligned. |
| Visual evidence read | Live desktop Browser inspection of `/`, `/market/`, `/market/checklist/`, `/publish/`, and `/trust/`. The root uses a separate black/gray design and duplicate navigation. Public subpages use the cream paper, cobalt/clay accent, heavy display type, hard rules, and shared public header. |
| Story evidence read | The live Roadmap describes drag priority, “independent parallel generation lanes,” internal file targets, pinned source revisions, and a generated operator declaration. Market labels itself a “public catalog concept” and exposes localhost sandbox status. Publish presents a public file upload whose own copy says it only talks to `127.0.0.1`. Trust marks signatures as proposed even though the signed catalog/bundle publication is now live. |
| Direct trigger | Internal implementation/research surfaces were promoted into the public navigation before their audience, authority, and production availability were resolved. The root landing page evolved separately from the public-market layout, so navigation, tokens, information hierarchy, and visual density diverged. |
| Root cause | There is no single public customer journey or single shared landing shell. Pages describe repository/operator architecture rather than the visitor decision each page must support. Status language mixes shipped behavior, local development simulation, and future registry design. |
| Worktree boundary | Branch `main`, HEAD/upstream `e2eb495e89f4209ef5e8503b77af74af70d1d99d`. A parallel staged domain-expansion delivery currently deletes the Roadmap/checklist surface and touches Market/Header/Layout plus generated facts. Those staged changes are preserved exactly and are not committed, unstaged, overwritten, or claimed by this work until their owner converges them. |
| Hard constraints | No User Interface automation tests or snapshot/baseline assertions. Desktop acceptance uses a real local page, real interactions, screenshots, manual visual inspection, and console evidence. Preserve signed download behavior, package facts, locale parity, and every unrelated staged/unstaged change. Do not invent public upload, publisher verification, or batch-install capability. |
| Repository search | Root story/visuals live in `Lander.astro` and `landing.ts`; public navigation/layout live in `PublicSiteHeader.astro`, `PublicSiteLayout.astro`, and `PublicSiteFooter.astro`; Market, Publish, Trust and shared public tokens live in their components and `public-site.css`. The operator-only checklist has a separate component, state module, styles, and routes; its independent staged deletion is directionally correct. |
| Independent agent feedback | None before implementation. Mandatory final read-only review will inspect the complete owned diff and real-page evidence. |

### Unified public story

1. **Understand the outcome:** OpenCorvus turns one repository request into a review-ready result with durable context and visible evidence.
2. **Choose the operating mode and team:** Chat, Work, and Mission are depth choices; an Expert Squad supplies the domain roster, Skills, tools, and workflow contract.
3. **Inspect before choosing:** Market helps visitors compare outcomes, fit, revision, and capability facts, then download the signed complete bundle. It does not explain editorial build internals or localhost Registry simulation.
4. **Build as an author:** the author page explains what is usable today—generate, validate, freeze, test, and contribute—and separately names the absent self-service publisher/namespace/review service. It never renders a public control that can only work on localhost.
5. **Verify before use:** Trust explains the current signed publication, browser digest/signature verification, strict package validation, atomic import, and explicit activation boundary. Future publisher identity/review is one clearly separated roadmap note rather than interleaved “proposed” states.

### Implementation plan

- Reuse the public header/footer and public-site design tokens on the root landing instead of maintaining a second navigation and black-only shell.
- Restructure the root hierarchy around outcome → modes → Expert Squads → durable runtime → clear actions; correct the false “Web application” GitHub action and give the hero/closing sections actionable next steps.
- Remove the operator-only Roadmap from the public product story. Preserve the parallel task's already staged deletion; this work will not recreate or compatibility-route it.
- Rewrite Market around visitor selection and signed download, remove the public localhost-hosted sandbox section, and keep exact generated facts and download verification intact.
- Replace Publish's nonfunctional public localhost upload workbench with an honest author workflow and current documentation/source actions.
- Rewrite Trust around current protections, update the live publication-signature fact, and isolate future publisher identity/review as a transparent limitation.
- Validate Astro/type facts without running UI tests; then start the real local site, inspect English and Chinese root/Market/author/Trust pages, interact with navigation/search/download-ready states, capture screenshots, inspect console logs, and iterate from visible evidence.

### Implemented public journey

- The root now uses `PublicSiteHeader`, `PublicSiteFooter`, and the same paper/cobalt/clay tokens, display typography, hard rules, and square actions as Market, author, Trust, and detail pages. The duplicate black landing shell and duplicate navigation were removed.
- The root story now moves through outcome → Chat/Work/Mission depth → Expert Squad selection → runtime continuity → verifiable start paths. The former GitHub link is labeled as source instead of a nonexistent Web application, and the internal ten-step parallel Mission diagram was removed with its now-unreferenced component.
- Market explicitly separates five editorially explained featured teams from the complete generated inventory. The current shared worktree generated facts are `49 = 4 embedded + 45 importable`; the page reads those values from generated data and contains no hard-coded inventory count.
- Market no longer renders the localhost hosted-Registry simulation. The author page no longer renders the localhost ZIP upload workbench. The public Roadmap/checklist and “parallel generation lane” navigation are removed by the already staged domain-expansion delivery and are not recreated here.
- Detail pages now explain selection fit, responsibilities, dependencies, revision identity, and the signed complete-bundle path. They no longer probe a localhost record API, create an `opencorvus://` deep link, promise an exact per-record ZIP, or imply batch installation. Scope controls are explanatory content rather than a nonfunctional form.
- Trust now describes the current OpenCorvus-signed publication: unknown key IDs do not count toward the trusted threshold; the browser rejects insufficient trusted signatures, expiry, rollback, publication-version mismatch, byte-length/digest mismatch, or resource-count mismatch; downloaded ZIP bytes are rehashed. It separately states that download, atomic client import, and activation are different decisions and that third-party publisher identity/review remains unavailable.

### Current validation evidence

- `bun run --cwd packages/web check`: 53 files checked with zero errors and zero warnings; the existing unused-variable hint in `qa/dedupe-lead.cjs` remains outside this change.
- `bun run --cwd packages/web build`: 121 pages built, Pagefind indexed 121 HTML files, sitemap generation succeeded, the canonical Expert Squad static distribution was copied, and zero local native installers were invented.
- `bun run docs:check`: 329 operations in 25 groups matched the documentation contract. `git diff --check` passed.
- Real in-app Browser desktop inspection covered English root, Market, Frontend Replica detail, author, Trust, and Simplified Chinese root pages at the local Astro server. The Market search reduced to the exact Deep Research result; the work-type filter updated the visible set; detail Tabs, the install-boundary dialog, and the role/dependency dialog all exposed the intended current contracts.
- Manual screenshot review found one real layout regression during the first pass: the 2880-pixel intrinsic video width overflowed the viewport and pushed the hero heading below the fold. The landing now constrains the video to its grid column and 470-pixel frame; the second screenshot shows the complete heading, actions, control boundary, and video together at a 1265-pixel desktop viewport without horizontal overflow.
- Browser developer logs contain only Astro/Vite connection, prefetch, and hot-update debug events; no page warning or error was recorded during the accepted pages and interactions.
- Independent read-only review found no P0 or P1 product defect. Its three P2 wording findings were corrected: unknown signing keys now use threshold semantics, `publicationVersion` is named “publication version,” Manager validation is described as preceding the atomic install commit/replacement, and the detail dialog no longer says the page launches the client. A second read-only review is required after these corrections before delivery.

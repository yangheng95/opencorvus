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
- [ ] From outside the server, send HTTP requests to the RackNerd IPv4 address with the requested Host header and verify the landing page plus discovered static assets before replacing DNS.
- [ ] Record the current authoritative root A and `www` CNAME values immediately before the cutover.

### 4. Cut over DNS and HTTPS

- [ ] Obtain an authorized GoDaddy DNS editing route, preferably an already signed-in browser session; do not request account passwords in chat.
- [ ] Replace only the root `@` A values with the RackNerd IPv4 address. Preserve `www` as a CNAME to the root and preserve all mail and verification records.
- [ ] Wait for authoritative public DNS to return the new address, then verify Caddy's managed certificate and HTTP-to-HTTPS redirect.
- [ ] If certificate issuance or the public service fails after cutover and cannot be corrected safely, restore the recorded old root A values and report the exact failure.

### 5. Real public acceptance and delivery

- [ ] Open the real English and Simplified Chinese pages in a visible browser, interact with the site navigation, inspect screenshots, and check browser console output. Do not add or run UI automation.
- [ ] Verify root and `www`, redirect behavior, certificate chain, key pages, sitemap, robots, media, and downloads with independent HTTP evidence.
- [ ] Confirm Caddy is enabled for reboot and review its journal for request or certificate errors.
- [ ] Commission the required independent agent for a read-only review of owned diffs, tests, generated output evidence, server/DNS evidence, documentation, and regression risk. Resolve every valid finding and repeat review after any repair.
- [ ] Update this record with exact evidence, check final Git status, commit only owned repository files, inspect `origin/main..HEAD`, and push only if every outgoing commit is authorized and reviewed.

## Required user-held information

- RackNerd server public IPv4 address: supplied and verified.
- SSH username, port, and bootstrap authentication route: supplied and verified. Dedicated recovery and deployment keys are installed and verified; SSH password authentication is disabled.
- Confirmation that the user can complete GoDaddy two-factor authentication in an already signed-in Chrome session, or that the user prefers to make the two DNS edits from values supplied by this task.
- Confirmation of whether any existing service on that VPS must remain reachable. The server inspection will verify this before changes.

## Local implementation evidence

- `bun test packages/web/test/hosted-market-root-routing.test.ts packages/web/test/hosted-market-registry.test.ts`: 4 passed, 0 failed, 20 expectations. The added positive contract proves `https://opencorvus.com`, root `/`, and `/api/registry` are derived from the current configuration; the existing complete-package Registry archive contract remains green.
- `bun run --cwd packages/web check`: 0 errors and 0 warnings across 53 files, with one pre-existing unused-variable hint in `qa/dedupe-lead.cjs` and the existing theme override notices.
- `bun run --cwd packages/web build`: 123 pages built successfully, Pagefind indexed 123 HTML files, the sitemap was produced, and no local landing installer was available to copy. The generated static tree contains 452 files and 26,919,134 bytes.
- Generated-output inspection found zero files containing the retired `/opencorvus-dist/dist` prefix and zero files containing a `https://dev.opencorvus.ai` canonical. It found 1,160 `https://opencorvus.com` occurrences across generated HTML and XML. Root English, Simplified Chinese, checklist, sitemap, and robots outputs all exist.
- A Node-launched Astro preview served six representative pages and 36 discovered Cascading Style Sheet (CSS), JavaScript (JS), font, image, icon, and media assets: 42 HTTP checks passed and none failed.
- Visible Browser interaction followed root English → Simplified Chinese → Expert Squad market → the current roadmap checklist. English, Chinese, and checklist screenshots were personally inspected; layouts, typography, images, navigation, and current checklist content rendered without missing styles or clipping in the inspected desktop viewport. Console warning/error collection returned an empty list. Evidence is under `specs/artifacts/2026-08-10-opencorvus-com-hosting/` and is intentionally ignored build evidence rather than product source.
- `bun run docs:check`: 329 operations in 25 groups matched the generated API documentation contract.
- The historical frozen upload bundle was created before the provider correction under the legacy local temporary directory `C:/Users/hengu/AppData/Local/Temp/opencorvus-cloudcone-20260810T2100/`. The file is 19,116,206 bytes with SHA-256 `b26391d0ab9ab6daf9b1b4316d8ce0972979f48ab5a7a0149fa4aef115bdcd95`; that local directory name is provenance only and is not a deployment-provider identifier. Its archive listing contains the root English, Simplified Chinese, current checklist, and sitemap entries. It was built from repository HEAD `2c7e990b300c4e76a31ac8276905468400a53660` plus the exact current dirty Web worktree recorded by `git status --short -- packages/web` at bundle time.

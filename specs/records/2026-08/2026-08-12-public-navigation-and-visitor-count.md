# Public navigation hierarchy and privacy-preserving visitor count

## Recall

| Item | Record |
| --- | --- |
| User request | Add a visitor count at the bottom of the public website in its established design language, and reorganize the public tabs so distinctive parts are prominent while low-interest parts are collapsed. |
| Acceptance | English and Simplified Chinese PublicSiteLayout pages share one calmer primary navigation; Expert Squads and Agent integration are visually prominent, Download remains a clear action, low-frequency contribution/trust/docs/source links remain reachable from one accessible disclosure, and both public-layout and documentation footers show a correctly labelled privacy-preserving 30-day estimated visitor total. |
| Hard constraints | No third-party analytics, IP address, User-Agent, browser fingerprint, local-storage identifier, cross-site identifier, personal-data export, UI automation, hidden fallback count, or claim that a browser identity equals a human. Preserve no-JavaScript navigation and bilingual parity. Keep the production Website Registry schema version exactly `1`. Upgrade the same `registry.sqlite3` path by resetting it to the candidate schema/fingerprint and reimporting signed publication data; do not create a v2 or a parallel visitor database. |
| Sources read | `AGENTS.md`; `specs/current/architecture/public-website.md`; the database-backend and iterative-design records; `PublicSiteHeader.astro`; `PublicSiteFooter.astro`; `PublicSiteLayout.astro`; Starlight `Header.astro` and `Footer.astro`; `public-site.css`; `website-registry.ts`; Registry control/API/health routes; activator; Caddy and Astro configuration; focused Registry/runtime checkers. |
| Repository search | PublicSiteLayout navigation is a flat eight-link flex row plus language switch. Its footer has only brand, statement and three links. Documentation uses separate Starlight header/footer overrides and has no equivalent eight-link row. Static landing/docs/download pages are served directly by Caddy, while only Market/API/health reach the Astro runtime. The Website Registry DDL uses both schema version and strict checksum. The current activator imports directly into the live file, so the requested same-version schema replacement requires a stopped-writer sibling reset and atomic swap, not an in-place `ALTER` or a compatibility reader. |
| External authority | Astro endpoint/cookie behavior and MDN cookie security guidance were checked. A host-only `__Host-` cookie with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`, and bounded `Max-Age` is the appropriate first-party opaque identifier. SQLite remains the transactional aggregation primitive. |
| Independent agent feedback | Review iterations closed the mutation, privacy, rolling-window, capacity, docs-footer and More accessibility contracts. The reviewer approved a v1-to-v2 design, but the user explicitly rejected changing the version and then clarified: “不改版本号原地升级重置DB”. That approval is superseded; the same-version reset design below requires fresh independent approval before implementation continues. |
| User correction | Keep schema version `1`, reset/upgrade the existing DB path. Verified before revising the design: earlier experimental changes to Registry code/control/activator/backup had a zero diff. The new implementation may change the v1 fingerprint and tables only through the explicitly designed reset transaction below. |

## Diagnosis and impact

### Observable problem

- Eight equal-weight header links make the public journey read as a repository index. The product's distinctive surfaces—Expert Squads and use from other Agents—compete with contributor, trust, documentation and source links.
- At the 1099-pixel breakpoint the same flat list wraps into multiple rows, increasing scan cost without adding hierarchy.
- The footer has ample editorial space but no live community signal.

### Direct trigger and root cause

The current header implements information availability as equal visual priority. It does not distinguish product discovery, primary action, and low-frequency reference work. Adding one more equal link would compound the problem.

The site also has no visit event path. Static Caddy delivery means a footer component alone cannot reliably count visits: only dynamic routes reach the database service. A count widget that merely fetches a number would undercount static-page visitors, while a third-party embed or fingerprint would violate the site's trust language.

### Why earlier paths do not solve it

- The existing archive response counter intentionally means responses, not users, installations or popularity; reusing it would be false analytics.
- Caddy access logs count requests and assets, not stable visitors, and are not a bilingual page-facing fact source.
- Static generated content would freeze the number at build time and create a second analytics source.
- Browser local storage is JavaScript-readable and offers no server-authoritative deduplication boundary.

### Affected contracts

- Shared PublicSiteLayout header/footer and responsive/focus CSS; a shared visitor component also enters the separate Starlight documentation footer. The Starlight documentation header/sidebar has no flat eight-tab problem and is not reorganized.
- Caddy runtime matcher, so one same-origin visitor endpoint reaches Astro from every otherwise-static page.
- Website Registry v1 DDL/fingerprint, its reset/rollback transaction, visitor store/API, backup/restore and production runtime smoke. The numeric schema version remains `1`; signed publication/archive facts remain the rebuild authority.
- Current public website architecture, bilingual copy, deployment probes and this record's visual evidence.
- No documentation sidebar reorganization, detail-page tab change, third-party tracking, account system, geographic analytics or historical-log import is in scope.

## Approved design proposed for review

### Navigation hierarchy

Desktop primary order:

1. `Expert Squads` / `专家团` — distinctive marketplace surface, rendered as the selected/featured product link.
2. `Use with Agents` / `Agent 接入` — distinctive interoperability surface.
3. `Mission` — core mental model.
4. `Download` / `下载` — compact cobalt action.
5. `More` / `更多` — native `<details>` disclosure containing Contribute Experts, Trust, Documentation and GitHub.
6. Language switch stays outside the disclosure.

The disclosure uses native summary/details semantics and keeps every destination as a real link when JavaScript is unavailable. A small enhancement closes it on Escape only while open and returns focus to `<summary>`; an outside pointer selection closes it without stealing focus or blocking the selected link. Only the exact current child receives `aria-current="page"`; `More` uses a separate `data-selected` visual state so assistive technology does not receive two current-page claims. A strong focus ring remains visible throughout.

At narrower widths the primary row remains compact instead of wrapping eight independent links. Touch targets remain at least 44 pixels. The menu is positioned within the viewport and uses the same paper/cobalt/ink border system.

### Visitor fact, privacy and abuse boundary

- The visible measure is `30-day estimated participating browsers` / `近 30 天估算参与浏览器数`, with the adjacent qualification `Opt-in first-party browser tokens` / `自愿加入的第一方浏览器令牌`. It is not a people, account or device count. People who do not opt in are not counted; cookie deletion, another browser/profile and automation can recount. The site does not claim to exclude bots.
- Add `site_visitor(visitor_digest PRIMARY KEY, first_seen_at, expires_at)` and a singleton `site_visitor_summary(active_count, next_cleanup_at, intake_day, new_tokens_today, updated_at)` to the candidate v1 fingerprint in the existing `/var/lib/opencorvus-web/registry.sqlite3`. No last-seen, request count or path history is collected. The raw token, IP address, User-Agent, Referer, locale and fingerprint inputs are never inserted or logged by this feature.
- `GET /api/site/v1/visitors` is read-only, sets no cookie and returns the current qualified total to every footer. `POST /api/site/v1/visitors` runs only after the visitor activates `Count this browser`; it accepts exact JSON purpose `{"purpose":"footer-count"}`, an `Origin` equal to the request origin, `Sec-Fetch-Site: same-origin`, and `Content-Type: application/json`. Caddy caps that exact POST at 1 KiB, while the application incrementally reads at most 128 bytes before returning typed `site_visitor_request_invalid`, including for streamed bodies. Other browser contexts receive a typed `site_visitor_origin_rejected` or `site_visitor_request_invalid` response. This blocks ordinary cross-site navigation/subresource/prefetch mutation but is not authentication: non-browser clients can forge headers and may still enter the estimate.
- A transaction performs due cleanup, then inserts and increments once for a new digest. An existing digest is unchanged until its last renewal is 24 hours old. Footer GET remains strictly read-only but reports `renewalDue`; the client then sends the same exact opt-in POST, which synchronously extends the database expiry and both visitor/consent cookies to 30 days from now. Thus an active participating browser writes at most once per 24 hours and remains in the rolling recent-visit window without per-page Write-Ahead Log churn. The unique row and O(1) summary are one transactional SQLite authority.
- At most 5,000 new tokens are accepted per Coordinated Universal Time (UTC) day and at most 150,000 active rows exist (30 days of maximum intake). When bounded intake is exhausted the typed success body reports `counted:false` with the current estimate and the UI remains qualified; the endpoint never grows unbounded. A low-frequency control audit recomputes row/summary agreement, while request readiness checks schema and bounded singleton invariants without a full-table scan.
- New tokens are cryptographically random 128-bit values. SQLite stores only `SHA-256(token)`. Explicit consent sets two host-only cookies: `__Host-opencorvus-visitor=<opaque>` and non-identifying `__Host-opencorvus-visitor-consent=1`; both use `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`, and `Max-Age=2592000` (30 days). A missing consent preference means read-only display and no POST. A consent preference with an invalid/missing visitor token rotates the token. Every count response is `Cache-Control: private, no-store` and emits no Access-Control-Allow-Origin header.
- `DELETE /api/site/v1/visitors/current` uses the same Origin/Fetch-Metadata boundary, transactionally removes a valid current digest and decrements the summary once, then expires both cookies. Missing, invalid or already-expired visitor tokens still produce typed idempotent success with no decrement. The footer exposes this withdrawal as `Don't count this browser`; returning to participation always requires activating `Count this browser` again. No opt-out identifier, JavaScript storage or implicit re-enrolment is used.
- The root-owned backup shell/service/timer remain byte-for-byte unchanged. The candidate new-v1 Registry control's existing `backup` command performs due visitor cleanup transactionally before creating the consistent SQLite snapshot while the shell already holds the shared operation lock. Cleanup failure makes that command and the scheduled service fail visibly and produces no snapshot. A separate `visitor-cleanup` command exists only for restore acceptance, which opens the restored v1 fingerprint, cleans, and verifies visitor summary/row equality before readiness. This avoids any old-control/new-root-script compatibility window. Request transactions may clean earlier, but the retention contract is at most the daily timer interval plus its 15-minute jitter (24 hours 15 minutes) after expiry on a healthy host. Historical visitor digests may remain in bounded root-restricted snapshots only until those snapshots age out; snapshots are never analytics exports.

### Same-version in-place reset transaction

- Candidate `WebsiteRegistry.open()` remains strict and declares schema version `1` with a new exact checksum that includes visitor tables. It accepts only that checksum. The old release likewise accepts only the old v1 checksum; there is no dual reader, `ALTER` path, fallback or version `2`.
- Under the existing activation lock, the activator stops the writer and uses the old release control to create/checksum the rollback snapshot. Candidate control creates a private same-directory sibling database from the new v1 DDL, imports the candidate's verified signed publication/archives into it, initializes visitor state empty, and initializes archive-response counters at zero. It does not copy any row from the old DB.
- This reset intentionally discards the old SQLite-derived state: previous archive-response counter values and any local transient rows. Signed publication and normalized Market facts are reconstructed from the verified release seed and content-addressed archives; archive blobs themselves are unchanged. The user explicitly authorized resetting the DB. The pre-reset snapshot remains the only rollback source and follows bounded root-only retention.
- Candidate control verifies schema version remains `1`, exact new checksum, SQLite integrity/foreign keys, active publication identity, every normalized projection, archive binding, zeroed response counters and empty visitor summary. It fully checkpoints and closes the sibling, fsyncs the file, and proves the sibling `-wal`/`-shm` sidecars contain no required transaction state. With the old writer/control already stopped and closed, the activator deletes only the exact old `$DATABASE-wal` and `$DATABASE-shm`, sets sibling owner/mode, atomically renames it over the exact `registry.sqlite3` path on the same filesystem, then root-fsyncs the parent directory before service start. No broad sidecar glob is allowed.
- A fresh host creates the new v1 fingerprint directly. A host already on the new v1 checksum performs the normal immutable publication import without reset, so every routine deploy does not erase counts. Only the exact old committed v1 checksum is eligible for the one-time reset; unknown v1 checksums fail closed.
- Any failure before swap deletes only the exact sibling and restarts the old release with the untouched DB. Any failure after swap restores the pre-reset DB snapshot and old release as one rollback transaction. Positive activation fixtures cover populated old-v1 to reset-new-v1, counter reset, signed fact reconstruction, fresh new-v1, repeat new-v1 import, pre-swap failure and post-swap rollback.

### Footer presentation

The count appears as a small ruled evidence block between the statement and footer navigation:

- English label: `30-day estimated participating browsers`
- Chinese label: `近 30 天估算参与浏览器数`
- Loading state: `Reading count…` / `正在读取统计…`
- Failure state: `Visitor count unavailable` / `访问统计暂不可用`
- Scope note: `Opt-in first-party browser tokens · no IP or fingerprint stored` / `自愿加入的第一方浏览器令牌 · 不存储 IP 或浏览器指纹`
- Consent and withdrawal: `Count this browser` / `将此浏览器计入`; after consent, `Don't count this browser` / `不再统计此浏览器`.

The live number uses tabular mono numerals and an `aria-live="polite"` status. One shared component is embedded by PublicSiteFooter and the Starlight documentation Footer so all website bottoms use the same endpoint/copy contract while retaining their respective layout language. The static no-JavaScript state explains the measure without inventing a value. Failure stays visually quiet and never blocks navigation.

## Implementation sequence

1. Obtain independent plan approval and repair every valid finding.
2. Add the same-version v1 reset primitive, candidate visitor tables/store and exact visitor POST/DELETE API plus Caddy matchers. Keep numeric schema version `1` everywhere.
3. Add focused Registry/API/runtime checks for old-v1 reset, new-v1 fresh/reopen and rollback; explicit-consent first/concurrent/repeat visits; daily rolling renewal; bounded intake; cookie rotation/withdrawal; typed cross-site rejection; scheduled cleanup; backup/restore; readiness and exact JSON response.
4. Rebuild the PublicSiteLayout header hierarchy and embed the shared footer evidence block in both PublicSite and Starlight footers; update current architecture and deployment probes.
5. Run focused non-UI checks, build and production-shaped runtime smoke.
6. Start the real local production-shaped site. Manually inspect and interact with English/Chinese home, Market, one low-frequency current page and English/Chinese docs at desktop and the existing narrow breakpoint. Capture screenshots of closed/open More, exact child selected state, Tab/Shift+Tab, Enter/Space, Escape focus return, outside selection, 44-pixel targets, no overflow and both footer success/opt-out states. Do not run UI automation.
7. Commission an uninvolved agent for read-only delivery review. Repair and repeat until no actionable finding remains.
8. Stage only owned files, commit, inspect every `origin/main..HEAD` commit, push normally and monitor the triggered website Action.

## Acceptance evidence required

- Independent plan and final delivery verdicts with no unresolved P0–P3.
- Focused Registry/API/runtime tests and build all green, including an explicit assertion that the numeric schema version remains `1`; exact old-v1 checksum eligibility; reset to the new-v1 checksum at the same path; exact old/sibling WAL/SHM cleanup order; signed publication reconstruction; response-counter reset; fresh/reopened new-v1; backup rollback; existing backup command cleanup success and cleanup-failure/no-snapshot behavior; concurrent first POST incrementing once; same-day repeat no-write behavior; synchronized visitor/consent-cookie renewal; day-29 renewal/day-31 retention and 30-day no-return cleanup; no-consent read-only state; bad-cookie rotation after consent; idempotent withdrawal; typed cross-site rejection; disabled-cookie response semantics; bounded intake and scheduled cleanup.
- Real-page screenshots and manual review demonstrating hierarchy, menu reachability, current state, focus, bilingual parity and successful footer count. The persisted evidence is under `specs/artifacts/2026-08-12-public-navigation-visitor-count/`: `01-home-en-1440.png`, `02-more-en-1440.png`, `03-footer-en-zero.png`, `04-footer-en-counted.png`, `05-footer-zh-cn-counted.png`, `06-docs-footer-en.png`, `07-home-en-760.png`, `08-docs-footer-zh-cn.png`, and `09-trust-more-selected.png`.
- Public endpoint and cookie inspection showing exact privacy/cache attributes without exposing the cookie value in the record.
- Git diff checks, docs checker, commit/push evidence and the resulting GitHub Action conclusion.

## Implementation evidence

- Independent plan review: final `APPROVED`, with no P0–P3 finding after the same-version reset, exact backup cleanup, WAL/SHM order and synchronized Cookie renewal were made explicit.
- Registry contract: `bun test ./test/website-registry.test.ts` passed 4 tests / 51 assertions. It asserts numeric schema version `1`, the exact old-v1 fingerprint, a same-directory new-v1 sibling, zeroed archive response/visitor counts, rolling renewal, expired-row recovery, capacity bounds, backup audit and withdrawal.
- Activation contract: `bash deploy/racknerd/test-opencorvus-activate-release.sh` passed the real activation/snapshot/same-path reset/service switch/rollback/bounded-backup fixture. No Registry version `2` exists.
- Static/type/build: direct `bunx astro check` passed with zero errors; `bun run --cwd packages/web build` passed and packaged the Astro runtime plus baseline Registry control. The first precheck exposed an unrelated but real dirty-worktree source split; `generateExpertSquadDistribution` now accepts the same indexed source set used by Market facts, after which the canonical build passed without modifying the parallel Advanced package work.
- Production-shaped runtime: `bun run --cwd packages/web runtime:smoke` passed with 119 records, exact archive SHA-256 binding, read-only visitor GET, same-origin opt-in POST, and host-only Secure/HttpOnly/SameSite/Path/Max-Age Cookie attributes.
- Manual page review used the packaged local runtime with a requested 1440×1000 desktop browser viewport and the existing 760-pixel narrow breakpoint; saved page-content captures are 1425×990 and 745×882 after the browser surface excludes its scrollbar/chrome. English and Chinese landing pages showed the featured Expert Squads link, cobalt Download action, compact More disclosure and footer count; More opened cleanly, Escape closed it and returned focus to its summary; the narrow page had no horizontal overflow. Explicit participation changed the visible total from 0 to 1 and exposed withdrawal. The Starlight quickstart footer showed the same successful count in its dark design language. No UI automation test, fixture or screenshot assertion was created or run.

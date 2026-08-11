# README and homepage alignment

## Recall

### User request

- Update the README so its content stays aligned with the current homepage.

### Acceptance indicators

- Root `README.md` and `README.zh-CN.md` use the homepage's current product position: an open-source Agent Workbench for long-horizon work.
- The README introduction mirrors the homepage's four-part information architecture: shape the Workbench, configure an inspectable Expert Squad, run fixed-squad Tasks and Mission-scale outcomes, and contribute through the open community.
- Top navigation uses the current `https://opencorvus.com` origin and real public routes for Mission, Agent hosts, Expert Squads, Download, and Quickstart.
- English and Simplified Chinese remain reciprocal and semantically equivalent.
- Existing installation, release, runtime, API, Agent Skill, platform, limitations, acknowledgements, and license facts remain intact unless a stale website URL must change.

### Hard constraints

- Treat the current working homepage copy in `packages/web/src/content/landing.ts` as the messaging source for this alignment, while preserving the concurrent uncommitted homepage implementation itself.
- Do not copy the entire marketing page into the README or invent a second product model. The README should summarize the homepage and then retain its deeper repository/runtime documentation role.
- Preserve every unrelated staged and unstaged change. The task owns only the two root README files, this record, and exact index entries.
- Do not add or run UI automation tests. Markdown rendering and link/content review are sufficient because no rendered website UI changes are part of this follow-up.

### Read materials and repository search

- Read both root README files, the current bilingual homepage copy in `packages/web/src/content/landing.ts`, the landing component structure, current Mission page copy, public header/footer routes, and root package scripts.
- Repository search found stale `https://opencorvus.ai` and `/docs` links only in the two root README files. The current site identity is `https://opencorvus.com` with Quickstart at `/start/quickstart/`.
- Both README files already contain accurate fixed-Squad Task, Mission, Artifact, host-observation, release, HTTP API, and Agent-host material; the required repair is public positioning and navigation alignment rather than a technical rewrite.
- Independent plan feedback: none; implementation will receive the mandatory independent read-only post-change review.

## Bounded implementation plan

1. Replace the bilingual tagline and top navigation with the current homepage position and current public routes.
2. Rewrite the opening description around the user-controlled Workbench boundary while retaining Task, Expert Squad, and Mission authority language.
3. Add one compact bilingual `From Workbench to Mission` section that maps the homepage's four numbered bands to concrete repository concepts and calls to action.
4. Preserve the existing deeper technical sections and update the remaining stale documentation links to the current Quickstart route.
5. Review the bilingual diff for semantic parity, run whitespace/link-target checks and the repository documentation checker, then request an independent read-only review.

## Non-goals

- No homepage, Mission page, navigation, runtime, release, API, or package change.
- No new screenshots, badges, generated diagrams, feature claims, or version bump.
- No claim that Agent Workbench is a second runtime object or that community self-service publication is open.

## Implementation and validation

- Updated both root README files with reciprocal Workbench positioning, current public navigation, the four-step homepage story, and current Quickstart links while leaving the deeper technical sections intact.
- Confirmed every linked English and Simplified Chinese route exists in the current local web build: homepage, Mission, Agent hosts, Expert Squads, Download, and Quickstart.
- `bun run docs:check` passed with 329 operations across 25 groups.
- `bunx prettier --check` passed for both README files and this record. The first check identified formatting only in the newly edited README text; the committed form was normalized with Prettier and rechecked.
- `rg -n "opencorvus\\.ai" README.md README.zh-CN.md` returned no stale-domain matches.
- `git diff --check` passed for every task-owned path.
- Independent read-only review: **APPROVED**. The reviewer confirmed bilingual semantic parity, alignment with the current homepage and Mission authority model, preservation of existing technical content, and exact exclusion of concurrent homepage, Mission, Overlay, and other index edits.
- Deployment guard: the bilingual `/mission/` routes exist and were validated in the current local site build, but their source is concurrent work not yet present in this task's base commit. Do not claim the README links are live until that route work is committed and deployed (or otherwise verified live).

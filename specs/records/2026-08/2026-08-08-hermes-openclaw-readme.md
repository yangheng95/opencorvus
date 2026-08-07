# Document Hermes and OpenClaw skill control in the README

## Recall

- User request: explain in the repository README how Hermes Agent and OpenClaw control OpenCorvus through the packaged skill.
- Acceptance: both reciprocal README languages describe the runtime-versus-skill boundary, host-specific installation, invocation, representative control requests, and links to the complete skill instructions.
- Hard constraints: preserve unrelated dirty-worktree changes; do not invent a second integration or duplicate the HTTP API manual; use the existing `skills/opencorvus/` package as the single operational source; create a reviewable local commit without pushing.
- Materials read: `README.md`, `README.zh-CN.md`, `skills/opencorvus/SKILL.md`, `skills/opencorvus/references/skill-installation.md`, repository `AGENTS.md`, and the first-party Hermes Agent and OpenClaw skill documentation linked by `skills/opencorvus/references/sources.md`.
- Repository search: `skills/opencorvus/` already contains the host installation, invocation, operations, HTTP API, troubleshooting, and source references; neither root README currently mentions Hermes Agent or OpenClaw.
- Independent agent feedback: none requested; repository rules prohibit unsolicited sub-agent delegation for this task.

## Plan

1. Add a concise section after the headless-service quick start in each root README.
2. Explain that the assistant skill controls an already installed/reachable OpenCorvus runtime; installing the skill does not install the runtime.
3. Show the current local-package install and verification commands for Hermes Agent and OpenClaw.
4. Give invocation examples for health inspection, service startup, Task creation/monitoring, follow-up input, and evidence review, while linking detailed operations and troubleshooting to the skill package.
5. Run Markdown formatting, link checks, repository documentation checks, diff checks, and a second manual review before committing only the owned documentation hunks.

## Acceptance evidence

- Added reciprocal root README sections that link to the existing skill package, distinguish runtime installation from skill installation, document Hermes Agent and OpenClaw setup, and give invocation and operating examples.
- First-party documentation review confirmed Hermes skill discovery and slash-command invocation, and OpenClaw local-directory installation, workspace scope, verification, and skill roots.
- `bunx prettier --check` passed for both root READMEs and all new spec indexes/records.
- A read-only local Markdown-link scan passed for both root READMEs and all new spec indexes/records.
- `bun run docs:check` passed with `322` operations and `25` groups.
- `git diff --check` passed.
- Neither `hermes` nor `openclaw` is installed in this Windows checkout, so the host commands were verified against the linked first-party documentation rather than executed locally.
- The rule-mandated `packages/opencorvus/test/script/historical-docs-links.test.ts` is not present in this checkout; Bun reported that the path matched no test files, and a repository filename search found no replacement historical/document-health test. This absent test is not reported as passing.

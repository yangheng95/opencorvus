# Browser runtime and original-PRD fresh case

## Purpose

The user requested a newly compiled application and a fresh case after repairing Browser Model Context Protocol (MCP) connectivity/Preview and the Product Requirements Document (PRD) source-to-execution chain. This case starts the original fishing-game request in a new project and Mission with the same three source attachments. It does not wake or mutate the failed Mission.

The repair plan, root causes and focused verification are in the [repair record](../../records/2026-09/2026-09-20-browser-preview-prd-execution-fidelity.md).

## Operator entry point

`case.ts` is an operator-run acceptance driver, not a UI automation test. Run it from the repository root only after the rebuilt packaged application is serving its normal local endpoint:

```powershell
bun specs/artifacts/2026-09-20-browser-prd-case/case.ts start
bun specs/artifacts/2026-09-20-browser-prd-case/case.ts status
```

`CASE_SERVER_URL` can select the active local server. The driver verifies that the existing provider is connected, that `openai/gpt-5.6-luna` is projected and selected, and that a real streaming provider connection check succeeds. It reads the source Task metadata from SQLite in read-only mode, downloads attachment bytes through the public attachment route, and verifies their exact size and SHA-256 (Secure Hash Algorithm 256-bit) identity before upload to the new Mission. It never copies or prints credentials.

Project creation and Mission start use public HTTP ingress routes. `receipt.json` records the allocated project before starting the Mission, and then its returned identities. Once a Mission identity is recorded, rerunning `start` returns that case. If a request has an uncertain network result before its Mission identity is written, inspect the allocated project and persisted ingress first; do not blindly create another case. `status` is read-only and prints current persisted task/session/tool evidence.

## Acceptance boundaries

- The original files are `NO_FISH_PRD_v1.0.html`, `pasted-20260919144506.markdown` and `NO_FISH_PRD_v1.0.md`.
- The new case requests faithful implementation, reading relevant original source content and real GUI (Graphical User Interface) interaction through Browser MCP and Browser Preview.
- A recorded Mission or successful provider probe proves launch/preflight, not completed game delivery, PRD fidelity or successful visual acceptance. Those require actual worker read/implementation/tool evidence and visible screenshots.
- No credentials, original attachment contents or private provider configuration are retained in this artifact directory.

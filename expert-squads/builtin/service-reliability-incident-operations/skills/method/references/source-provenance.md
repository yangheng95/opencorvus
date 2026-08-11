# Upstream license, adaptation and authority boundary

## Accepted upstream Agent Skills

- Original repository: `wshobson/agents`
- Fixed commit: `c4b82b0ad771190355eb8e204b1329732a18449a`
- Exact paths:
  - `plugins/incident-response/skills/incident-runbook-templates/SKILL.md`
  - `plugins/incident-response/skills/postmortem-writing/SKILL.md`
  - `plugins/incident-response/skills/on-call-handoff-patterns/SKILL.md`
- Source URLs:
  - <https://github.com/wshobson/agents/blob/c4b82b0ad771190355eb8e204b1329732a18449a/plugins/incident-response/skills/incident-runbook-templates/SKILL.md>
  - <https://github.com/wshobson/agents/blob/c4b82b0ad771190355eb8e204b1329732a18449a/plugins/incident-response/skills/postmortem-writing/SKILL.md>
  - <https://github.com/wshobson/agents/blob/c4b82b0ad771190355eb8e204b1329732a18449a/plugins/incident-response/skills/on-call-handoff-patterns/SKILL.md>
- License at the fixed commit: root `LICENSE`, MIT, copyright 2024 Seth Hobson. The exact text is saved in `LICENSE-MIT.txt`.
- NOTICE closure: no root `NOTICE` or `NOTICE.md` existed at the fixed commit.
- Maturity/fit: a mature multi-agent repository with substantive incident Skills of 5,463, 6,938 and 3,747 bytes. They provide useful document structures but include live-response language that is outside this package's authority.

## Retained and modified concepts

Retain structured incident evidence, explicit prerequisites and verification fields, declared roles, timeline and decision context, handoff continuity, blameless learning, evidence-backed contributing factors, and owned action records. These structures were rewritten into a provider-neutral, source-grounded package method and joined with a clean-room SLI/SLO, error-budget, observability and alert-quality evidence method.

The local work does not copy command examples, platform integrations or fixed operating values. It adds stable identity, source/version/date, time semantics, quantities/units/denominators, uncertainty, privacy boundaries, branch hashes, explicit `decision_not_made`, `outcome_unknown`, stop conditions and qualified-human gates.

## Excluded behavior

Exclude all hard-coded severity classifications, response/update/escalation time limits, production commands, mitigation or recovery instructions, paging/chat/status integrations, automatic incident declaration, responder assignment, rollback or deployment actions, external communication, unsupported root-cause claims, action deadlines and closure decisions. No upstream example threshold is current operational authority.

## Current-authority boundary

For a real review, require the current service catalog, dependency map, approved SLI/SLO policies, telemetry/query/alert configurations, incident-management process, role assignments, change records, communication rules and action system of record supplied by authorized owners. Use current [OpenTelemetry specifications](https://opentelemetry.io/docs/specs/) and the organization-controlled reliability standards only at identified versions. The frozen upstream Skills are method provenance, not authorization to operate production.

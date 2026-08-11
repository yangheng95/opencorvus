---
name: cybersecurity-assurance-method
description: Build read-only cybersecurity assurance packs from scoped threat evidence, control coverage, and incident readiness. Use for posture reviews, control mapping, remediation planning, or security decision support that must preserve evidence, uncertainty, and human authority.
---

# Cybersecurity assurance method

## Upstream provenance

This is a bounded OpenCorvus adaptation of `agent-owasp-compliance` from [github/awesome-copilot](https://github.com/github/awesome-copilot), pinned to `3f0bba475ec40b9680e1d0311b9caffeec5ad4c3` under the MIT License. See `references/upstream.md` and `references/upstream-license.txt`. It retains evidence-first control review while excluding upstream code scanners, framework-specific claims, fixed compliance scores, and external tool dependencies.

## Workflow

1. Freeze the authorized systems, dates, sources, prohibited actions, and accountable risk owner.
2. Record each statement as observed evidence, documented claim, inference, unknown, or decision.
3. Run threat evidence, control coverage, and incident readiness as independent branches.
4. Join only after all branch reports exist; preserve conflicts and missing evidence.
5. Rank gaps by supported impact, exposure, reversibility, and verification cost without inventing risk values.
6. Publish owners, approval gates, safe verification steps, residual uncertainty, and revisit triggers.

## Boundaries

- Do not exploit, scan without authorization, retrieve credentials, change controls, or expose secrets.
- Do not certify compliance or accept risk. Authorized security and business owners retain those decisions.
- Use `assets/security-assurance-register.md` for the final pack.

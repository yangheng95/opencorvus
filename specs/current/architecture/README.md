# Current Architecture Index

This directory contains current architecture authority for live subsystem contracts.

Every file in this directory is a current fact source and is listed below. The
index is the authority graph's entry point, so a document that exists here and
is not listed is unreachable authority — `bun run check:architecture-index`
fails on an unlisted document and on any link that does not resolve to a live
file.

## Runtime planes

- [01 — Agent runtime architecture](01-agents.md)
- [02 — Data plane](02-data.md)
- [03 — Control plane and message routing](03-control.md)
- [10 — Worktree lifecycle](10-worktree-lifecycle.md)
- [16 — Unified teardown](16-unified-teardown.md)
- [18 — Scheduled Automations](18-scheduled-automations.md)
- [Task control plane](task-control-plane.md)
- [Task runtime directory ownership](task-runtime-directory.md)
- [Server runtime readiness](server-runtime-readiness.md)

## Agents, tools, and extensions

- [04 — Extension ownership, package projection, and lifecycle](04-extensions.md)
- [08 — Agent Tool adapter](08-agent-tool-adapter.md)
- [11 — Agent out-of-process protocol](11-agent-oop-protocol.md)
- [13 — Agent communication matrix](13-agent-communication-matrix.md)
- [14 — Agent runtime mode](14-agent-runtime-mode.md)
- [15 — Agent facts and Turns](15-agent-facts-and-turns.md)
- [17 — Code and Work agent platform](17-code-work-agent-platform.md)

## Configuration, providers, and memory

- [05 — Unified config](05-config.md)
- [06 — LLM Provider adapter layer](06-provider.md)
- [Project memory](project-memory.md)

## Surfaces

- [07 — Overlay panels and Task evidence](07-panel.md)
- [07-panel-reactivity — Overlay reactive projection](07-panel-reactivity.md)
- [12 — Overlay card system](12-overlay-card-system.md)
- [Overlay typography](overlay-typography.md)
- [Public website and Registry](public-website.md)

## Boundaries, verification, and principles

- [09 — Verification evidence](09-verification-evidence.md)
- [99 — Architecture principles](99-principles.md)
- [Security, permission, and metric-evaluator boundaries](security-permission.md)

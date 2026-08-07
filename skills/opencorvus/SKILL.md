---
name: opencorvus
description: Install, configure, verify, operate, and troubleshoot OpenCorvus from an assistant such as Hermes Agent, OpenClaw, Codex, or another Agent Skills-compatible host. Use when the user asks to install OpenCorvus, connect a model provider, run OpenCorvus locally, start or secure its headless service, create or monitor a Code or Work Task, send follow-up input, inspect delivery evidence, or diagnose an OpenCorvus setup.
---

# Operate OpenCorvus

Treat skill installation and OpenCorvus installation as separate operations. Read [skill-installation.md](references/skill-installation.md) only when installing this skill into an assistant host. Read [opencorvus-installation.md](references/opencorvus-installation.md) before installing or configuring OpenCorvus itself.

## Execute the request

1. Determine the requested outcome: install the skill, install OpenCorvus, configure credentials or models, run one local prompt, operate the headless service, manage a Task, or diagnose a failure.
2. Inspect the operating system, shell, current directory, existing `opencorvus` and `bun` commands, repository checkout, configuration, and relevant running process. Do not ask for facts that can be observed safely.
3. Read only the references needed for the outcome:
   - [skill-installation.md](references/skill-installation.md): install and invoke this skill in Hermes Agent or OpenClaw.
   - [opencorvus-installation.md](references/opencorvus-installation.md): clone, build, authenticate, select a model, and verify OpenCorvus.
   - [operations.md](references/operations.md): run the command-line interface (CLI), start the service, monitor work, and stop it safely.
   - [http-api.md](references/http-api.md): use the Hypertext Transfer Protocol application programming interface (HTTP API), Basic authentication, Task routes, and Server-Sent Events (SSE).
   - [troubleshooting.md](references/troubleshooting.md): diagnose installation, provider, server, project, Task, and event-stream failures.
   - [sources.md](references/sources.md): verify claims against first-party documentation and current repository contracts.
4. Prefer the repository's current, documented source-build path. Do not invent npm, Homebrew, winget, Docker, or curl-pipe installation commands. If the user supplies a packaged release, read its release instructions before using it.
5. Explain any machine-changing command immediately before execution. Never print, persist in a prompt, or commit a secret. Use the host's secret facility or process environment.
6. Keep the OpenCorvus process, project directory, and Task identity explicit. A Task belongs to one project directory; send that exact directory on project-scoped API requests.
7. Verify the result at the layer changed. Installation requires `doctor`; provider configuration requires `auth list` and `models`; service startup requires a reachable `/ui/`; Task submission requires HTTP `202`, a captured `task_id`, and observable Task events or board state.
8. Report the exact commands run, observed evidence, remaining warnings, server address, project directory, and Task identifier. Do not call a Task complete merely because a process or agent stopped.

## Safety and authority

- Bind the service to `127.0.0.1` unless the user explicitly requests remote access. Set `OPENCORVUS_SERVER_PASSWORD` before binding outside localhost.
- Treat cancellation, deletion, credential removal, database reset, uninstall, and overwriting configuration as destructive. Obtain explicit authority and preserve the exact target before executing them.
- Do not use `db reset` as troubleshooting. Diagnose the schema or runtime error first.
- Do not silently switch models, providers, project directories, installation methods, or Task product pillars after a failure.
- For long-running Tasks, return control after establishing durable observation. Use the host's supported scheduler or wake-up mechanism when the user requests continued monitoring; do not busy-loop.

## Completion evidence

Conclude only with observed facts. Distinguish among:

- skill available to the assistant;
- OpenCorvus installed and healthy;
- provider authenticated and models listed;
- server reachable and secured as requested;
- Task accepted and running;
- Task terminal with reviewable delivery evidence;
- blocked, with the exact failing command, response, and unresolved cause.

# First-party sources

Use first-party sources before changing commands or contracts. OpenCorvus is under active development; confirm version-sensitive behavior against the installed revision.

## OpenCorvus

- [OpenCorvus English README](../../../README.md): product scope, current source installation, quick start, service address, Task routes, execution providers, and development commands.
- [OpenCorvus Chinese README](../../../README.zh-CN.md): Chinese-language equivalent of the primary project overview and quick start.
- [Root package metadata](../../../package.json): pinned Bun package-manager version and repository scripts.
- [OpenCorvus package metadata](../../../packages/opencorvus/package.json): CLI binary name and package-level build, test, and type-check commands.
- [CLI entry point](../../../packages/opencorvus/src/index.ts): registered commands and startup capability reporting.
- [Serve command](../../../packages/opencorvus/src/cli/cmd/serve.ts): bind behavior, project directory, startup messages, shutdown, and service recovery.
- [Run command](../../../packages/opencorvus/src/cli/cmd/run.ts): one-shot execution, remote attachment, model, directory, session continuation, and output format.
- [Doctor command](../../../packages/opencorvus/src/cli/cmd/doctor.ts): health output and strict-mode exit behavior.
- [Authentication command](../../../packages/opencorvus/src/cli/cmd/auth.ts): provider credential management.
- [Models command](../../../packages/opencorvus/src/cli/cmd/models.ts): exact provider/model listing and refresh.
- [Network options](../../../packages/opencorvus/src/cli/network.ts): default host, port, multicast Domain Name System (mDNS), and Cross-Origin Resource Sharing (CORS) options.
- [Server application](../../../packages/opencorvus/src/server/server.ts): HTTP Basic authentication and request handling.
- [Task routes](../../../packages/opencorvus/src/server/routes/orchestrator.ts): Task creation, board, events, follow-up, retry, replan, and cancellation routes.
- [Task schemas](../../../packages/opencorvus/src/engine/model.ts): `productPillar`, creation body, follow-up body, and Task response contracts.
- [Transport protocol](../../../packages/transport-protocol/src/index.ts): cancellation request surface and reason contract.
- [Configuration resolver](../../../packages/opencorvus/src/config/config.ts): configuration locations, precedence, provider, model, and server schema.

Published project links:

- [OpenCorvus repository](https://github.com/yangheng95/opencorvus)
- [OpenCorvus documentation](https://opencorvus.ai/docs)
- [OpenCorvus configuration schema](https://opencorvus.ai/config.json)

## Assistant skill hosts

- [Hermes Agent: Working with Skills](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/guides/work-with-skills.md): discovery, URL installation, `~/.hermes/skills`, invocation, progressive disclosure, and reference files.
- [OpenClaw: Skills](https://github.com/openclaw/openclaw/blob/main/docs/tools/skills.md): Agent Skills compatibility, discovery roots, precedence, local installation, invocation, snapshots, and security.
- [Agent Skills specification](https://agentskills.io/specification): portable `SKILL.md` package format.

## Version-sensitive checks

Before publishing or updating this skill, compare these facts with the current revision:

1. root `packageManager` version;
2. documented installation path in both README files;
3. registered CLI commands and options;
4. `CreateTaskInput` required fields;
5. server authentication method and default username;
6. project-directory header behavior;
7. Hermes and OpenClaw skill roots and install commands.

# Agent Client Protocol (ACP)

OpenCorvus uses the official `@agentclientprotocol/sdk` for editor connections.
The current contract lives in [the extension architecture](../../../../specs/current/architecture/04-extensions.md). Session ownership and cancellation follow [the task control plane](../../../../specs/current/architecture/task-control-plane.md).

Start the standard input/output transport with `opencorvus acp --cwd <project-directory>`.
Its command entry is `../cli/cmd/acp.ts`. `agent.ts` handles the protocol and streamed
updates; `session.ts` tracks connection-local configuration; `prompt-response.ts`
projects the returned canonical reply into ACP stop reasons and structured errors.
Authentication is configured with `opencorvus auth login` before starting ACP.

Focused backend checks use the repository's isolated runner:

```sh
bun run test test/acp-prompt-terminal.test.ts test/acp-prompt-response.test.ts test/dependabot-runtime-contract.test.ts
```

Run this command from `packages/opencorvus`. The terminal tests use actual ACP and
product HTTP transports with an owned local streaming participant; they do not
claim external model or editor visual acceptance.

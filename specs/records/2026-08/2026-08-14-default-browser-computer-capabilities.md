# Default Browser and Computer capabilities

## Recall

- User request: enable Browser and Computer by default and quantify their context burden.
- Acceptance:
  - an uncustomized Project assigns both built-in MCP servers to native Chat and Work;
  - an explicit per-Project Chat or Work assignment remains authoritative, including an explicit empty list;
  - the production capability routes and runtime MCP catalog prove the projected tools;
  - report the measured incremental tool-schema characters and estimated tokens.
- Hard constraints:
  - preserve the existing project-local, Chat-versus-Work assignment contract and permission authority;
  - do not default-enable Browser or Computer for Mission or Expert Squad runtimes;
  - do not add a fallback or a second configuration source;
  - do not automate UI tests; use production routes, runtime diagnostics, and manual evidence if UI is touched.
- Read material:
  - `packages/opencorvus/src/conversation/capability.ts`
  - `packages/opencorvus/src/work/harness.ts`
  - `packages/opencorvus/src/config/config.ts`
  - `packages/opencorvus/src/mcp/browser/builtin.ts`
  - `packages/opencorvus/src/mcp/computer/builtin.ts`
  - `packages/opencorvus/test/server/conversation-capability-route.test.ts`
  - `specs/current/architecture/04-extensions.md`
  - `specs/records/2026-08/2026-08-14-computer-use-scope-and-project-delete-settlement-repair.md`
- Repository search: the native conversation default assignment is read only through `ConversationCapability.assignment`; Work's default seed is exported by `work/harness.ts`. Browser and Computer are always materialized into the MCP catalog, but assignment separately controls model projection. Mission and Expert Squad defaults are independent and remain empty.
- Independent-agent feedback before implementation: none.

## Analysis

### Observable failure

The captured Work Session requested Windows and browser interaction, but every model turn exposed only the 24 built-in Work tools. The model used Bash and PowerShell instead of Browser or Computer. The current Project capability state assigns `browser` and `computer` to Chat while Work has no assigned MCP servers.

### Direct trigger and root cause

The direct trigger was a Work turn whose resolved capability assignment contained no MCP servers. Permission approval was downstream and therefore irrelevant: an unprojected tool cannot request authorization or execute. The root configuration cause is that both native conversation defaults use an empty MCP assignment even though Config materializes the built-in Browser and Computer servers.

### Why the old path did not prevent it

The settings surface correctly supports explicit project-local assignment, but a user must repeat that assignment for each Project and independently for Chat and Work. Configuring the MCP servers and granting execution permission do not assign them to either model harness.

### Impact and exclusions

- Change the single native-conversation default to `browser` and `computer` for both Chat and Work.
- Preserve explicit `primary_assistant_capabilities` values as opt-outs; no migration or dual read is added.
- Permission evaluation, Browser runtime mode, Computer host runtime, Mission, Expert Squads, and UI layout are unchanged.
- Existing Projects with an explicit empty assignment remain off by design. The affected Project has no explicit Work assignment and inherits the new default when the updated runtime starts.

## Verification plan

1. Run the focused production-route test and assert fresh Chat and Work settings both assign Browser and Computer.
2. Assert a project-local explicit empty assignment is returned unchanged.
3. Materialize the real Browser and Computer runtime MCP catalogs and measure them with the runtime's own `toolSchemaChars` estimator.
4. Inspect the affected Project's persisted assignment and confirm it has no Work override that would suppress the new default.
5. Run typecheck and documentation checks relevant to the modified files.
6. Obtain a read-only independent review of the complete diff and evidence, then repair and re-verify any valid finding.

## Measured context burden

The production `SessionLoop.estimateToolPayloadChars` estimator measured the default MCP catalogs as follows:

| Capability | Tools | Schema characters | Estimated tokens per model turn |
| --- | ---: | ---: | ---: |
| Browser | 45 | 21,398 | 5,350 |
| Computer | 8 | 5,500 | 1,375 |
| Combined | 53 | 26,898 | 6,725 |

The estimate uses the runtime's canonical four-characters-per-token heuristic. It is a fixed, non-compressible cost repeated on every model turn where the capabilities are projected; it does not accumulate inside conversation history. Against the affected GPT-5.5 Work diagnostic's 400,000-token context limit, the combined increment is about 1.68%; against its 272,000-token input catalog limit it is about 2.47%. Its previous 139,185-character tool-schema surface would rise by about 19.3% to 166,083 characters if the rest of the tool catalog remains unchanged.

## Verification evidence

- `bun test packages/opencorvus/test/server/conversation-capability-route.test.ts packages/opencorvus/test/mcp/computer-contract.test.ts packages/opencorvus/test/mcp/browser-projection-contract.test.ts packages/opencorvus/test/browser-mcp-node-bundle.test.ts`: 23 passed, 0 failed.
- `bun run --cwd packages/opencorvus typecheck`: passed.
- `bun run docs:check`: passed with 332 operations in 25 groups.
- The affected Project's persisted `.opencorvus/opencorvus.jsonc` contains an explicit Chat assignment for `browser` and `computer` but no Work assignment. The new shared Work default therefore applies without a migration after the updated runtime starts.
- A live capability PATCH was attempted only after implementation, but `127.0.0.1:7878` was no longer listening. The request failed before any write, and the user application was not restarted.
- Independent read-only review found no implementation, scope, permission, dependency-cycle, measurement, or regression issue. Its sole P1 delivery finding was that the new shared source and ignored dated spec had not yet been staged; both are explicitly included in the task commit.

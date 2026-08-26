import { describe, expect, test } from "bun:test"
import type { CuaDriverLike, ToolResult } from "@trycua/cua-driver"
import { PNG } from "pngjs"
import { ComputerMCPBuiltin } from "../../src/mcp/computer/builtin"
import { BrowserMCPBuiltin } from "../../src/mcp/browser/builtin"
import {
  CuaComputerBackend,
  type ComputerBackend,
  type ComputerBackendAction,
  type ComputerBackendObservation,
} from "../../src/mcp/computer/backend"
import { ComputerController } from "../../src/mcp/computer/controller"
import { ConversationCapability } from "../../src/conversation/capability"
import { Config } from "../../src/config/config"
import { Instance } from "../../src/project/instance"
import { memoryProject } from "../fixture/memory"
import { materializeMcpToolResult } from "../../src/mcp/materialize"
import { ExpertSquadConversationAuthoring } from "../../src/expert-squad/conversation-authoring"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { buildExpertSquadAuthorDefinition } from "../../src/tool/expert-squad-author"
import { MCP } from "../../src/mcp"
import { computerMcpPermissionKeyOf } from "../../src/mcp/computer/permission-plan"
import { computerRuntimeScopeIdentity } from "../../src/mcp/computer/runtime-scope"
import { CapabilityCatalog, searchCapabilityCatalog } from "../../src/tool/capability-catalog"
import { ComputerHostRuntimeAuthority } from "../../src/mcp/computer/host-runtime"
import { HostComputerBackend } from "../../src/mcp/computer/host-client"
import { EngineService } from "../../src/task-api"
import { configureTaskIngressRunner } from "../../src/engine/task-root-ingress-delivery"
import { artifactRuntimeNodeModuleNames } from "../../script/build-artifact"

function pngBase64(width: number, height: number) {
  const image = new PNG({ width, height })
  image.data.fill(255)
  return PNG.sync.write(image).toString("base64")
}

class RecordingBackend implements ComputerBackend {
  readonly actions: ComputerBackendAction[] = []
  observations: ComputerBackendObservation[] = [
    { computerId: "computer-1", displayId: "display-1", pngBase64: pngBase64(8, 6) },
    { computerId: "computer-1", displayId: "display-1", pngBase64: pngBase64(10, 7) },
  ]
  destroyCalls: string[] = []

  async create() {
    return {
      computerId: "computer-1",
      displayId: "display-1",
      driverVersion: "0.12.2",
    }
  }

  async observe() {
    return this.observations.shift()!
  }

  async act(action: ComputerBackendAction) {
    this.actions.push(action)
    return { accepted: true as const, backendActionId: `action-${this.actions.length}` }
  }

  async destroy(input: { computerId: string }) {
    this.destroyCalls.push(input.computerId)
    return { destroyed: true as const }
  }

  async close() {}
}

class LifecycleBackend implements ComputerBackend {
  readonly events: string[] = []
  private readonly screens = [pngBase64(8, 6), pngBase64(10, 7)]

  constructor(
    private readonly computerId = "computer-lifecycle",
    private readonly displayId = "display-lifecycle",
  ) {}

  async create() {
    this.events.push("desktop:create")
    return { computerId: this.computerId, displayId: this.displayId, driverVersion: "0.12.2" }
  }

  async observe(input: { computerId: string; displayId: string }) {
    this.events.push(`desktop:observe:${input.computerId}:${input.displayId}`)
    return { computerId: input.computerId, displayId: input.displayId, pngBase64: this.screens.shift()! }
  }

  async act() {
    this.events.push("desktop:act")
    return { accepted: true as const, backendActionId: "lifecycle-action" }
  }

  async destroy(input: { computerId: string }) {
    this.events.push(`desktop:destroy:${input.computerId}`)
    return { destroyed: true as const }
  }

  async close() {
    this.events.push("desktop:close")
  }
}

describe("Computer Use exact control contract", () => {
  test("publishes the complete narrow MCP tool reference set", () => {
    expect(ComputerMCPBuiltin.ImportableToolRefs).toEqual([
      "default/mcp/computer/tool/session_create",
      "default/mcp/computer/tool/observe",
      "default/mcp/computer/tool/click",
      "default/mcp/computer/tool/type_text",
      "default/mcp/computer/tool/keypress",
      "default/mcp/computer/tool/scroll",
      "default/mcp/computer/tool/drag",
      "default/mcp/computer/tool/session_destroy",
    ])
  })

  test("derives the exact host runtime owner identities for every supported execution surface", () => {
    expect(computerRuntimeScopeIdentity({ ownerKind: "conversation", sessionID: "session-1" })).toBe(
      "conversation:session-1:computer",
    )
    expect(computerRuntimeScopeIdentity({ ownerKind: "orchestrator", taskID: "task-1", sessionID: "session-2" })).toBe(
      "orchestrator:task-1:session-2",
    )
    expect(computerRuntimeScopeIdentity({ ownerKind: "worker", taskID: "task-1", sessionID: "session-3" })).toBe(
      "worker:task-1:session-3",
    )
  })

  test("preserves one host-owned desktop session across takeover and returns with a fresh adapter run", async () => {
    const runtime = new LifecycleBackend()
    const authority = new ComputerHostRuntimeAuthority({ entries: new Map(), authorizations: new Map() }, () => runtime)
    const firstAdapter = authority.adapter({
      runtimeScope: "conversation:session-lifecycle:computer",
    })
    const firstController = new ComputerController(
      new HostComputerBackend(
        firstAdapter.endpoint,
        firstAdapter.authorization,
        firstAdapter.runtimeScope,
        (input, init) => authority.fetch(new Request(input, init)),
      ),
    )
    const created = await firstController.create()
    const firstObservation = await firstController.observe({
      computerId: created.computerId,
      displayId: created.displayId,
    })
    expect(firstObservation).toMatchObject({ width: 8, height: 6 })
    expect(
      await authority.takeover({
        runtimeScope: firstAdapter.runtimeScope,
        computerId: created.computerId,
        displayId: created.displayId,
      }),
    ).toEqual({
      ownership: "human",
      computerId: "computer-lifecycle",
      displayId: "display-lifecycle",
      driverVersion: "0.12.2",
      desktopPreserved: true,
    })
    await firstController.close()

    expect(
      authority.returnControl({
        runtimeScope: firstAdapter.runtimeScope,
        computerId: created.computerId,
        displayId: created.displayId,
      }),
    ).toEqual({
      ownership: "agent",
      computerId: "computer-lifecycle",
      displayId: "display-lifecycle",
      driverVersion: "0.12.2",
      freshObservationRequired: true,
    })
    const secondAdapter = authority.adapter({
      runtimeScope: firstAdapter.runtimeScope,
    })
    expect(new Set([firstAdapter.authorization, secondAdapter.authorization]).size).toBe(2)
    const secondController = new ComputerController(
      new HostComputerBackend(
        secondAdapter.endpoint,
        secondAdapter.authorization,
        secondAdapter.runtimeScope,
        (input, init) => authority.fetch(new Request(input, init)),
      ),
    )
    expect(await secondController.create()).toEqual(created)
    expect(
      await secondController.observe({ computerId: created.computerId, displayId: created.displayId }),
    ).toMatchObject({ width: 10, height: 7 })
    expect(await secondController.destroy({ computerId: created.computerId })).toEqual({
      computerId: "computer-lifecycle",
      destroyed: true,
    })
    await secondController.close()
    await authority.close()
    expect(runtime.events).toEqual([
      "desktop:create",
      "desktop:observe:computer-lifecycle:display-lifecycle",
      "desktop:observe:computer-lifecycle:display-lifecycle",
      "desktop:destroy:computer-lifecycle",
      "desktop:close",
    ])
  })

  test("keeps one adapter authority usable for a new desktop session after exact session destruction", async () => {
    const backends = [
      new LifecycleBackend("computer-generation-1", "display-generation-1"),
      new LifecycleBackend("computer-generation-2", "display-generation-2"),
    ]
    const authority = new ComputerHostRuntimeAuthority(
      { entries: new Map(), authorizations: new Map() },
      () => backends.shift()!,
    )
    const adapter = authority.adapter({ runtimeScope: "conversation:reusable-adapter:computer" })
    const controller = new ComputerController(
      new HostComputerBackend(adapter.endpoint, adapter.authorization, adapter.runtimeScope, (input, init) =>
        authority.fetch(new Request(input, init)),
      ),
    )

    const first = await controller.create()
    expect(await controller.destroy({ computerId: first.computerId })).toEqual({
      computerId: "computer-generation-1",
      destroyed: true,
    })
    const second = await controller.create()
    expect([first.computerId, second.computerId]).toEqual(["computer-generation-1", "computer-generation-2"])
    expect(await controller.observe({ computerId: second.computerId, displayId: second.displayId })).toMatchObject({
      computerId: "computer-generation-2",
      displayId: "display-generation-2",
      width: 8,
      height: 6,
    })

    await authority.close()
    expect(backends).toEqual([])
  })

  test("classifies a lost post-dispatch native session response as an unknown effect outcome", async () => {
    const runtime = new LifecycleBackend()
    const authority = new ComputerHostRuntimeAuthority({ entries: new Map(), authorizations: new Map() }, () => runtime)
    const adapter = authority.adapter({ runtimeScope: "conversation:lost-create-response:computer" })
    const backend = new HostComputerBackend(
      adapter.endpoint,
      adapter.authorization,
      adapter.runtimeScope,
      async (input, init) => {
        await authority.fetch(new Request(input, init))
        throw new Error("injected response loss")
      },
    )
    await expect(backend.create()).rejects.toMatchObject({
      code: "COMPUTER_OUTCOME_UNKNOWN",
      details: { operation: "session_create", runtimeScope: adapter.runtimeScope },
    })
    expect(authority.identity(adapter.runtimeScope)).toEqual({
      computerId: "computer-lifecycle",
      displayId: "display-lifecycle",
      driverVersion: "0.12.2",
    })
    await authority.destroy(adapter.runtimeScope)
    await authority.close()
  })

  test("settles an entered Agent input before publishing human desktop ownership", async () => {
    const timeline: string[] = []
    let markStarted!: () => void
    let releaseAction!: () => void
    const actionStarted = new Promise<void>((resolve) => {
      markStarted = resolve
    })
    const actionReleased = new Promise<void>((resolve) => {
      releaseAction = resolve
    })
    const runtime: ComputerBackend = {
      async create() {
        return { computerId: "computer-quiescence", displayId: "primary", driverVersion: "0.12.2" }
      },
      async observe() {
        return { computerId: "computer-quiescence", displayId: "primary", pngBase64: pngBase64(4, 4) }
      },
      async act() {
        markStarted()
        await actionReleased
        timeline.push("agent-input-settled")
        return { accepted: true, backendActionId: "action-quiescence" }
      },
      async destroy() {
        return { destroyed: true }
      },
      async close() {},
    }
    const authority = new ComputerHostRuntimeAuthority({ entries: new Map(), authorizations: new Map() }, () => runtime)
    const adapter = authority.adapter({ runtimeScope: "conversation:takeover-quiescence:computer" })
    const controller = new HostComputerBackend(
      adapter.endpoint,
      adapter.authorization,
      adapter.runtimeScope,
      (input, init) => authority.fetch(new Request(input, init)),
    )
    const created = await controller.create()
    const action = controller.act({
      kind: "click",
      computerId: created.computerId,
      displayId: created.displayId,
      x: 1,
      y: 1,
      button: "left",
    })
    await actionStarted
    const takeover = authority
      .takeover({
        runtimeScope: adapter.runtimeScope,
        computerId: created.computerId,
        displayId: created.displayId,
      })
      .then((result) => {
        timeline.push("human-ownership-published")
        return result
      })
    releaseAction()
    expect(await action).toMatchObject({ accepted: true, backendActionId: "action-quiescence" })
    expect(await takeover).toMatchObject({ ownership: "human", desktopPreserved: true })
    expect(timeline).toEqual(["agent-input-settled", "human-ownership-published"])
    await authority.destroy(adapter.runtimeScope)
    await authority.close()
  })

  test("maps an observation-bound click to one exact backend action", async () => {
    const backend = new RecordingBackend()
    const controller = new ComputerController(backend)
    const created = await controller.create()
    const observed = await controller.observe({ computerId: created.computerId, displayId: created.displayId })
    const result = await controller.act(
      {
        computerId: observed.computerId,
        displayId: observed.displayId,
        observationId: observed.observationId,
        observationDigest: observed.observationDigest,
      },
      { kind: "click", x: 3, y: 4, button: "left" },
    )

    expect(observed).toMatchObject({ width: 8, height: 6 })
    expect(observed.observationDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(backend.actions).toEqual([
      {
        kind: "click",
        computerId: "computer-1",
        displayId: "display-1",
        x: 3,
        y: 4,
        button: "left",
      },
    ])
    expect(result).toEqual({
      computerId: "computer-1",
      displayId: "display-1",
      observationId: observed.observationId,
      observationDigest: observed.observationDigest,
      accepted: true,
      backendActionId: "action-1",
    })
  })

  test("returns the typed stale-observation contract after a newer screen becomes authoritative", async () => {
    const backend = new RecordingBackend()
    const controller = new ComputerController(backend)
    const created = await controller.create()
    const first = await controller.observe({ computerId: created.computerId, displayId: created.displayId })
    const second = await controller.observe({ computerId: created.computerId, displayId: created.displayId })

    expect(second).toMatchObject({ width: 10, height: 7 })
    await expect(
      controller.act(
        {
          computerId: first.computerId,
          displayId: first.displayId,
          observationId: first.observationId,
          observationDigest: first.observationDigest,
        },
        { kind: "type_text", text: "hello" },
      ),
    ).rejects.toMatchObject({ code: "STALE_OBSERVATION" })
  })

  test("consumes one observation after exactly one accepted backend action", async () => {
    const backend = new RecordingBackend()
    const controller = new ComputerController(backend)
    const created = await controller.create()
    const observed = await controller.observe({ computerId: created.computerId, displayId: created.displayId })
    const binding = {
      computerId: observed.computerId,
      displayId: observed.displayId,
      observationId: observed.observationId,
      observationDigest: observed.observationDigest,
    }

    expect(await controller.act(binding, { kind: "keypress", keys: ["ENTER"] })).toMatchObject({
      accepted: true,
      backendActionId: "action-1",
    })
    await expect(controller.act(binding, { kind: "keypress", keys: ["ENTER"] })).rejects.toMatchObject({
      code: "STALE_OBSERVATION",
    })
    expect(backend.actions).toEqual([
      {
        kind: "keypress",
        computerId: "computer-1",
        displayId: "display-1",
        keys: ["ENTER"],
      },
    ])
  })

  test(
    "projects the exact Computer tool set into an assigned direct Work conversation",
    { timeout: 30_000 },
    async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          await ConversationCapability.update("work", {
            kind: "mcp_server",
            ref: BrowserMCPBuiltin.ServerName,
            assigned: false,
          })
          const settings = await ConversationCapability.update("work", {
            kind: "mcp_server",
            ref: ComputerMCPBuiltin.ServerName,
            assigned: true,
          })
          expect(settings.mcp).toMatchObject({
            assigned_server_refs: [ComputerMCPBuiltin.ServerName],
          })
          expect(settings.mcp.configured_server_refs).toContain(ComputerMCPBuiltin.ServerName)

          const config = await Config.get()
          const tools = await ConversationCapability.runtimeMcpTools(
            config,
            "work",
            "session-computer-catalog-contract",
          )
          expect(Object.keys(tools).sort()).toEqual(
            ComputerMCPBuiltin.ImportableToolNames.map((name) => `computer_${name}`).sort(),
          )

          const executionMcpToolIDs = Object.keys(tools)
          const harnessProjection = await ConversationCapability.harnessProjection("work", {
            config,
            executionToolIDs: executionMcpToolIDs,
            executionMcpToolIDs,
          })
          const { caller, snapshot } = await CapabilityCatalog.runtimeSnapshot({
            config,
            sessionID: "session-computer-catalog-contract",
            agentID: "work",
            executionToolIDs: executionMcpToolIDs,
            harnessProjection,
          })
          const mcpEntries = snapshot.entries.filter((entry) => entry.ref.owner_ref === "mcp-config")
          expect(mcpEntries.map((entry) => [entry.ref.kind, entry.ref.local_ref, entry.availability])).toEqual([
            ["mcp_server", "browser", "installed_unbound"],
            ["mcp_server", "computer", "visible"],
            ...executionMcpToolIDs.sort().map((toolID) => ["mcp_tool", toolID, "visible"]),
          ])
          expect(
            searchCapabilityCatalog(snapshot, caller, { next_owner_kinds: ["call_tool"] }).map(
              (entry) => entry.ref.local_ref,
            ),
          ).toEqual(executionMcpToolIDs)
          expect(ConversationCapability.runtimeMcpOwnerIdentity("session-computer-catalog-contract")).toBe(
            "conversation:session-computer-catalog-contract:computer",
          )
          expect(ConversationCapability.runtimeMcpOwnerIdentity("session-computer-independent-contract")).toBe(
            "conversation:session-computer-independent-contract:computer",
          )
          await ConversationCapability.disposeRuntimeMcp("session-computer-catalog-contract")
        },
      })
    },
  )

  test("materializes an observation with Computer identity and its persisted image attachment", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const observationDigest = "a".repeat(64)
        const result = await materializeMcpToolResult({
          projectID: Instance.project.id,
          serverName: ComputerMCPBuiltin.ServerName,
          result: {
            content: [{ type: "image", data: pngBase64(8, 6), mimeType: "image/png" }],
            structuredContent: {
              ok: true,
              computer_id: "computer-1",
              display_id: "display-1",
              observation_id: "observation-1",
              observation_digest: observationDigest,
              width: 8,
              height: 6,
              mime_type: "image/png",
            },
          },
        })

        expect(result.attachments).toHaveLength(1)
        expect(result.metadata).toEqual({
          computer: {
            computerId: "computer-1",
            displayId: "display-1",
            observationId: "observation-1",
            observationDigest,
            screenshot: {
              mimeType: "image/png",
              width: 8,
              height: 6,
              attachmentUrl: result.attachments[0]!.url,
              sha: result.attachments[0]!.sha,
            },
          },
          mcp_tool_result: { is_error: false },
        })

        expect(
          await materializeMcpToolResult({
            projectID: Instance.project.id,
            serverName: ComputerMCPBuiltin.ServerName,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    ok: true,
                    computer_id: "computer-1",
                    display_id: "display-1",
                    driver_version: "0.12.2",
                  }),
                },
              ],
              structuredContent: {
                ok: true,
                computer_id: "computer-1",
                display_id: "display-1",
                driver_version: "0.12.2",
              },
            },
          }),
        ).toMatchObject({
          attachments: [],
          metadata: {
            computer: {
              computerId: "computer-1",
              displayId: "display-1",
              driverVersion: "0.12.2",
            },
            mcp_tool_result: { is_error: false },
          },
        })
      },
    })
  })

  test(
    "projects explicitly declared Computer tools through an Expert Squad harness with canonical permissions",
    { timeout: 30_000 },
    async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const profileID = "computer-harness-contract"
          await ExpertSquadConversationAuthoring.author({
            projectDirectory: project.path,
            installationScope: "project",
            replace: false,
            definition: buildExpertSquadAuthorDefinition({
              schema_version: 1,
              namespace: "test",
              id: profileID,
              name: "Computer Harness Contract",
              label: "Computer Harness Contract",
              description: "Projects the exact Computer capability through an Expert Squad harness.",
              version: "2026.08.07.1",
              product_pillars: ["work"],
              readme: "# Computer Harness Contract\n\nExercises exact Computer projection.\n",
              selector: {
                summary: "Exercise exact Computer projection.",
                selection_guidance: "Select for the Computer harness contract.",
                instructions: "# Selection\n\nSelect for the Computer harness contract.\n",
              },
              scheduler: {
                prompt: "Coordinate the exact Computer harness contract.",
                default_mcp_tool_refs: [...ComputerMCPBuiltin.ImportableToolRefs],
              },
              agents: {
                "computer-contract-worker": {
                  label: "Computer Contract Worker",
                  description: "Executes the exact projected Computer contract.",
                  base_role: "build",
                  prompt: "Execute the exact projected Computer contract.",
                },
              },
              virtual_workflows: {},
            }),
          })
          const config = Config.Info.parse({
            prompt_profile: { active: profileID },
            mcp: { [ComputerMCPBuiltin.ServerName]: { enabled: false } },
          })
          const capability = await PromptProfileResolver.resolveSchedulerCapability({
            projectDirectory: project.path,
            config,
          })
          expect(capability.defaultMcpTools.map((entry) => entry.ref)).toEqual([
            ...ComputerMCPBuiltin.ImportableToolRefs,
          ])

          configureTaskIngressRunner(async () => {})
          const taskID = await EngineService.createTask(
            {
              requestID: "computer-harness-contract-task",
              request: "Project the exact Computer tools through the Expert Squad harness",
              productPillar: "work",
              model: "firmware/gpt-5",
              promptProfile: profileID,
              expectedPackageDigest: capability.packageRevision.packageDigest,
            },
            { actor: "user" },
          )

          const harness = PromptProfileResolver.schedulerHarnessProjection({
            taskID,
            capability,
          })
          expect(harness.mcp_tool_refs).toEqual(
            capability.defaultMcpTools
              .map((entry) => ({
                kind: "mcp_tool" as const,
                source: "project" as const,
                owner_ref: "default-mcp-registry",
                local_ref: entry.providerName,
              }))
              .sort((left, right) => left.local_ref.localeCompare(right.local_ref)),
          )

          const owner = MCP.createScopedConnectionOwner("test:computer-harness-contract")
          try {
            const projected = await PromptProfileResolver.projectOrchestratorTools(
              Object.fromEntries(capability.builtInToolIDs.map((toolID) => [toolID, {}])),
              capability,
              {
                taskID,
                projectDirectory: project.path,
                connectionOwner: owner,
              },
            )
            expect(Object.keys(projected).sort()).toEqual(
              [...capability.builtInToolIDs, ...capability.defaultMcpTools.map((entry) => entry.providerName)].sort(),
            )
            for (const entry of capability.defaultMcpTools) {
              const toolName = entry.ref.split("/").at(-1)!
              expect(computerMcpPermissionKeyOf(projected[entry.providerName] as object)).toBe(`computer_${toolName}`)
            }
          } finally {
            await owner.close()
          }
        },
      })
    },
  )
})

describe("embedded CUA Driver contract", () => {
  test("packages the pinned CUA SDK and exact native libraries for Windows and macOS", () => {
    expect(artifactRuntimeNodeModuleNames({ os: "win32", arch: "x64" })).toEqual(
      expect.arrayContaining(["@trycua/cua-driver", "@trycua/cua-driver-win32-x64-msvc", "@ubjs/node-win32-x64-msvc"]),
    )
    expect(artifactRuntimeNodeModuleNames({ os: "darwin", arch: "arm64" })).toEqual(
      expect.arrayContaining(["@trycua/cua-driver", "@trycua/cua-driver-darwin-arm64", "@ubjs/node-darwin-arm64"]),
    )
  })

  test("maps one native desktop session and every Computer action through the typed SDK", async () => {
    const calls: Array<{ operation: string; input: unknown }> = []
    const ok = (operation: string, input: unknown): ToolResult => {
      calls.push({ operation, input })
      return { text: "ok", images: [], isError: false, degraded: false, rawJson: "{}" }
    }
    const driver = {
      isAvailable: () => true,
      metadata: async () => ({
        driverVersion: "0.12.2",
        contractVersion: "0.2.0",
        toolsListSchemaVersion: "1",
        capabilityVersion: "1",
        mcpProtocolVersion: "2025-06-18",
        pid: 42,
        embedded: true,
      }),
      startSession: async (input: unknown) => {
        calls.push({ operation: "startSession", input })
        return {
          active: true,
          revived: false,
          state: {
            session: (input as { session: string }).session,
            captureScope: 2,
            effectiveScope: 1,
            desktopUnlocked: true,
          },
        }
      },
      getDesktopState: async (input: unknown) => {
        calls.push({ operation: "getDesktopState", input })
        return {
          text: "desktop screenshot",
          images: [{ mimeType: "image/png", dataBase64: pngBase64(12, 9) }],
          structuredJson: JSON.stringify({
            display: "primary",
            platform: "windows",
            screen_width: 12,
            screen_height: 9,
            screenshot_width: 12,
            screenshot_height: 9,
            screenshot_mime_type: "image/png",
          }),
          isError: false,
          degraded: false,
          rawJson: "{}",
        }
      },
      click: async (input: unknown) => ok("click", input),
      typeText: async (input: unknown) => ok("typeText", input),
      pressKey: async (input: unknown) => ok("pressKey", input),
      hotkey: async (input: unknown) => ok("hotkey", input),
      scroll: async (input: unknown) => ok("scroll", input),
      drag: async (input: unknown) => ok("drag", input),
      endSession: async (input: unknown) => {
        calls.push({ operation: "endSession", input })
        return { session: (input as { session: string }).session, active: false }
      },
    } as unknown as CuaDriverLike
    const backend = new CuaComputerBackend(driver)
    const created = await backend.create()
    expect(created).toMatchObject({ displayId: "primary", driverVersion: "0.12.2" })
    expect(await backend.observe(created)).toMatchObject({
      computerId: created.computerId,
      displayId: "primary",
    })
    expect(await backend.act({ kind: "click", ...created, x: 2, y: 3, button: "left" })).toMatchObject({
      accepted: true,
    })
    expect(await backend.act({ kind: "type_text", ...created, text: "OpenCorvus" })).toMatchObject({ accepted: true })
    expect(await backend.act({ kind: "keypress", ...created, keys: ["ENTER"] })).toMatchObject({ accepted: true })
    expect(await backend.act({ kind: "keypress", ...created, keys: ["CTRL", "L"] })).toMatchObject({ accepted: true })
    expect(await backend.act({ kind: "scroll", ...created, x: 5, y: 6, direction: "down", amount: 3 })).toMatchObject({
      accepted: true,
    })
    expect(
      await backend.act({ kind: "drag", ...created, from: { x: 1, y: 2 }, to: { x: 8, y: 7 }, durationMs: 500 }),
    ).toMatchObject({ accepted: true })
    expect(await backend.destroy({ computerId: created.computerId })).toEqual({ destroyed: true })
    expect(calls.map((call) => call.operation)).toEqual([
      "startSession",
      "getDesktopState",
      "getDesktopState",
      "click",
      "typeText",
      "pressKey",
      "hotkey",
      "scroll",
      "drag",
      "endSession",
    ])
  })
})

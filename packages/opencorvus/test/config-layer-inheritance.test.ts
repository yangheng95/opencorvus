import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Hono } from "hono"
import { Config } from "@/config/config"
import { ConfigPaths } from "@/config/paths"
import { Global } from "@/global"
import { Instance } from "@/project/instance"
import { ConfigRoutes } from "@/server/routes/config"
import { serverErrorResponse } from "@/server/error-handler"
import { Bus } from "@/bus"
import { PermissionAuthority } from "@/permission/authority"
import { PermissionPolicyTable } from "@/permission/permission.sql"
import { Session } from "@/session"
import { Database, eq } from "@/storage/db"
import { SkillManager } from "@/skill/manager"
import { removeProvider } from "@/provider/removal"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const globalFile = path.join(Global.Path.config, ConfigPaths.CANONICAL_FILE_NAME)
const baseline = {
  prompt_profile: { active: "base" },
  permission_mode: "ask",
  experimental: {
    auto_question: false,
    memory: { document_token_limit: 5000, organizer_input_token_budget: 16000, pending_availability_limit: 50 },
  },
  terminal: {
    profiles: { public: { label: "Public", command: "powershell", args: ["-NoProfile"], env: { MODE: "public" } } },
  },
}
const priorInline = process.env.OPENCORVUS_CONFIG_CONTENT
const priorConfigDir = process.env.OPENCORVUS_CONFIG_DIR
beforeEach(async () => {
  await fs.mkdir(Global.Path.config, { recursive: true })
  await fs.writeFile(globalFile, JSON.stringify(baseline))
  Config.global.reset()
})
afterEach(async () => {
  if (priorInline === undefined) delete process.env.OPENCORVUS_CONFIG_CONTENT
  else process.env.OPENCORVUS_CONFIG_CONTENT = priorInline
  if (priorConfigDir === undefined) delete process.env.OPENCORVUS_CONFIG_DIR
  else process.env.OPENCORVUS_CONFIG_DIR = priorConfigDir
  await Instance.disposeAll()
  await resetMemoryDatabase()
  await fs.rm(globalFile, { force: true })
  Config.global.reset()
})

async function source(directory: string, value: unknown) {
  const file = ConfigPaths.projectFile(directory)
  await fs.mkdir(path.dirname(file), { recursive: true })
  if (value !== undefined) await fs.writeFile(file, typeof value === "string" ? value : JSON.stringify(value))
  return file
}
function selected(config: Config.Info) {
  return { profile: config.prompt_profile.active, mode: config.permission_mode }
}
async function invalid(operation: Promise<unknown>) {
  try {
    await operation
  } catch (error) {
    expect(Config.InvalidError.isInstance(error as Error)).toBe(true)
    return (error as InstanceType<typeof Config.InvalidError>).data
  }
  throw new Error("Expected the explicit ConfigInvalidError contract")
}

describe.serial("declared configuration layers and effective defaults", () => {
  for (const [name, value] of [
    ["absent", undefined],
    ["empty", ""],
    ["whitespace", " \n\t"],
    ["empty object", {}],
    ["unrelated username", { username: "public-project" }],
  ] as const) {
    test(`${name} project source preserves explicit global profile and permission`, async () => {
      await using project = await memoryProject()
      await source(project.path, value)
      expect(selected(await Config.snapshotForProject(project.path))).toEqual({ profile: "base", mode: "ask" })
    })
  }

  test("partial nested objects preserve the actual inherited question, memory and terminal values", async () => {
    await using project = await memoryProject()
    await source(project.path, {
      experimental: { openTelemetry: true, memory: { enabled: true } },
      terminal: { profiles: { public: { label: "Project public" } } },
    })
    const config = await Config.snapshotForProject(project.path)
    expect(config.experimental).toEqual({
      ...baseline.experimental,
      openTelemetry: true,
      memory: { ...baseline.experimental.memory, enabled: true },
    })
    expect(config.terminal?.profiles?.public).toEqual({ ...baseline.terminal.profiles.public, label: "Project public" })
    expect(selected(config)).toEqual({ profile: "base", mode: "ask" })
  })

  test("a source relation is checked with its actual inherited memory limit", async () => {
    await using project = await memoryProject()
    await source(project.path, { experimental: { memory: { organizer_input_token_budget: 12000 } } })
    const config = await Config.snapshotForProject(project.path)
    expect(config.experimental?.memory).toEqual({
      ...baseline.experimental.memory,
      organizer_input_token_budget: 12000,
    })
  })

  test("explicit defaults, false, zero and empty argument arrays remain authored values", async () => {
    await using project = await memoryProject()
    await source(project.path, {
      prompt_profile: { active: "dynamic" },
      permission_mode: "full_access",
      compaction: { tail_turns: 0, auto: false },
      terminal: { profiles: { public: { args: [] } } },
    })
    const config = await Config.snapshotForProject(project.path)
    expect(selected(config)).toEqual({ profile: "dynamic", mode: "full_access" })
    expect(config.compaction).toEqual({ tail_turns: 0, auto: false })
    expect(config.terminal?.profiles?.public).toEqual({ ...baseline.terminal.profiles.public, args: [] })
  })

  test("source values normalize explicit leaves while getProject keeps the declared shape", async () => {
    await using project = await memoryProject()
    const file = await source(project.path, {
      network: { proxy: { url: "  http://127.0.0.1:9999  " } },
      experimental: { memory: { organizer_input_token_budget: 12000 } },
    })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        expect(await Config.getProject()).toEqual({
          network: { proxy: { url: "http://127.0.0.1:9999" } },
          experimental: { memory: { organizer_input_token_budget: 12000 } },
        })
        expect((await Config.get()).network?.proxy?.url).toBe("http://127.0.0.1:9999")
        expect(JSON.parse(await fs.readFile(file, "utf8")).network.proxy.url).toBe("  http://127.0.0.1:9999  ")
      },
    })
  })

  for (const [name, value, issue] of [
    ["unknown field", { mistyped_setting: true }, { code: "unrecognized_keys", path: [] }],
    ["wrong permission type", { permission_mode: true }, { code: "invalid_value", path: ["permission_mode"] }],
    [
      "invalid effective memory relation",
      { experimental: { memory: { organizer_input_token_budget: 12000, document_token_limit: 10000 } } },
      { code: "custom", path: ["experimental", "memory", "organizer_input_token_budget"] },
    ],
  ] as const) {
    test(`${name} produces the canonical typed source error`, async () => {
      await using project = await memoryProject()
      const file = await source(project.path, value)
      const error = await invalid(Config.snapshotForProject(project.path))
      expect(error.path).toBe(file)
      expect(error.issues).toEqual([expect.objectContaining(issue)])
    })
  }

  test("project atomic writer reads only authored values and publishes a valid cumulative candidate", async () => {
    await using project = await memoryProject()
    await source(project.path, { username: "before" })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        let writable: unknown
        await Config.updateProjectPatchAtomic((current) => {
          writable = current
          return { username: "after", experimental: { memory: { organizer_input_token_budget: 12000 } } }
        })
        expect(writable).toEqual({ username: "before" })
        expect(await Config.getProject()).toEqual({
          $schema: "https://opencorvus.ai/config.json",
          username: "after",
          experimental: { memory: { organizer_input_token_budget: 12000 } },
        })
        expect(selected(await Config.get())).toEqual({ profile: "base", mode: "ask" })
        expect((await Config.get()).experimental?.memory?.organizer_input_token_budget).toBe(12000)
        expect(await Config.snapshotForProject(project.path)).toEqual(await Config.get())
      },
    })
  }, 60_000)

  test("the public project PATCH handler retains inheritance and null restores a global field", async () => {
    await using project = await memoryProject()
    await source(project.path, {})
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const app = new Hono().route("/config", ConfigRoutes())
        app.onError(serverErrorResponse)
        for (const [patch, expected] of [
          [{ username: "public-config" }, { profile: "base", mode: "ask" }],
          [
            { prompt_profile: { active: "dynamic" }, permission_mode: "full_access" },
            { profile: "dynamic", mode: "full_access" },
          ],
          [
            { prompt_profile: null, permission_mode: null },
            { profile: "base", mode: "ask" },
          ],
        ] as const) {
          const response = await app.request("/config", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(patch),
          })
          const body = await response.json()
          expect(response.status, JSON.stringify(body)).toBe(200)
          expect(selected(body)).toEqual(expected)
        }
        expect(await Config.getProject()).toEqual({
          $schema: "https://opencorvus.ai/config.json",
          username: "public-config",
        })
      },
    })
  }, 60_000)

  test("global atomic callbacks separate effective defaults from the actual writable source", async () => {
    await fs.writeFile(globalFile, "{}")
    Config.global.reset()
    let callback: unknown
    await Config.updateGlobalPatchAtomic((effective, writable) => {
      callback = { effective, writable }
      return { username: "first-public-setting" }
    })
    expect(callback).toEqual({ effective: Config.Info.parse({}), writable: {} })
    expect(await Config.getGlobal()).toEqual(
      Config.Info.parse({ $schema: "https://opencorvus.ai/config.json", username: "first-public-setting" }),
    )
    expect(JSON.parse(await fs.readFile(globalFile, "utf8"))).toEqual({
      $schema: "https://opencorvus.ai/config.json",
      username: "first-public-setting",
    })
  }, 60_000)

  test("global null deletion preserves schema defaults and the sparse writable source", async () => {
    await fs.writeFile(globalFile, "{}")
    Config.global.reset()
    const config = await Config.updateGlobalPatch({ prompt_profile: null, permission_mode: null })
    expect(config).toEqual(Config.Info.parse({}))
    expect(JSON.parse(await fs.readFile(globalFile, "utf8"))).toEqual({})
    await Config.updateGlobalPatch({ prompt_profile: { active: "base" }, permission_mode: "ask" })
    const cleared = await Config.updateGlobalPatch({ prompt_profile: null, permission_mode: null })
    expect(cleared).toEqual(Config.Info.parse({ $schema: "https://opencorvus.ai/config.json" }))
    expect(JSON.parse(await fs.readFile(globalFile, "utf8"))).toEqual({ $schema: "https://opencorvus.ai/config.json" })
  }, 60_000)

  test("inline and explicit resource-directory layers merge only their declared nested leaves", async () => {
    await using project = await memoryProject()
    await source(project.path, { username: "project-public" })
    const extra = path.join(project.path, "owned-config-resources")
    await fs.mkdir(extra)
    await fs.writeFile(
      path.join(extra, ConfigPaths.CANONICAL_FILE_NAME),
      JSON.stringify({ experimental: { openTelemetry: true } }),
    )
    process.env.OPENCORVUS_CONFIG_DIR = extra
    process.env.OPENCORVUS_CONFIG_CONTENT = JSON.stringify({
      experimental: { memory: { organizer_input_token_budget: 12000 } },
    })
    const config = await Config.snapshotForProject(project.path)
    expect(selected(config)).toEqual({ profile: "base", mode: "ask" })
    expect(config.experimental).toEqual({
      ...baseline.experimental,
      openTelemetry: true,
      memory: { ...baseline.experimental.memory, organizer_input_token_budget: 12000 },
    })
  })

  test("configured extension arrays keep their additive order and ordinary arrays remain replaceable", async () => {
    await fs.writeFile(
      globalFile,
      JSON.stringify({ ...baseline, instructions: ["global-public.md", "shared-public.md"] }),
    )
    await using project = await memoryProject()
    await source(project.path, {
      instructions: ["shared-public.md", "project-public.md"],
      terminal: { profiles: { public: { args: ["-NoLogo"] } } },
    })
    const config = await Config.snapshotForProject(project.path)
    expect(config.instructions).toEqual(["global-public.md", "shared-public.md", "project-public.md"])
    expect(config.terminal?.profiles?.public?.args).toEqual(["-NoLogo"])
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        expect((await Config.getProject()).instructions).toEqual(["shared-public.md", "project-public.md"])
        let writable: unknown
        await Config.updateProjectPatchAtomic((current) => {
          writable = current.instructions
          return { username: "array-source" }
        })
        expect(writable).toEqual(["shared-public.md", "project-public.md"])
        expect((await Config.getProject()).instructions).toEqual(["shared-public.md", "project-public.md"])
        expect((await Config.get()).instructions).toEqual(["global-public.md", "shared-public.md", "project-public.md"])
      },
    })
  })

  test("legacy explicit permission migration remains an authored source decision", async () => {
    await using project = await memoryProject()
    await source(project.path, { permission: "allow", username: "legacy-public" })
    const config = await Config.snapshotForProject(project.path)
    expect(selected(config)).toEqual({ profile: "base", mode: "full_access" })
    expect(config.permission_migration).toEqual({
      version: 1,
      source_fields: ["permission"],
      permission_mode: "full_access",
      reason: "all_allow",
    })
  })

  test("Skill path installation, policy update and removal preserve the canonical source contract", async () => {
    await using project = await memoryProject()
    const skillPath = path.join(project.path, "public-skill")
    await fs.mkdir(skillPath)
    await fs.writeFile(
      path.join(skillPath, "SKILL.md"),
      "---\nname: layer-public\ndescription: Public configuration contract\n---\n\nPublic text.\n",
    )
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        expect(await SkillManager.install({ kind: "path", value: skillPath, policy: "allow" })).toEqual({
          source: skillPath,
          kind: "path",
        })
        expect((await Config.getGlobal()).skills?.paths).toEqual([skillPath])
        expect((await Config.getGlobal()).skill_policy).toEqual({ "layer-public": "allow" })
        expect(await SkillManager.setPolicy({ name: "layer-public", action: "deny" })).toBe(true)
        expect((await Config.getGlobal()).skill_policy).toEqual({ "layer-public": "deny" })
        expect(await SkillManager.remove({ source: skillPath, kind: "path" })).toBe(true)
        expect((await Config.getGlobal()).skills).toEqual({ paths: [], urls: [] })
        expect(selected(await Config.getGlobal())).toEqual({ profile: "base", mode: "ask" })
      },
    })
  }, 60_000)

  test("Provider removal consumes the actual sparse project source and publishes its committed result", async () => {
    await using project = await memoryProject()
    await source(project.path, {
      disabled_providers: ["public-unconfigured"],
      provider: { "public-unconfigured": { name: "Public config", options: { timeout: false } } },
      agent: { chat: { description: "Public source", model: "public-unconfigured/public-model" } },
    })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const writable = await Config.getProject()
        expect(writable.provider).toEqual({
          "public-unconfigured": { name: "Public config", options: { timeout: false } },
        })
        expect(writable.agent).toEqual({
          chat: { description: "Public source", model: "public-unconfigured/public-model" },
        })
        expect(await removeProvider({ providerID: "public-unconfigured", scope: "project" })).toEqual({
          providerID: "public-unconfigured",
          scope: "project",
          status: "committed",
          config: "committed",
          credential: "absent",
          residue: [],
        })
        expect(await Config.getProject()).toEqual({
          $schema: "https://opencorvus.ai/config.json",
          provider: {},
          agent: { chat: { description: "Public source" } },
        })
        expect(selected(await Config.get())).toEqual({ profile: "base", mode: "ask" })
      },
    })
  }, 60_000)

  test("two projects preserve their separate authored overrides over one global source", async () => {
    await using first = await memoryProject("config-layer-first")
    await using second = await memoryProject("config-layer-second")
    await source(first.path, { username: "first" })
    await source(second.path, { prompt_profile: { active: "dynamic" }, permission_mode: "full_access" })
    expect(selected(await Config.snapshotForProject(first.path))).toEqual({ profile: "base", mode: "ask" })
    expect(selected(await Config.snapshotForProject(second.path))).toEqual({ profile: "dynamic", mode: "full_access" })
  })

  test("inherited Ask mode becomes a real request and an explicit allow_once result", async () => {
    await using project = await memoryProject()
    await source(project.path, { username: "permission-public" })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Inherited public policy" })
        let resolveAsked!: (request: PermissionAuthority.Request) => void
        const asked = new Promise<PermissionAuthority.Request>((resolve) => {
          resolveAsked = resolve
        })
        const stop = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) => resolveAsked(properties))
        const execution = PermissionAuthority.authorizeAndExecute(
          {
            projectID: Instance.project.id,
            sessionID: session.id,
            messageID: "msg_config_layer_public",
            toolCallID: "call_config_layer_public",
            providerKind: "builtin",
            providerID: "builtin",
            toolName: "webfetch",
            args: { url: "https://example.test/public" },
          },
          async () => "public-result",
        )
        try {
          const first = await Promise.race([
            asked.then((request) => ({ kind: "asked" as const, request })),
            execution.then((output) => ({ kind: "completed" as const, output })),
          ])
          expect(first.kind).toBe("asked")
          if (first.kind !== "asked") throw new Error("Expected inherited Ask request")
          expect(first.request.mode).toBe("ask")
          await PermissionAuthority.reply({
            requestID: first.request.id,
            decision: "allow_once",
            actorID: "public-test-operator",
            autoReply: false,
          })
          expect(await execution).toBe("public-result")
          const policy = Database.use((db) =>
            db.select().from(PermissionPolicyTable).where(eq(PermissionPolicyTable.session_id, session.id)).get(),
          )!
          expect({ projectID: policy.project_id, mode: policy.mode }).toEqual({
            projectID: Instance.project.id,
            mode: "ask",
          })
        } finally {
          stop()
        }
      },
    })
  }, 60_000)
})

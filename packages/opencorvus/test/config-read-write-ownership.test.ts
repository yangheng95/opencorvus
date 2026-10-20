import { afterEach, beforeEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "@/config/config"
import { ConfigPaths } from "@/config/paths"
import { Global } from "@/global"
import { Instance } from "@/project/instance"
import { Process } from "@/util/process"
import { parse } from "jsonc-parser"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const schema = "https://opencorvus.ai/config.json"
const baseline = { $schema: schema, prompt_profile: { active: "base" }, permission_mode: "ask" }
const globalFile = path.join(Global.Path.config, ConfigPaths.CANONICAL_FILE_NAME)

beforeEach(async () => {
  await fs.mkdir(Global.Path.config, { recursive: true })
  await fs.writeFile(globalFile, JSON.stringify(baseline))
  Config.global.reset()
  await Config.state.resetAll()
})

afterEach(async () => {
  Config.TestHooks.afterSourceSnapshotRead = undefined
  Config.TestHooks.afterSourceSnapshotParsed = undefined
  await resetMemoryDatabase()
})

for (const scope of ["project", "global"] as const) {
  for (const representation of ["schema", "legacy-permission"] as const) {
    test(`${scope} ${representation} reader retains a real peer's accepted fields`, async () => {
      await using project = await memoryProject()
      const projectFile = path.join(project.path, ".opencorvus", ConfigPaths.CANONICAL_FILE_NAME)
      await fs.mkdir(path.dirname(projectFile), { recursive: true })
      await fs.writeFile(projectFile, JSON.stringify({ $schema: schema, prompt_profile: { active: "base" } }))
      await Instance.provideProjectIdentity({ directory: project.path, fn: () => undefined })
      const target = scope === "project" ? projectFile : globalFile
      const initial =
        representation === "schema"
          ? { username: "reader-before", permission_mode: "full_access", prompt_profile: { active: "base" } }
          : { $schema: schema, username: "reader-before", permission: "allow", prompt_profile: { active: "base" } }
      await fs.writeFile(target, JSON.stringify(initial))
      Config.global.reset()
      await Config.state.resetAll()
      let peer: Record<string, unknown> | undefined
      let acknowledgement: unknown
      let interleaved = false
      Config.TestHooks.afterSourceSnapshotRead = async (input) => {
        if (interleaved || path.resolve(input.path) !== path.resolve(target)) return
        interleaved = true
        const patch = {
          username: "peer-after",
          permission_mode: "ask",
          ...(scope === "project" ? { agent: { coding: { description: "peer-after" } } } : {}),
        }
        const result = await Process.runHost(
          [
            process.execPath,
            "run",
            path.join(import.meta.dir, "fixture", "config-peer-writer.ts"),
            scope,
            project.path,
            JSON.stringify(patch),
          ],
          {
            cwd: path.resolve(import.meta.dir, ".."),
            env: { ...process.env },
            owner: "config-read-write-peer",
            stdin: "ignore",
            inactivityTimeoutMs: 30000,
          },
        )
        acknowledgement = JSON.parse(result.stdout.toString())
        peer = JSON.parse(await fs.readFile(target, "utf8"))
      }
      try {
        const read = await Instance.provideProjectIdentity({ directory: project.path, fn: () => Config.get() })
        const saved = JSON.parse(await fs.readFile(target, "utf8"))
        expect({
          interleaved,
          acknowledgement,
          reader: { username: read.username, mode: read.permission_mode },
        }).toEqual({
          interleaved: true,
          acknowledgement: scope === "project" ? { description: "peer-after" } : { username: "peer-after" },
          reader: { username: "peer-after", mode: "ask" },
        })
        expect(saved).toEqual(peer)
      } finally {
        Config.TestHooks.afterSourceSnapshotRead = undefined
      }
    }, 60000)
  }
}

test("ordinary reads retain the complete authored schema-less source", async () => {
  await using project = await memoryProject()
  const target = path.join(project.path, ".opencorvus", ConfigPaths.CANONICAL_FILE_NAME)
  const authored = '// Kept by the config owner\n{ "username": "authored", "prompt_profile": { "active": "base" } }\n'
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, authored)
  const read = await Instance.provideProjectIdentity({ directory: project.path, fn: () => Config.get() })
  expect({ username: read.username, source: await fs.readFile(target, "utf8") }).toEqual({
    username: "authored",
    source: authored,
  })
})

test("legacy migration retains comments and literal references with its version-one audit", async () => {
  await using project = await memoryProject()
  const target = path.join(project.path, ".opencorvus", ConfigPaths.CANONICAL_FILE_NAME)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(path.join(project.path, "public-name.txt"), "reference-name")
  const authored =
    "// Keep this authored comment\n" +
    JSON.stringify({
      username: "{file:../public-name.txt}",
      permission: { read: "allow", bash: "ask" },
      prompt_profile: { active: "base" },
    })
  await fs.writeFile(target, authored)
  const read = await Instance.provideProjectIdentity({ directory: project.path, fn: () => Config.get() })
  const text = await fs.readFile(target, "utf8")
  const audit = { version: 1, source_fields: ["permission"], permission_mode: "ask", reason: "restricted_or_mixed" }
  expect({ username: read.username, mode: read.permission_mode, audit: read.permission_migration }).toEqual({
    username: "reference-name",
    mode: "ask",
    audit,
  })
  expect(text).toContain("// Keep this authored comment")
  expect(parse(text)).toEqual({
    username: "{file:../public-name.txt}",
    permission_mode: "ask",
    permission_migration: audit,
    prompt_profile: { active: "base" },
  })
})

test("legacy migration resolves the configured environment value before persisting its canonical mode", async () => {
  await using project = await memoryProject()
  const target = path.join(project.path, ".opencorvus", ConfigPaths.CANONICAL_FILE_NAME)
  const key = "OPENCORVUS_TEST_CONFIG_MIGRATION_PERMISSION"
  const previous = process.env[key]
  process.env[key] = '"allow"'
  try {
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, '{ "permission": {env:' + key + '}, "username": "expanded-public" }')
    const read = await Instance.provideProjectIdentity({ directory: project.path, fn: () => Config.get() })
    expect({
      username: read.username,
      mode: read.permission_mode,
      source: parse(await fs.readFile(target, "utf8")),
    }).toEqual({
      username: "expanded-public",
      mode: "full_access",
      source: {
        username: "expanded-public",
        permission_mode: "full_access",
        permission_migration: {
          version: 1,
          source_fields: ["permission"],
          permission_mode: "full_access",
          reason: "all_allow",
        },
      },
    })
  } finally {
    if (previous === undefined) delete process.env[key]
    else process.env[key] = previous
  }
})

for (const scope of ["project", "global"] as const) {
  test(`${scope} atomic owner settles legacy source reads within its callback`, async () => {
    await using project = await memoryProject()
    const projectFile = path.join(project.path, ".opencorvus", ConfigPaths.CANONICAL_FILE_NAME)
    await fs.mkdir(path.dirname(projectFile), { recursive: true })
    await fs.writeFile(projectFile, JSON.stringify({ permission: "allow", prompt_profile: { active: "base" } }))
    await fs.writeFile(globalFile, JSON.stringify({ permission: { bash: "ask" }, prompt_profile: { active: "base" } }))
    const observed: string[] = []
    const saved = await Instance.provideProjectIdentity({
      directory: project.path,
      fn: () => {
        const patch = async () => {
          const read = await Config.get()
          const global = await Config.global()
          observed.push(read.permission_mode, global.permission_mode)
          return { username: `${scope}-accepted` }
        }
        return scope === "project" ? Config.updateProjectPatchAtomic(patch) : Config.updateGlobalPatchAtomic(patch)
      },
    })
    const target = scope === "project" ? projectFile : globalFile
    const source = parse(await fs.readFile(target, "utf8"))
    expect({
      username: saved.username,
      observed,
      source: { username: source.username, mode: source.permission_mode, schema: source.$schema },
    }).toEqual({
      username: `${scope}-accepted`,
      observed: ["full_access", "ask"],
      source: { username: `${scope}-accepted`, mode: scope === "project" ? "full_access" : "ask", schema },
    })
  }, 30000)
}

test("project and global peer owners converge from both legacy sources", async () => {
  await using project = await memoryProject()
  const projectFile = path.join(project.path, ".opencorvus", ConfigPaths.CANONICAL_FILE_NAME)
  await fs.mkdir(path.dirname(projectFile), { recursive: true })
  await fs.writeFile(projectFile, JSON.stringify({ permission: { bash: "ask" }, prompt_profile: { active: "base" } }))
  await fs.writeFile(globalFile, JSON.stringify({ permission: "allow", prompt_profile: { active: "base" } }))
  const results = await Promise.allSettled(
    (["project", "global"] as const).map((scope) =>
      Process.runHost(
        [
          process.execPath,
          "run",
          path.join(import.meta.dir, "fixture", "config-peer-writer.ts"),
          scope,
          project.path,
          JSON.stringify({
            username: `${scope}-accepted`,
            ...(scope === "project" ? { agent: { coding: { description: "project-accepted" } } } : {}),
          }),
        ],
        {
          cwd: path.resolve(import.meta.dir, ".."),
          env: { ...process.env },
          owner: `config-legacy-${scope}-peer`,
          stdin: "ignore",
          inactivityTimeoutMs: 30000,
        },
      ),
    ),
  )
  expect(
    results.map((result) =>
      result.status === "fulfilled" ? JSON.parse(result.value.stdout.toString()) : String(result.reason),
    ),
  ).toEqual([{ description: "project-accepted" }, { username: "global-accepted" }])
  const sources = await Promise.all(
    [projectFile, globalFile].map(async (file) => parse(await fs.readFile(file, "utf8"))),
  )
  expect(
    sources.map((source) => ({ username: source.username, mode: source.permission_mode, schema: source.$schema })),
  ).toEqual([
    { username: "project-accepted", mode: "ask", schema },
    { username: "global-accepted", mode: "full_access", schema },
  ])
}, 60000)

test("MCP owner commits the current metadata and preserves migrated authored fields", async () => {
  await using project = await memoryProject()
  const target = path.join(project.path, ".opencorvus", ConfigPaths.CANONICAL_FILE_NAME)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(
    target,
    "// Preserve MCP settings\n" + JSON.stringify({ username: "mcp-author", permission: "allow" }),
  )
  expect(
    await Config.writeMcpConfigEntry("public", { type: "local", command: ["echo", "ready"], enabled: false }, target),
  ).toBe(target)
  const text = await fs.readFile(target, "utf8")
  expect(text).toContain("// Preserve MCP settings")
  expect(parse(text)).toEqual({
    $schema: schema,
    username: "mcp-author",
    permission_mode: "full_access",
    permission_migration: {
      version: 1,
      source_fields: ["permission"],
      permission_mode: "full_access",
      reason: "all_allow",
    },
    mcp: { public: { type: "local", command: ["echo", "ready"], enabled: false } },
  })
})

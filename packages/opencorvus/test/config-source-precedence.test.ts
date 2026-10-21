import { describe, expect, test } from "bun:test"
import path from "node:path"
import fs from "node:fs/promises"
import { Process } from "@/util/process"
import { tmpdir } from "./fixture/fixture"

describe.serial("source precedence with independent static custom-file flags", () => {
  for (const variant of [
    { name: "custom file", username: "custom-user", mode: "full_access", tailTurns: 8 },
    {
      name: "custom file with global resource alias",
      aliasGlobal: true,
      username: "custom-user",
      mode: "full_access",
      tailTurns: 8,
    },
    {
      name: "custom file with normalized global resource alias",
      aliasGlobal: true,
      globalSuffix: ".",
      username: "custom-user",
      mode: "full_access",
      tailTurns: 8,
    },
    {
      name: "custom file with Windows case-equivalent global resource alias",
      aliasGlobal: true,
      uppercaseGlobal: true,
      username: "custom-user",
      mode: "full_access",
      tailTurns: 8,
    },
    { name: "project source", project: true, username: "project-user", mode: "ask", tailTurns: 11 },
    {
      name: "explicit resources",
      project: true,
      resource: true,
      username: "resource-user",
      mode: "full_access",
      tailTurns: 14,
    },
    {
      name: "inline source",
      project: true,
      resource: true,
      inline: true,
      username: "inline-user",
      mode: "ask",
      tailTurns: 17,
    },
    {
      name: "managed source",
      project: true,
      resource: true,
      inline: true,
      managed: true,
      username: "managed-user",
      mode: "full_access",
      tailTurns: 21,
    },
  ]) {
    test.skipIf(variant.uppercaseGlobal === true && process.platform !== "win32")(
      `${variant.name} publishes its declared values and the global command resource`,
      async () => {
        await using scope = await tmpdir()
        const runtime = path.join(scope.path, "runtime")
        const globalDirectory = path.join(runtime, "config")
        const project = path.join(scope.path, "project")
        const resource = path.join(scope.path, "resources")
        const managed = path.join(scope.path, "managed")
        const custom = path.join(scope.path, "custom.jsonc")
        const output = path.join(scope.path, "observed.json")
        const write = async (directory: string, value: unknown) => {
          await fs.mkdir(directory, { recursive: true })
          await fs.writeFile(path.join(directory, "opencorvus.jsonc"), JSON.stringify(value))
        }
        await write(globalDirectory, { username: "global-user", permission_mode: "ask", compaction: { tail_turns: 3 } })
        await fs.writeFile(
          custom,
          JSON.stringify({ username: "custom-user", permission_mode: "full_access", compaction: { tail_turns: 8 } }),
        )
        await fs.mkdir(project)
        await fs.mkdir(managed)
        await fs.mkdir(path.join(globalDirectory, "commands"))
        await fs.writeFile(
          path.join(globalDirectory, "commands", "global_resource.md"),
          "---\ndescription: Global owned resource\n---\nUse the global command resource.",
        )
        if (variant.project)
          await write(path.join(project, ".opencorvus"), {
            username: "project-user",
            permission_mode: "ask",
            compaction: { tail_turns: 11 },
          })
        if (variant.resource)
          await write(resource, {
            username: "resource-user",
            permission_mode: "full_access",
            compaction: { tail_turns: 14 },
          })
        if (variant.managed)
          await write(managed, {
            username: "managed-user",
            permission_mode: "full_access",
            compaction: { tail_turns: 21 },
          })
        const child = await Process.runHost(
          [process.execPath, path.join(import.meta.dir, "fixture", "config-source-reader.ts"), project, output],
          {
            cwd: path.resolve(import.meta.dir, ".."),
            env: {
              OPENCORVUS_HOME: runtime,
              OPENCORVUS_TEST_HOME: path.join(scope.path, "home"),
              OPENCORVUS_TEST_MANAGED_CONFIG_DIR: managed,
              OPENCORVUS_CONFIG: custom,
              OPENCORVUS_CONFIG_DIR: variant.aliasGlobal
                ? (variant.uppercaseGlobal ? globalDirectory.toUpperCase() : globalDirectory) +
                  (variant.globalSuffix ? path.sep + variant.globalSuffix : "")
                : variant.resource
                  ? resource
                  : undefined,
              OPENCORVUS_CONFIG_CONTENT: variant.inline
                ? JSON.stringify({ username: "inline-user", permission_mode: "ask", compaction: { tail_turns: 17 } })
                : undefined,
              OPENCORVUS_DISABLE_EXTERNAL_SKILLS: "1",
            },
            stdin: "ignore",
            inactivityTimeoutMs: 30_000,
          },
        )
        expect(child.code).toBe(0)
        expect(JSON.parse(await fs.readFile(output, "utf8"))).toEqual({
          username: variant.username,
          mode: variant.mode,
          tailTurns: variant.tailTurns,
          globalResource: "Use the global command resource.",
        })
      },
      60_000,
    )
  }
})

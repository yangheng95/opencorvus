import { afterAll, describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { artifactBrowserMcpNodeRuntimeModules } from "../script/build-artifact"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { Identifier } from "../src/id/id"
import { BrowserMCPBuiltin } from "../src/mcp/browser/builtin"
import { BrowserMCPNodeLauncher } from "../src/mcp/browser/node-launcher"
import { MCP } from "../src/mcp"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { ProcessSupervisor } from "../src/shell/process-supervisor"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "base",
  version: "2026.08.09.1",
  packageDigest: "b".repeat(64),
}

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Browser Model Context Protocol Node sidecar bundle", () => {
  test("builds the complete Node entry without importing Host-only runtime modules", async () => {
    const child = Bun.spawn(
      [process.execPath, path.resolve(import.meta.dir, "../script/check-browser-mcp-node-bundle.ts")],
      {
        cwd: path.resolve(import.meta.dir, ".."),
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])

    expect({ exitCode, stderr, result: JSON.parse(stdout) }).toEqual({
      exitCode: 0,
      stderr: "",
      result: {
        outputs: 1,
        bytes: expect.any(Number),
      },
    })
  })

  test("declares the complete packaged Browser sidecar runtime closure", () => {
    expect(artifactBrowserMcpNodeRuntimeModules()).toEqual([{ name: "playwright" }])
  })

  test("materializes one Browser Node process plan from the configured environment", async () => {
    const runtime = await BrowserMCPNodeLauncher.resolveRuntime({ transport: "stdio" })
    const processPlan = await BrowserMCPBuiltin.resolveStdioProcess({
      env: { OPENCORVUS_BROWSER_TEST_ENVIRONMENT: "preserved" },
    })
    const packagedEnvironment = await BrowserMCPNodeLauncher.childEnvironment({
      packaged: true,
      env: { OPENCORVUS_BROWSER_TEST_ENVIRONMENT: "preserved" },
    })

    expect({
      executable: processPlan.executable,
      args: processPlan.args,
      configuredEnvironment: processPlan.env.OPENCORVUS_BROWSER_TEST_ENVIRONMENT,
      sourcePackageDirectory: processPlan.env.OPENCORVUS_BROWSER_MCP_SOURCE_PACKAGE_DIR,
    }).toEqual({
      executable: runtime.node,
      args: [runtime.bundle, "stdio"],
      configuredEnvironment: "preserved",
      sourcePackageDirectory: path.resolve(import.meta.dir, ".."),
    })
    expect({
      configuredEnvironment: packagedEnvironment.OPENCORVUS_BROWSER_TEST_ENVIRONMENT,
      packagedRuntime: packagedEnvironment.OPENCORVUS_BROWSER_MCP_PACKAGED,
    }).toEqual({
      configuredEnvironment: "preserved",
      packagedRuntime: "1",
    })
  })

  test("converges two process publishers on one verified Browser source bundle", async () => {
    const isolatedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-browser-bundle-race-"))
    const cacheRoot = path.join(isolatedRoot, "cache")
    const barrierRoot = path.join(isolatedRoot, "barrier")
    const worker = path.join(import.meta.dir, "fixture", "browser-mcp-node-bundle-process-worker.ts")
    await fs.mkdir(barrierRoot, { recursive: true })
    const children = ["one", "two"].map((workerID) =>
      Bun.spawn([process.execPath, worker, cacheRoot, barrierRoot, workerID], {
        cwd: isolatedRoot,
        env: { ...Bun.env, OPENCORVUS_HOME: path.join(isolatedRoot, "runtime") },
        stdout: "pipe",
        stderr: "pipe",
      }),
    )

    try {
      for (const workerID of ["one", "two"]) {
        const ready = path.join(barrierRoot, `ready-${workerID}`)
        const deadline = Date.now() + 10_000
        while (true) {
          try {
            await fs.access(ready)
            break
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
            if (Date.now() >= deadline) throw new Error(`Timed out waiting for Browser bundle worker ${workerID}`)
            await Bun.sleep(10)
          }
        }
      }
      await fs.writeFile(path.join(barrierRoot, "release"), "release", { flag: "wx" })

      const results = await Promise.all(
        children.map(async (child) => {
          const [exitCode, stdout, stderr] = await Promise.all([
            child.exited,
            new Response(child.stdout).text(),
            new Response(child.stderr).text(),
          ])
          if (exitCode !== 0) throw new Error(`Browser bundle worker failed (${exitCode}): ${stderr}`)
          return JSON.parse(stdout.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? "null") as {
            bundle: string
            digest: string
          }
        }),
      )

      expect(results[0]).toEqual(results[1])
      expect(path.basename(results[0]!.bundle)).toBe(`stdio-${results[0]!.digest}.mjs`)
      expect(createHash("sha256").update(await fs.readFile(results[0]!.bundle)).digest("hex")).toBe(
        results[0]!.digest,
      )
    } finally {
      for (const child of children) {
        try {
          child.kill()
        } catch {}
      }
      await Promise.all(children.map((child) => child.exited.catch(() => -1)))
      await fs.rm(isolatedRoot, { recursive: true, force: true })
    }
  }, 30_000)

  test("reuses one canonical Browser connection across hashed Task provider aliases and reports its owner", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const projectedTools = BrowserMCPBuiltin.ImportableToolRefs.map((ref, index) => {
          const toolName = ref.split("/").at(-1)!
          return {
            providerAlias: `default_mcp_tool__default_mcp_browser_tool_${toolName}__${index.toString(16).padStart(12, "0")}`,
            toolName,
          }
        })
        const taskRoot = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title: "Scoped Browser Task authority" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        persistTask({
          taskID,
          rootSession: taskRoot,
          now,
          title: "Scoped Browser Task authority",
          request: "Initialize the exact projected Browser MCP tool through Task process authority.",
          productPillar: "work",
          metadata: {},
          projectID: Instance.project.id,
          packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: project.path,
            packageRevisionSHA256: packageRevision.packageDigest,
            timeCreated: now,
          }),
        })
        const owner = MCP.createScopedConnectionOwner("browser-scoped-provider-alias")
        try {
          const scopedToolInfo = (key: string, toolName: string) =>
            MCP.scopedToolInfo({
              key,
              mcp: BrowserMCPBuiltin.localConfig(),
              cwd: project.path,
              connectionOwner: owner,
              connectionIdentity: "default/mcp/browser",
              processAuthority: MCP.taskProcessAuthority(taskID, project.path),
              toolName,
            })
          const tools = await Promise.all(
            projectedTools.map((projected) => scopedToolInfo(projected.providerAlias, projected.toolName)),
          )

          expect({
            connectionIdentity: "default/mcp/browser",
            taskID,
            projectedToolNames: tools.map((tool) => tool.name),
            descriptions: tools.map((tool) => tool.description),
            inputSchemaTypes: tools.map((tool) => tool.inputSchema.type),
            metrics: await MCP.connectionStats(),
            processes: ProcessSupervisor.metricsSnapshot(),
          }).toEqual({
            connectionIdentity: "default/mcp/browser",
            taskID,
            projectedToolNames: projectedTools.map((tool) => tool.toolName),
            descriptions: projectedTools.map(() => expect.any(String)),
            inputSchemaTypes: projectedTools.map(() => "object"),
            metrics: {
              projects: 1,
              connected: 1,
              local: 1,
              remote: 0,
              localStdioTransports: 1,
              connecting: 0,
              failedAwaitingReconnect: 0,
            },
            processes: {
              live: 1,
              owners: {
                "mcp-stdio": { count: 1, pids: [expect.any(Number)] },
              },
            },
          })
        } finally {
          await owner.close()
        }
        expect(await MCP.connectionStats()).toEqual({
          projects: 1,
          connected: 0,
          local: 0,
          remote: 0,
          localStdioTransports: 0,
          connecting: 0,
          failedAwaitingReconnect: 0,
        })
        expect(ProcessSupervisor.metricsSnapshot()).toEqual({ live: 0, owners: {} })
      },
    })
  })
})

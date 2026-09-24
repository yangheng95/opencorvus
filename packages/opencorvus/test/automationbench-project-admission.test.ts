import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { Config } from "../src/config/config"
import { ConfigPaths } from "../src/config/paths"
import { Instance } from "../src/project/instance"
import { PromptProfileResolver } from "../src/expert-squad/prompt-profile-resolver"
import { removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"

test.skipIf(!process.env.OPENCORVUS_INSPECT_TEST_PYTHON)(
  "Inspect sample enters actual product config and squad projection with a live official MCP",
  async () => {
    const repository = path.resolve(import.meta.dir, "../../..")
    const packageRoot = path.join(repository, "packages/inspect-benchmark")
    const python = process.env.OPENCORVUS_INSPECT_TEST_PYTHON!
    const root = await fs.mkdtemp(path.join(process.env.OPENCORVUS_TEST_PROCESS_ROOT!, "inspect-admission-"))
    const project = path.join(root, "sample")
    const child = Bun.spawn(
      [
        python,
        path.join(packageRoot, "tests/project_admission.py"),
        project,
        path.join(repository, "expert-squads/builtin/automationbench"),
        path.join(packageRoot, "src/opencorvus_inspect/examples/automationbench-smoke.json"),
      ],
      { stdin: "pipe", stdout: "pipe", stderr: "pipe", signal: AbortSignal.timeout(55_000) },
    )
    const errors = new Response(child.stderr).text()
    try {
      const reader = child.stdout.getReader()
      const decoder = new TextDecoder()
      let ready = ""
      try {
        while (!ready.includes("\n")) {
          const chunk = await reader.read()
          if (chunk.done) throw new Error(`Inspect project preparation exited: ${await errors}`)
          ready += decoder.decode(chunk.value, { stream: true })
        }
      } finally {
        reader.releaseLock()
      }
      const receipt = JSON.parse(ready.trim()) as { project: string; endpoint: string }
      for (const args of [
        ["init", "-q"],
        [
          "-c",
          "user.name=Inspect Test",
          "-c",
          "user.email=inspect@example.invalid",
          "-c",
          "commit.gpgsign=false",
          "commit",
          "--allow-empty",
          "-qm",
          "Inspect sample",
        ],
      ]) {
        const git = Bun.spawn(["git", ...args], { cwd: project, stdout: "pipe", stderr: "pipe" })
        expect(await git.exited).toBe(0)
      }
      expect(await ConfigPaths.assertCanonicalProject(project, project)).toBe(
        path.join(project, ".opencorvus/opencorvus.jsonc"),
      )
      await Instance.provide({
        directory: project,
        fn: async () => {
          const loaded = await Config.get()
          expect(loaded.mcp?.automationbench).toMatchObject({
            type: "remote",
            url: receipt.endpoint,
            transport: "streamable-http",
          })
          const config = Config.Info.parse({ ...loaded, prompt_profile: { active: "automationbench" } })
          const revision = await PromptProfileResolver.resolveActivePackageRevision({
            projectDirectory: project,
            config,
          })
          const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
            projectDirectory: project,
            config,
            packageRevision: revision,
          })
          expect(Object.keys(scheduler.virtualWorkflows)).toEqual(["execute-verify"])
          for (const agentID of ["automationbench-executor", "automationbench-verifier"]) {
            const worker = await PromptProfileResolver.resolveWorkerCapability({
              projectDirectory: project,
              config,
              packageRevision: revision,
              agentID,
            })
            expect(worker.defaultMcpTools.map((tool) => tool.ref)).toEqual([
              "default/mcp/automationbench/tool/api_fetch",
              "default/mcp/automationbench/tool/api_search",
              "default/mcp/automationbench/tool/base64_encode",
            ])
            expect(worker.defaultMcpServers.automationbench).toMatchObject({ url: receipt.endpoint })
          }
          const client = new Client({ name: "inspect-project-admission", version: "1" })
          try {
            await client.connect(new StreamableHTTPClientTransport(new URL(receipt.endpoint)))
            const result = await client.callTool({ name: "base64_encode", arguments: { text: "project-admission" } })
            expect(result.content).toEqual([{ type: "text", text: "cHJvamVjdC1hZG1pc3Npb24=" }])
          } finally {
            await client.close()
          }
        },
      })
    } finally {
      try {
        await Instance.disposeAll()
      } finally {
        child.stdin.end()
        const exitCode = await child.exited
        await errors
        await removeManagedDirectoryTree(root)
        expect(exitCode).toBe(0)
      }
    }
  },
  60_000,
)

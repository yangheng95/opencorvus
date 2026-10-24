import fs from "node:fs/promises"
import path from "node:path"
import { setDurablePublicationTestCutHook } from "@opencorvus-ai/util/durable-publication"
import { ImplicitProject } from "../../src/project/implicit-project"
import { Instance } from "../../src/project/instance"
import { Global } from "../../src/global"
import { Config } from "../../src/config/config"
import { MCP } from "../../src/mcp"
import { McpAuth } from "../../src/mcp/auth"

const [action, directory] = process.argv.slice(2)
async function wait(name: string) {
  const deadline = Date.now() + 60000
  while (true) {
    try {
      await fs.stat(path.join(Global.Path.root, name))
      return
    } catch {}
    if (Date.now() >= deadline) throw new Error(`owned MCP barrier timed out: ${name}`)
    await Bun.sleep(10)
  }
}
if (action === "setup") {
  const created = await ImplicitProject.create()
  console.log(JSON.stringify({ directory: created.directory }))
} else {
  try {
    const result = await Instance.provide({
      directory,
      fn: async () => {
        const name = "mcp-receipt-recovery"
        if (action === "b") {
          await MCP.status()
          await fs.writeFile(path.join(Global.Path.root, "b-ready"), "ready")
          await wait("b-start")
          setDurablePublicationTestCutHook(async (cut, kind) => {
            if (cut === "subject-queued" && kind === "skill-catalog-replacement")
              await fs.writeFile(path.join(Global.Path.root, "b-attempt"), "queued")
          })
        }
        if (action === "a")
          Config.TestHooks.beforeProjectRuntimeSettlement = async () => {
            await fs.writeFile(path.join(Global.Path.root, "a-ready"), "committed")
            await wait("a-release")
          }
        if (action === "exit") Config.TestHooks.beforeProjectRuntimeSettlement = async () => process.exit(23)
        if (action !== "inspect")
          await MCP.configure(
            name,
            {
              type: "remote",
              transport: "streamable-http",
              url: "https://audit.invalid/unreachable",
              enabled: false,
              oauth: false,
              credential: action === "b" ? { type: "header", name: "X-Audit-Only" } : { type: "bearer" },
            },
            action === "b" ? "AUDIT_SYNTHETIC_B" : "AUDIT_SYNTHETIC_A",
          )
        else await MCP.status()
        const entry = await McpAuth.get(`${Instance.project.id}:${name}`)
        return {
          available: !!entry?.staticCredential,
          matchesA: entry?.staticCredential?.secret === "AUDIT_SYNTHETIC_A",
          matchesB: entry?.staticCredential?.secret === "AUDIT_SYNTHETIC_B",
          definition: (await Config.getProject()).mcp?.[name],
        }
      },
    })
    console.log(JSON.stringify(result))
  } finally {
    await Instance.disposeAll()
  }
}

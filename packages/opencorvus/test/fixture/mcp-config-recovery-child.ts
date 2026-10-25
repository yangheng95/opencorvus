import fs from "node:fs/promises"
import path from "node:path"
import { setDurablePublicationTestCutHook } from "@opencorvus-ai/util/durable-publication"
import { ImplicitProject } from "../../src/project/implicit-project"
import { Instance } from "../../src/project/instance"
import { Global } from "../../src/global"
import { Config } from "../../src/config/config"
import { MCP } from "../../src/mcp"
import { McpAuth } from "../../src/mcp/auth"
import { GlobalBus } from "../../src/bus/global"

const [action, directory] = process.argv.slice(2)
async function peerRuntimeRace(credential = false) {
  const name = "peer-credential-race"
  const original = {
    type: "remote" as const,
    transport: "streamable-http" as const,
    url: "https://audit.invalid/unreachable",
    enabled: false,
    oauth: false as const,
    credential: { type: "bearer" as const },
  }
  const replacement = { ...original, credential: { type: "header" as const, name: "X-Audit-Only" } }
  if (credential) await MCP.configure(name, original, "AUDIT_SYNTHETIC_A")
  else await MCP.status()
  const directory = Instance.directory
  const peerEntered = Promise.withResolvers<void>()
  const localCommitted = Promise.withResolvers<void>()
  const observed: string[] = []
  const listener = (event: { directory?: string; payload: { type?: string; properties?: Config.Info } }) => {
    if (event.directory !== directory || event.payload.type !== "config.changed") return
    const username = event.payload.properties?.username
    if (username === "peer-owner-middle" || username === "peer-owner-final") observed.push(username)
  }
  GlobalBus.on("event", listener)
  Config.TestHooks.beforePeerRuntimeSettlement = async (input) => {
    if (input.directory !== directory || input.config.username !== "peer-owner-middle") return
    peerEntered.resolve()
    await localCommitted.promise
  }
  Config.TestHooks.beforeProjectRuntimeSettlement = async (input) => {
    if (input.directory !== directory) return
    if (credential) {
      const definition = input.config.mcp?.[name]
      if (!definition || !("credential" in definition) || definition.credential?.type !== "header") return
    } else if (input.config.username !== "peer-owner-final") return
    localCommitted.resolve()
  }
  try {
    const filename = Config.projectConfigFile()
    await fs.mkdir(path.dirname(filename), { recursive: true })
    await fs.writeFile(
      filename,
      JSON.stringify({
        ...(await Config.getProject()),
        username: "peer-owner-middle",
        ...(credential
          ? { mcp: { [name]: { ...original, credential: { type: "header", name: "X-Peer-Only" } } } }
          : {}),
      }),
    )
    await Config.get()
    await peerEntered.promise
    if (credential) {
      await MCP.configure(name, replacement, "AUDIT_SYNTHETIC_B")
      const entry = await McpAuth.get(`${Instance.project.id}:${name}`)
      return {
        available: !!entry?.staticCredential,
        matchesB: entry?.staticCredential?.secret === "AUDIT_SYNTHETIC_B",
        definition: (await Config.getProject()).mcp?.[name],
      }
    }
    const final = await Config.updateProjectPatch({ username: "peer-owner-final" })
    return { username: final.username, canonical: (await Config.getProject()).username, observed }
  } finally {
    Config.TestHooks.beforePeerRuntimeSettlement = undefined
    Config.TestHooks.beforeProjectRuntimeSettlement = undefined
    GlobalBus.off("event", listener)
  }
}
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
        if (action === "peer-runtime-race") return peerRuntimeRace()
        if (action === "peer-credential-race") return peerRuntimeRace(true)
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

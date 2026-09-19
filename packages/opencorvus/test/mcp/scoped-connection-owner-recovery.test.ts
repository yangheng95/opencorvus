import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { MCP } from "@/mcp"
import { Instance } from "@/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function waitForDisconnected(owner: MCP.ScopedConnectionOwner, serverID: string) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const entry = owner.catalogSnapshot().entries.find((candidate) => candidate.server_id === serverID)
    if (entry?.status.status === "disconnected") return
    await Bun.sleep(10)
  }
  throw new Error(`Scoped MCP owner did not observe ${serverID} disconnect`)
}

describe("scoped MCP connection owner recovery", () => {
  test("reconnects the next inventory occurrence after its retained transport closes unexpectedly", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const launches = path.join(project.path, "scoped-owner-launches.log")
        const fixture = path.join(project.path, "scoped-owner-recovery-fixture.mjs")
        await fs.writeFile(
          fixture,
          [
            'import fs from "node:fs";',
            'import readline from "node:readline";',
            'fs.appendFileSync(process.argv[2], `${process.pid}\\n`);',
            'const send = (value) => process.stdout.write(`${JSON.stringify(value)}\\n`);',
            'readline.createInterface({ input: process.stdin }).on("line", (line) => {',
            '  const request = JSON.parse(line);',
            '  if (request.method === "initialize") return send({ jsonrpc: "2.0", id: request.id, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "scoped-owner-recovery", version: "1" } } });',
            '  if (request.method === "tools/list") return send({ jsonrpc: "2.0", id: request.id, result: { tools: [{ name: "status", description: "Read fixture status", inputSchema: { type: "object", properties: {}, additionalProperties: false } }] } });',
            '});',
          ].join("\n"),
          { flag: "wx" },
        )
        const owner = MCP.createScopedConnectionOwner("scoped-owner-recovery")
        const input = {
          key: "recovery-fixture",
          mcp: { type: "local" as const, command: [process.execPath, fixture, launches], timeout: 10_000 },
          cwd: project.path,
          connectionOwner: owner,
          connectionIdentity: "session:scoped-owner-recovery",
          processAuthority: MCP.hostProcessAuthority(project.path),
        }
        try {
          const initial = await MCP.inspectScopedCapabilities(input)
          expect(initial.tools).toEqual(["status"])
          const initialPid = Number((await fs.readFile(launches, "utf8")).trim())
          process.kill(initialPid)

          await waitForDisconnected(owner, input.key)
          const recovered = await MCP.inspectScopedCapabilities(input)
          const launchedPids = (await fs.readFile(launches, "utf8")).trim().split(/\r?\n/)

          expect(recovered.tools).toEqual(["status"])
          expect(new Set(launchedPids).size).toBe(2)
          expect(owner.catalogSnapshot().entries).toEqual([
            expect.objectContaining({ server_id: input.key, status: { status: "connected" } }),
          ])
        } finally {
          await owner.close()
        }
      },
    })
  }, 60_000)
})

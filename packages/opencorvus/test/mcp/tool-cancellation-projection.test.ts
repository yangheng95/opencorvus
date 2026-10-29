import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { MCP } from "../../src/mcp"
import { Config } from "../../src/config/config"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { PermissionAuthority } from "../../src/permission/authority"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function readObserved(file: string) {
  const limit = Date.now() + 5_000
  while (Date.now() < limit) {
    try {
      return JSON.parse(await fs.readFile(file, "utf8"))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
    await Bun.sleep(10)
  }
  throw new Error(`Expected real MCP receipt at ${file}`)
}

for (const mode of ["catalog", "scoped-definition", "scoped-direct"] as const) {
  test(`${mode} forwards caller cancellation to the real MCP request`, async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = path.join(project.path, "receiver.mjs")
        const startedFile = path.join(project.path, "started.json")
        const cancelledFile = path.join(project.path, "cancelled.json")
        await fs.writeFile(
          fixture,
          [
            "import readline from 'node:readline'; import fs from 'node:fs';",
            `const started=${JSON.stringify(startedFile)},cancelled=${JSON.stringify(cancelledFile)};`,
            "const send=(v)=>process.stdout.write(JSON.stringify(v)+'\\n');",
            "readline.createInterface({input:process.stdin}).on('line',(line)=>{const q=JSON.parse(line);",
            "if(q.method==='initialize')return send({jsonrpc:'2.0',id:q.id,result:{protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'cancel-receiver',version:'1'}}});",
            "if(q.method==='tools/list')return send({jsonrpc:'2.0',id:q.id,result:{tools:[{name:'wait',description:'Cancellable request',inputSchema:{type:'object',properties:{},additionalProperties:false}}]}});",
            "if(q.method==='tools/call')return fs.writeFileSync(started,JSON.stringify({id:q.id,name:q.params.name}));",
            "if(q.method==='notifications/cancelled')return fs.writeFileSync(cancelled,JSON.stringify(q.params));",
            "});",
          ].join("\n"),
        )
        const mcp = Config.Mcp.parse({ type: "local", command: [process.execPath, fixture], timeout: 10_000 })
        const owner = MCP.createScopedConnectionOwner(`cancel-${mode}`)
        const connection = {
          key: "receiver",
          mcp,
          cwd: project.path,
          connectionOwner: owner,
          connectionIdentity: `cancel-${mode}`,
          processAuthority: MCP.hostProcessAuthority(project.path),
          toolName: "wait",
        }
        const session = await Session.create({ kind: "assistant", title: `Cancellation ${mode}` })
        const controller = new AbortController()
        try {
          let execute: () => Promise<unknown>
          if (mode === "catalog") {
            await Config.updateProjectPatch({ mcp: { receiver: mcp } })
            await MCP.connect("receiver")
            const config = await Config.get()
            const catalog = await MCP.observedCatalogSnapshot(config)
            const definition = await MCP.exactCatalogTool({
              config,
              binding: catalog.tool_bindings.receiver_wait!,
              expectedOwnerRevision: catalog.owner_revision,
              processAuthority: connection.processAuthority,
            })
            execute = async () =>
              definition.execute!({}, { toolCallId: `call_${mode}`, messages: [], abortSignal: controller.signal })
          } else if (mode === "scoped-definition") {
            const definition = await MCP.scopedTool(connection)
            execute = async () =>
              definition.execute!({}, { toolCallId: `call_${mode}`, messages: [], abortSignal: controller.signal })
          } else {
            await MCP.scopedToolInfo(connection)
            execute = () => MCP.callScopedTool({ ...connection, args: {}, signal: controller.signal })
          }
          const result = PermissionAuthority.authorizeAndExecute(
            {
              projectID: Instance.project.id,
              sessionID: session.id,
              messageID: `msg_${mode}`,
              toolCallID: `call_${mode}`,
              providerKind: "mcp",
              providerID: "receiver",
              providerDigest: "cancel-receiver-fixture-v1",
              toolName: "wait",
              args: {},
            },
            execute,
          )
          const settled = result.then(
            (value) => ({ status: "completed", value }),
            (error) => ({ status: "cancelled", error }),
          )
          const actual = await readObserved(startedFile)
          const reason = new DOMException(`Cancel ${mode} request`, "AbortError")
          controller.abort(reason)
          expect(await settled).toMatchObject({
            status: "cancelled",
            error: {
              code: -32001,
              message: expect.stringContaining(reason.message),
            },
          })
          expect(await readObserved(cancelledFile)).toMatchObject({ requestId: actual.id })
        } finally {
          controller.abort()
          await owner.close()
        }
      },
    })
  }, 30_000)
}

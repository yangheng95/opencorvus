import { afterEach, describe, expect, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { MCP } from "../../src/mcp"
import { ComputerHostRuntime } from "../../src/mcp/computer/host-runtime"
import { createComputerRuntimeConnectionOwner } from "../../src/mcp/computer/runtime-owner"
import { computerRuntimeScopeIdentity } from "../../src/mcp/computer/runtime-scope"
import { Instance } from "../../src/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("a scoped MCP owner settles the Computer session it owns", () => {
  function startRemoteMcpServer() {
    return Bun.serve({
      port: 0,
      fetch: async (request) => {
        const mcp = new McpServer({ name: "computer-owner-remote-fixture", version: "1.0.0" })
        mcp.tool("scope_echo", async () => ({ content: [{ type: "text" as const, text: "scoped" }] }))
        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        })
        await mcp.connect(transport)
        return transport.handleRequest(request)
      },
    })
  }

  test("projects through the original scoped connection and destroys exactly its own Computer runtime scope", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const scope = computerRuntimeScopeIdentity({
          ownerKind: "worker",
          taskID: "tsk_computer_scope_probe",
          sessionID: "ses_computer_scope_probe",
        })
        const destroyed: string[] = []
        const fixture = path.join(project.path, "computer-runtime-owner-fixture.mjs")
        await fs.writeFile(
          fixture,
          [
            "import readline from 'node:readline';",
            "const rl=readline.createInterface({input:process.stdin});",
            "const send=(value)=>process.stdout.write(JSON.stringify(value)+'\\n');",
            "rl.on('line',(line)=>{const request=JSON.parse(line); if(request.method==='initialize') return send({jsonrpc:'2.0',id:request.id,result:{protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'computer-owner-fixture',version:'1'}}}); if(request.method==='tools/list') return send({jsonrpc:'2.0',id:request.id,result:{tools:[{name:'scope_echo',description:'Echo scoped owner cwd',inputSchema:{type:'object',properties:{},additionalProperties:false}}]}}); if(request.method==='tools/call') return send({jsonrpc:'2.0',id:request.id,result:{content:[{type:'text',text:process.cwd()}]}});});",
          ].join("\n"),
          { flag: "wx" },
        )
        const destroy = spyOn(ComputerHostRuntime, "destroy").mockImplementation(async (runtimeScope: string) => {
          destroyed.push(runtimeScope)
        })
        const owner = createComputerRuntimeConnectionOwner(scope)
        let projected: Awaited<ReturnType<typeof MCP.scopedTool>>
        try {
          const connection = {
            key: "computer-owner-fixture",
            mcp: { type: "local", command: [process.execPath, fixture], timeout: 10_000 },
            cwd: project.path,
            connectionOwner: owner,
            connectionIdentity: scope,
            processAuthority: MCP.hostProcessAuthority(project.path),
            toolName: "scope_echo",
          } as const
          projected = await MCP.scopedTool(connection)
        } finally {
          await owner.close()
          destroy.mockRestore()
        }
        expect(projected.description).toBe("Echo scoped owner cwd")
        // The owner's settlement is what tears the desktop session down — not
        // Project disposal, which is only the outer safety net.
        expect(destroyed).toEqual([scope])
      },
    })
  }, 60_000)

  test("reports a Computer teardown failure after its scoped MCP connection settled", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const scope = computerRuntimeScopeIdentity({
          ownerKind: "session",
          sessionID: "ses_computer_scope_failure",
        })
        const destroy = spyOn(ComputerHostRuntime, "destroy").mockRejectedValue(
          new Error("injected Computer teardown failure"),
        )
        try {
          const owner = createComputerRuntimeConnectionOwner(scope)
          await expect(owner.close()).rejects.toThrow("injected Computer teardown failure")
        } finally {
          destroy.mockRestore()
        }
      },
    })
  }, 60_000)

  test("runs successful Computer teardown once when connection settlement is reported and then retried", async () => {
    await using project = await memoryProject()
    const server = startRemoteMcpServer()
    const scope = computerRuntimeScopeIdentity({
      ownerKind: "session",
      sessionID: "ses_computer_scope_connection_failure",
    })
    const destroy = spyOn(ComputerHostRuntime, "destroy").mockResolvedValue()
    const owner = createComputerRuntimeConnectionOwner(scope)
    let closeTransport: ReturnType<typeof spyOn> | undefined
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          await MCP.scopedTool({
            key: "computer-owner-remote-fixture",
            mcp: {
              type: "remote",
              transport: "streamable-http",
              url: `http://127.0.0.1:${server.port}`,
              timeout: 10_000,
            },
            cwd: project.path,
            connectionOwner: owner,
            connectionIdentity: scope,
            processAuthority: MCP.hostProcessAuthority(project.path),
            toolName: "scope_echo",
          })
        },
      })
      closeTransport = spyOn(StreamableHTTPClientTransport.prototype, "close").mockRejectedValue(
        new Error("injected scoped transport close failure"),
      )

      const failure = await Instance.disposeAll().catch((error) => error)
      expect(failure).toBeInstanceOf(AggregateError)
      const messages = (failure as AggregateError).errors.flatMap((error) => {
        if (error instanceof AggregateError) return error.errors.map((nested) => (nested as Error).message)
        return [(error as Error).message]
      })
      expect(messages.some((message) => message.includes("injected scoped transport close failure"))).toBeTrue()
      expect(destroy).toHaveBeenCalledTimes(1)

      closeTransport.mockRestore()
      closeTransport = undefined
      await Instance.disposeAll()
      await owner.close()
      await owner.close()
      expect(destroy).toHaveBeenCalledTimes(1)
    } finally {
      closeTransport?.mockRestore()
      destroy.mockRestore()
      server.stop(true)
    }
  }, 60_000)

  test("aggregates connection and Computer teardown failures while retrying only the failed teardown", async () => {
    await using project = await memoryProject()
    const server = startRemoteMcpServer()
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const scope = computerRuntimeScopeIdentity({
            ownerKind: "session",
            sessionID: "ses_computer_scope_aggregate_failure",
          })
          let teardownAttempts = 0
          const destroy = spyOn(ComputerHostRuntime, "destroy").mockImplementation(async () => {
            teardownAttempts++
            if (teardownAttempts === 1) throw new Error("injected Computer teardown failure")
          })
          const owner = createComputerRuntimeConnectionOwner(scope)
          await MCP.scopedTool({
            key: "computer-owner-aggregate-fixture",
            mcp: {
              type: "remote",
              transport: "streamable-http",
              url: `http://127.0.0.1:${server.port}`,
              timeout: 10_000,
            },
            cwd: project.path,
            connectionOwner: owner,
            connectionIdentity: scope,
            processAuthority: MCP.hostProcessAuthority(project.path),
            toolName: "scope_echo",
          })
          const closeTransport = spyOn(StreamableHTTPClientTransport.prototype, "close").mockRejectedValue(
            new Error("injected scoped transport close failure"),
          )
          try {
            const failure = await owner.close().catch((error) => error)
            expect(failure).toBeInstanceOf(AggregateError)
            expect((failure as AggregateError).errors.map((error) => (error as Error).message)).toEqual([
              "injected scoped transport close failure",
              "injected Computer teardown failure",
            ])
            expect(destroy).toHaveBeenCalledTimes(1)

            await owner.close()
            await owner.close()
            expect(destroy).toHaveBeenCalledTimes(2)
          } finally {
            closeTransport.mockRestore()
            destroy.mockRestore()
          }
        },
      })
    } finally {
      server.stop(true)
    }
  }, 60_000)
})

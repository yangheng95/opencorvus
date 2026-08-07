import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { ComputerMCPBuiltin } from "./builtin"
import { createComputerMcpServer } from "./tools"

export namespace ComputerMCP {
  export const ServerName = ComputerMCPBuiltin.ServerName
  export const command = ComputerMCPBuiltin.command
  export const localConfig = ComputerMCPBuiltin.localConfig

  export async function serveStdio() {
    const { server, controller } = createComputerMcpServer()
    const transport = new StdioServerTransport()
    let closing: Promise<void> | undefined
    const close = () => {
      closing ??= Promise.allSettled([controller.close(), Promise.resolve(server.close()), Promise.resolve(transport.close())])
        .then((results) => {
          const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
          if (failures.length === 1) throw failures[0]
          if (failures.length > 1) throw new AggregateError(failures, "Computer MCP shutdown failed")
        })
      return closing
    }
    transport.onclose = () => {
      void close().catch((error) => {
        console.error(`[computer-mcp] close failed: ${error instanceof Error ? error.message : String(error)}`)
      })
    }
    process.once("SIGINT", () => void close())
    process.once("SIGTERM", () => void close())
    await server.connect(transport)
  }
}

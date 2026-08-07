import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { createServer } from "http"
import { createMcpServer } from "./tools.js"
import { handleMonitorRequest } from "./monitor.js"
import { shutdownBrowserSessions } from "./sessions.js"
import type { IncomingMessage, Server, ServerResponse } from "node:http"

export namespace BrowserMCP {
  export type HttpServer = {
    port: number
    close(): Promise<void>
  }

  async function closeHttpServer(server: Server): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }

  export async function serveHttp(port = Number(process.env.PORT ?? 8931)): Promise<HttpServer> {
    const active = new Set<() => Promise<void>>()
    const handleRequest = async (req: IncomingMessage, res: ServerResponse) => {
      if (await handleMonitorRequest(req, res)) return

      if (req.url === "/mcp") {
        res.setHeader("Access-Control-Allow-Origin", "*")
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id, last-event-id")

        if (req.method === "OPTIONS") {
          res.writeHead(204)
          res.end()
          return
        }

        const server = createMcpServer()
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
        let releaseOperation: Promise<void> | undefined
        const release = () => {
          if (releaseOperation) return releaseOperation
          active.delete(release)
          const operation = Promise.allSettled([transport.close(), server.close()]).then((results) => {
            const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
            if (failures.length === 1) throw failures[0]
            if (failures.length > 1) throw new AggregateError(failures, "Browser MCP request cleanup failed")
          })
          releaseOperation = operation
          return operation
        }
        active.add(release)
        res.on("close", () => {
          void release().catch((error) => {
            console.error(
              `[browser-mcp] request cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
            )
          })
        })
        try {
          await server.connect(transport)
          await transport.handleRequest(req, res)
        } catch (error) {
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" })
            res.end(JSON.stringify({ error: "browser_mcp_request_failed" }))
          } else {
            res.destroy()
          }
          await release()
        }
        return
      }

      res.writeHead(404)
      res.end()
    }
    const httpServer = createServer((req, res) => {
      void handleRequest(req, res).catch((error) => {
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ error: "browser_mcp_request_failed" }))
        } else {
          res.destroy()
        }
        console.error(`[browser-mcp] request failed: ${error instanceof Error ? error.message : String(error)}`)
      })
    })

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        httpServer.removeListener("error", onError)
        reject(error)
      }
      httpServer.once("error", onError)
      httpServer.listen(port, () => {
        httpServer.removeListener("error", onError)
        resolve()
      })
    })
    const address = httpServer.address()
    if (!address || typeof address === "string") {
      await closeHttpServer(httpServer)
      throw new Error("Browser MCP HTTP server did not publish an internet socket")
    }
    console.error(`[browser-mcp] HTTP server listening on :${address.port}`)

    let closing: Promise<void> | undefined
    const removeSignalListeners = () => {
      process.off("SIGINT", onSigint)
      process.off("SIGTERM", onSigterm)
      httpServer.off("error", onRuntimeError)
    }
    const close = () => {
      if (closing) return closing
      removeSignalListeners()
      const operation = (async () => {
        const results = await Promise.allSettled([
          shutdownBrowserSessions(),
          ...[...active].map((release) => release()),
          closeHttpServer(httpServer),
        ])
        active.clear()
        const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
        if (failures.length === 1) throw failures[0]
        if (failures.length > 1) throw new AggregateError(failures, "Browser MCP HTTP shutdown failed")
      })()
      closing = operation
      return operation
    }
    const closeForSignal = (exitCode: number) => {
      void close().then(
        () => {
          process.exitCode = exitCode
        },
        (error) => {
          console.error(`[browser-mcp] HTTP shutdown failed: ${error instanceof Error ? error.message : String(error)}`)
          process.exitCode = 1
        },
      )
    }
    const onRuntimeError = (error: Error) => {
      console.error(`[browser-mcp] HTTP server failed: ${error.message}`)
      void close().catch((closeError) => {
        console.error(
          `[browser-mcp] HTTP cleanup after server failure failed: ${
            closeError instanceof Error ? closeError.message : String(closeError)
          }`,
        )
      })
    }
    const onSigint = () => closeForSignal(130)
    const onSigterm = () => closeForSignal(143)
    httpServer.on("error", onRuntimeError)
    process.once("SIGINT", onSigint)
    process.once("SIGTERM", onSigterm)

    return {
      port: address.port,
      close,
    }
  }

  export async function serveStdio() {
    const server = createMcpServer()
    const transport = new StdioServerTransport()
    let closing = false
    const close = async () => {
      if (closing) return
      closing = true
      await shutdownBrowserSessions()
      await Promise.resolve(server.close())
      await Promise.resolve(transport.close())
    }
    transport.onclose = () => {
      void close().catch((error) => {
        console.error(`[browser-mcp] close failed: ${error instanceof Error ? error.message : String(error)}`)
      })
    }
    await server.connect(transport)
  }
}

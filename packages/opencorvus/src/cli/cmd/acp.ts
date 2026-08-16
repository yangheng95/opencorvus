import { Log } from "@/util/log"
import path from "node:path"
import { cmd } from "./cmd"
import { AgentSideConnection, ndJsonStream } from "@agentclientprotocol/sdk"
import { ACP } from "@/acp/agent"
import { Server } from "@/server/server"
import { createOpenCorvusClient } from "@opencorvus-ai/sdk"
import { withNetworkOptions, resolveNetworkOptions } from "../network"
import { listenWithRecoveredServerRuntime, requireRecoveredServerRuntime } from "../server-runtime"
import { assertStartedTaskProjectRecoverySucceeded, recoverStartedTaskExecutions } from "@/engine/host-recovery"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"

const log = Log.create({ service: "acp-command" })

export async function listenForAcp(options: Server.ListenOptions) {
  const prepared = await requireRecoveredServerRuntime(await listenWithRecoveredServerRuntime({
    options,
    recover: async () => {
      const result = await recoverStartedTaskExecutions()
      assertStartedTaskProjectRecoverySucceeded(result)
    },
    disposeInstances: () => Instance.disposeAll(),
  }))
  return prepared.server
}

export const AcpCommand = cmd({
  command: "acp",
  describe: "start ACP (Agent Client Protocol) server",
  builder: (yargs) => {
    return withNetworkOptions(yargs).option("cwd", {
      describe: "working directory",
      type: "string",
      default: process.cwd(),
    })
  },
  handler: async (args) => {
    process.env.OPENCORVUS_CLIENT = "acp"
    const cwd = path.resolve(args.cwd as string)
    const opts = await resolveNetworkOptions(args)
    const server = await listenForAcp(opts)
    try {
      await Instance.provide({
        directory: cwd,
        init: InstanceBootstrap,
        fn: async () => {

          const sdk = createOpenCorvusClient({
            baseUrl: `http://${server.hostname}:${server.port}`,
          })

          const input = new WritableStream<Uint8Array>({
            write(chunk) {
              return new Promise<void>((resolve, reject) => {
                process.stdout.write(chunk, (err) => {
                  if (err) {
                    reject(err)
                  } else {
                    resolve()
                  }
                })
              })
            },
          })
          const output = new ReadableStream<Uint8Array>({
            start(controller) {
              process.stdin.on("data", (chunk: Buffer) => {
                controller.enqueue(new Uint8Array(chunk))
              })
              process.stdin.on("end", () => controller.close())
              process.stdin.on("error", (err) => controller.error(err))
            },
          })

          const stream = ndJsonStream(input, output)
          const agent = await ACP.init({ sdk })

          new AgentSideConnection((conn) => {
            return agent.create(conn, { sdk })
          }, stream)

          log.info("setup connection")
          process.stdin.resume()
          await new Promise((resolve, reject) => {
            process.stdin.on("end", resolve)
            process.stdin.on("error", reject)
          })
        },
      })
    } finally {
      await server.stop(true)
    }
  },
})

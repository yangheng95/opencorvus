import { describe, expect, test } from "bun:test"
import { ChannelSupervisor } from "../src/channel/supervisor"
import { Instance } from "../src/project/instance"
import { setServerUrl } from "../src/server/runtime-url"
import { memoryProject } from "./fixture/memory"

describe("ChannelSupervisor physical runtime receipt", () => {
  test("publishes only channels admitted by the runtime start receipt", async () => {
    await using project = await memoryProject()
    const originalFetch = globalThis.fetch
    let settleMatrixSync: ((response: Response) => void) | undefined
    const matrixSync = new Promise<Response>((resolve) => {
      settleMatrixSync = resolve
    })
    globalThis.fetch = (async (input) => {
      const url = String(input)
      if (url.includes("/_matrix/client/v3/account/whoami")) {
        return Response.json({ user_id: "@bot:matrix.test" })
      }
      if (url.includes("/_matrix/client/v3/sync")) return matrixSync
      if (url.includes("signal.test/v1/receive/")) {
        return new Response("signal unavailable", { status: 503 })
      }
      throw new Error(`Unexpected channel supervisor request: ${url}`)
    }) as unknown as typeof fetch

    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          setServerUrl(new URL("http://127.0.0.1:7878"))
          const running = await ChannelSupervisor.sync({
            channel: {
              matrix: {
                enabled: true,
                homeserver: "http://matrix.test",
                token: "matrix-token",
              },
              signal: {
                enabled: true,
                service: "http://signal.test",
                account: "+15550001111",
              },
            },
          })

          expect({
            running,
            matrix: await ChannelSupervisor.channelStatus("matrix"),
            signal: await ChannelSupervisor.channelStatus("signal"),
            handlesMatrix: await ChannelSupervisor.handles("matrix"),
            handlesSignal: await ChannelSupervisor.handles("signal"),
          }).toEqual({
            running: {
              status: "running",
              detail: "Managed runtime active for matrix.",
              channels: ["matrix"],
              logs: ["Registered: matrix", "Registered: signal", "Channel runtime active: matrix"],
              running: true,
            },
            matrix: {
              runtime_status: "running",
              runtime_detail: "Managed runtime active for matrix.",
            },
            signal: {
              runtime_status: "disabled",
              runtime_detail: "Managed runtime active for matrix.",
            },
            handlesMatrix: true,
            handlesSignal: false,
          })

          const disabling = ChannelSupervisor.sync({})
          settleMatrixSync!(Response.json({ next_batch: "settled" }))
          expect(await disabling).toMatchObject({
            status: "disabled",
            channels: [],
            running: false,
          })
        },
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

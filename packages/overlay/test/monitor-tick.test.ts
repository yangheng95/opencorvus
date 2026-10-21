import { describe, expect, test } from "bun:test"
import { once } from "node:events"
import { createServer } from "node:http"
import { makeMonitorTick } from "../src/services/monitor-tick"

// Transport-owner contracts only. Real page navigation is qualified manually.
describe("connection recovery receipts", () => {
  test("a pending workspace recovers through real HTTP after another probe published online", async () => {
    const server = createServer((request, response) => {
      response.setHeader("content-type", "application/json")
      response.end(JSON.stringify(request.url === "/health"
        ? { healthy: true }
        : { owner: "loopback-peer", state: "ready" }))
    })
    server.listen(0, "127.0.0.1")
    await once(server, "listening")
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("TCP listener receipt required")
    const url = "http://127.0.0.1:" + address.port
    let recovered = false
    let receipt: unknown
    try {
      const tick = makeMonitorTick({
        isHidden: () => false,
        isConnected: () => true,
        isRecoveryComplete: () => recovered,
        check: async () => {
          const response = await fetch(url + "/health")
          return response.ok && (await response.json() as { healthy: boolean }).healthy
        },
        onReconnect: async () => {
          receipt = await (await fetch(url + "/workspace")).json()
          recovered = true
        },
      })
      await tick()
      expect(receipt).toEqual({ owner: "loopback-peer", state: "ready" })
      expect(recovered).toBe(true)
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  })

  test("an offline owner publishes its successful recovery receipt", async () => {
    let connected = false
    let recovered = false
    const events: string[] = []
    const tick = makeMonitorTick({
      isHidden: () => false,
      isConnected: () => connected,
      isRecoveryComplete: () => recovered,
      check: async () => {
        connected = true
        events.push("healthy")
        return true
      },
      onReconnect: async () => {
        recovered = true
        events.push("recovered")
      },
    })
    await tick()
    expect(events).toEqual(["healthy", "recovered"])
    expect({ connected, recovered }).toEqual({ connected: true, recovered: true })
  })

  test("a replacement server supplies the new recovery identity", async () => {
    let serverProcessID = 101
    let receipt: { owner: number } | undefined
    const tick = makeMonitorTick({
      isHidden: () => false,
      isConnected: () => true,
      isRecoveryComplete: () => true,
      connectionIdentity: () => serverProcessID,
      check: async () => {
        serverProcessID = 202
        return true
      },
      onReconnect: async () => { receipt = { owner: serverProcessID } },
    })
    await tick()
    expect(receipt).toEqual({ owner: 202 })
  })

  test("a failed workspace recovery retries to a concrete completed receipt", async () => {
    const failure = new Error("workspace load failed")
    const warnings: unknown[][] = []
    let attempt = 0
    let recovered = false
    let receipt: { state: string; attempt: number } | undefined
    const tick = makeMonitorTick({
      isHidden: () => false,
      isConnected: () => true,
      isRecoveryComplete: () => recovered,
      check: async () => true,
      onReconnect: async () => {
        if (++attempt === 1) throw failure
        receipt = { state: "ready", attempt }
        recovered = true
      },
      warn: (...args) => warnings.push(args),
    })
    await tick()
    await tick()
    expect(warnings).toEqual([["[connection] monitor retry failed", failure]])
    expect(receipt).toEqual({ state: "ready", attempt: 2 })
  })

  test("a probe error reports its cause and a later probe recovers", async () => {
    const failure = new Error("health request failed")
    const warnings: unknown[][] = []
    let attempt = 0
    let receipt: { state: string; attempt: number } | undefined
    const tick = makeMonitorTick({
      isHidden: () => false,
      isConnected: () => false,
      isRecoveryComplete: () => false,
      check: async () => {
        if (++attempt === 1) throw failure
        return true
      },
      onReconnect: async () => { receipt = { state: "ready", attempt } },
      warn: (...args) => warnings.push(args),
    })
    await tick()
    await tick()
    expect(warnings).toEqual([["[connection] monitor retry failed", failure]])
    expect(receipt).toEqual({ state: "ready", attempt: 2 })
  })

  test("the recovery receipt precedes the next admitted probe", async () => {
    let release!: (value: boolean) => void
    const probe = new Promise<boolean>(resolve => { release = resolve })
    let connected = false
    let recovered = false
    let sequence = 0
    const events: string[] = []
    const tick = makeMonitorTick({
      isHidden: () => false,
      isConnected: () => connected,
      isRecoveryComplete: () => recovered,
      check: async () => {
        events.push("probe:" + ++sequence)
        return probe
      },
      onReconnect: async () => {
        connected = true
        recovered = true
        events.push("recovered:" + sequence)
      },
    })
    const first = tick()
    const pending = [tick(), tick(), tick()]
    release(true)
    await Promise.all([first, ...pending])
    await tick()
    expect(events).toEqual(["probe:1", "recovered:1", "probe:2"])
  })

  test("a successor owner retains the published recovery receipt", async () => {
    let release!: (value: boolean) => void
    const previousProbe = new Promise<boolean>(resolve => { release = resolve })
    let generation = 1
    let receipt: { owner: number; state: string } | undefined
    const previous = makeMonitorTick({
      isHidden: () => false,
      isCurrent: () => generation === 1,
      isConnected: () => false,
      isRecoveryComplete: () => false,
      check: async () => previousProbe,
      onReconnect: async () => { receipt = { owner: 1, state: "ready" } },
    })
    const pending = previous()
    generation = 2
    const successor = makeMonitorTick({
      isHidden: () => false,
      isCurrent: () => generation === 2,
      isConnected: () => false,
      isRecoveryComplete: () => false,
      check: async () => true,
      onReconnect: async () => { receipt = { owner: 2, state: "ready" } },
    })
    await successor()
    release(true)
    await pending
    expect(receipt).toEqual({ owner: 2, state: "ready" })
  })
})

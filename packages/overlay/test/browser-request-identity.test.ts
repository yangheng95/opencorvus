import { expect, test } from "bun:test"
import { BrowserRequestIdentityRegistry } from "./browser/request-identity"

const base = {
  url: "http://127.0.0.1:7378/task/events?directory=D%3A%2Fproject",
  method: "GET",
  resourceType: "eventsource",
}

test("browser request identity remains stable across request and failed events", () => {
  const registry = new BrowserRequestIdentityRegistry()
  const started = registry.resolve({ requestID: "request-1", phase: "request", ...base })
  const failed = registry.resolve({
    requestID: "request-1",
    phase: "failed",
    ...base,
    errorText: "net::ERR_ABORTED",
  })

  expect(failed).toBe(started)
  expect(failed.phase()).toBe("failed")
  expect(failed.failure()).toEqual({ errorText: "net::ERR_ABORTED" })
})

test("same URL with a different requestID remains a different request owner", () => {
  const registry = new BrowserRequestIdentityRegistry()
  const first = registry.resolve({ requestID: "request-1", phase: "request", ...base })
  const second = registry.resolve({ requestID: "request-2", phase: "request", ...base })

  expect(second).not.toBe(first)
  expect(second.url()).toBe(first.url())
})

test("request identity rejects missing IDs and same-ID transport drift", () => {
  const registry = new BrowserRequestIdentityRegistry()
  registry.resolve({ requestID: "request-1", phase: "request", ...base })

  expect(() => registry.resolve({ requestID: "", phase: "request", ...base })).toThrow(/missing requestID/)
  expect(() => registry.resolve({ requestID: "request-1", phase: "response", ...base, method: "POST" })).toThrow(
    /method drift/,
  )
})

test("browser request lifecycle rejects out-of-order, duplicate terminal, rewrite, and revive events", () => {
  const terminalVariants = ["finished", "failed"] as const
  for (const terminal of terminalVariants) {
    const registry = new BrowserRequestIdentityRegistry()
    const terminalInput = {
      requestID: `request-${terminal}`,
      phase: terminal,
      ...base,
      ...(terminal === "failed" ? { errorText: "net::ERR_ABORTED" } : {}),
    }
    expect(() => registry.resolve(terminalInput)).toThrow(/must begin with request phase/)

    registry.resolve({ requestID: terminalInput.requestID, phase: "request", ...base })
    registry.resolve(terminalInput)
    expect(() => registry.resolve(terminalInput)).toThrow(/phase drift/)
    expect(() => registry.resolve({ requestID: terminalInput.requestID, phase: "response", ...base })).toThrow(
      /phase drift/,
    )
    expect(() => registry.resolve({ requestID: terminalInput.requestID, phase: "request", ...base })).toThrow(
      /phase drift/,
    )
  }
})

test("browser request lifecycle accepts request, optional response, and one terminal event", () => {
  for (const withResponse of [false, true]) {
    const registry = new BrowserRequestIdentityRegistry()
    const requestID = `request-valid-${withResponse}`
    const request = registry.resolve({ requestID, phase: "request", ...base })
    if (withResponse) expect(registry.resolve({ requestID, phase: "response", ...base })).toBe(request)
    expect(registry.resolve({ requestID, phase: "finished", ...base })).toBe(request)
    expect(request.phase()).toBe("finished")
    expect(request.failure()).toBeNull()
  }
})

test("sequential sidecar registries isolate the same request_1 identity and dispose state", () => {
  const firstRegistry = new BrowserRequestIdentityRegistry()
  const first = firstRegistry.resolve({ requestID: "request_1", phase: "request", ...base })
  firstRegistry.resolve({ requestID: "request_1", phase: "finished", ...base })
  firstRegistry.dispose()
  expect(() => firstRegistry.resolve({ requestID: "request_2", phase: "request", ...base })).toThrow(/disposed/)

  const secondRegistry = new BrowserRequestIdentityRegistry()
  const second = secondRegistry.resolve({ requestID: "request_1", phase: "request", ...base })
  expect(second).not.toBe(first)
  expect(second.phase()).toBe("request")
})

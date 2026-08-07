import { afterEach, describe, expect, test } from "bun:test"
import { DEFAULT_REQUEST_TIMEOUT_MILLISECONDS } from "../src/services/host-transport"
import { createTauriTransport } from "../src/services/tauri-transport"

const originalFetch = globalThis.fetch
const originalAbortSignalTimeout = AbortSignal.timeout

afterEach(() => {
  globalThis.fetch = originalFetch
  AbortSignal.timeout = originalAbortSignalTimeout
})

describe("tauri transport error body", () => {
  test("preserves JSON response bodies on non-2xx API responses", async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          name: "DirectoryRequiredError",
          data: {
            message: "Project-scoped route /tasks requires ?directory=",
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      )

    const res = await createTauriTransport().request({ path: "tasks" })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
    expect(res.body).toEqual({
      name: "DirectoryRequiredError",
      data: {
        message: "Project-scoped route /tasks requires ?directory=",
      },
    })
  })

  test("aborts stalled requests with the transport default timeout", async () => {
    const timeoutController = new AbortController()
    let timeoutMilliseconds = 0
    let capturedSignal: AbortSignal | undefined
    AbortSignal.timeout = ((milliseconds: number) => {
      timeoutMilliseconds = milliseconds
      return timeoutController.signal
    }) as typeof AbortSignal.timeout
    globalThis.fetch = async (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        capturedSignal = init?.signal ?? undefined
        capturedSignal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
          once: true,
        })
      })

    const request = createTauriTransport()
      .request({ path: "tasks" })
      .catch((error) => error)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(timeoutMilliseconds).toBe(DEFAULT_REQUEST_TIMEOUT_MILLISECONDS)
    expect(capturedSignal).toBe(timeoutController.signal)

    timeoutController.abort()
    const error = await request
    expect(error).toBeInstanceOf(DOMException)
    expect((error as DOMException).name).toBe("AbortError")
  })

  test("preserves caller-owned abort signals", async () => {
    const callerController = new AbortController()
    AbortSignal.timeout = (() => {
      throw new Error("default timeout should not replace caller signal")
    }) as typeof AbortSignal.timeout
    globalThis.fetch = async (_url, init) => {
      expect(init?.signal).toBe(callerController.signal)
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    const res = await createTauriTransport().request({
      path: "tasks",
      signal: callerController.signal,
    })

    expect(res.ok).toBe(true)
    expect(res.body).toEqual({ ok: true })
  })

  test("allows explicit long-running requests without the transport default timeout", async () => {
    AbortSignal.timeout = (() => {
      throw new Error("long-running request should not allocate the default timeout")
    }) as typeof AbortSignal.timeout
    globalThis.fetch = async (_url, init) => {
      expect(init?.signal).toBeUndefined()
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    const res = await createTauriTransport().request({
      path: "project/current/worktrees",
      method: "DELETE",
      timeoutMilliseconds: null,
    })

    expect(res.ok).toBe(true)
    expect(res.body).toEqual({ ok: true })
  })

  test("server-settled requests stay pending without a timer and still honor caller abort", async () => {
    const callerController = new AbortController()
    let settled = false
    AbortSignal.timeout = (() => {
      throw new Error("server-settled request must not allocate a wall-clock timeout")
    }) as typeof AbortSignal.timeout
    globalThis.fetch = async (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        expect(init?.signal).toBe(callerController.signal)
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
          once: true,
        })
      })

    const request = createTauriTransport()
      .request({
        path: "task/tsk_slow",
        method: "DELETE",
        timeoutMilliseconds: null,
        signal: callerController.signal,
      })
      .finally(() => {
        settled = true
      })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(settled).toBe(false)

    callerController.abort()
    await expect(request).rejects.toMatchObject({ name: "AbortError" })
    expect(settled).toBe(true)
  })
})

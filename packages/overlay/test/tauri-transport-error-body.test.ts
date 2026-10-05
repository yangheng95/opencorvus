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
          headers: { "Content-Type": "application/json", "X-OpenCorvus-Request-ID": "transport-response-1" },
        },
      )

    const res = await createTauriTransport().request({ path: "tasks" })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
    expect(res.headers["x-opencorvus-request-id"]).toBe("transport-response-1")
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

  test("server-settled requests resolve with the actual server response", async () => {
    let completeResponse!: (response: Response) => void
    globalThis.fetch = async () => new Promise<Response>((resolve) => { completeResponse = resolve })

    const request = createTauriTransport().request({
      path: "project/current/worktrees",
      method: "DELETE",
      timeoutMilliseconds: null,
    })
    completeResponse(new Response(JSON.stringify({ completed: "worktree-deletion" }), {
      status: 202,
      headers: { "Content-Type": "application/json", "x-opencorvus-request-id": "settled-response-1" },
    }))
    const res = await request
    expect(res.status).toBe(202)
    expect(res.body).toEqual({ completed: "worktree-deletion" })
    expect(res.headers["x-opencorvus-request-id"]).toBe("settled-response-1")
  })

  test("server-settled requests preserve the caller signal and its AbortError result", async () => {
    const callerController = new AbortController()
    globalThis.fetch = async (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        expect(init?.signal).toBe(callerController.signal)
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
          once: true,
        })
      })

    const request = createTauriTransport().request({
      path: "task/tsk_slow",
      method: "DELETE",
      timeoutMilliseconds: null,
      signal: callerController.signal,
    })

    callerController.abort()
    await expect(request).rejects.toMatchObject({ name: "AbortError" })
  })
})

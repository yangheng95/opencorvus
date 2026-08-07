import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { FeishuAdapter } from "../src/adapters/feishu"

type ServeOpts = {
  hostname?: string
  port?: number
  fetch: (req: Request) => Response | Promise<Response>
}

type Server = {
  hostname: string
  port: number
  stop: (force?: boolean) => void
}

let oldFetch: typeof globalThis.fetch

beforeEach(() => {
  oldFetch = globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = oldFetch
})

describe("feishu adapter", () => {
  function textEvent(token?: string) {
    return {
      header: {
        event_type: "im.message.receive_v1",
        ...(token ? { token } : {}),
      },
      event: {
        sender: {
          sender_type: "user",
          sender_id: { open_id: "ou_1" },
        },
        message: {
          chat_id: "oc_1",
          message_id: "om_2",
          root_id: "om_1",
          message_type: "text",
          content: JSON.stringify({ text: "@_user_1 hello" }),
        },
      },
    }
  }

  test("maps webhook text event into IncomingMessage", async () => {
    let route: ((req: Request) => Response | Promise<Response>) | undefined
    const serve = (opts: ServeOpts) => {
      route = opts.fetch
      return {
        hostname: "127.0.0.1",
        port: 16666,
        stop() {},
      } as Server
    }

    const adapter = new FeishuAdapter({
      appId: "cli_a",
      appSecret: "sec_a",
      serve,
    })

    const seen: Array<any> = []
    adapter.onMessage(async (msg) => {
      seen.push(msg)
    })
    await adapter.start()

    const body = textEvent()

    const res = await route!(
      new Request("http://127.0.0.1:16666/feishu", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    )

    expect(res.status).toBe(200)
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({
      platform: "feishu",
      channel: "oc_1",
      thread: "om_1",
      user: "ou_1",
      text: "hello",
    })

    await adapter.stop()
  })

  test("requires configured verification token before dispatch", async () => {
    let route: ((req: Request) => Response | Promise<Response>) | undefined
    const serve = (opts: ServeOpts) => {
      route = opts.fetch
      return {
        hostname: "127.0.0.1",
        port: 16666,
        stop() {},
      } as Server
    }

    const adapter = new FeishuAdapter({
      appId: "cli_a",
      appSecret: "sec_a",
      verificationToken: "verify_a",
      serve,
    })

    const seen: Array<any> = []
    adapter.onMessage(async (msg) => {
      seen.push(msg)
    })
    await adapter.start()

    const post = (body: unknown) =>
      route!(
        new Request("http://127.0.0.1:16666/feishu", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      )

    const missing = await post(textEvent())
    const wrong = await post(textEvent("wrong"))
    const valid = await post(textEvent("verify_a"))

    expect(missing.status).toBe(401)
    expect(wrong.status).toBe(401)
    expect(valid.status).toBe(200)
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({
      platform: "feishu",
      channel: "oc_1",
      thread: "om_1",
      user: "ou_1",
      text: "hello",
    })

    await adapter.stop()
  })

  test("does not send a new chat message when reply endpoint fails", async () => {
    const calls: Array<{ url: string; body?: string }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString()
      calls.push({
        url,
        body: typeof init?.body === "string" ? init.body : undefined,
      })

      if (calls.length === 1) {
        return Response.json({
          tenant_access_token: "tok_a",
          expire: 7200,
        })
      }
      if (calls.length === 2) {
        return new Response("not found", { status: 404 })
      }
      throw new Error(`unexpected Feishu request: ${url}`)
    }) as typeof globalThis.fetch

    const adapter = new FeishuAdapter({
      appId: "cli_a",
      appSecret: "sec_a",
      serve: () => ({ hostname: "127.0.0.1", port: 16666, stop() {} }) as Server,
    })

    await expect(adapter.sendMessage("oc_9", "om_root", "done")).rejects.toThrow("Feishu reply failed: 404 not found")

    expect(calls).toHaveLength(2)
    expect(calls[0]?.url).toContain("/auth/v3/tenant_access_token/internal")
    expect(calls[1]?.url).toContain("/im/v1/messages/om_root/reply")
  })
})

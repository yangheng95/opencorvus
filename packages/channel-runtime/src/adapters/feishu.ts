import type { ChannelAdapter, MessageHandler } from "../adapter"

type Payload = {
  msg_type: "text" | "image"
  content: string
}

type Body = {
  challenge?: string
  type?: string
  token?: string
  header?: {
    event_type?: string
    token?: string
  }
  event?: {
    sender?: {
      sender_id?: {
        open_id?: string
        user_id?: string
      }
      sender_type?: string
    }
    message?: {
      chat_id?: string
      message_id?: string
      root_id?: string
      parent_id?: string
      message_type?: string
      content?: string
    }
  }
}

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

type Serve = (opts: ServeOpts) => Server

function parse(raw: string) {
  const text = raw.trim()
  if (!text) return ""
  if (!text.startsWith("{")) return text
  try {
    const data = JSON.parse(text) as { text?: string }
    if (typeof data.text === "string") return data.text
    return text
  } catch {
    return text
  }
}

function clean(text: string) {
  const t = text.replace(/^@_user_\d+\s*/, "").replace(/^<at [^>]*>.*?<\/at>\s*/i, "")
  return t.trim()
}

export class FeishuAdapter implements ChannelAdapter {
  readonly platform = "feishu"

  private handler?: MessageHandler
  private appId: string
  private appSecret: string
  private host: string
  private port: number
  private path: string
  private verificationToken?: string
  private serve: Serve
  private server?: Server
  private token?: string
  private expires = 0

  constructor(opts: {
    appId: string
    appSecret: string
    host?: string
    port?: number
    path?: string
    verificationToken?: string
    serve?: Serve
  }) {
    this.appId = opts.appId
    this.appSecret = opts.appSecret
    this.host = opts.host ?? "0.0.0.0"
    this.port = opts.port ?? 16666
    this.path = opts.path ? (opts.path.startsWith("/") ? opts.path : `/${opts.path}`) : "/feishu"
    this.verificationToken = opts.verificationToken
    this.serve = opts.serve ?? ((cfg) => Bun.serve(cfg) as unknown as Server)
  }

  onMessage(handler: MessageHandler): void {
    this.handler = handler
  }

  async start(): Promise<void> {
    if (this.server) return
    this.server = this.serve({
      hostname: this.host,
      port: this.port,
      fetch: (req) => this.route(req),
    })
    console.log(`[Feishu] Webhook listening at http://${this.server.hostname}:${this.server.port}${this.path}`)
  }

  async stop(): Promise<void> {
    if (!this.server) return
    this.server.stop(true)
    this.server = undefined
  }

  async sendMessage(_channel: string, thread: string, text: string): Promise<void> {
    const token = await this.tenant()
    const payload: Payload = {
      msg_type: "text",
      content: JSON.stringify({ text }),
    }
    await this.reply(token, thread, payload)
  }

  async uploadImage(
    channel: string,
    thread: string,
    imageBuffer: Buffer,
    filename: string,
    title?: string,
  ): Promise<void> {
    const token = await this.tenant()
    const form = new FormData()
    form.set("image_type", "message")
    form.set("image", new Blob([Uint8Array.from(imageBuffer)]), filename)

    const imageRes = await fetch("https://open.feishu.cn/open-apis/im/v1/images", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
      signal: AbortSignal.timeout(30_000),
    })
    if (!imageRes.ok) {
      throw new Error(`Feishu upload image failed: ${imageRes.status} ${await imageRes.text()}`)
    }
    const imageData = (await imageRes.json()) as {
      data?: {
        image_key?: string
      }
    }
    const imageKey = imageData.data?.image_key
    if (!imageKey) throw new Error("Feishu upload image failed: missing image_key")

    const payload: Payload = {
      msg_type: "image",
      content: JSON.stringify({ image_key: imageKey }),
    }
    await this.reply(token, thread, payload)
    if (!title || title === filename) return
    await this.sendMessage(channel, thread, title)
  }

  async startThread(channel: string, text: string): Promise<string> {
    const token = await this.tenant()
    const id = await this.create(token, channel, {
      msg_type: "text",
      content: JSON.stringify({ text }),
    })
    return id
  }

  private async route(req: Request) {
    const url = new URL(req.url)
    if (url.pathname !== this.path) return new Response("Not Found", { status: 404 })
    if (req.method === "GET") return new Response("ok")
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 })

    // Malformed JSON → 400 below
    const body = (await req.json().catch(() => undefined)) as Body | undefined
    if (!body) return Response.json({ error: "invalid body" }, { status: 400 })

    const token =
      typeof body.header?.token === "string"
        ? body.header.token
        : typeof body.token === "string"
          ? body.token
          : undefined
    if (this.verificationToken && token !== this.verificationToken) {
      return Response.json({ error: "invalid token" }, { status: 401 })
    }

    const challenge = typeof body.challenge === "string" ? body.challenge : undefined
    if (body.type === "url_verification" && challenge) return Response.json({ challenge })
    if (challenge) return Response.json({ challenge })

    const eventType = body.header?.event_type
    if (eventType !== "im.message.receive_v1") return Response.json({ ok: true })

    const msg = body.event?.message
    if (!msg?.chat_id || !msg.message_id) return Response.json({ ok: true })
    if (msg.message_type && msg.message_type !== "text") return Response.json({ ok: true })
    if (body.event?.sender?.sender_type === "app") return Response.json({ ok: true })

    const text = clean(parse(msg.content ?? ""))
    if (!text) return Response.json({ ok: true })
    if (!this.handler) return Response.json({ ok: true })

    const user = body.event?.sender?.sender_id?.open_id ?? body.event?.sender?.sender_id?.user_id ?? "unknown"
    const thread = msg.root_id ?? msg.parent_id ?? msg.message_id

    await this.handler({
      platform: this.platform,
      channel: msg.chat_id,
      thread,
      user,
      text,
    }).catch((err) => {
      console.error("[Feishu] handler error:", err)
    })

    return Response.json({ ok: true })
  }

  private async tenant() {
    if (this.token && this.expires > Date.now()) return this.token
    const res = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: this.appId,
        app_secret: this.appSecret,
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`Feishu tenant token failed: ${res.status} ${await res.text()}`)

    const data = (await res.json()) as {
      tenant_access_token?: string
      expire?: number
    }
    if (!data.tenant_access_token) throw new Error("Feishu tenant token failed: missing tenant_access_token")
    const ttl = typeof data.expire === "number" ? data.expire : 7200
    this.token = data.tenant_access_token
    this.expires = Date.now() + Math.max(60, ttl - 60) * 1000
    return this.token
  }

  private async reply(token: string, thread: string, payload: Payload) {
    if (!thread) throw new Error("Feishu reply failed: missing thread")
    const res = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${encodeURIComponent(thread)}/reply`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    })
    if (res.ok) return
    throw new Error(`Feishu reply failed: ${res.status} ${await res.text()}`)
  }

  private async create(token: string, channel: string, payload: Payload) {
    const res = await fetch("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        receive_id: channel,
        ...payload,
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`Feishu create message failed: ${res.status} ${await res.text()}`)

    const data = (await res.json()) as {
      data?: {
        message_id?: string
      }
    }
    const id = data.data?.message_id
    if (!id) throw new Error("Feishu create message failed: missing message_id")
    return id
  }
}

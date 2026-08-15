import { createHmac, timingSafeEqual } from "node:crypto"
import type { ChannelAdapter, MessageHandler } from "../adapter"
import { adapt, path, type Serve, type Server } from "./http"

type Body = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: {
          phone_number_id?: string
        }
        messages?: Array<{
          id?: string
          from?: string
          type?: string
          text?: {
            body?: string
          }
          context?: {
            id?: string
          }
        }>
      }
    }>
  }>
}

type SendResult = {
  messages?: Array<{
    id?: string
  }>
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export class WhatsappAdapter implements ChannelAdapter {
  readonly platform = "whatsapp"
  private handler?: MessageHandler
  private token: string
  private numberId: string
  private appSecret: string
  private host: string
  private port: number
  private hook: string
  private verifyToken: string
  private api: string
  private serve: Serve
  private server?: Server

  constructor(opts: {
    token: string
    numberId: string
    appSecret: string
    host?: string
    port?: number
    path?: string
    verifyToken: string
    graphVersion?: string
    serve?: Serve
  }) {
    this.token = opts.token
    this.numberId = opts.numberId
    this.appSecret = opts.appSecret
    this.verifyToken = opts.verifyToken
    if (!this.appSecret.trim()) throw new Error("WhatsApp app secret is required")
    if (!this.verifyToken.trim()) throw new Error("WhatsApp verify token is required")
    this.host = opts.host ?? "0.0.0.0"
    this.port = opts.port ?? 16667
    this.hook = path(opts.path, "/whatsapp")
    this.api = `https://graph.facebook.com/${opts.graphVersion ?? "v21.0"}`
    this.serve = adapt(opts.serve)
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
    console.log(`[WhatsApp] Webhook listening at http://${this.server.hostname}:${this.server.port}${this.hook}`)
  }

  async stop(): Promise<void> {
    if (!this.server) return
    this.server.stop(true)
    this.server = undefined
  }

  async sendMessage(channel: string, thread: string, text: string): Promise<void> {
    await this.send(channel, text, thread)
  }

  async startThread(channel: string, text: string): Promise<string> {
    return this.send(channel, text)
  }

  async uploadImage(
    channel: string,
    thread: string,
    imageBuffer: Buffer,
    filename: string,
    title?: string,
  ): Promise<void> {
    const form = new FormData()
    form.set("messaging_product", "whatsapp")
    form.set("file", new Blob([Uint8Array.from(imageBuffer)]), filename)

    const uploaded = await fetch(`${this.api}/${encodeURIComponent(this.numberId)}/media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      body: form,
      signal: AbortSignal.timeout(30_000),
    })
    if (!uploaded.ok) throw new Error(`WhatsApp upload image failed: ${uploaded.status} ${await uploaded.text()}`)

    const data = (await uploaded.json()) as { id?: string }
    if (!data.id) throw new Error("WhatsApp upload image failed: missing media id")

    const res = await fetch(`${this.api}/${encodeURIComponent(this.numberId)}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: channel,
        context: thread ? { message_id: thread } : undefined,
        type: "image",
        image: {
          id: data.id,
          caption: title ?? filename,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`WhatsApp send image failed: ${res.status} ${await res.text()}`)
  }

  private async send(channel: string, text: string, thread?: string) {
    const res = await fetch(`${this.api}/${encodeURIComponent(this.numberId)}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: channel,
        context: thread ? { message_id: thread } : undefined,
        type: "text",
        text: {
          body: text,
          preview_url: false,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`WhatsApp send message failed: ${res.status} ${await res.text()}`)
    const data = (await res.json()) as SendResult
    return data.messages?.[0]?.id ?? `${Date.now()}`
  }

  private async route(req: Request) {
    const url = new URL(req.url)
    if (url.pathname !== this.hook) return new Response("Not Found", { status: 404 })
    if (req.method === "GET") return this.challenge(url)
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 })

    const raw = await req.text()
    if (!this.valid(req, raw)) return Response.json({ error: "invalid signature" }, { status: 401 })

    let body: Body
    try {
      body = JSON.parse(raw) as Body
    } catch {
      return Response.json({ error: "invalid body" }, { status: 400 })
    }
    if (!body) return Response.json({ error: "invalid body" }, { status: 400 })
    if (!this.handler) return Response.json({ ok: true })

    const list =
      body.entry
        ?.flatMap((entry) => entry.changes ?? [])
        .flatMap((change) => change.value?.messages ?? [])
        .filter((msg): msg is NonNullable<typeof msg> => Boolean(msg)) ?? []

    for (const item of list) {
      if (!item.id || !item.from) continue
      if (item.type !== "text") continue
      const text = item.text?.body?.trim() ?? ""
      if (!text) continue
      await this.handler({
        id: item.id,
        platform: this.platform,
        channel: item.from,
        thread: item.context?.id ?? item.id,
        user: item.from,
        text,
      })
    }

    return Response.json({ ok: true })
  }

  private challenge(url: URL) {
    const mode = url.searchParams.get("hub.mode")
    const token = url.searchParams.get("hub.verify_token")
    const challenge = url.searchParams.get("hub.challenge")
    if (mode !== "subscribe" || !challenge) return new Response("ok")
    if (token !== this.verifyToken) return new Response("forbidden", { status: 401 })
    return new Response(challenge)
  }

  private valid(req: Request, raw: string) {
    const signature = req.headers.get("x-hub-signature-256")
    if (!signature) return false
    const expected = `sha256=${createHmac("sha256", this.appSecret).update(raw).digest("hex")}`
    return safeEqual(signature.toLowerCase(), expected)
  }
}

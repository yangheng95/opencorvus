import type { ChannelAdapter, MessageHandler } from "../adapter"
import { adapt, path, type Serve, type Server } from "./http"
import { MSTeamsActivityAuth } from "./msteams-auth"

type Activity = {
  type?: string
  channelId?: string
  id?: string
  text?: string
  serviceUrl?: string
  conversation?: {
    id?: string
  }
  from?: {
    id?: string
  }
  recipient?: {
    id?: string
  }
  replyToId?: string
}

type Session = {
  serviceUrl: string
  conversationId: string
}

export class MSTeamsAdapter implements ChannelAdapter {
  readonly platform = "msteams"
  private handler?: MessageHandler
  private appId: string
  private appSecret: string
  private host: string
  private port: number
  private hook: string
  private serve: Serve
  private server?: Server
  private session = new Map<string, Session>()
  private activityAuth: MSTeamsActivityAuth
  private token?: string
  private expires = 0

  constructor(opts: { appId: string; appSecret: string; host?: string; port?: number; path?: string; serve?: Serve }) {
    this.appId = opts.appId
    this.appSecret = opts.appSecret
    this.host = opts.host ?? "0.0.0.0"
    this.port = opts.port ?? 16669
    this.hook = path(opts.path, "/msteams")
    this.serve = adapt(opts.serve)
    this.activityAuth = new MSTeamsActivityAuth({ appId: this.appId })
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
    console.log(`[MSTeams] Webhook listening at http://${this.server.hostname}:${this.server.port}${this.hook}`)
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
    _imageBuffer: Buffer,
    filename: string,
    title?: string,
  ): Promise<void> {
    const text =
      title && title !== filename
        ? `${title}\n(image upload not supported in MS Teams text MVP)`
        : `Image "${filename}" generated (upload is not supported in MS Teams text MVP).`
    await this.sendMessage(channel, thread, text)
  }

  async uploadImageUrl(channel: string, thread: string, url: string, filename: string, title?: string): Promise<void> {
    await this.post(channel, {
      type: "message",
      from: { id: this.appId },
      conversation: { id: this.session.get(channel)?.conversationId ?? channel },
      ...(thread ? { replyToId: thread } : {}),
      ...(title ? { text: title } : {}),
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.hero",
          content: {
            title: title ?? filename,
            images: [{ url }],
          },
        },
      ],
    })
  }

  private async send(channel: string, text: string, thread?: string) {
    return this.post(channel, {
      type: "message",
      from: { id: this.appId },
      conversation: { id: this.session.get(channel)?.conversationId ?? channel },
      text,
      ...(thread ? { replyToId: thread } : {}),
    })
  }

  private async post(channel: string, payload: Record<string, unknown>) {
    const session = this.session.get(channel)
    if (!session) throw new Error(`MS Teams channel not initialized: ${channel}`)
    const token = await this.auth()
    const res = await fetch(
      `${session.serviceUrl}/v3/conversations/${encodeURIComponent(session.conversationId)}/activities`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      },
    )
    if (!res.ok) throw new Error(`MS Teams send failed: ${res.status} ${await res.text()}`)
    const data = (await res.json()) as { id?: string }
    return data.id ?? `${Date.now()}`
  }

  private async route(req: Request) {
    const url = new URL(req.url)
    if (url.pathname !== this.hook) return new Response("Not Found", { status: 404 })
    if (req.method === "GET") return new Response("ok")
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 })

    // Malformed JSON → 400 below
    const body = (await req.json().catch(() => undefined)) as Activity | undefined
    if (!body) return Response.json({ error: "invalid body" }, { status: 400 })
    if (!(await this.activityAuth.verify(req, body))) {
      return Response.json({ error: "invalid auth" }, { status: 401 })
    }
    if (body.type !== "message") return Response.json({ ok: true })
    if (!this.handler) return Response.json({ ok: true })

    const channel = body.conversation?.id
    const serviceUrl = body.serviceUrl
    const user = body.from?.id
    const thread = body.replyToId ?? body.id
    const text = (body.text ?? "").trim()
    if (!body.id || !channel || !serviceUrl || !user || !thread || !text) return Response.json({ ok: true })
    if (user === this.appId) return Response.json({ ok: true })

    this.session.set(channel, { serviceUrl, conversationId: channel })

    await this.handler({
      id: body.id,
      platform: this.platform,
      channel,
      thread,
      user,
      text,
    })

    return Response.json({ ok: true })
  }

  private async auth() {
    if (this.token && this.expires > Date.now()) return this.token
    const body = new URLSearchParams()
    body.set("grant_type", "client_credentials")
    body.set("client_id", this.appId)
    body.set("client_secret", this.appSecret)
    body.set("scope", "https://api.botframework.com/.default")
    const res = await fetch("https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`MS Teams token failed: ${res.status} ${await res.text()}`)
    const data = (await res.json()) as {
      access_token?: string
      expires_in?: number
    }
    if (!data.access_token) throw new Error("MS Teams token failed: missing access token")
    this.token = data.access_token
    this.expires = Date.now() + ((data.expires_in ?? 3600) - 60) * 1000
    return this.token
  }
}

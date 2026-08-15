import { createSign } from "node:crypto"
import { createRemoteJWKSet, jwtVerify } from "jose"
import type { ChannelAdapter, MessageHandler } from "../adapter"
import { adapt, path, type Serve, type Server } from "./http"

const GOOGLE_CHAT_SENDER = "chat@system.gserviceaccount.com"
const GOOGLE_OIDC_KEYS = new URL("https://www.googleapis.com/oauth2/v3/certs")

type Body = {
  type?: string
  message?: {
    name?: string
    text?: string
    argumentText?: string
    thread?: {
      name?: string
    }
    sender?: {
      name?: string
    }
  }
  space?: {
    name?: string
  }
}

type Account = {
  client_email: string
  private_key: string
  token_uri?: string
}

function b64(raw: string) {
  return Buffer.from(raw).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

export class GoogleChatAdapter implements ChannelAdapter {
  readonly platform = "googlechat"
  private handler?: MessageHandler
  private raw: string
  private authAudience: string
  private host: string
  private port: number
  private hook: string
  private serve: Serve
  private server?: Server
  private cached?: Account
  private token?: string
  private expires = 0
  private keys = createRemoteJWKSet(GOOGLE_OIDC_KEYS)

  constructor(opts: {
    serviceAccount: string
    authAudience: string
    host?: string
    port?: number
    path?: string
    serve?: Serve
  }) {
    this.raw = opts.serviceAccount
    this.authAudience = opts.authAudience
    if (!this.authAudience.trim()) throw new Error("Google Chat auth audience is required")
    this.host = opts.host ?? "0.0.0.0"
    this.port = opts.port ?? 16668
    this.hook = path(opts.path, "/googlechat")
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
    console.log(`[GoogleChat] Webhook listening at http://${this.server.hostname}:${this.server.port}${this.hook}`)
  }

  async stop(): Promise<void> {
    if (!this.server) return
    this.server.stop(true)
    this.server = undefined
  }

  async sendMessage(channel: string, thread: string, text: string): Promise<void> {
    await this.send(channel, { text, thread: thread ? { name: thread } : undefined })
  }

  async startThread(channel: string, text: string): Promise<string> {
    const data = await this.send(channel, { text })
    return data.thread?.name ?? data.name ?? `${Date.now()}`
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
        ? `${title}\n(image upload not supported in Google Chat text MVP)`
        : `Image "${filename}" generated (upload is not supported in Google Chat text MVP).`
    await this.sendMessage(channel, thread, text)
  }

  async uploadImageUrl(channel: string, thread: string, url: string, filename: string, title?: string): Promise<void> {
    await this.send(channel, {
      text: title ?? filename,
      thread: thread ? { name: thread } : undefined,
      cardsV2: [
        {
          cardId: "screenshot",
          card: {
            sections: [
              {
                widgets: [
                  ...(title ? [{ textParagraph: { text: title } }] : []),
                  {
                    image: {
                      imageUrl: url,
                      altText: filename,
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    })
  }

  private async send(channel: string, payload: Record<string, unknown>) {
    const token = await this.auth()
    const res = await fetch(`https://chat.googleapis.com/v1/${channel}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`Google Chat send failed: ${res.status} ${await res.text()}`)
    return (await res.json()) as {
      name?: string
      thread?: {
        name?: string
      }
    }
  }

  private async route(req: Request) {
    const url = new URL(req.url)
    if (url.pathname !== this.hook) return new Response("Not Found", { status: 404 })
    if (req.method === "GET") return new Response("ok")
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 })

    if (!(await this.valid(req))) return Response.json({ error: "invalid auth" }, { status: 401 })

    // Malformed JSON → 400 below
    const body = (await req.json().catch(() => undefined)) as Body | undefined
    if (!body) return Response.json({ error: "invalid body" }, { status: 400 })
    if (body.type !== "MESSAGE") return Response.json({ ok: true })
    if (!this.handler) return Response.json({ ok: true })

    const channel = body.space?.name
    const message = body.message?.name
    const user = body.message?.sender?.name
    const thread = body.message?.thread?.name ?? message
    const text = (body.message?.argumentText ?? body.message?.text ?? "").trim()
    if (!channel || !message || !thread || !user || !text) return Response.json({ ok: true })

    await this.handler({
      id: message,
      platform: this.platform,
      channel,
      thread,
      user,
      text,
    })

    return Response.json({ ok: true })
  }

  private async valid(req: Request) {
    const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) return false
    try {
      const verified = await jwtVerify(token, this.keys, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: this.authAudience,
        algorithms: ["RS256"],
        clockTolerance: 300,
      })
      return verified.payload.email === GOOGLE_CHAT_SENDER && verified.payload.email_verified === true
    } catch {
      return false
    }
  }

  private async auth() {
    if (this.token && this.expires > Date.now()) return this.token
    const account = await this.account()
    const now = Math.floor(Date.now() / 1000)
    const uri = account.token_uri ?? "https://oauth2.googleapis.com/token"
    const header = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    const payload = b64(
      JSON.stringify({
        iss: account.client_email,
        scope: "https://www.googleapis.com/auth/chat.bot",
        aud: uri,
        iat: now,
        exp: now + 3600,
      }),
    )
    const sign = createSign("RSA-SHA256")
    sign.update(`${header}.${payload}`)
    sign.end()
    const signature = sign
      .sign(account.private_key)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "")
    const assertion = `${header}.${payload}.${signature}`

    const body = new URLSearchParams()
    body.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer")
    body.set("assertion", assertion)
    const res = await fetch(uri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`Google Chat token failed: ${res.status} ${await res.text()}`)

    const data = (await res.json()) as {
      access_token?: string
      expires_in?: number
    }
    if (!data.access_token) throw new Error("Google Chat token failed: missing access token")
    this.token = data.access_token
    this.expires = Date.now() + ((data.expires_in ?? 3600) - 60) * 1000
    return this.token
  }

  private async account() {
    if (this.cached) return this.cached
    const raw = this.raw.trim().startsWith("{") ? this.raw : await Bun.file(this.raw).text()
    let account: Account
    try {
      account = JSON.parse(raw) as Account
    } catch {
      throw new Error("GOOGLECHAT_SERVICE_ACCOUNT_JSON contains invalid JSON")
    }
    if (!account.client_email || !account.private_key) {
      throw new Error("GOOGLECHAT_SERVICE_ACCOUNT_JSON is invalid")
    }
    this.cached = account
    return account
  }
}

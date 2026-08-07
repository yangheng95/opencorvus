import { randomBytes } from "node:crypto"
import type { ChannelAdapter, MessageHandler } from "../adapter"
import { adapt, path, type Serve, type Server } from "./http"
import {
  callbackSignature,
  decryptCallbackEnvelope,
  encryptCallbackEnvelope,
  verifyCallbackSignature,
} from "./callback-crypto"

type Body = {
  challenge?: string
  msgtype?: string
  text?: {
    content?: string
  }
  senderStaffId?: string
  conversationId?: string
  msgId?: string
  sessionWebhook?: string
}

export class DingTalkAdapter implements ChannelAdapter {
  readonly platform = "dingtalk"
  private handler?: MessageHandler
  private appKey: string
  private appSecret: string
  private callbackToken: string
  private encodingAesKey: string
  private host: string
  private port: number
  private hook: string
  private defaultWebhook?: string
  private serve: Serve
  private server?: Server
  private webhooks = new Map<string, string>()

  constructor(opts: {
    appKey: string
    appSecret: string
    callbackToken: string
    encodingAesKey: string
    host?: string
    port?: number
    path?: string
    defaultWebhook?: string
    serve?: Serve
  }) {
    this.appKey = opts.appKey
    this.appSecret = opts.appSecret
    this.callbackToken = opts.callbackToken
    this.encodingAesKey = opts.encodingAesKey
    if (!this.callbackToken.trim()) throw new Error("DingTalk callback token is required")
    if (!this.encodingAesKey.trim()) throw new Error("DingTalk EncodingAESKey is required")
    this.host = opts.host ?? "0.0.0.0"
    this.port = opts.port ?? 16673
    this.hook = path(opts.path, "/dingtalk")
    this.defaultWebhook = opts.defaultWebhook
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
    console.log(`[DingTalk] Webhook listening at http://${this.server.hostname}:${this.server.port}${this.hook}`)
    if (!this.defaultWebhook) {
      console.log("[DingTalk] defaultWebhook not set, replies depend on inbound sessionWebhook")
    }
  }

  async stop(): Promise<void> {
    if (!this.server) return
    this.server.stop(true)
    this.server = undefined
  }

  async sendMessage(channel: string, _thread: string, text: string): Promise<void> {
    await this.post(channel, {
      msgtype: "text",
      text: { content: text },
    })
  }

  async startThread(channel: string, text: string): Promise<string> {
    await this.sendMessage(channel, "", text)
    return `${Date.now()}`
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
        ? `${title}\n(image upload not supported in DingTalk text MVP)`
        : `Image "${filename}" generated (upload is not supported in DingTalk text MVP).`
    await this.sendMessage(channel, thread, text)
  }

  async uploadImageUrl(channel: string, _thread: string, url: string, filename: string, title?: string): Promise<void> {
    const heading = title ?? filename
    await this.post(channel, {
      msgtype: "markdown",
      markdown: {
        title: heading,
        text: `### ${heading}\n\n![](${url})`,
      },
    })
  }

  private async post(channel: string, payload: Record<string, unknown>) {
    const webhook = this.webhooks.get(channel) ?? this.defaultWebhook
    if (!webhook) throw new Error(`DingTalk conversation not initialized: ${channel}`)
    const res = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`DingTalk send failed: ${res.status} ${await res.text()}`)
  }

  private async route(req: Request) {
    const url = new URL(req.url)
    if (url.pathname !== this.hook) return new Response("Not Found", { status: 404 })
    if (req.method === "GET") return new Response("ok")
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 })

    const outer = (await req.json().catch(() => undefined)) as { encrypt?: string } | undefined
    if (!outer?.encrypt) return Response.json({ error: "invalid body" }, { status: 400 })
    if (
      !verifyCallbackSignature({
        token: this.callbackToken,
        timestamp: url.searchParams.get("timestamp"),
        nonce: url.searchParams.get("nonce"),
        encrypted: outer.encrypt,
        signature: url.searchParams.get("signature"),
      })
    ) {
      return Response.json({ error: "invalid signature" }, { status: 401 })
    }

    const decrypted = this.decrypt(outer.encrypt)
    if (!decrypted) return Response.json({ error: "invalid signature" }, { status: 401 })
    const body = (await new Response(decrypted).json().catch(() => undefined)) as Body | undefined
    if (!body) return Response.json({ error: "invalid body" }, { status: 400 })
    if (body.challenge) return this.encryptedResponse(body.challenge, url)
    if (!this.handler) return this.encryptedResponse("success", url)

    const channel = body.conversationId
    const user = body.senderStaffId
    const thread = body.msgId ?? `${Date.now()}`
    const text = (body.text?.content ?? "").trim()
    if (!channel || !user || !thread || !text) return this.encryptedResponse("success", url)
    if (body.sessionWebhook) this.webhooks.set(channel, body.sessionWebhook)

    await this.handler({
      platform: this.platform,
      channel,
      thread,
      user,
      text,
    })

    return this.encryptedResponse("success", url)
  }

  private encryptedResponse(message: string, url: URL) {
    const timestamp = url.searchParams.get("timestamp") ?? `${Math.floor(Date.now() / 1000)}`
    const nonce = url.searchParams.get("nonce") ?? randomBytes(8).toString("hex")
    const encrypt = encryptCallbackEnvelope({
      encodingAesKey: this.encodingAesKey,
      receiveId: this.appKey,
      message,
    })
    return Response.json({
      msg_signature: callbackSignature(this.callbackToken, timestamp, nonce, encrypt),
      timeStamp: timestamp,
      nonce,
      encrypt,
    })
  }

  private decrypt(encrypted: string) {
    try {
      return decryptCallbackEnvelope({
        encodingAesKey: this.encodingAesKey,
        encrypted,
        receiveId: this.appKey,
      })
    } catch {
      return undefined
    }
  }
}

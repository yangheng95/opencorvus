import type { ChannelAdapter, MessageHandler } from "../adapter"
import { adapt, path, type Serve, type Server } from "./http"
import { decryptCallbackEnvelope, encryptedXml, verifyCallbackSignature } from "./callback-crypto"

function pick(xml: string, tag: string) {
  const cdata = new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]><\\/${tag}>`)
  const plain = new RegExp(`<${tag}>(.*?)<\\/${tag}>`)
  const byCdata = xml.match(cdata)?.[1]
  if (byCdata) return byCdata
  return xml.match(plain)?.[1]
}

export class WeComAdapter implements ChannelAdapter {
  readonly platform = "wecom"
  private handler?: MessageHandler
  private corpId: string
  private secret: string
  private agentId: string
  private callbackToken: string
  private encodingAesKey: string
  private host: string
  private port: number
  private hook: string
  private serve: Serve
  private server?: Server
  private token?: string
  private expires = 0

  constructor(opts: {
    corpId: string
    secret: string
    agentId: string
    token: string
    encodingAesKey: string
    host?: string
    port?: number
    path?: string
    serve?: Serve
  }) {
    this.corpId = opts.corpId
    this.secret = opts.secret
    this.agentId = opts.agentId
    this.callbackToken = opts.token
    this.encodingAesKey = opts.encodingAesKey
    if (!this.callbackToken.trim()) throw new Error("WeCom callback token is required")
    if (!this.encodingAesKey.trim()) throw new Error("WeCom EncodingAESKey is required")
    this.host = opts.host ?? "0.0.0.0"
    this.port = opts.port ?? 16672
    this.hook = path(opts.path, "/wecom")
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
    console.log(`[WeCom] Webhook listening at http://${this.server.hostname}:${this.server.port}${this.hook}`)
  }

  async stop(): Promise<void> {
    if (!this.server) return
    this.server.stop(true)
    this.server = undefined
  }

  async sendMessage(channel: string, _thread: string, text: string): Promise<void> {
    const token = await this.auth()
    const res = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          touser: channel,
          msgtype: "text",
          agentid: Number(this.agentId),
          text: { content: text },
        }),
        signal: AbortSignal.timeout(30_000),
      },
    )
    if (!res.ok) throw new Error(`WeCom send failed: ${res.status} ${await res.text()}`)
    const data = (await res.json()) as { errcode?: number; errmsg?: string }
    if (data.errcode && data.errcode !== 0) throw new Error(`WeCom send failed: ${data.errcode} ${data.errmsg ?? ""}`)
  }

  async startThread(channel: string, text: string): Promise<string> {
    await this.sendMessage(channel, "", text)
    return `${Date.now()}`
  }

  async uploadImage(
    channel: string,
    thread: string,
    imageBuffer: Buffer,
    filename: string,
    title?: string,
  ): Promise<void> {
    const token = await this.auth()
    const form = new FormData()
    form.set("media", new Blob([Uint8Array.from(imageBuffer)]), filename)
    const uploaded = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/media/upload?access_token=${encodeURIComponent(token)}&type=image`,
      {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(30_000),
      },
    )
    if (!uploaded.ok) throw new Error(`WeCom upload failed: ${uploaded.status} ${await uploaded.text()}`)
    const media = (await uploaded.json()) as {
      errcode?: number
      errmsg?: string
      media_id?: string
    }
    if (media.errcode && media.errcode !== 0)
      throw new Error(`WeCom upload failed: ${media.errcode} ${media.errmsg ?? ""}`)
    if (!media.media_id) throw new Error("WeCom upload failed: missing media_id")

    const sent = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          touser: channel,
          msgtype: "image",
          agentid: Number(this.agentId),
          image: { media_id: media.media_id },
        }),
        signal: AbortSignal.timeout(30_000),
      },
    )
    if (!sent.ok) throw new Error(`WeCom send image failed: ${sent.status} ${await sent.text()}`)
    if (!title || title === filename) return
    await this.sendMessage(channel, thread, title)
  }

  private async route(req: Request) {
    const url = new URL(req.url)
    if (url.pathname !== this.hook) return new Response("Not Found", { status: 404 })
    if (req.method === "GET") {
      const echostr = url.searchParams.get("echostr")
      if (!echostr) return new Response("ok")
      if (!this.valid(url, echostr)) return new Response("forbidden", { status: 401 })
      const plain = this.decrypt(echostr)
      if (!plain) return new Response("forbidden", { status: 401 })
      return new Response(plain)
    }
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 })

    const raw = await req.text()
    const encrypted = encryptedXml(raw)
    if (!encrypted) return new Response("invalid body", { status: 400 })
    if (!this.valid(url, encrypted)) return new Response("forbidden", { status: 401 })
    const xml = this.decrypt(encrypted)
    if (!xml) return new Response("forbidden", { status: 401 })
    if (!this.handler) return new Response("success")
    const type = pick(xml, "MsgType")
    if (type !== "text") return new Response("success")
    const channel = pick(xml, "FromUserName")
    const user = pick(xml, "FromUserName")
    const thread = pick(xml, "MsgId") ?? pick(xml, "CreateTime")
    const text = (pick(xml, "Content") ?? "").trim()
    if (!channel || !user || !thread || !text) return new Response("success")

    await this.handler({
      platform: this.platform,
      channel,
      thread,
      user,
      text,
    })
    return new Response("success")
  }

  private valid(url: URL, encrypted: string) {
    return verifyCallbackSignature({
      token: this.callbackToken,
      timestamp: url.searchParams.get("timestamp"),
      nonce: url.searchParams.get("nonce"),
      encrypted,
      signature: url.searchParams.get("msg_signature"),
    })
  }

  private decrypt(encrypted: string) {
    try {
      return decryptCallbackEnvelope({
        encodingAesKey: this.encodingAesKey,
        encrypted,
        receiveId: this.corpId,
      })
    } catch {
      return undefined
    }
  }

  private async auth() {
    if (this.token && this.expires > Date.now()) return this.token
    const res = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(this.corpId)}&corpsecret=${encodeURIComponent(this.secret)}`,
      {
        signal: AbortSignal.timeout(30_000),
      },
    )
    if (!res.ok) throw new Error(`WeCom token failed: ${res.status} ${await res.text()}`)
    const data = (await res.json()) as {
      errcode?: number
      errmsg?: string
      access_token?: string
      expires_in?: number
    }
    if (data.errcode && data.errcode !== 0) throw new Error(`WeCom token failed: ${data.errcode} ${data.errmsg ?? ""}`)
    if (!data.access_token) throw new Error("WeCom token failed: missing access_token")
    this.token = data.access_token
    this.expires = Date.now() + ((data.expires_in ?? 7200) - 60) * 1000
    return this.token
  }
}

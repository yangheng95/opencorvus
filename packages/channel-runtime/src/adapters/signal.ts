import type { ChannelAdapter, MessageHandler } from "../adapter"
import { base } from "./http"

type Envelope = {
  envelope?: {
    source?: string
    sourceNumber?: string
    sourceUuid?: string
    timestamp?: number
    dataMessage?: {
      message?: string
      timestamp?: number
      quote?: {
        id?: number
      }
    }
  }
  source?: string
  sourceNumber?: string
  sourceUuid?: string
  timestamp?: number
  dataMessage?: {
    message?: string
    timestamp?: number
    quote?: {
      id?: number
    }
  }
}

type SendResponse = {
  timestamp?: number
}

export class SignalAdapter implements ChannelAdapter {
  readonly platform = "signal"
  private handler?: MessageHandler
  private service: string
  private account: string
  private running = false
  private loop?: Promise<void>

  constructor(opts: { service: string; account: string }) {
    this.service = base(opts.service)
    this.account = opts.account
  }

  onMessage(handler: MessageHandler): void {
    this.handler = handler
  }

  async start(): Promise<void> {
    if (this.running) return
    this.running = true
    this.loop = this.pull()
    console.log("[Signal] Receive loop started")
  }

  async stop(): Promise<void> {
    this.running = false
    // Poll loop may reject during shutdown — expected
    if (this.loop) await this.loop.catch(() => undefined)
  }

  async sendMessage(channel: string, thread: string, text: string): Promise<void> {
    await this.send({
      recipients: [channel],
      message: text,
      quote_timestamp: thread ? Number(thread) || undefined : undefined,
    })
  }

  async startThread(channel: string, text: string): Promise<string> {
    const data = await this.send({
      recipients: [channel],
      message: text,
    })
    return String(data.timestamp ?? Date.now())
  }

  async uploadImage(
    channel: string,
    thread: string,
    imageBuffer: Buffer,
    filename: string,
    title?: string,
  ): Promise<void> {
    await this.send({
      recipients: [channel],
      message: title ?? filename,
      quote_timestamp: thread ? Number(thread) || undefined : undefined,
      base64_attachments: [imageBuffer.toString("base64")],
    })
  }

  private async send(payload: Record<string, unknown>) {
    const res = await fetch(`${this.service}/v2/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        number: this.account,
        ...payload,
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`Signal send failed: ${res.status} ${await res.text()}`)
    return (await res.json().catch(() => ({}))) as SendResponse
  }

  private async pull() {
    while (this.running) {
      const res = await fetch(`${this.service}/v1/receive/${encodeURIComponent(this.account)}?timeout=5`, {
        signal: AbortSignal.timeout(20_000),
      }).catch(() => undefined) // Network failure → retry after sleep below
      if (!res || !res.ok) {
        await Bun.sleep(1000)
        continue
      }

      const data = (await res.json().catch(() => [])) as Envelope[]
      if (!this.handler || data.length === 0) continue
      for (const item of data) {
        const envelope = item.envelope ?? item
        const source = envelope.source ?? envelope.sourceNumber ?? envelope.sourceUuid
        const text = (envelope.dataMessage?.message ?? "").trim()
        if (!source || !text) continue
        const thread = String(
          envelope.dataMessage?.quote?.id ?? envelope.dataMessage?.timestamp ?? envelope.timestamp ?? Date.now(),
        )
        await this.handler({
          platform: this.platform,
          channel: source,
          thread,
          user: source,
          text,
        })
      }
    }
  }
}

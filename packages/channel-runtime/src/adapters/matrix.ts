import type { ChannelAdapter, MessageHandler } from "../adapter"
import { base } from "./http"

type SyncResponse = {
  next_batch?: string
  rooms?: {
    join?: Record<
      string,
      {
        timeline?: {
          events?: Array<{
            event_id?: string
            type?: string
            sender?: string
            content?: {
              msgtype?: string
              body?: string
              [key: string]: unknown
            }
          }>
        }
      }
    >
  }
}

type UploadResponse = {
  content_uri?: string
}

export class MatrixAdapter implements ChannelAdapter {
  readonly platform = "matrix"
  private handler?: MessageHandler
  private homeserver: string
  private token: string
  private since?: string
  private userId?: string
  private running = false
  private loop?: Promise<void>

  constructor(opts: { homeserver: string; token: string; since?: string }) {
    this.homeserver = base(opts.homeserver)
    this.token = opts.token
    this.since = opts.since
  }

  onMessage(handler: MessageHandler): void {
    this.handler = handler
  }

  async start(): Promise<void> {
    if (this.running) return
    this.userId = await this.whoami()
    this.running = true
    this.loop = this.syncLoop()
    console.log("[Matrix] Sync loop started")
  }

  async stop(): Promise<void> {
    this.running = false
    // Sync loop may reject when running flag becomes false — expected during shutdown
    if (this.loop) await this.loop.catch(() => undefined)
  }

  async sendMessage(channel: string, thread: string, text: string): Promise<void> {
    await this.send(channel, {
      msgtype: "m.text",
      body: text,
      "m.relates_to": thread
        ? {
            "m.in_reply_to": {
              event_id: thread,
            },
          }
        : undefined,
    })
  }

  async startThread(channel: string, text: string): Promise<string> {
    const data = await this.send(channel, {
      msgtype: "m.text",
      body: text,
    })
    return data.event_id ?? `${Date.now()}`
  }

  async uploadImage(
    channel: string,
    thread: string,
    imageBuffer: Buffer,
    filename: string,
    title?: string,
  ): Promise<void> {
    const uploaded = await fetch(
      `${this.homeserver}/_matrix/media/v3/upload?filename=${encodeURIComponent(filename)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/octet-stream",
        },
        body: Uint8Array.from(imageBuffer),
        signal: AbortSignal.timeout(30_000),
      },
    )
    if (!uploaded.ok) throw new Error(`Matrix upload failed: ${uploaded.status} ${await uploaded.text()}`)
    const data = (await uploaded.json()) as UploadResponse
    if (!data.content_uri) throw new Error("Matrix upload failed: missing content_uri")

    await this.send(channel, {
      msgtype: "m.image",
      body: title ?? filename,
      url: data.content_uri,
      info: {
        size: imageBuffer.length,
      },
      "m.relates_to": thread
        ? {
            "m.in_reply_to": {
              event_id: thread,
            },
          }
        : undefined,
    })
  }

  private async send(channel: string, payload: Record<string, unknown>) {
    const txn = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const res = await fetch(
      `${this.homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(channel)}/send/m.room.message/${txn}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      },
    )
    if (!res.ok) throw new Error(`Matrix send failed: ${res.status} ${await res.text()}`)
    return (await res.json()) as { event_id?: string }
  }

  private async syncLoop() {
    while (this.running) {
      const params = new URLSearchParams()
      params.set("timeout", "25000")
      params.set("filter", JSON.stringify({ room: { timeline: { limit: 50 } } }))
      if (this.since) params.set("since", this.since)

      const res = await fetch(`${this.homeserver}/_matrix/client/v3/sync?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        signal: AbortSignal.timeout(35_000),
      }).catch(() => undefined) // Network failure → retry in next sync iteration
      if (!res || !res.ok) {
        await Bun.sleep(1000)
        continue
      }

      const data = (await res.json()) as SyncResponse
      this.since = data.next_batch ?? this.since
      if (!this.handler) continue

      for (const [channel, room] of Object.entries(data.rooms?.join ?? {})) {
        for (const event of room.timeline?.events ?? []) {
          if (event.type !== "m.room.message") continue
          if (event.sender === this.userId) continue
          if (!event.event_id || !event.sender) continue
          const msgtype = event.content?.msgtype
          if (msgtype !== "m.text" && msgtype !== "m.notice") continue
          const text = (event.content?.body ?? "").trim()
          if (!text) continue
          const relates = event.content?.["m.relates_to"] as
            | {
                "m.in_reply_to"?: {
                  event_id?: string
                }
              }
            | undefined
          const thread = relates?.["m.in_reply_to"]?.event_id ?? event.event_id
          await this.handler({
            platform: this.platform,
            channel,
            thread,
            user: event.sender,
            text,
          })
        }
      }
    }
  }

  private async whoami() {
    const res = await fetch(`${this.homeserver}/_matrix/client/v3/account/whoami`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`Matrix whoami failed: ${res.status}`)
    const data = (await res.json()) as { user_id?: string }
    return data.user_id
  }
}

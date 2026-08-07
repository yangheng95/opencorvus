import { App } from "@slack/bolt"
import { createHttpAudioSource } from "./audio-download"
import type { AudioAttachment, ChannelAdapter, MessageHandler } from "../adapter"

export class SlackAdapter implements ChannelAdapter {
  readonly platform = "slack"
  private app: App
  private token: string
  private handler?: MessageHandler
  private botUserId?: string
  /** Ignore messages older than this timestamp (seconds) to prevent replay on restart */
  private startTs = (Date.now() / 1000).toString()

  constructor(opts: { token: string; signingSecret?: string; appToken: string }) {
    this.token = opts.token
    this.app = new App({
      token: opts.token,
      signingSecret: opts.signingSecret ?? "",
      socketMode: true,
      appToken: opts.appToken,
    })
  }

  async start(): Promise<void> {
    const auth = await this.app.client.auth.test()
    this.botUserId = auth.user_id
    console.log(`[Slack] Bot user ID: ${this.botUserId}`)

    // Debug: log ALL raw message events before any filtering
    this.app.event("message", async ({ event }) => {
      const ev = event as unknown as Record<string, unknown>
      console.log(
        `[Slack][DEBUG] raw event: subtype=${ev.subtype ?? "none"} bot_id=${ev.bot_id ?? "none"} user=${ev.user ?? "none"} text="${(typeof ev.text === "string" ? ev.text : "").slice(0, 60)}"`,
      )
    })

    this.app.message(async ({ message }) => {
      // Allow file_share subtype (voice messages), block other subtypes
      if (message.subtype && message.subtype !== "file_share") return
      if ("user" in message && message.user === this.botUserId) return
      if (!this.handler) return

      // Extract text (may be empty for voice-only messages)
      const text = ("text" in message ? message.text : undefined) ?? ""

      // Detect audio attachments from message files
      let audio: AudioAttachment | undefined
      const msgAny = message as unknown as Record<string, unknown>
      const files = msgAny.files as
        | Array<{
            mimetype: string
            url_private: string
            name?: string
            size?: number
            duration_ms?: number
          }>
        | undefined

      if (files) {
        const audioFile = files.find((f) => f.mimetype?.startsWith("audio/"))
        if (audioFile) {
          audio = createHttpAudioSource({
            url: audioFile.url_private,
            headers: { Authorization: `Bearer ${this.token}` },
            mime: audioFile.mimetype,
            filename: audioFile.name,
            size: audioFile.size,
            duration: audioFile.duration_ms ? audioFile.duration_ms / 1000 : undefined,
          })
        }
      }

      // Skip if no text and no audio
      if (!text && !audio) return

      // Skip messages from before this bot instance started (prevents replay on restart)
      if (message.ts < this.startTs) return

      const msgTs = message.ts

      const channel = message.channel
      const thread = (msgAny.thread_ts as string) || message.ts

      await this.handler({
        id: msgTs,
        platform: this.platform,
        channel,
        thread,
        user: ("user" in message ? message.user : undefined) ?? "unknown",
        text,
        audio,
      })
    })

    await this.app.start()
  }

  async stop(): Promise<void> {
    await this.app.stop()
  }

  async sendMessage(channel: string, thread: string, text: string): Promise<void> {
    await this.app.client.chat.postMessage({
      channel,
      thread_ts: thread,
      text,
    })
  }

  async startThread(channel: string, text: string): Promise<string> {
    const result = await this.app.client.chat.postMessage({ channel, text })
    return result.ts!
  }

  async uploadImage(
    channel: string,
    thread: string,
    imageBuffer: Buffer,
    filename: string,
    title?: string,
  ): Promise<void> {
    await this.app.client.filesUploadV2({
      channel_id: channel,
      thread_ts: thread,
      file: imageBuffer,
      filename,
      title: title ?? filename,
    })
  }

  onMessage(handler: MessageHandler): void {
    this.handler = handler
  }
}

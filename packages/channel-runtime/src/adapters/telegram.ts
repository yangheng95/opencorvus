import { Bot, InputFile } from "grammy"
import { createHttpAudioSource } from "./audio-download"
import type { AudioAttachment, ChannelAdapter, MessageHandler } from "../adapter"
import { assertSTTAudioSize } from "../stt/limits"

export class TelegramAdapter implements ChannelAdapter {
  readonly platform = "telegram"
  private bot: Bot
  private token: string
  private handler?: MessageHandler

  constructor(opts: { token: string }) {
    this.token = opts.token
    this.bot = new Bot(opts.token)
  }

  async start(): Promise<void> {
    this.bot.on("message:text", async (ctx) => {
      // Ignore messages from the bot itself
      if (ctx.from.id === this.bot.botInfo.id) return
      if (!this.handler) return

      const channel = String(ctx.chat.id)
      const thread = String(ctx.message.reply_to_message?.message_id ?? ctx.message.message_id)
      const user = String(ctx.from.id)

      await this.handler({
        platform: this.platform,
        channel,
        thread,
        user,
        text: ctx.message.text,
      })
    })

    // Voice messages (Telegram voice notes, always .ogg opus)
    this.bot.on("message:voice", async (ctx) => {
      if (ctx.from.id === this.bot.botInfo.id) return
      if (!this.handler) return

      const channel = String(ctx.chat.id)
      const thread = String(ctx.message.reply_to_message?.message_id ?? ctx.message.message_id)
      const user = String(ctx.from.id)

      const audio = this.createTelegramAudioSource(
        ctx.message.voice.file_id,
        "audio/ogg",
        ctx.message.voice.duration,
        undefined,
        ctx.message.voice.file_size,
      )

      await this.handler({
        platform: this.platform,
        channel,
        thread,
        user,
        text: ctx.message.caption ?? "",
        audio,
      })
    })

    // Audio file attachments (e.g., .mp3, .m4a sent as documents)
    this.bot.on("message:audio", async (ctx) => {
      if (ctx.from.id === this.bot.botInfo.id) return
      if (!this.handler) return

      const channel = String(ctx.chat.id)
      const thread = String(ctx.message.reply_to_message?.message_id ?? ctx.message.message_id)
      const user = String(ctx.from.id)

      const audio = this.createTelegramAudioSource(
        ctx.message.audio.file_id,
        ctx.message.audio.mime_type ?? "audio/mpeg",
        ctx.message.audio.duration,
        ctx.message.audio.file_name,
        ctx.message.audio.file_size,
      )

      await this.handler({
        platform: this.platform,
        channel,
        thread,
        user,
        text: ctx.message.caption ?? "",
        audio,
      })
    })

    await new Promise<void>((resolve, reject) => {
      let ready = false
      const polling = this.bot.start({
        onStart: () => {
          ready = true
          resolve()
        },
      })
      polling.catch((error) => {
        if (!ready) reject(error)
        else console.error("[Telegram] Long polling stopped:", error)
      })
    })
    console.log(`[Telegram] Bot started (long polling)`)
  }

  private createTelegramAudioSource(
    fileId: string,
    mime: string,
    duration?: number,
    filename?: string,
    metadataSize?: number,
  ): AudioAttachment {
    return {
      mime,
      filename,
      size: metadataSize,
      duration,
      read: async (maxFileSizeBytes) => {
        if (metadataSize !== undefined) {
          assertSTTAudioSize(metadataSize, maxFileSizeBytes)
        }
        const file = await this.bot.api.getFile(fileId)
        const filePath = file.file_path
        if (!filePath) {
          throw new Error("[Telegram] getFile returned no file_path")
        }

        const url = `https://api.telegram.org/file/bot${this.token}/${filePath}`
        return createHttpAudioSource({
          url,
          mime,
          filename,
          size: file.file_size ?? metadataSize,
          duration,
        }).read(maxFileSizeBytes)
      },
    }
  }

  async stop(): Promise<void> {
    if (this.bot.isRunning()) await this.bot.stop()
  }

  async sendMessage(channel: string, thread: string, text: string): Promise<void> {
    await this.bot.api.sendMessage(Number(channel), text, {
      reply_parameters: { message_id: Number(thread) },
    })
  }

  async uploadImage(
    channel: string,
    thread: string,
    imageBuffer: Buffer,
    filename: string,
    title?: string,
  ): Promise<void> {
    await this.bot.api.sendPhoto(Number(channel), new InputFile(imageBuffer, filename), {
      caption: title ?? filename,
      reply_parameters: { message_id: Number(thread) },
    })
  }

  onMessage(handler: MessageHandler): void {
    this.handler = handler
  }
}

import type { AudioSource } from "./stt/types"

export type AudioAttachment = AudioSource

export interface ChannelAdapter {
  readonly platform: string
  start(): Promise<void>
  stop(): Promise<void>
  sendMessage(channel: string, thread: string, text: string): Promise<void>
  uploadImage(channel: string, thread: string, imageBuffer: Buffer, filename: string, title?: string): Promise<void>
  uploadImageUrl?(channel: string, thread: string, url: string, filename: string, title?: string): Promise<void>
  startThread?(channel: string, text: string): Promise<string>
  onMessage(handler: MessageHandler): void
}

export interface IncomingMessage {
  /** Stable provider event/message identity used for durable ingress ownership. */
  id?: string
  platform: string
  channel: string
  thread: string
  user: string
  text: string
  audio?: AudioAttachment
}

export type MessageHandler = (msg: IncomingMessage) => Promise<void>

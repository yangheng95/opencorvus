import { beforeEach, describe, expect, mock, test } from "bun:test"

type Msg = {
  author: { bot: boolean; id: string }
  inGuild: () => boolean
  channel: { type: number; id: string; isThread: () => boolean }
  type: number
  reference?: { messageId?: string }
  id: string
  channelId: string
  content?: string
}

let sends: Array<any> = []
let lastClient: any
let sendFailure: Error | undefined

class FakeClient {
  handlers = new Map<string, (msg: Msg) => Promise<void> | void>()
  channels = {
    fetch: async (_id: string) => ({
      id: "ch-1",
      isTextBased: () => true,
      send: async (payload: any) => {
        sends.push(payload)
        if (sendFailure) throw sendFailure
      },
    }),
  }
  user = { tag: "bot#0001" }

  constructor() {
    lastClient = this
  }

  once(_name: string, _handler: (...args: any[]) => void) {}

  on(name: string, handler: (msg: Msg) => Promise<void> | void) {
    this.handlers.set(name, handler)
  }

  async login(_token: string) {}

  async destroy() {}

  async emitMessage(msg: Msg) {
    const fn = this.handlers.get("messageCreate")
    if (!fn) return
    await fn(msg)
  }
}

mock.module("discord.js", () => ({
  Client: FakeClient,
  AttachmentBuilder: class {
    constructor(
      public buffer: Buffer,
      public options: { name: string },
    ) {}
  },
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    DirectMessages: 3,
    MessageContent: 4,
  },
  Partials: { Channel: 1 },
  ChannelType: { DM: 1 },
  MessageFlags: { SuppressNotifications: 1 << 12 },
}))

const { DiscordAdapter } = await import("../src/adapters/discord")

beforeEach(() => {
  sends = []
  sendFailure = undefined
})

describe("discord adapter", () => {
  test("maps messageCreate to IncomingMessage with reply root thread id", async () => {
    const adapter = new DiscordAdapter({ token: "x" })
    const seen: Array<any> = []
    adapter.onMessage(async (msg) => {
      seen.push(msg)
    })

    await adapter.start()

    await lastClient.emitMessage({
      author: { bot: false, id: "u-1" },
      inGuild: () => true,
      channel: { type: 0, id: "ch-1", isThread: () => false },
      type: 19,
      reference: { messageId: "root-1" },
      id: "msg-1",
      channelId: "ch-1",
      content: "hello",
    })

    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({
      platform: "discord",
      channel: "ch-1",
      thread: "root-1",
      user: "u-1",
      text: "hello",
    })
  })

  test("sends reply message with messageReference", async () => {
    const adapter = new DiscordAdapter({ token: "x" })

    await adapter.sendMessage("ch-1", "root-9", "done")

    expect(sends).toHaveLength(1)
    expect(sends[0]).toMatchObject({
      content: "done",
      reply: {
        messageReference: "root-9",
      },
    })
  })

  test("does not retry Discord text sends without the reply reference", async () => {
    const adapter = new DiscordAdapter({ token: "x" })
    sendFailure = new Error("reply reference failed")

    await expect(adapter.sendMessage("ch-1", "root-9", "done")).rejects.toThrow("reply reference failed")

    expect(sends).toHaveLength(1)
    expect(sends[0]).toMatchObject({
      content: "done",
      reply: {
        messageReference: "root-9",
      },
    })
  })

  test("does not retry Discord image sends without the reply reference", async () => {
    const adapter = new DiscordAdapter({ token: "x" })
    sendFailure = new Error("image reply failed")

    await expect(adapter.uploadImage("ch-1", "root-9", Buffer.from("png"), "overlay.png", "capture")).rejects.toThrow(
      "image reply failed",
    )

    expect(sends).toHaveLength(1)
    expect(sends[0]).toMatchObject({
      content: "capture",
      reply: {
        messageReference: "root-9",
      },
    })
  })
})

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { ChannelCatalog } from "@opencorvus-ai/channel-config"
import type { ChannelAdapter, MessageHandler } from "../src/adapter"
import { ADAPTER_HINT, PLANNED_CHANNELS, registerAdapters, READY_CHANNELS } from "../src/registry"

const repoRoot = resolve(import.meta.dir, "../../..")

class Fake implements ChannelAdapter {
  constructor(
    readonly platform: string,
    readonly options?: unknown,
  ) {}
  async start() {}
  async stop() {}
  async sendMessage(_channel: string, _thread: string, _text: string) {}
  async uploadImage(_channel: string, _thread: string, _imageBuffer: Buffer, _filename: string, _title?: string) {}
  onMessage(_handler: MessageHandler) {}
}

function runtime() {
  const list: ChannelAdapter[] = []
  return {
    list,
    register(adapter: ChannelAdapter) {
      list.push(adapter)
      return this
    },
  }
}

function factory() {
  return {
    slack: (options: unknown) => new Fake("slack", options),
    telegram: (options: unknown) => new Fake("telegram", options),
    discord: (options: unknown) => new Fake("discord", options),
    feishu: (options: unknown) => new Fake("feishu", options),
    whatsapp: (options: unknown) => new Fake("whatsapp", options),
    googlechat: (options: unknown) => new Fake("googlechat", options),
    msteams: (options: unknown) => new Fake("msteams", options),
    line: (options: unknown) => new Fake("line", options),
    matrix: (options: unknown) => new Fake("matrix", options),
    mattermost: (options: unknown) => new Fake("mattermost", options),
    signal: (options: unknown) => new Fake("signal", options),
    wecom: (options: unknown) => new Fake("wecom", options),
    dingtalk: (options: unknown) => new Fake("dingtalk", options),
    qqbot: (options: unknown) => new Fake("qqbot", options),
  }
}

describe("channel registry", () => {
  test("does not read process env when caller supplies an empty env", () => {
    const previousBotToken = process.env.SLACK_BOT_TOKEN
    const previousAppToken = process.env.SLACK_APP_TOKEN
    process.env.SLACK_BOT_TOKEN = "xoxb-global"
    process.env.SLACK_APP_TOKEN = "xapp-global"
    try {
      const app = runtime()
      const result = registerAdapters(app, {}, factory())

      expect(result.names).toEqual([])
      expect(result.warns).toEqual([])
      expect(app.list).toHaveLength(0)
    } finally {
      if (previousBotToken === undefined) delete process.env.SLACK_BOT_TOKEN
      else process.env.SLACK_BOT_TOKEN = previousBotToken
      if (previousAppToken === undefined) delete process.env.SLACK_APP_TOKEN
      else process.env.SLACK_APP_TOKEN = previousAppToken
    }
  })

  test("registers slack, telegram, discord and feishu from standard env keys", () => {
    const app = runtime()
    const result = registerAdapters(
      app,
      {
        SLACK_BOT_TOKEN: "xoxb-a",
        SLACK_APP_TOKEN: "xapp-a",
        TELEGRAM_BOT_TOKEN: "tg-a",
        DISCORD_BOT_TOKEN: "dc-a",
        FEISHU_APP_ID: "cli_a",
        FEISHU_APP_SECRET: "sec_a",
      },
      factory(),
    )

    expect(result.warns).toHaveLength(0)
    expect(result.names).toEqual(["slack", "telegram", "discord", "feishu"])
    expect(app.list.map((item) => item.platform)).toEqual(["slack", "telegram", "discord", "feishu"])
  })

  test("warns and skips slack when app token is missing", () => {
    const app = runtime()
    const result = registerAdapters(
      app,
      {
        SLACK_BOT_TOKEN: "xoxb-a",
      },
      factory(),
    )

    expect(result.names).toEqual([])
    expect(result.warns).toEqual(["Skip slack channel: missing required env. Need: SLACK_BOT_TOKEN, SLACK_APP_TOKEN."])
    expect(app.list).toHaveLength(0)
  })

  test("requires line channel secret before registering LINE", () => {
    const partial = runtime()
    const partialResult = registerAdapters(
      partial,
      {
        LINE_CHANNEL_ACCESS_TOKEN: "line_token",
      },
      factory(),
    )

    expect(partialResult.names).toEqual([])
    expect(partialResult.warns).toEqual([
      "Skip line channel: missing required env. Need: LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET.",
    ])
    expect(partial.list).toHaveLength(0)

    const complete = runtime()
    const completeResult = registerAdapters(
      complete,
      {
        LINE_CHANNEL_ACCESS_TOKEN: "line_token",
        LINE_CHANNEL_SECRET: "line_secret",
      },
      factory(),
    )

    expect(completeResult.warns).toEqual([])
    expect(completeResult.names).toEqual(["line"])
    expect(complete.list.map((item) => item.platform)).toEqual(["line"])
    expect((complete.list[0] as Fake).options).toEqual({
      token: "line_token",
      host: undefined,
      port: undefined,
      path: undefined,
      secret: "line_secret",
    })
  })

  test("requires googlechat auth audience before registering", () => {
    const partial = runtime()
    const partialResult = registerAdapters(
      partial,
      {
        GOOGLECHAT_SERVICE_ACCOUNT_JSON: "{}",
      },
      factory(),
    )

    expect(partialResult.names).toEqual([])
    expect(partialResult.warns).toEqual([
      "Skip googlechat channel: missing required env. Need: GOOGLECHAT_SERVICE_ACCOUNT_JSON, GOOGLECHAT_AUTH_AUDIENCE.",
    ])
    expect(partial.list).toHaveLength(0)

    const complete = runtime()
    const completeResult = registerAdapters(
      complete,
      {
        GOOGLECHAT_SERVICE_ACCOUNT_JSON: "{}",
        GOOGLECHAT_AUTH_AUDIENCE: "https://public.opencorvus.dev/googlechat",
      },
      factory(),
    )

    expect(completeResult.warns).toEqual([])
    expect(completeResult.names).toEqual(["googlechat"])
    expect((complete.list[0] as Fake).options).toEqual({
      serviceAccount: "{}",
      authAudience: "https://public.opencorvus.dev/googlechat",
      host: undefined,
      port: undefined,
      path: undefined,
    })
  })

  test("requires dingtalk callback crypto env before registering", () => {
    const partial = runtime()
    const partialResult = registerAdapters(
      partial,
      {
        DINGTALK_APP_KEY: "ding_key",
        DINGTALK_APP_SECRET: "ding_secret",
      },
      factory(),
    )

    expect(partialResult.names).toEqual([])
    expect(partialResult.warns).toEqual([
      "Skip dingtalk channel: missing required env. Need: DINGTALK_APP_KEY, DINGTALK_APP_SECRET, DINGTALK_CALLBACK_TOKEN, DINGTALK_ENCODING_AES_KEY.",
    ])
    expect(partial.list).toHaveLength(0)

    const complete = runtime()
    const completeResult = registerAdapters(
      complete,
      {
        DINGTALK_APP_KEY: "ding_key",
        DINGTALK_APP_SECRET: "ding_secret",
        DINGTALK_CALLBACK_TOKEN: "ding_token",
        DINGTALK_ENCODING_AES_KEY: "aes_key",
      },
      factory(),
    )

    expect(completeResult.warns).toEqual([])
    expect(completeResult.names).toEqual(["dingtalk"])
    expect((complete.list[0] as Fake).options).toEqual({
      appKey: "ding_key",
      appSecret: "ding_secret",
      callbackToken: "ding_token",
      encodingAesKey: "aes_key",
      host: undefined,
      port: undefined,
      path: undefined,
      defaultWebhook: undefined,
    })
  })

  test("requires wecom callback crypto env before registering", () => {
    const partial = runtime()
    const partialResult = registerAdapters(
      partial,
      {
        WECOM_CORP_ID: "wxcorp",
        WECOM_SECRET: "wxsec",
        WECOM_AGENT_ID: "1000002",
      },
      factory(),
    )

    expect(partialResult.names).toEqual([])
    expect(partialResult.warns).toEqual([
      "Skip wecom channel: missing required env. Need: WECOM_CORP_ID, WECOM_SECRET, WECOM_AGENT_ID, WECOM_CALLBACK_TOKEN, WECOM_ENCODING_AES_KEY.",
    ])
    expect(partial.list).toHaveLength(0)

    const complete = runtime()
    const completeResult = registerAdapters(
      complete,
      {
        WECOM_CORP_ID: "wxcorp",
        WECOM_SECRET: "wxsec",
        WECOM_AGENT_ID: "1000002",
        WECOM_CALLBACK_TOKEN: "wecom_token",
        WECOM_ENCODING_AES_KEY: "aes_key",
      },
      factory(),
    )

    expect(completeResult.warns).toEqual([])
    expect(completeResult.names).toEqual(["wecom"])
    expect((complete.list[0] as Fake).options).toEqual({
      corpId: "wxcorp",
      secret: "wxsec",
      agentId: "1000002",
      token: "wecom_token",
      encodingAesKey: "aes_key",
      host: undefined,
      port: undefined,
      path: undefined,
    })
  })

  test("registers dingtalk from complete env keys", () => {
    const app = runtime()
    const result = registerAdapters(
      app,
      {
        DINGTALK_APP_KEY: "ding_key",
        DINGTALK_APP_SECRET: "ding_secret",
        DINGTALK_CALLBACK_TOKEN: "ding_token",
        DINGTALK_ENCODING_AES_KEY: "aes_key",
      },
      factory(),
    )

    expect(result.warns).toEqual([])
    expect(result.names).toEqual(["dingtalk"])
    expect(app.list.map((item) => item.platform)).toEqual(["dingtalk"])
    expect((app.list[0] as Fake).options).toMatchObject({
      callbackToken: "ding_token",
      encodingAesKey: "aes_key",
    })
  })

  test("requires whatsapp verification token and app secret before registering", () => {
    const partial = runtime()
    const partialResult = registerAdapters(
      partial,
      {
        WHATSAPP_ACCESS_TOKEN: "wa_token",
        WHATSAPP_PHONE_NUMBER_ID: "wa_number",
        WHATSAPP_VERIFY_TOKEN: "wa_verify",
      },
      factory(),
    )

    expect(partialResult.names).toEqual([])
    expect(partialResult.warns).toEqual([
      "Skip whatsapp channel: missing required env. Need: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN.",
    ])
    expect(partial.list).toHaveLength(0)

    const complete = runtime()
    const completeResult = registerAdapters(
      complete,
      {
        WHATSAPP_ACCESS_TOKEN: "wa_token",
        WHATSAPP_PHONE_NUMBER_ID: "wa_number",
        WHATSAPP_APP_SECRET: "wa_secret",
        WHATSAPP_VERIFY_TOKEN: "wa_verify",
      },
      factory(),
    )

    expect(completeResult.warns).toEqual([])
    expect(completeResult.names).toEqual(["whatsapp"])
    expect((complete.list[0] as Fake).options).toEqual({
      token: "wa_token",
      numberId: "wa_number",
      appSecret: "wa_secret",
      verifyToken: "wa_verify",
      host: undefined,
      port: undefined,
      path: undefined,
    })
  })

  test("requires mattermost outgoing webhook token before registering", () => {
    const partial = runtime()
    const partialResult = registerAdapters(
      partial,
      {
        MATTERMOST_SERVER_URL: "https://mm.example.com",
        MATTERMOST_BOT_TOKEN: "mm_token",
      },
      factory(),
    )

    expect(partialResult.names).toEqual([])
    expect(partialResult.warns).toEqual([
      "Skip mattermost channel: missing required env. Need: MATTERMOST_SERVER_URL, MATTERMOST_BOT_TOKEN, MATTERMOST_WEBHOOK_TOKEN.",
    ])
    expect(partial.list).toHaveLength(0)

    const complete = runtime()
    const completeResult = registerAdapters(
      complete,
      {
        MATTERMOST_SERVER_URL: "https://mm.example.com",
        MATTERMOST_BOT_TOKEN: "mm_token",
        MATTERMOST_WEBHOOK_TOKEN: "hook_token",
      },
      factory(),
    )

    expect(completeResult.warns).toEqual([])
    expect(completeResult.names).toEqual(["mattermost"])
    expect((complete.list[0] as Fake).options).toEqual({
      url: "https://mm.example.com",
      token: "mm_token",
      webhookToken: "hook_token",
      host: undefined,
      port: undefined,
      path: undefined,
    })
  })

  test("does not register a planned provider even when its env is configured", () => {
    const app = runtime()
    const result = registerAdapters(
      app,
      {
        QQBOT_APP_ID: "1024",
        QQBOT_CLIENT_SECRET: "qq_secret",
      },
      factory(),
    )

    expect(result.warns).toEqual([])
    expect(result.names).toEqual([])
    expect(app.list).toEqual([])
  })

  test("forwards optional webhook settings from shared channel definitions", () => {
    const app = runtime()
    const result = registerAdapters(
      app,
      {
        FEISHU_APP_ID: "cli_a",
        FEISHU_APP_SECRET: "sec_a",
        FEISHU_VERIFICATION_TOKEN: "verify_a",
        FEISHU_WEBHOOK_HOST: "0.0.0.0",
        FEISHU_WEBHOOK_PORT: "16666",
        FEISHU_WEBHOOK_PATH: "/feishu",
      },
      factory(),
    )

    expect(result.warns).toHaveLength(0)
    expect(result.names).toEqual(["feishu"])
    expect((app.list[0] as Fake).options).toEqual({
      appId: "cli_a",
      appSecret: "sec_a",
      host: "0.0.0.0",
      port: 16666,
      path: "/feishu",
      verificationToken: "verify_a",
    })
  })

  test("keeps application-runtime providers out of the ready runtime projection", () => {
    expect(READY_CHANNELS).toEqual(
      ChannelCatalog.flatMap((item) => (item.implementation.kind === "planned" ? [] : [item.id])),
    )
    expect(READY_CHANNELS).toHaveLength(13)
    expect(PLANNED_CHANNELS).toHaveLength(14)
    expect(READY_CHANNELS).not.toContain("reef")
    expect(READY_CHANNELS).not.toContain("imessage")
    expect(READY_CHANNELS).not.toContain("qqbot")
    expect(PLANNED_CHANNELS).toContain("qqbot")
    expect(READY_CHANNELS).not.toContain("qq")
    expect(ADAPTER_HINT).not.toContain("QQBOT_APP_ID")
  })

  test("env examples document every required ChannelCatalog key", () => {
    const requiredEnv = ChannelCatalog.flatMap((channel) =>
      channel.fields.filter((field) => field.required && field.env).map((field) => field.env!),
    )
    const missing = [".env.example", "packages/channel-runtime/.env.example"].flatMap((relativePath) => {
      const example = readFileSync(resolve(repoRoot, relativePath), "utf8")
      return requiredEnv
        .filter((env) => !new RegExp(`^#?\\s*${env}=`, "m").test(example))
        .map((env) => `${relativePath}:${env}`)
    })

    expect(missing).toEqual([])
  })
})

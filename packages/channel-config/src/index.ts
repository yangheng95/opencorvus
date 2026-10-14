import z from "zod"

export const ChannelFieldType = z.enum(["boolean", "text", "secret"])
export const ChannelId = z.enum([
  "slack",
  "telegram",
  "discord",
  "feishu",
  "whatsapp",
  "googlechat",
  "msteams",
  "line",
  "matrix",
  "mattermost",
  "signal",
  "wecom",
  "dingtalk",
  "clickclack",
  "imessage",
  "irc",
  "nextcloud-talk",
  "nostr",
  "qqbot",
  "raft",
  "reef",
  "sms",
  "synology-chat",
  "tlon",
  "twitch",
  "zalo",
  "zalouser",
])
export const ChannelSurface = z.enum(["panel", "gateway", ...ChannelId.options])

export type ChannelName = z.infer<typeof ChannelId>
export const ChannelFieldPlaceholder = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("example"), value: z.string() }),
  z.object({ kind: z.literal("hint"), key: z.string() }),
])

export type ChannelField = {
  key: string
  labelKey: string
  type: z.infer<typeof ChannelFieldType>
  description: string
  placeholder?: z.infer<typeof ChannelFieldPlaceholder>
  env?: string
  required?: boolean
  transform?: "integer" | "string-list"
  configPath?: readonly string[]
}

export type ChannelImplementation =
  | { kind: "native" }
  | {
      kind: "planned"
      reason: string
      source?: "package" | "runtime"
      packageName?: string
      entry?: string
      version?: string
      providerConfig?: Readonly<Record<string, unknown>>
    }

type Spec = {
  id: ChannelName
  name: string
  schemaName: string
  docsUrl: string
  implementation: ChannelImplementation
  fields: readonly ChannelField[]
}

function define(
  input: Omit<Spec, "schemaName" | "docsUrl" | "implementation"> &
    Partial<Pick<Spec, "schemaName" | "docsUrl" | "implementation">>,
): Spec {
  return {
    ...input,
    schemaName: input.schemaName ?? input.name.replace(/[^A-Za-z0-9]/g, ""),
    docsUrl: input.docsUrl ?? `https://docs.openclaw.ai/channels/${input.id}`,
    implementation: input.implementation ?? { kind: "native" },
  }
}

export const ChannelCatalog = [
  define({
    id: "slack",
    name: "Slack",
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.slack.enabled",
        type: "boolean",
        description: "Enable Slack channel integration",
      },
      {
        key: "botToken",
        labelKey: "channel.field.slack.botToken",
        type: "secret",
        description: "Slack bot token",
        placeholder: { kind: "example", value: "xoxb-..." },
        env: "SLACK_BOT_TOKEN",
        required: true,
      },
      {
        key: "appToken",
        labelKey: "channel.field.slack.appToken",
        type: "secret",
        description: "Slack app token for Socket Mode",
        placeholder: { kind: "example", value: "xapp-..." },
        env: "SLACK_APP_TOKEN",
        required: true,
      },
      {
        key: "signingSecret",
        labelKey: "channel.field.slack.signingSecret",
        type: "secret",
        description: "Slack signing secret",
        placeholder: { kind: "hint", key: "channel.placeholder.slack.signingSecret" },
        env: "SLACK_SIGNING_SECRET",
      },
    ],
  }),
  define({
    id: "telegram",
    name: "Telegram",
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.telegram.enabled",
        type: "boolean",
        description: "Enable Telegram channel integration",
      },
      {
        key: "token",
        labelKey: "channel.field.telegram.token",
        type: "secret",
        description: "Telegram bot token",
        placeholder: { kind: "example", value: "123456:ABC..." },
        env: "TELEGRAM_BOT_TOKEN",
        required: true,
      },
    ],
  }),
  define({
    id: "discord",
    name: "Discord",
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.discord.enabled",
        type: "boolean",
        description: "Enable Discord channel integration",
      },
      {
        key: "token",
        labelKey: "channel.field.discord.token",
        type: "secret",
        description: "Discord bot token",
        placeholder: { kind: "hint", key: "channel.placeholder.discord.token" },
        env: "DISCORD_BOT_TOKEN",
        required: true,
      },
    ],
  }),
  define({
    id: "feishu",
    name: "Feishu / Lark",
    schemaName: "Feishu",
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.feishu.enabled",
        type: "boolean",
        description: "Enable Feishu or Lark channel integration",
      },
      {
        key: "appId",
        labelKey: "channel.field.feishu.appId",
        type: "secret",
        description: "Feishu or Lark app ID",
        placeholder: { kind: "example", value: "cli_..." },
        env: "FEISHU_APP_ID",
        required: true,
      },
      {
        key: "appSecret",
        labelKey: "channel.field.feishu.appSecret",
        type: "secret",
        description: "Feishu or Lark app secret",
        placeholder: { kind: "hint", key: "channel.placeholder.feishu.appSecret" },
        env: "FEISHU_APP_SECRET",
        required: true,
      },
      {
        key: "verificationToken",
        labelKey: "channel.field.feishu.verificationToken",
        type: "secret",
        description: "Optional Feishu or Lark webhook verification token",
        placeholder: { kind: "hint", key: "channel.placeholder.feishu.verificationToken" },
        env: "FEISHU_VERIFICATION_TOKEN",
      },
      {
        key: "webhookHost",
        labelKey: "channel.field.feishu.webhookHost",
        type: "text",
        description: "Optional Feishu or Lark webhook host",
        placeholder: { kind: "example", value: "0.0.0.0" },
        env: "FEISHU_WEBHOOK_HOST",
      },
      {
        key: "webhookPort",
        labelKey: "channel.field.feishu.webhookPort",
        type: "text",
        description: "Optional Feishu or Lark webhook port",
        placeholder: { kind: "example", value: "16666" },
        env: "FEISHU_WEBHOOK_PORT",
      },
      {
        key: "webhookPath",
        labelKey: "channel.field.feishu.webhookPath",
        type: "text",
        description: "Optional Feishu or Lark webhook path",
        placeholder: { kind: "example", value: "/feishu" },
        env: "FEISHU_WEBHOOK_PATH",
      },
    ],
  }),
  define({
    id: "whatsapp",
    name: "WhatsApp",
    schemaName: "Whatsapp",
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.whatsapp.enabled",
        type: "boolean",
        description: "Enable WhatsApp channel integration",
      },
      {
        key: "token",
        labelKey: "channel.field.whatsapp.token",
        type: "secret",
        description: "WhatsApp Cloud API access token",
        placeholder: { kind: "example", value: "EAAG..." },
        env: "WHATSAPP_ACCESS_TOKEN",
        required: true,
      },
      {
        key: "numberId",
        labelKey: "channel.field.whatsapp.numberId",
        type: "secret",
        description: "WhatsApp Cloud API phone number ID",
        placeholder: { kind: "hint", key: "channel.placeholder.whatsapp.numberId" },
        env: "WHATSAPP_PHONE_NUMBER_ID",
        required: true,
      },
      {
        key: "appSecret",
        labelKey: "channel.field.whatsapp.appSecret",
        type: "secret",
        description: "WhatsApp Meta app secret used to verify webhook signatures",
        placeholder: { kind: "hint", key: "channel.placeholder.whatsapp.appSecret" },
        env: "WHATSAPP_APP_SECRET",
        required: true,
      },
      {
        key: "verifyToken",
        labelKey: "channel.field.whatsapp.verifyToken",
        type: "secret",
        description: "WhatsApp webhook verification token",
        placeholder: { kind: "hint", key: "channel.placeholder.whatsapp.verifyToken" },
        env: "WHATSAPP_VERIFY_TOKEN",
        required: true,
      },
      {
        key: "webhookHost",
        labelKey: "channel.field.whatsapp.webhookHost",
        type: "text",
        description: "Optional WhatsApp webhook host",
        placeholder: { kind: "example", value: "0.0.0.0" },
        env: "WHATSAPP_WEBHOOK_HOST",
      },
      {
        key: "webhookPort",
        labelKey: "channel.field.whatsapp.webhookPort",
        type: "text",
        description: "Optional WhatsApp webhook port",
        placeholder: { kind: "example", value: "16667" },
        env: "WHATSAPP_WEBHOOK_PORT",
      },
      {
        key: "webhookPath",
        labelKey: "channel.field.whatsapp.webhookPath",
        type: "text",
        description: "Optional WhatsApp webhook path",
        placeholder: { kind: "example", value: "/whatsapp" },
        env: "WHATSAPP_WEBHOOK_PATH",
      },
    ],
  }),
  define({
    id: "googlechat",
    name: "Google Chat",
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.googlechat.enabled",
        type: "boolean",
        description: "Enable Google Chat integration",
      },
      {
        key: "serviceAccount",
        labelKey: "channel.field.googlechat.serviceAccount",
        type: "secret",
        description: "Google Chat service account JSON or path",
        placeholder: { kind: "hint", key: "channel.placeholder.googlechat.serviceAccount" },
        env: "GOOGLECHAT_SERVICE_ACCOUNT_JSON",
        required: true,
      },
      {
        key: "authAudience",
        labelKey: "channel.field.googlechat.authAudience",
        type: "secret",
        description: "Google Chat request token audience, usually the HTTPS endpoint URL",
        placeholder: { kind: "example", value: "https://example.com/googlechat" },
        env: "GOOGLECHAT_AUTH_AUDIENCE",
        required: true,
      },
      {
        key: "webhookHost",
        labelKey: "channel.field.googlechat.webhookHost",
        type: "text",
        description: "Optional Google Chat webhook host",
        placeholder: { kind: "example", value: "0.0.0.0" },
        env: "GOOGLECHAT_WEBHOOK_HOST",
      },
      {
        key: "webhookPort",
        labelKey: "channel.field.googlechat.webhookPort",
        type: "text",
        description: "Optional Google Chat webhook port",
        placeholder: { kind: "example", value: "16668" },
        env: "GOOGLECHAT_WEBHOOK_PORT",
      },
      {
        key: "webhookPath",
        labelKey: "channel.field.googlechat.webhookPath",
        type: "text",
        description: "Optional Google Chat webhook path",
        placeholder: { kind: "example", value: "/googlechat" },
        env: "GOOGLECHAT_WEBHOOK_PATH",
      },
    ],
  }),
  define({
    id: "msteams",
    name: "Microsoft Teams",
    schemaName: "MSTeams",
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.msteams.enabled",
        type: "boolean",
        description: "Enable Microsoft Teams integration",
      },
      {
        key: "appId",
        labelKey: "channel.field.msteams.appId",
        type: "secret",
        description: "Microsoft Teams bot app ID",
        placeholder: { kind: "hint", key: "channel.placeholder.msteams.appId" },
        env: "MSTEAMS_APP_ID",
        required: true,
      },
      {
        key: "appSecret",
        labelKey: "channel.field.msteams.appSecret",
        type: "secret",
        description: "Microsoft Teams bot app secret",
        placeholder: { kind: "hint", key: "channel.placeholder.msteams.appSecret" },
        env: "MSTEAMS_APP_SECRET",
        required: true,
      },
      {
        key: "webhookHost",
        labelKey: "channel.field.msteams.webhookHost",
        type: "text",
        description: "Optional Microsoft Teams webhook host",
        placeholder: { kind: "example", value: "0.0.0.0" },
        env: "MSTEAMS_WEBHOOK_HOST",
      },
      {
        key: "webhookPort",
        labelKey: "channel.field.msteams.webhookPort",
        type: "text",
        description: "Optional Microsoft Teams webhook port",
        placeholder: { kind: "example", value: "16669" },
        env: "MSTEAMS_WEBHOOK_PORT",
      },
      {
        key: "webhookPath",
        labelKey: "channel.field.msteams.webhookPath",
        type: "text",
        description: "Optional Microsoft Teams webhook path",
        placeholder: { kind: "example", value: "/msteams" },
        env: "MSTEAMS_WEBHOOK_PATH",
      },
    ],
  }),
  define({
    id: "line",
    name: "LINE",
    schemaName: "Line",
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.line.enabled",
        type: "boolean",
        description: "Enable LINE integration",
      },
      {
        key: "token",
        labelKey: "channel.field.line.token",
        type: "secret",
        description: "LINE channel access token",
        placeholder: { kind: "hint", key: "channel.placeholder.line.token" },
        env: "LINE_CHANNEL_ACCESS_TOKEN",
        required: true,
      },
      {
        key: "secret",
        labelKey: "channel.field.line.secret",
        type: "secret",
        description: "LINE channel secret for webhook verification",
        placeholder: { kind: "hint", key: "channel.placeholder.line.secret" },
        env: "LINE_CHANNEL_SECRET",
        required: true,
      },
      {
        key: "webhookHost",
        labelKey: "channel.field.line.webhookHost",
        type: "text",
        description: "Optional LINE webhook host",
        placeholder: { kind: "example", value: "0.0.0.0" },
        env: "LINE_WEBHOOK_HOST",
      },
      {
        key: "webhookPort",
        labelKey: "channel.field.line.webhookPort",
        type: "text",
        description: "Optional LINE webhook port",
        placeholder: { kind: "example", value: "16670" },
        env: "LINE_WEBHOOK_PORT",
      },
      {
        key: "webhookPath",
        labelKey: "channel.field.line.webhookPath",
        type: "text",
        description: "Optional LINE webhook path",
        placeholder: { kind: "example", value: "/line" },
        env: "LINE_WEBHOOK_PATH",
      },
    ],
  }),
  define({
    id: "matrix",
    name: "Matrix",
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.matrix.enabled",
        type: "boolean",
        description: "Enable Matrix integration",
      },
      {
        key: "homeserver",
        labelKey: "channel.field.matrix.homeserver",
        type: "text",
        description: "Matrix homeserver URL",
        placeholder: { kind: "example", value: "https://matrix.example.com" },
        env: "MATRIX_HOMESERVER_URL",
        required: true,
      },
      {
        key: "token",
        labelKey: "channel.field.matrix.token",
        type: "secret",
        description: "Matrix access token",
        placeholder: { kind: "hint", key: "channel.placeholder.matrix.token" },
        env: "MATRIX_ACCESS_TOKEN",
        required: true,
      },
      {
        key: "since",
        labelKey: "channel.field.matrix.since",
        type: "secret",
        description: "Optional Matrix sync token",
        placeholder: { kind: "hint", key: "channel.placeholder.matrix.since" },
        env: "MATRIX_SINCE_TOKEN",
      },
    ],
  }),
  define({
    id: "mattermost",
    name: "Mattermost",
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.mattermost.enabled",
        type: "boolean",
        description: "Enable Mattermost integration",
      },
      {
        key: "url",
        labelKey: "channel.field.mattermost.url",
        type: "text",
        description: "Mattermost server URL",
        placeholder: { kind: "example", value: "https://mattermost.example.com" },
        env: "MATTERMOST_SERVER_URL",
        required: true,
      },
      {
        key: "token",
        labelKey: "channel.field.mattermost.token",
        type: "secret",
        description: "Mattermost bot token",
        placeholder: { kind: "hint", key: "channel.placeholder.mattermost.token" },
        env: "MATTERMOST_BOT_TOKEN",
        required: true,
      },
      {
        key: "webhookToken",
        labelKey: "channel.field.mattermost.webhookToken",
        type: "secret",
        description: "Mattermost outgoing webhook token used to verify inbound requests",
        placeholder: { kind: "hint", key: "channel.placeholder.mattermost.webhookToken" },
        env: "MATTERMOST_WEBHOOK_TOKEN",
        required: true,
      },
      {
        key: "webhookHost",
        labelKey: "channel.field.mattermost.webhookHost",
        type: "text",
        description: "Optional Mattermost webhook host",
        placeholder: { kind: "example", value: "0.0.0.0" },
        env: "MATTERMOST_WEBHOOK_HOST",
      },
      {
        key: "webhookPort",
        labelKey: "channel.field.mattermost.webhookPort",
        type: "text",
        description: "Optional Mattermost webhook port",
        placeholder: { kind: "example", value: "16671" },
        env: "MATTERMOST_WEBHOOK_PORT",
      },
      {
        key: "webhookPath",
        labelKey: "channel.field.mattermost.webhookPath",
        type: "text",
        description: "Optional Mattermost webhook path",
        placeholder: { kind: "example", value: "/mattermost" },
        env: "MATTERMOST_WEBHOOK_PATH",
      },
    ],
  }),
  define({
    id: "signal",
    name: "Signal",
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.signal.enabled",
        type: "boolean",
        description: "Enable Signal integration",
      },
      {
        key: "service",
        labelKey: "channel.field.signal.service",
        type: "text",
        description: "Signal service URL",
        placeholder: { kind: "example", value: "http://localhost:8080" },
        env: "SIGNAL_SERVICE_URL",
        required: true,
      },
      {
        key: "account",
        labelKey: "channel.field.signal.account",
        type: "text",
        description: "Signal sender account or number",
        placeholder: { kind: "example", value: "+1234567890" },
        env: "SIGNAL_ACCOUNT",
        required: true,
      },
    ],
  }),
  define({
    id: "wecom",
    name: "WeCom",
    docsUrl: "https://opencorvus.ai/docs/channels/wecom/",
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.wecom.enabled",
        type: "boolean",
        description: "Enable WeCom integration",
      },
      {
        key: "corpId",
        labelKey: "channel.field.wecom.corpId",
        type: "secret",
        description: "WeCom corp ID",
        placeholder: { kind: "hint", key: "channel.placeholder.wecom.corpId" },
        env: "WECOM_CORP_ID",
        required: true,
      },
      {
        key: "secret",
        labelKey: "channel.field.wecom.secret",
        type: "secret",
        description: "WeCom app secret",
        placeholder: { kind: "hint", key: "channel.placeholder.wecom.secret" },
        env: "WECOM_SECRET",
        required: true,
      },
      {
        key: "agentId",
        labelKey: "channel.field.wecom.agentId",
        type: "secret",
        description: "WeCom agent ID",
        placeholder: { kind: "example", value: "1000002" },
        env: "WECOM_AGENT_ID",
        required: true,
      },
      {
        key: "token",
        labelKey: "channel.field.wecom.token",
        type: "secret",
        description: "WeCom receive-message callback token",
        placeholder: { kind: "hint", key: "channel.placeholder.wecom.token" },
        env: "WECOM_CALLBACK_TOKEN",
        required: true,
      },
      {
        key: "encodingAesKey",
        labelKey: "channel.field.wecom.encodingAesKey",
        type: "secret",
        description: "WeCom receive-message callback EncodingAESKey",
        placeholder: { kind: "hint", key: "channel.placeholder.wecom.encodingAesKey" },
        env: "WECOM_ENCODING_AES_KEY",
        required: true,
      },
      {
        key: "webhookHost",
        labelKey: "channel.field.wecom.webhookHost",
        type: "text",
        description: "Optional WeCom webhook host",
        placeholder: { kind: "example", value: "0.0.0.0" },
        env: "WECOM_WEBHOOK_HOST",
      },
      {
        key: "webhookPort",
        labelKey: "channel.field.wecom.webhookPort",
        type: "text",
        description: "Optional WeCom webhook port",
        placeholder: { kind: "example", value: "16672" },
        env: "WECOM_WEBHOOK_PORT",
      },
      {
        key: "webhookPath",
        labelKey: "channel.field.wecom.webhookPath",
        type: "text",
        description: "Optional WeCom webhook path",
        placeholder: { kind: "example", value: "/wecom" },
        env: "WECOM_WEBHOOK_PATH",
      },
    ],
  }),
  define({
    id: "dingtalk",
    name: "DingTalk",
    docsUrl: "https://opencorvus.ai/docs/channels/dingtalk/",
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.dingtalk.enabled",
        type: "boolean",
        description: "Enable DingTalk integration",
      },
      {
        key: "appKey",
        labelKey: "channel.field.dingtalk.appKey",
        type: "secret",
        description: "DingTalk app key",
        placeholder: { kind: "hint", key: "channel.placeholder.dingtalk.appKey" },
        env: "DINGTALK_APP_KEY",
        required: true,
      },
      {
        key: "appSecret",
        labelKey: "channel.field.dingtalk.appSecret",
        type: "secret",
        description: "DingTalk app secret",
        placeholder: { kind: "hint", key: "channel.placeholder.dingtalk.appSecret" },
        env: "DINGTALK_APP_SECRET",
        required: true,
      },
      {
        key: "callbackToken",
        labelKey: "channel.field.dingtalk.callbackToken",
        type: "secret",
        description: "DingTalk callback token",
        placeholder: { kind: "hint", key: "channel.placeholder.dingtalk.callbackToken" },
        env: "DINGTALK_CALLBACK_TOKEN",
        required: true,
      },
      {
        key: "encodingAesKey",
        labelKey: "channel.field.dingtalk.encodingAesKey",
        type: "secret",
        description: "DingTalk callback EncodingAESKey",
        placeholder: { kind: "hint", key: "channel.placeholder.dingtalk.encodingAesKey" },
        env: "DINGTALK_ENCODING_AES_KEY",
        required: true,
      },
      {
        key: "defaultWebhook",
        labelKey: "channel.field.dingtalk.defaultWebhook",
        type: "secret",
        description: "Optional DingTalk default session webhook",
        placeholder: { kind: "hint", key: "channel.placeholder.dingtalk.defaultWebhook" },
        env: "DINGTALK_DEFAULT_WEBHOOK",
      },
      {
        key: "webhookHost",
        labelKey: "channel.field.dingtalk.webhookHost",
        type: "text",
        description: "Optional DingTalk webhook host",
        placeholder: { kind: "example", value: "0.0.0.0" },
        env: "DINGTALK_WEBHOOK_HOST",
      },
      {
        key: "webhookPort",
        labelKey: "channel.field.dingtalk.webhookPort",
        type: "text",
        description: "Optional DingTalk webhook port",
        placeholder: { kind: "example", value: "16673" },
        env: "DINGTALK_WEBHOOK_PORT",
      },
      {
        key: "webhookPath",
        labelKey: "channel.field.dingtalk.webhookPath",
        type: "text",
        description: "Optional DingTalk webhook path",
        placeholder: { kind: "example", value: "/dingtalk" },
        env: "DINGTALK_WEBHOOK_PATH",
      },
    ],
  }),
  define({
    id: "clickclack",
    name: "ClickClack",
    implementation: {
      kind: "planned",
      reason: "The provider requires the OpenClaw application runtime instead of a thin standalone contract.",
      source: "package",
      packageName: "@openclaw/clickclack",
      entry: ".",
      version: "2026.7.1",
      providerConfig: { allowFrom: ["*"] },
    },
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.clickclack.enabled",
        type: "boolean",
        description: "Enable ClickClack channel integration",
      },
      {
        key: "baseUrl",
        labelKey: "channel.field.clickclack.baseUrl",
        type: "text",
        description: "ClickClack server base URL",
        placeholder: { kind: "example", value: "https://chat.example.com" },
        env: "CLICKCLACK_BASE_URL",
        required: true,
      },
      {
        key: "token",
        labelKey: "channel.field.clickclack.token",
        type: "secret",
        description: "ClickClack bot token",
        placeholder: { kind: "hint", key: "channel.placeholder.clickclack.token" },
        env: "CLICKCLACK_BOT_TOKEN",
        required: true,
      },
      {
        key: "workspace",
        labelKey: "channel.field.clickclack.workspace",
        type: "text",
        description: "ClickClack workspace ID, slug, or name",
        placeholder: { kind: "example", value: "workspace" },
        env: "CLICKCLACK_WORKSPACE",
        required: true,
      },
    ],
  }),
  define({
    id: "imessage",
    name: "iMessage",
    schemaName: "IMessage",
    implementation: {
      kind: "planned",
      reason: "The provider is not published through a stable package runtime contract.",
    },
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.imessage.enabled",
        type: "boolean",
        description: "Enable iMessage integration",
      },
      {
        key: "cliPath",
        labelKey: "channel.field.imessage.cliPath",
        type: "text",
        description: "Path to the imsg command-line bridge on macOS",
        placeholder: { kind: "example", value: "/opt/homebrew/bin/imsg" },
        env: "IMESSAGE_CLI_PATH",
        required: true,
      },
      {
        key: "dbPath",
        labelKey: "channel.field.imessage.dbPath",
        type: "text",
        description: "Optional path to the Messages chat database",
        placeholder: { kind: "example", value: "~/Library/Messages/chat.db" },
        env: "IMESSAGE_DB_PATH",
      },
      {
        key: "service",
        labelKey: "channel.field.imessage.service",
        type: "text",
        description: "Optional service selection: imessage, sms, or auto",
        placeholder: { kind: "example", value: "auto" },
        env: "IMESSAGE_SERVICE",
      },
    ],
  }),
  define({
    id: "irc",
    name: "IRC",
    implementation: {
      kind: "planned",
      reason: "The provider requires the OpenClaw application runtime instead of a thin standalone contract.",
      source: "package",
      packageName: "@openclaw/irc",
      entry: "dist/index.js",
      version: "2026.7.1",
      providerConfig: { dmPolicy: "open", allowFrom: ["*"], groupPolicy: "open", groupAllowFrom: ["*"] },
    },
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.irc.enabled",
        type: "boolean",
        description: "Enable Internet Relay Chat integration",
      },
      {
        key: "host",
        labelKey: "channel.field.irc.host",
        type: "text",
        description: "IRC server hostname",
        placeholder: { kind: "example", value: "irc.libera.chat" },
        env: "IRC_HOST",
        required: true,
      },
      {
        key: "nick",
        labelKey: "channel.field.irc.nick",
        type: "text",
        description: "IRC bot nickname",
        placeholder: { kind: "example", value: "opencorvus" },
        env: "IRC_NICK",
        required: true,
      },
      {
        key: "port",
        labelKey: "channel.field.irc.port",
        type: "text",
        description: "Optional IRC server port",
        placeholder: { kind: "example", value: "6697" },
        env: "IRC_PORT",
        transform: "integer",
      },
      {
        key: "tls",
        labelKey: "channel.field.irc.tls",
        type: "boolean",
        description: "Use Transport Layer Security for IRC",
        env: "IRC_TLS",
      },
      {
        key: "password",
        labelKey: "channel.field.irc.password",
        type: "secret",
        description: "Optional IRC server password",
        env: "IRC_PASSWORD",
      },
      {
        key: "channels",
        labelKey: "channel.field.irc.channels",
        type: "text",
        description: "Comma-separated IRC channels to join",
        placeholder: { kind: "example", value: "#general,#bots" },
        env: "IRC_CHANNELS",
        transform: "string-list",
      },
    ],
  }),
  define({
    id: "nextcloud-talk",
    name: "Nextcloud Talk",
    implementation: {
      kind: "planned",
      reason: "The provider requires the OpenClaw application runtime instead of a thin standalone contract.",
      source: "package",
      packageName: "@openclaw/nextcloud-talk",
      entry: "dist/index.js",
      version: "2026.7.1",
      providerConfig: { dmPolicy: "open", allowFrom: ["*"], groupPolicy: "open", groupAllowFrom: ["*"] },
    },
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.nextcloud-talk.enabled",
        type: "boolean",
        description: "Enable Nextcloud Talk integration",
      },
      {
        key: "baseUrl",
        labelKey: "channel.field.nextcloud-talk.baseUrl",
        type: "text",
        description: "Nextcloud server base URL",
        placeholder: { kind: "example", value: "https://cloud.example.com" },
        env: "NEXTCLOUD_TALK_BASE_URL",
        required: true,
      },
      {
        key: "botSecret",
        labelKey: "channel.field.nextcloud-talk.botSecret",
        type: "secret",
        description: "Nextcloud Talk webhook bot secret",
        env: "NEXTCLOUD_TALK_BOT_SECRET",
        required: true,
      },
      {
        key: "webhookHost",
        labelKey: "channel.field.nextcloud-talk.webhookHost",
        type: "text",
        description: "Optional webhook bind host",
        placeholder: { kind: "example", value: "0.0.0.0" },
        env: "NEXTCLOUD_TALK_WEBHOOK_HOST",
      },
      {
        key: "webhookPort",
        labelKey: "channel.field.nextcloud-talk.webhookPort",
        type: "text",
        description: "Optional webhook bind port",
        placeholder: { kind: "example", value: "8788" },
        env: "NEXTCLOUD_TALK_WEBHOOK_PORT",
        transform: "integer",
      },
      {
        key: "webhookPath",
        labelKey: "channel.field.nextcloud-talk.webhookPath",
        type: "text",
        description: "Optional webhook path",
        placeholder: { kind: "example", value: "/nextcloud-talk" },
        env: "NEXTCLOUD_TALK_WEBHOOK_PATH",
      },
      {
        key: "webhookPublicUrl",
        labelKey: "channel.field.nextcloud-talk.webhookPublicUrl",
        type: "text",
        description: "Optional externally reachable webhook URL",
        placeholder: { kind: "example", value: "https://bot.example.com/nextcloud-talk" },
        env: "NEXTCLOUD_TALK_PUBLIC_WEBHOOK_URL",
      },
    ],
  }),
  define({
    id: "nostr",
    name: "Nostr",
    implementation: {
      kind: "planned",
      reason: "The provider requires the OpenClaw application runtime instead of a thin standalone contract.",
      source: "package",
      packageName: "@openclaw/nostr",
      entry: "dist/index.js",
      version: "2026.7.1",
      providerConfig: { dmPolicy: "open", allowFrom: ["*"] },
    },
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.nostr.enabled",
        type: "boolean",
        description: "Enable Nostr direct messages",
      },
      {
        key: "privateKey",
        labelKey: "channel.field.nostr.privateKey",
        type: "secret",
        description: "Nostr private key",
        placeholder: { kind: "example", value: "nsec1..." },
        env: "NOSTR_PRIVATE_KEY",
        required: true,
      },
      {
        key: "relays",
        labelKey: "channel.field.nostr.relays",
        type: "text",
        description: "Comma-separated Nostr relay URLs",
        placeholder: { kind: "example", value: "wss://relay.example.com" },
        env: "NOSTR_RELAYS",
        transform: "string-list",
      },
    ],
  }),
  define({
    id: "qqbot",
    name: "QQ Bot",
    implementation: {
      kind: "planned",
      reason: "The provider requires the OpenClaw application runtime instead of a thin standalone contract.",
      source: "package",
      packageName: "@openclaw/qqbot",
      entry: "dist/index.js",
      version: "2026.7.1",
      providerConfig: { dmPolicy: "open", allowFrom: ["*"], groupPolicy: "open", groupAllowFrom: ["*"] },
    },
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.qqbot.enabled",
        type: "boolean",
        description: "Enable the official QQ Bot API integration",
      },
      {
        key: "appId",
        labelKey: "channel.field.qqbot.appId",
        type: "secret",
        description: "QQ Bot application ID",
        placeholder: { kind: "hint", key: "channel.placeholder.qqbot.appId" },
        env: "QQBOT_APP_ID",
        required: true,
      },
      {
        key: "clientSecret",
        labelKey: "channel.field.qqbot.clientSecret",
        type: "secret",
        description: "QQ Bot client secret",
        placeholder: { kind: "hint", key: "channel.placeholder.qqbot.clientSecret" },
        env: "QQBOT_CLIENT_SECRET",
        required: true,
      },
    ],
  }),
  define({
    id: "raft",
    name: "Raft",
    implementation: {
      kind: "planned",
      reason: "The provider requires the OpenClaw application runtime instead of a thin standalone contract.",
      source: "package",
      packageName: "@openclaw/raft",
      entry: "dist/index.js",
      version: "2026.7.1",
    },
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.raft.enabled",
        type: "boolean",
        description: "Enable the Raft command-line wake bridge",
      },
      {
        key: "profile",
        labelKey: "channel.field.raft.profile",
        type: "text",
        description: "Raft CLI profile",
        placeholder: { kind: "example", value: "default" },
        env: "RAFT_PROFILE",
        required: true,
      },
    ],
  }),
  define({
    id: "reef",
    name: "Reef",
    implementation: {
      kind: "planned",
      reason: "The provider is not published through a stable package runtime contract.",
    },
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.reef.enabled",
        type: "boolean",
        description: "Enable guarded end-to-end encrypted Reef messaging",
      },
      {
        key: "handle",
        labelKey: "channel.field.reef.handle",
        type: "text",
        description: "Reef handle",
        placeholder: { kind: "example", value: "opencorvus" },
        env: "REEF_HANDLE",
        required: true,
      },
      {
        key: "email",
        labelKey: "channel.field.reef.email",
        type: "text",
        description: "Reef registration email",
        placeholder: { kind: "example", value: "owner@example.com" },
        env: "REEF_EMAIL",
        required: true,
      },
      {
        key: "relayUrl",
        labelKey: "channel.field.reef.relayUrl",
        type: "text",
        description: "Reef relay origin",
        placeholder: { kind: "example", value: "https://reefwire.ai" },
        env: "REEF_RELAY_URL",
      },
      {
        key: "guardProvider",
        labelKey: "channel.field.reef.guardProvider",
        type: "text",
        description: "Guard model provider: anthropic or openai",
        placeholder: { kind: "example", value: "openai" },
        env: "REEF_GUARD_PROVIDER",
        required: true,
        configPath: ["guard", "provider"],
      },
      {
        key: "guardPinnedModel",
        labelKey: "channel.field.reef.guardPinnedModel",
        type: "text",
        description: "Pinned guard model identifier",
        placeholder: { kind: "example", value: "gpt-5-mini" },
        env: "REEF_GUARD_PINNED_MODEL",
        required: true,
        configPath: ["guard", "pinnedModel"],
      },
      {
        key: "guardApiKeyEnv",
        labelKey: "channel.field.reef.guardApiKeyEnv",
        type: "text",
        description: "Environment variable containing the guard provider API key",
        placeholder: { kind: "example", value: "OPENAI_API_KEY" },
        env: "REEF_GUARD_API_KEY_ENV",
        required: true,
        configPath: ["guard", "apiKeyEnv"],
      },
      {
        key: "guardPolicyVersion",
        labelKey: "channel.field.reef.guardPolicyVersion",
        type: "text",
        description: "Pinned Reef guard policy version",
        placeholder: { kind: "example", value: "v1" },
        env: "REEF_GUARD_POLICY_VERSION",
        required: true,
        configPath: ["guard", "policyVersion"],
      },
      {
        key: "guardTimeoutMs",
        labelKey: "channel.field.reef.guardTimeoutMs",
        type: "text",
        description: "Guard request timeout in milliseconds",
        placeholder: { kind: "example", value: "30000" },
        env: "REEF_GUARD_TIMEOUT_MS",
        required: true,
        transform: "integer",
        configPath: ["guard", "timeoutMs"],
      },
      {
        key: "requestPolicy",
        labelKey: "channel.field.reef.requestPolicy",
        type: "text",
        description: "Reef friend request policy: code-only, friends-of-friends, or open",
        placeholder: { kind: "example", value: "code-only" },
        env: "REEF_REQUEST_POLICY",
      },
    ],
  }),
  define({
    id: "sms",
    name: "SMS",
    implementation: {
      kind: "planned",
      reason: "The provider requires the OpenClaw application runtime instead of a thin standalone contract.",
      source: "package",
      packageName: "@openclaw/sms",
      entry: "dist/index.js",
      version: "2026.7.1",
      providerConfig: { dmPolicy: "open", allowFrom: ["*"] },
    },
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.sms.enabled",
        type: "boolean",
        description: "Enable Twilio Short Message Service integration",
      },
      {
        key: "accountSid",
        labelKey: "channel.field.sms.accountSid",
        type: "secret",
        description: "Twilio account identifier",
        placeholder: { kind: "example", value: "AC..." },
        env: "TWILIO_ACCOUNT_SID",
        required: true,
      },
      {
        key: "authToken",
        labelKey: "channel.field.sms.authToken",
        type: "secret",
        description: "Twilio authentication token",
        env: "TWILIO_AUTH_TOKEN",
        required: true,
      },
      {
        key: "fromNumber",
        labelKey: "channel.field.sms.fromNumber",
        type: "text",
        description: "Twilio sender number in E.164 format",
        placeholder: { kind: "example", value: "+15551234567" },
        env: "TWILIO_PHONE_NUMBER",
        required: true,
      },
      {
        key: "defaultTo",
        labelKey: "channel.field.sms.defaultTo",
        type: "text",
        description: "Optional default recipient number",
        placeholder: { kind: "example", value: "+15557654321" },
        env: "SMS_DEFAULT_TO",
      },
      {
        key: "publicWebhookUrl",
        labelKey: "channel.field.sms.publicWebhookUrl",
        type: "text",
        description: "Externally reachable Twilio webhook URL",
        placeholder: { kind: "example", value: "https://bot.example.com/sms" },
        env: "SMS_PUBLIC_WEBHOOK_URL",
      },
      {
        key: "webhookPath",
        labelKey: "channel.field.sms.webhookPath",
        type: "text",
        description: "Optional local webhook path",
        placeholder: { kind: "example", value: "/sms" },
        env: "SMS_WEBHOOK_PATH",
      },
    ],
  }),
  define({
    id: "synology-chat",
    name: "Synology Chat",
    implementation: {
      kind: "planned",
      reason: "The provider requires the OpenClaw application runtime instead of a thin standalone contract.",
      source: "package",
      packageName: "@openclaw/synology-chat",
      entry: "dist/index.js",
      version: "2026.7.1",
      providerConfig: { dmPolicy: "open", allowedUserIds: ["*"] },
    },
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.synology-chat.enabled",
        type: "boolean",
        description: "Enable Synology Chat webhooks",
      },
      {
        key: "token",
        labelKey: "channel.field.synology-chat.token",
        type: "secret",
        description: "Synology Chat outgoing webhook token",
        env: "SYNOLOGY_CHAT_TOKEN",
        required: true,
      },
      {
        key: "incomingUrl",
        labelKey: "channel.field.synology-chat.incomingUrl",
        type: "secret",
        description: "Synology Chat incoming webhook URL",
        placeholder: { kind: "example", value: "https://nas.example.com/webapi/entry.cgi?..." },
        env: "SYNOLOGY_CHAT_INCOMING_URL",
        required: true,
      },
      {
        key: "nasHost",
        labelKey: "channel.field.synology-chat.nasHost",
        type: "text",
        description: "Optional Synology Network Attached Storage host",
        placeholder: { kind: "example", value: "nas.example.com" },
        env: "SYNOLOGY_NAS_HOST",
      },
    ],
  }),
  define({
    id: "tlon",
    name: "Tlon",
    implementation: {
      kind: "planned",
      reason: "The provider requires the OpenClaw application runtime instead of a thin standalone contract.",
      source: "package",
      packageName: "@openclaw/tlon",
      entry: "dist/index.js",
      version: "2026.7.1",
    },
    fields: [
      { key: "enabled", labelKey: "channel.field.tlon.enabled", type: "boolean", description: "Enable Tlon on Urbit" },
      {
        key: "ship",
        labelKey: "channel.field.tlon.ship",
        type: "text",
        description: "Urbit ship name",
        placeholder: { kind: "example", value: "~sampel-palnet" },
        env: "TLON_SHIP",
        required: true,
      },
      {
        key: "url",
        labelKey: "channel.field.tlon.url",
        type: "text",
        description: "Urbit ship URL",
        placeholder: { kind: "example", value: "http://localhost:8080" },
        env: "TLON_URL",
        required: true,
      },
      {
        key: "code",
        labelKey: "channel.field.tlon.code",
        type: "secret",
        description: "Urbit ship login code",
        env: "TLON_CODE",
        required: true,
      },
      {
        key: "groupChannels",
        labelKey: "channel.field.tlon.groupChannels",
        type: "text",
        description: "Comma-separated channel nests",
        env: "TLON_GROUP_CHANNELS",
        transform: "string-list",
      },
      {
        key: "dmAllowlist",
        labelKey: "channel.field.tlon.dmAllowlist",
        type: "text",
        description: "Comma-separated Urbit ships allowed to send direct messages",
        env: "TLON_DM_ALLOWLIST",
        transform: "string-list",
      },
      {
        key: "defaultAuthorizedShips",
        labelKey: "channel.field.tlon.defaultAuthorizedShips",
        type: "text",
        description: "Comma-separated Urbit ships authorized in joined group channels",
        env: "TLON_DEFAULT_AUTHORIZED_SHIPS",
        transform: "string-list",
      },
    ],
  }),
  define({
    id: "twitch",
    name: "Twitch",
    implementation: {
      kind: "planned",
      reason: "The provider requires the OpenClaw application runtime instead of a thin standalone contract.",
      source: "package",
      packageName: "@openclaw/twitch",
      entry: "dist/index.js",
      version: "2026.7.1",
      providerConfig: { allowFrom: ["*"] },
    },
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.twitch.enabled",
        type: "boolean",
        description: "Enable Twitch chat integration",
      },
      {
        key: "username",
        labelKey: "channel.field.twitch.username",
        type: "text",
        description: "Twitch bot username",
        placeholder: { kind: "example", value: "opencorvus" },
        env: "TWITCH_USERNAME",
        required: true,
      },
      {
        key: "accessToken",
        labelKey: "channel.field.twitch.accessToken",
        type: "secret",
        description: "Twitch OAuth token with chat read and write scopes",
        placeholder: { kind: "example", value: "oauth:..." },
        env: "OPENCLAW_TWITCH_ACCESS_TOKEN",
        required: true,
      },
      {
        key: "clientId",
        labelKey: "channel.field.twitch.clientId",
        type: "secret",
        description: "Twitch application client ID",
        env: "TWITCH_CLIENT_ID",
        required: true,
      },
      {
        key: "channel",
        labelKey: "channel.field.twitch.channel",
        type: "text",
        description: "Twitch channel name to join",
        placeholder: { kind: "example", value: "channel-name" },
        env: "TWITCH_CHANNEL",
        required: true,
      },
      {
        key: "allowFrom",
        labelKey: "channel.field.twitch.allowFrom",
        type: "text",
        description: "Comma-separated Twitch user IDs",
        env: "TWITCH_ALLOW_FROM",
        transform: "string-list",
      },
      {
        key: "requireMention",
        labelKey: "channel.field.twitch.requireMention",
        type: "boolean",
        description: "Require messages to mention the Twitch bot",
        env: "TWITCH_REQUIRE_MENTION",
      },
    ],
  }),
  define({
    id: "zalo",
    name: "Zalo",
    implementation: {
      kind: "planned",
      reason: "The provider requires the OpenClaw application runtime instead of a thin standalone contract.",
      source: "package",
      packageName: "@openclaw/zalo",
      entry: "dist/index.js",
      version: "2026.7.1",
      providerConfig: { dmPolicy: "open", allowFrom: ["*"], groupPolicy: "open", groupAllowFrom: ["*"] },
    },
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.zalo.enabled",
        type: "boolean",
        description: "Enable the Zalo Bot API integration",
      },
      {
        key: "botToken",
        labelKey: "channel.field.zalo.botToken",
        type: "secret",
        description: "Zalo bot token",
        env: "ZALO_BOT_TOKEN",
        required: true,
      },
      {
        key: "webhookSecret",
        labelKey: "channel.field.zalo.webhookSecret",
        type: "secret",
        description: "Optional Zalo webhook signature secret",
        env: "ZALO_WEBHOOK_SECRET",
      },
      {
        key: "webhookUrl",
        labelKey: "channel.field.zalo.webhookUrl",
        type: "text",
        description: "Optional public webhook URL",
        placeholder: { kind: "example", value: "https://bot.example.com/zalo" },
        env: "ZALO_WEBHOOK_URL",
      },
    ],
  }),
  define({
    id: "zalouser",
    name: "Zalo Personal",
    implementation: {
      kind: "planned",
      reason: "The provider requires the OpenClaw application runtime instead of a thin standalone contract.",
      source: "package",
      packageName: "@openclaw/zalouser",
      entry: "dist/index.js",
      version: "2026.7.1",
      providerConfig: { dmPolicy: "open", allowFrom: ["*"], groupPolicy: "open", groupAllowFrom: ["*"] },
    },
    fields: [
      {
        key: "enabled",
        labelKey: "channel.field.zalouser.enabled",
        type: "boolean",
        description: "Enable a Zalo personal account through the official OpenClaw plugin",
      },
      {
        key: "profile",
        labelKey: "channel.field.zalouser.profile",
        type: "text",
        description: "Zalo Personal profile name",
        placeholder: { kind: "example", value: "default" },
        env: "ZALOUSER_PROFILE",
        required: true,
      },
    ],
  }),
] as const

export function channelInfo(id: ChannelName) {
  const result = ChannelCatalog.find((item) => item.id === id)
  if (!result) throw new Error(`Unknown channel: ${id}`)
  return result
}

export function channelRequiredFields(id: ChannelName) {
  return channelInfo(id).fields.filter((field) => field.required && field.env)
}

export function buildChannelSchema(id: ChannelName, ref: string) {
  const shape = Object.fromEntries(
    channelInfo(id).fields.map((field) => [
      field.key,
      field.type === "boolean"
        ? z.boolean().optional().describe(field.description)
        : z.string().optional().describe(field.description),
    ]),
  ) as Record<string, z.ZodTypeAny>
  return z.object(shape).strict().meta({ ref })
}

function text(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return undefined
}

export function resolveChannel(
  id: ChannelName,
  raw: Record<string, unknown> | undefined,
  env: Record<string, string | undefined> = process.env,
) {
  const info = channelInfo(id)
  const values = info.fields.reduce<Record<string, string | undefined>>((acc, field) => {
    if (!field.env) return acc
    const configured = raw?.[field.key]
    acc[field.key] =
      field.type === "boolean" && typeof configured === "boolean"
        ? String(configured)
        : text(configured, env[field.env])
    return acc
  }, {})
  return {
    enabled: raw?.enabled !== false,
    values,
  }
}

export function channelState(
  id: ChannelName,
  raw: Record<string, unknown> | undefined,
  env: Record<string, string | undefined> = process.env,
) {
  const info = channelInfo(id)
  const resolved = resolveChannel(id, raw, env)
  const required = info.fields.filter((field) => field.required).map((field) => resolved.values[field.key])
  const configured = required.length > 0 && required.every(Boolean)
  const partial = Object.values(resolved.values).some(Boolean)
  const status = !resolved.enabled ? "disabled" : configured ? "configured" : partial ? "partial" : "missing"
  return {
    ...resolved,
    status,
  }
}

export function channelEnv(
  id: ChannelName,
  raw: Record<string, unknown> | undefined,
  env: Record<string, string | undefined> = process.env,
) {
  const info = channelInfo(id)
  const resolved = channelState(id, raw, env)
  if (!resolved.enabled || resolved.status !== "configured") return
  return info.fields.reduce<Record<string, string>>((acc, field) => {
    if (!field.env) return acc
    const value = resolved.values[field.key]
    if (!value) return acc
    acc[field.env] = value
    return acc
  }, {})
}

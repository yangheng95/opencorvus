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
export type ChannelField = {
  key: string
  label: string
  type: z.infer<typeof ChannelFieldType>
  description: string
  placeholder?: string
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
  summaries: {
    configured: string
    partial: string
  }
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
    summaries: {
      configured: "Managed runtime ready",
      partial: "Partially configured",
    },
    fields: [
      {
        key: "enabled",
        label: "Enable Slack",
        type: "boolean",
        description: "Enable Slack channel integration",
      },
      {
        key: "botToken",
        label: "Slack Bot Token",
        type: "secret",
        description: "Slack bot token",
        placeholder: "xoxb-...",
        env: "SLACK_BOT_TOKEN",
        required: true,
      },
      {
        key: "appToken",
        label: "Slack App Token",
        type: "secret",
        description: "Slack app token for Socket Mode",
        placeholder: "xapp-...",
        env: "SLACK_APP_TOKEN",
        required: true,
      },
      {
        key: "signingSecret",
        label: "Signing Secret",
        type: "secret",
        description: "Slack signing secret",
        placeholder: "Optional",
        env: "SLACK_SIGNING_SECRET",
      },
    ],
  }),
  define({
    id: "telegram",
    name: "Telegram",
    summaries: {
      configured: "Managed runtime ready",
      partial: "Partially configured",
    },
    fields: [
      {
        key: "enabled",
        label: "Enable Telegram",
        type: "boolean",
        description: "Enable Telegram channel integration",
      },
      {
        key: "token",
        label: "Telegram Bot Token",
        type: "secret",
        description: "Telegram bot token",
        placeholder: "123456:ABC...",
        env: "TELEGRAM_BOT_TOKEN",
        required: true,
      },
    ],
  }),
  define({
    id: "discord",
    name: "Discord",
    summaries: {
      configured: "Managed runtime ready",
      partial: "Partially configured",
    },
    fields: [
      {
        key: "enabled",
        label: "Enable Discord",
        type: "boolean",
        description: "Enable Discord channel integration",
      },
      {
        key: "token",
        label: "Discord Bot Token",
        type: "secret",
        description: "Discord bot token",
        placeholder: "Discord token",
        env: "DISCORD_BOT_TOKEN",
        required: true,
      },
    ],
  }),
  define({
    id: "feishu",
    name: "Feishu / Lark",
    schemaName: "Feishu",
    summaries: {
      configured: "Managed runtime ready",
      partial: "Partially configured",
    },
    fields: [
      {
        key: "enabled",
        label: "Enable Feishu / Lark",
        type: "boolean",
        description: "Enable Feishu or Lark channel integration",
      },
      {
        key: "appId",
        label: "App ID",
        type: "secret",
        description: "Feishu or Lark app ID",
        placeholder: "cli_...",
        env: "FEISHU_APP_ID",
        required: true,
      },
      {
        key: "appSecret",
        label: "App Secret",
        type: "secret",
        description: "Feishu or Lark app secret",
        placeholder: "App secret",
        env: "FEISHU_APP_SECRET",
        required: true,
      },
      {
        key: "verificationToken",
        label: "Verification Token",
        type: "secret",
        description: "Optional Feishu or Lark webhook verification token",
        placeholder: "Optional",
        env: "FEISHU_VERIFICATION_TOKEN",
      },
      {
        key: "webhookHost",
        label: "Webhook Host",
        type: "text",
        description: "Optional Feishu or Lark webhook host",
        placeholder: "0.0.0.0",
        env: "FEISHU_WEBHOOK_HOST",
      },
      {
        key: "webhookPort",
        label: "Webhook Port",
        type: "text",
        description: "Optional Feishu or Lark webhook port",
        placeholder: "16666",
        env: "FEISHU_WEBHOOK_PORT",
      },
      {
        key: "webhookPath",
        label: "Webhook Path",
        type: "text",
        description: "Optional Feishu or Lark webhook path",
        placeholder: "/feishu",
        env: "FEISHU_WEBHOOK_PATH",
      },
    ],
  }),
  define({
    id: "whatsapp",
    name: "WhatsApp",
    schemaName: "Whatsapp",
    summaries: {
      configured: "Managed runtime ready",
      partial: "Partially configured",
    },
    fields: [
      {
        key: "enabled",
        label: "Enable WhatsApp",
        type: "boolean",
        description: "Enable WhatsApp channel integration",
      },
      {
        key: "token",
        label: "Access Token",
        type: "secret",
        description: "WhatsApp Cloud API access token",
        placeholder: "EAAG...",
        env: "WHATSAPP_ACCESS_TOKEN",
        required: true,
      },
      {
        key: "numberId",
        label: "Phone Number ID",
        type: "secret",
        description: "WhatsApp Cloud API phone number ID",
        placeholder: "Phone number ID",
        env: "WHATSAPP_PHONE_NUMBER_ID",
        required: true,
      },
      {
        key: "appSecret",
        label: "App Secret",
        type: "secret",
        description: "WhatsApp Meta app secret used to verify webhook signatures",
        placeholder: "App secret",
        env: "WHATSAPP_APP_SECRET",
        required: true,
      },
      {
        key: "verifyToken",
        label: "Verify Token",
        type: "secret",
        description: "WhatsApp webhook verification token",
        placeholder: "Verify token",
        env: "WHATSAPP_VERIFY_TOKEN",
        required: true,
      },
      {
        key: "webhookHost",
        label: "Webhook Host",
        type: "text",
        description: "Optional WhatsApp webhook host",
        placeholder: "0.0.0.0",
        env: "WHATSAPP_WEBHOOK_HOST",
      },
      {
        key: "webhookPort",
        label: "Webhook Port",
        type: "text",
        description: "Optional WhatsApp webhook port",
        placeholder: "16667",
        env: "WHATSAPP_WEBHOOK_PORT",
      },
      {
        key: "webhookPath",
        label: "Webhook Path",
        type: "text",
        description: "Optional WhatsApp webhook path",
        placeholder: "/whatsapp",
        env: "WHATSAPP_WEBHOOK_PATH",
      },
    ],
  }),
  define({
    id: "googlechat",
    name: "Google Chat",
    summaries: {
      configured: "Managed runtime ready",
      partial: "Partially configured",
    },
    fields: [
      {
        key: "enabled",
        label: "Enable Google Chat",
        type: "boolean",
        description: "Enable Google Chat integration",
      },
      {
        key: "serviceAccount",
        label: "Service Account JSON",
        type: "secret",
        description: "Google Chat service account JSON or path",
        placeholder: "JSON or file path",
        env: "GOOGLECHAT_SERVICE_ACCOUNT_JSON",
        required: true,
      },
      {
        key: "authAudience",
        label: "Auth Audience",
        type: "secret",
        description: "Google Chat request token audience, usually the HTTPS endpoint URL",
        placeholder: "https://example.com/googlechat",
        env: "GOOGLECHAT_AUTH_AUDIENCE",
        required: true,
      },
      {
        key: "webhookHost",
        label: "Webhook Host",
        type: "text",
        description: "Optional Google Chat webhook host",
        placeholder: "0.0.0.0",
        env: "GOOGLECHAT_WEBHOOK_HOST",
      },
      {
        key: "webhookPort",
        label: "Webhook Port",
        type: "text",
        description: "Optional Google Chat webhook port",
        placeholder: "16668",
        env: "GOOGLECHAT_WEBHOOK_PORT",
      },
      {
        key: "webhookPath",
        label: "Webhook Path",
        type: "text",
        description: "Optional Google Chat webhook path",
        placeholder: "/googlechat",
        env: "GOOGLECHAT_WEBHOOK_PATH",
      },
    ],
  }),
  define({
    id: "msteams",
    name: "Microsoft Teams",
    schemaName: "MSTeams",
    summaries: {
      configured: "Managed runtime ready",
      partial: "Partially configured",
    },
    fields: [
      {
        key: "enabled",
        label: "Enable Microsoft Teams",
        type: "boolean",
        description: "Enable Microsoft Teams integration",
      },
      {
        key: "appId",
        label: "App ID",
        type: "secret",
        description: "Microsoft Teams bot app ID",
        placeholder: "Application ID",
        env: "MSTEAMS_APP_ID",
        required: true,
      },
      {
        key: "appSecret",
        label: "App Secret",
        type: "secret",
        description: "Microsoft Teams bot app secret",
        placeholder: "App secret",
        env: "MSTEAMS_APP_SECRET",
        required: true,
      },
      {
        key: "webhookHost",
        label: "Webhook Host",
        type: "text",
        description: "Optional Microsoft Teams webhook host",
        placeholder: "0.0.0.0",
        env: "MSTEAMS_WEBHOOK_HOST",
      },
      {
        key: "webhookPort",
        label: "Webhook Port",
        type: "text",
        description: "Optional Microsoft Teams webhook port",
        placeholder: "16669",
        env: "MSTEAMS_WEBHOOK_PORT",
      },
      {
        key: "webhookPath",
        label: "Webhook Path",
        type: "text",
        description: "Optional Microsoft Teams webhook path",
        placeholder: "/msteams",
        env: "MSTEAMS_WEBHOOK_PATH",
      },
    ],
  }),
  define({
    id: "line",
    name: "LINE",
    schemaName: "Line",
    summaries: {
      configured: "Managed runtime ready",
      partial: "Partially configured",
    },
    fields: [
      {
        key: "enabled",
        label: "Enable LINE",
        type: "boolean",
        description: "Enable LINE integration",
      },
      {
        key: "token",
        label: "Channel Access Token",
        type: "secret",
        description: "LINE channel access token",
        placeholder: "Channel access token",
        env: "LINE_CHANNEL_ACCESS_TOKEN",
        required: true,
      },
      {
        key: "secret",
        label: "Channel Secret",
        type: "secret",
        description: "LINE channel secret for webhook verification",
        placeholder: "Channel secret",
        env: "LINE_CHANNEL_SECRET",
        required: true,
      },
      {
        key: "webhookHost",
        label: "Webhook Host",
        type: "text",
        description: "Optional LINE webhook host",
        placeholder: "0.0.0.0",
        env: "LINE_WEBHOOK_HOST",
      },
      {
        key: "webhookPort",
        label: "Webhook Port",
        type: "text",
        description: "Optional LINE webhook port",
        placeholder: "16670",
        env: "LINE_WEBHOOK_PORT",
      },
      {
        key: "webhookPath",
        label: "Webhook Path",
        type: "text",
        description: "Optional LINE webhook path",
        placeholder: "/line",
        env: "LINE_WEBHOOK_PATH",
      },
    ],
  }),
  define({
    id: "matrix",
    name: "Matrix",
    summaries: {
      configured: "Managed runtime ready",
      partial: "Partially configured",
    },
    fields: [
      {
        key: "enabled",
        label: "Enable Matrix",
        type: "boolean",
        description: "Enable Matrix integration",
      },
      {
        key: "homeserver",
        label: "Homeserver URL",
        type: "text",
        description: "Matrix homeserver URL",
        placeholder: "https://matrix.example.com",
        env: "MATRIX_HOMESERVER_URL",
        required: true,
      },
      {
        key: "token",
        label: "Access Token",
        type: "secret",
        description: "Matrix access token",
        placeholder: "Matrix token",
        env: "MATRIX_ACCESS_TOKEN",
        required: true,
      },
      {
        key: "since",
        label: "Since Token",
        type: "secret",
        description: "Optional Matrix sync token",
        placeholder: "Optional",
        env: "MATRIX_SINCE_TOKEN",
      },
    ],
  }),
  define({
    id: "mattermost",
    name: "Mattermost",
    summaries: {
      configured: "Managed runtime ready",
      partial: "Partially configured",
    },
    fields: [
      {
        key: "enabled",
        label: "Enable Mattermost",
        type: "boolean",
        description: "Enable Mattermost integration",
      },
      {
        key: "url",
        label: "Server URL",
        type: "text",
        description: "Mattermost server URL",
        placeholder: "https://mattermost.example.com",
        env: "MATTERMOST_SERVER_URL",
        required: true,
      },
      {
        key: "token",
        label: "Bot Token",
        type: "secret",
        description: "Mattermost bot token",
        placeholder: "Mattermost token",
        env: "MATTERMOST_BOT_TOKEN",
        required: true,
      },
      {
        key: "webhookToken",
        label: "Webhook Token",
        type: "secret",
        description: "Mattermost outgoing webhook token used to verify inbound requests",
        placeholder: "Outgoing webhook token",
        env: "MATTERMOST_WEBHOOK_TOKEN",
        required: true,
      },
      {
        key: "webhookHost",
        label: "Webhook Host",
        type: "text",
        description: "Optional Mattermost webhook host",
        placeholder: "0.0.0.0",
        env: "MATTERMOST_WEBHOOK_HOST",
      },
      {
        key: "webhookPort",
        label: "Webhook Port",
        type: "text",
        description: "Optional Mattermost webhook port",
        placeholder: "16671",
        env: "MATTERMOST_WEBHOOK_PORT",
      },
      {
        key: "webhookPath",
        label: "Webhook Path",
        type: "text",
        description: "Optional Mattermost webhook path",
        placeholder: "/mattermost",
        env: "MATTERMOST_WEBHOOK_PATH",
      },
    ],
  }),
  define({
    id: "signal",
    name: "Signal",
    summaries: {
      configured: "Managed runtime ready",
      partial: "Partially configured",
    },
    fields: [
      {
        key: "enabled",
        label: "Enable Signal",
        type: "boolean",
        description: "Enable Signal integration",
      },
      {
        key: "service",
        label: "Service URL",
        type: "text",
        description: "Signal service URL",
        placeholder: "http://localhost:8080",
        env: "SIGNAL_SERVICE_URL",
        required: true,
      },
      {
        key: "account",
        label: "Account",
        type: "text",
        description: "Signal sender account or number",
        placeholder: "+1234567890",
        env: "SIGNAL_ACCOUNT",
        required: true,
      },
    ],
  }),
  define({
    id: "wecom",
    name: "WeCom",
    docsUrl: "https://opencorvus.ai/docs/channels/wecom/",
    summaries: {
      configured: "Managed runtime ready",
      partial: "Partially configured",
    },
    fields: [
      {
        key: "enabled",
        label: "Enable WeCom",
        type: "boolean",
        description: "Enable WeCom integration",
      },
      {
        key: "corpId",
        label: "Corp ID",
        type: "secret",
        description: "WeCom corp ID",
        placeholder: "Corp ID",
        env: "WECOM_CORP_ID",
        required: true,
      },
      {
        key: "secret",
        label: "Secret",
        type: "secret",
        description: "WeCom app secret",
        placeholder: "App secret",
        env: "WECOM_SECRET",
        required: true,
      },
      {
        key: "agentId",
        label: "Agent ID",
        type: "secret",
        description: "WeCom agent ID",
        placeholder: "1000002",
        env: "WECOM_AGENT_ID",
        required: true,
      },
      {
        key: "token",
        label: "Callback Token",
        type: "secret",
        description: "WeCom receive-message callback token",
        placeholder: "Callback token",
        env: "WECOM_CALLBACK_TOKEN",
        required: true,
      },
      {
        key: "encodingAesKey",
        label: "EncodingAESKey",
        type: "secret",
        description: "WeCom receive-message callback EncodingAESKey",
        placeholder: "43-character EncodingAESKey",
        env: "WECOM_ENCODING_AES_KEY",
        required: true,
      },
      {
        key: "webhookHost",
        label: "Webhook Host",
        type: "text",
        description: "Optional WeCom webhook host",
        placeholder: "0.0.0.0",
        env: "WECOM_WEBHOOK_HOST",
      },
      {
        key: "webhookPort",
        label: "Webhook Port",
        type: "text",
        description: "Optional WeCom webhook port",
        placeholder: "16672",
        env: "WECOM_WEBHOOK_PORT",
      },
      {
        key: "webhookPath",
        label: "Webhook Path",
        type: "text",
        description: "Optional WeCom webhook path",
        placeholder: "/wecom",
        env: "WECOM_WEBHOOK_PATH",
      },
    ],
  }),
  define({
    id: "dingtalk",
    name: "DingTalk",
    docsUrl: "https://opencorvus.ai/docs/channels/dingtalk/",
    summaries: {
      configured: "Managed runtime ready",
      partial: "Partially configured",
    },
    fields: [
      {
        key: "enabled",
        label: "Enable DingTalk",
        type: "boolean",
        description: "Enable DingTalk integration",
      },
      {
        key: "appKey",
        label: "App Key",
        type: "secret",
        description: "DingTalk app key",
        placeholder: "App key",
        env: "DINGTALK_APP_KEY",
        required: true,
      },
      {
        key: "appSecret",
        label: "App Secret",
        type: "secret",
        description: "DingTalk app secret",
        placeholder: "App secret",
        env: "DINGTALK_APP_SECRET",
        required: true,
      },
      {
        key: "callbackToken",
        label: "Callback Token",
        type: "secret",
        description: "DingTalk callback token",
        placeholder: "Callback token",
        env: "DINGTALK_CALLBACK_TOKEN",
        required: true,
      },
      {
        key: "encodingAesKey",
        label: "EncodingAESKey",
        type: "secret",
        description: "DingTalk callback EncodingAESKey",
        placeholder: "43-character EncodingAESKey",
        env: "DINGTALK_ENCODING_AES_KEY",
        required: true,
      },
      {
        key: "defaultWebhook",
        label: "Default Webhook",
        type: "secret",
        description: "Optional DingTalk default session webhook",
        placeholder: "Optional",
        env: "DINGTALK_DEFAULT_WEBHOOK",
      },
      {
        key: "webhookHost",
        label: "Webhook Host",
        type: "text",
        description: "Optional DingTalk webhook host",
        placeholder: "0.0.0.0",
        env: "DINGTALK_WEBHOOK_HOST",
      },
      {
        key: "webhookPort",
        label: "Webhook Port",
        type: "text",
        description: "Optional DingTalk webhook port",
        placeholder: "16673",
        env: "DINGTALK_WEBHOOK_PORT",
      },
      {
        key: "webhookPath",
        label: "Webhook Path",
        type: "text",
        description: "Optional DingTalk webhook path",
        placeholder: "/dingtalk",
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
    summaries: {
      configured: "Managed runtime ready",
      partial: "Partially configured",
    },
    fields: [
      {
        key: "enabled",
        label: "Enable ClickClack",
        type: "boolean",
        description: "Enable ClickClack channel integration",
      },
      {
        key: "baseUrl",
        label: "Base URL",
        type: "text",
        description: "ClickClack server base URL",
        placeholder: "https://chat.example.com",
        env: "CLICKCLACK_BASE_URL",
        required: true,
      },
      {
        key: "token",
        label: "Bot Token",
        type: "secret",
        description: "ClickClack bot token",
        placeholder: "Bot token",
        env: "CLICKCLACK_BOT_TOKEN",
        required: true,
      },
      {
        key: "workspace",
        label: "Workspace",
        type: "text",
        description: "ClickClack workspace ID, slug, or name",
        placeholder: "workspace",
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
    summaries: { configured: "Managed runtime ready", partial: "Partially configured" },
    fields: [
      { key: "enabled", label: "Enable iMessage", type: "boolean", description: "Enable iMessage integration" },
      {
        key: "cliPath",
        label: "imsg CLI Path",
        type: "text",
        description: "Path to the imsg command-line bridge on macOS",
        placeholder: "/opt/homebrew/bin/imsg",
        env: "IMESSAGE_CLI_PATH",
        required: true,
      },
      {
        key: "dbPath",
        label: "Messages Database",
        type: "text",
        description: "Optional path to the Messages chat database",
        placeholder: "~/Library/Messages/chat.db",
        env: "IMESSAGE_DB_PATH",
      },
      {
        key: "service",
        label: "Service",
        type: "text",
        description: "Optional service selection: imessage, sms, or auto",
        placeholder: "auto",
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
    summaries: { configured: "Managed runtime ready", partial: "Partially configured" },
    fields: [
      { key: "enabled", label: "Enable IRC", type: "boolean", description: "Enable Internet Relay Chat integration" },
      {
        key: "host",
        label: "Server Host",
        type: "text",
        description: "IRC server hostname",
        placeholder: "irc.libera.chat",
        env: "IRC_HOST",
        required: true,
      },
      {
        key: "nick",
        label: "Nickname",
        type: "text",
        description: "IRC bot nickname",
        placeholder: "opencorvus",
        env: "IRC_NICK",
        required: true,
      },
      {
        key: "port",
        label: "Port",
        type: "text",
        description: "Optional IRC server port",
        placeholder: "6697",
        env: "IRC_PORT",
        transform: "integer",
      },
      {
        key: "tls",
        label: "Use TLS",
        type: "boolean",
        description: "Use Transport Layer Security for IRC",
        env: "IRC_TLS",
      },
      {
        key: "password",
        label: "Server Password",
        type: "secret",
        description: "Optional IRC server password",
        env: "IRC_PASSWORD",
      },
      {
        key: "channels",
        label: "Channels",
        type: "text",
        description: "Comma-separated IRC channels to join",
        placeholder: "#general,#bots",
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
    summaries: { configured: "Managed runtime ready", partial: "Partially configured" },
    fields: [
      {
        key: "enabled",
        label: "Enable Nextcloud Talk",
        type: "boolean",
        description: "Enable Nextcloud Talk integration",
      },
      {
        key: "baseUrl",
        label: "Nextcloud URL",
        type: "text",
        description: "Nextcloud server base URL",
        placeholder: "https://cloud.example.com",
        env: "NEXTCLOUD_TALK_BASE_URL",
        required: true,
      },
      {
        key: "botSecret",
        label: "Bot Secret",
        type: "secret",
        description: "Nextcloud Talk webhook bot secret",
        env: "NEXTCLOUD_TALK_BOT_SECRET",
        required: true,
      },
      {
        key: "webhookHost",
        label: "Webhook Host",
        type: "text",
        description: "Optional webhook bind host",
        placeholder: "0.0.0.0",
        env: "NEXTCLOUD_TALK_WEBHOOK_HOST",
      },
      {
        key: "webhookPort",
        label: "Webhook Port",
        type: "text",
        description: "Optional webhook bind port",
        placeholder: "8788",
        env: "NEXTCLOUD_TALK_WEBHOOK_PORT",
        transform: "integer",
      },
      {
        key: "webhookPath",
        label: "Webhook Path",
        type: "text",
        description: "Optional webhook path",
        placeholder: "/nextcloud-talk",
        env: "NEXTCLOUD_TALK_WEBHOOK_PATH",
      },
      {
        key: "webhookPublicUrl",
        label: "Public Webhook URL",
        type: "text",
        description: "Optional externally reachable webhook URL",
        placeholder: "https://bot.example.com/nextcloud-talk",
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
    summaries: { configured: "Managed runtime ready", partial: "Partially configured" },
    fields: [
      { key: "enabled", label: "Enable Nostr", type: "boolean", description: "Enable Nostr direct messages" },
      {
        key: "privateKey",
        label: "Private Key",
        type: "secret",
        description: "Nostr private key",
        placeholder: "nsec1...",
        env: "NOSTR_PRIVATE_KEY",
        required: true,
      },
      {
        key: "relays",
        label: "Relays",
        type: "text",
        description: "Comma-separated Nostr relay URLs",
        placeholder: "wss://relay.example.com",
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
    summaries: { configured: "Managed runtime ready", partial: "Partially configured" },
    fields: [
      {
        key: "enabled",
        label: "Enable QQ Bot",
        type: "boolean",
        description: "Enable the official QQ Bot API integration",
      },
      {
        key: "appId",
        label: "App ID",
        type: "secret",
        description: "QQ Bot application ID",
        placeholder: "App ID",
        env: "QQBOT_APP_ID",
        required: true,
      },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: "secret",
        description: "QQ Bot client secret",
        placeholder: "Client secret",
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
    summaries: { configured: "Managed runtime ready", partial: "Partially configured" },
    fields: [
      {
        key: "enabled",
        label: "Enable Raft",
        type: "boolean",
        description: "Enable the Raft command-line wake bridge",
      },
      {
        key: "profile",
        label: "Profile",
        type: "text",
        description: "Raft CLI profile",
        placeholder: "default",
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
    summaries: { configured: "Managed runtime ready", partial: "Partially configured" },
    fields: [
      {
        key: "enabled",
        label: "Enable Reef",
        type: "boolean",
        description: "Enable guarded end-to-end encrypted Reef messaging",
      },
      {
        key: "handle",
        label: "Handle",
        type: "text",
        description: "Reef handle",
        placeholder: "opencorvus",
        env: "REEF_HANDLE",
        required: true,
      },
      {
        key: "email",
        label: "Email",
        type: "text",
        description: "Reef registration email",
        placeholder: "owner@example.com",
        env: "REEF_EMAIL",
        required: true,
      },
      {
        key: "relayUrl",
        label: "Relay URL",
        type: "text",
        description: "Reef relay origin",
        placeholder: "https://reefwire.ai",
        env: "REEF_RELAY_URL",
      },
      {
        key: "guardProvider",
        label: "Guard Provider",
        type: "text",
        description: "Guard model provider: anthropic or openai",
        placeholder: "openai",
        env: "REEF_GUARD_PROVIDER",
        required: true,
        configPath: ["guard", "provider"],
      },
      {
        key: "guardPinnedModel",
        label: "Guard Model",
        type: "text",
        description: "Pinned guard model identifier",
        placeholder: "gpt-5-mini",
        env: "REEF_GUARD_PINNED_MODEL",
        required: true,
        configPath: ["guard", "pinnedModel"],
      },
      {
        key: "guardApiKeyEnv",
        label: "Guard API Key Environment",
        type: "text",
        description: "Environment variable containing the guard provider API key",
        placeholder: "OPENAI_API_KEY",
        env: "REEF_GUARD_API_KEY_ENV",
        required: true,
        configPath: ["guard", "apiKeyEnv"],
      },
      {
        key: "guardPolicyVersion",
        label: "Guard Policy Version",
        type: "text",
        description: "Pinned Reef guard policy version",
        placeholder: "v1",
        env: "REEF_GUARD_POLICY_VERSION",
        required: true,
        configPath: ["guard", "policyVersion"],
      },
      {
        key: "guardTimeoutMs",
        label: "Guard Timeout",
        type: "text",
        description: "Guard request timeout in milliseconds",
        placeholder: "30000",
        env: "REEF_GUARD_TIMEOUT_MS",
        required: true,
        transform: "integer",
        configPath: ["guard", "timeoutMs"],
      },
      {
        key: "requestPolicy",
        label: "Friend Request Policy",
        type: "text",
        description: "Reef friend request policy: code-only, friends-of-friends, or open",
        placeholder: "code-only",
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
    summaries: { configured: "Managed runtime ready", partial: "Partially configured" },
    fields: [
      {
        key: "enabled",
        label: "Enable SMS",
        type: "boolean",
        description: "Enable Twilio Short Message Service integration",
      },
      {
        key: "accountSid",
        label: "Account SID",
        type: "secret",
        description: "Twilio account identifier",
        placeholder: "AC...",
        env: "TWILIO_ACCOUNT_SID",
        required: true,
      },
      {
        key: "authToken",
        label: "Auth Token",
        type: "secret",
        description: "Twilio authentication token",
        env: "TWILIO_AUTH_TOKEN",
        required: true,
      },
      {
        key: "fromNumber",
        label: "From Number",
        type: "text",
        description: "Twilio sender number in E.164 format",
        placeholder: "+15551234567",
        env: "TWILIO_PHONE_NUMBER",
        required: true,
      },
      {
        key: "defaultTo",
        label: "Default Recipient",
        type: "text",
        description: "Optional default recipient number",
        placeholder: "+15557654321",
        env: "SMS_DEFAULT_TO",
      },
      {
        key: "publicWebhookUrl",
        label: "Public Webhook URL",
        type: "text",
        description: "Externally reachable Twilio webhook URL",
        placeholder: "https://bot.example.com/sms",
        env: "SMS_PUBLIC_WEBHOOK_URL",
      },
      {
        key: "webhookPath",
        label: "Webhook Path",
        type: "text",
        description: "Optional local webhook path",
        placeholder: "/sms",
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
    summaries: { configured: "Managed runtime ready", partial: "Partially configured" },
    fields: [
      { key: "enabled", label: "Enable Synology Chat", type: "boolean", description: "Enable Synology Chat webhooks" },
      {
        key: "token",
        label: "Outgoing Token",
        type: "secret",
        description: "Synology Chat outgoing webhook token",
        env: "SYNOLOGY_CHAT_TOKEN",
        required: true,
      },
      {
        key: "incomingUrl",
        label: "Incoming Webhook URL",
        type: "secret",
        description: "Synology Chat incoming webhook URL",
        placeholder: "https://nas.example.com/webapi/entry.cgi?...",
        env: "SYNOLOGY_CHAT_INCOMING_URL",
        required: true,
      },
      {
        key: "nasHost",
        label: "NAS Host",
        type: "text",
        description: "Optional Synology Network Attached Storage host",
        placeholder: "nas.example.com",
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
    summaries: { configured: "Managed runtime ready", partial: "Partially configured" },
    fields: [
      { key: "enabled", label: "Enable Tlon", type: "boolean", description: "Enable Tlon on Urbit" },
      {
        key: "ship",
        label: "Ship",
        type: "text",
        description: "Urbit ship name",
        placeholder: "~sampel-palnet",
        env: "TLON_SHIP",
        required: true,
      },
      {
        key: "url",
        label: "Ship URL",
        type: "text",
        description: "Urbit ship URL",
        placeholder: "http://localhost:8080",
        env: "TLON_URL",
        required: true,
      },
      {
        key: "code",
        label: "Login Code",
        type: "secret",
        description: "Urbit ship login code",
        env: "TLON_CODE",
        required: true,
      },
      {
        key: "groupChannels",
        label: "Group Channels",
        type: "text",
        description: "Comma-separated channel nests",
        env: "TLON_GROUP_CHANNELS",
        transform: "string-list",
      },
      {
        key: "dmAllowlist",
        label: "Direct Message Allowlist",
        type: "text",
        description: "Comma-separated Urbit ships allowed to send direct messages",
        env: "TLON_DM_ALLOWLIST",
        transform: "string-list",
      },
      {
        key: "defaultAuthorizedShips",
        label: "Authorized Group Ships",
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
    summaries: { configured: "Managed runtime ready", partial: "Partially configured" },
    fields: [
      { key: "enabled", label: "Enable Twitch", type: "boolean", description: "Enable Twitch chat integration" },
      {
        key: "username",
        label: "Username",
        type: "text",
        description: "Twitch bot username",
        placeholder: "opencorvus",
        env: "TWITCH_USERNAME",
        required: true,
      },
      {
        key: "accessToken",
        label: "Access Token",
        type: "secret",
        description: "Twitch OAuth token with chat read and write scopes",
        placeholder: "oauth:...",
        env: "OPENCLAW_TWITCH_ACCESS_TOKEN",
        required: true,
      },
      {
        key: "clientId",
        label: "Client ID",
        type: "secret",
        description: "Twitch application client ID",
        env: "TWITCH_CLIENT_ID",
        required: true,
      },
      {
        key: "channel",
        label: "Channel",
        type: "text",
        description: "Twitch channel name to join",
        placeholder: "channel-name",
        env: "TWITCH_CHANNEL",
        required: true,
      },
      {
        key: "allowFrom",
        label: "Allowed User IDs",
        type: "text",
        description: "Comma-separated Twitch user IDs",
        env: "TWITCH_ALLOW_FROM",
        transform: "string-list",
      },
      {
        key: "requireMention",
        label: "Require Mention",
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
    summaries: { configured: "Managed runtime ready", partial: "Partially configured" },
    fields: [
      { key: "enabled", label: "Enable Zalo", type: "boolean", description: "Enable the Zalo Bot API integration" },
      {
        key: "botToken",
        label: "Bot Token",
        type: "secret",
        description: "Zalo bot token",
        env: "ZALO_BOT_TOKEN",
        required: true,
      },
      {
        key: "webhookSecret",
        label: "Webhook Secret",
        type: "secret",
        description: "Optional Zalo webhook signature secret",
        env: "ZALO_WEBHOOK_SECRET",
      },
      {
        key: "webhookUrl",
        label: "Webhook URL",
        type: "text",
        description: "Optional public webhook URL",
        placeholder: "https://bot.example.com/zalo",
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
    summaries: { configured: "Managed runtime ready", partial: "Partially configured" },
    fields: [
      {
        key: "enabled",
        label: "Enable Zalo Personal",
        type: "boolean",
        description: "Enable a Zalo personal account through the official OpenClaw plugin",
      },
      {
        key: "profile",
        label: "Profile",
        type: "text",
        description: "Zalo Personal profile name",
        placeholder: "default",
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
  const summary =
    status === "disabled"
      ? "Disabled"
      : status === "configured"
        ? info.summaries.configured
        : status === "partial"
          ? info.summaries.partial
          : "Not configured"
  return {
    ...resolved,
    status,
    summary,
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

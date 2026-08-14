import { ChannelRuntime } from "./core"
import { SlackAdapter } from "./adapters/slack"
import { TelegramAdapter } from "./adapters/telegram"
import { DiscordAdapter } from "./adapters/discord"
import { FeishuAdapter } from "./adapters/feishu"
import { WhatsappAdapter } from "./adapters/whatsapp"
import { GoogleChatAdapter } from "./adapters/googlechat"
import { MSTeamsAdapter } from "./adapters/msteams"
import { LineAdapter } from "./adapters/line"
import { MatrixAdapter } from "./adapters/matrix"
import { MattermostAdapter } from "./adapters/mattermost"
import { SignalAdapter } from "./adapters/signal"
import { WeComAdapter } from "./adapters/wecom"
import { DingTalkAdapter } from "./adapters/dingtalk"
import { createConfiguredSTT } from "./stt/setup"
import { VisionPipeline } from "./vision"
import { applyDashscopeRuntime } from "./dashscope"
import { ADAPTER_HINT, registerAdapters } from "./registry"
import { applyBundledEnv } from "./bundled-env"
import { resolveRuntimeConfig } from "./runtime-config"

const bundled = await applyBundledEnv()
if (bundled.expired) {
  console.warn(
    `[ChannelRuntime] Bundled env expired at ${bundled.expireAt}. Configure your own packages/channel-runtime/.env to continue.`,
  )
} else if (bundled.enabled) {
  console.log(
    `[ChannelRuntime] Bundled env active until ${bundled.expireAt} (applied ${bundled.applied}, user overrides ${bundled.skipped}).`,
  )
} else if (bundled.reason === "invalid_bundle") {
  console.warn(`[ChannelRuntime] Ignore invalid bundled env file: ${bundled.file}`)
}

const dashscope = await applyDashscopeRuntime()
const activeKey = dashscope.key
const useCodingPlan = dashscope.useCodingPlan
const baseURL = dashscope.baseURL

const runtimeConfig = resolveRuntimeConfig(
  process.env.OPENCORVUS_CONFIG_CONTENT,
  process.env.OPENCORVUS_CHANNEL_PERMISSION_PROFILE,
)
process.env.OPENCORVUS_CONFIG_CONTENT = JSON.stringify(runtimeConfig.config)
console.log(`[ChannelRuntime] Permission profile: ${runtimeConfig.profile}`)

console.log(
  "[ChannelRuntime] Model/provider config source: opencorvus auth + opencorvus.jsonc + OPENCORVUS_CONFIG_CONTENT",
)
if (!activeKey) {
  console.log(
    "[ChannelRuntime] DashScope key not found in opencorvus auth. Run: opencorvus auth login (provider: alibaba-cn)",
  )
}
if (activeKey) {
  const keyType = useCodingPlan ? "sk-sp-* (Coding Plan)" : "sk-* (DashScope)"
  const provider = dashscope.authProvider ?? "unknown"
  const from = dashscope.authPath ? `auth:${provider} @ ${dashscope.authPath}` : `auth:${provider}`
  console.log(`[ChannelRuntime] DashScope runtime: ${keyType}, baseURL: ${baseURL}, source: ${from}`)
}

const serverUrl = process.env.OPENCORVUS_CHANNEL_SERVER_URL?.trim()
if (serverUrl) {
  console.log(`[ChannelRuntime] Attach existing OpenCorvus server: ${serverUrl}`)
}
const runtime = new ChannelRuntime({
  baseUrl: serverUrl,
  directory: process.env.OPENCORVUS_PROJECT_DIR?.trim(),
  channelProtocol: process.env.OPENCORVUS_CHANNEL_PROTOCOL === "1",
  sharedMode: process.env.OPENCORVUS_SHARED_SESSION_MODE === "1",
  sharedFile: process.env.OPENCORVUS_SHARED_SESSION_FILE,
})

// --- STT Pipeline Setup ---
const sttPipeline = await createConfiguredSTT(process.env)
if (sttPipeline) {
  runtime.setSTT(sttPipeline)
  console.log(`[ChannelRuntime] STT provider: ${process.env.STT_PROVIDER}`)
} else {
  console.log("[ChannelRuntime] STT disabled (STT_PROVIDER not set)")
}

// --- Vision Pipeline Setup ---
if (activeKey) {
  const visionModel = process.env.OPENCORVUS_VISION_MODEL
  if (visionModel) {
    runtime.setVision(
      new VisionPipeline({
        apiKey: activeKey,
        baseURL,
        model: visionModel,
      }),
    )
    const keySource = useCodingPlan ? "opencorvus auth (coding plan)" : "opencorvus auth"
    console.log(
      `[ChannelRuntime] Vision pipeline enabled (model: ${visionModel}, key: ${keySource}, baseURL: ${baseURL})`,
    )
  } else {
    console.log("[ChannelRuntime] Vision pipeline disabled (OPENCORVUS_VISION_MODEL not set)")
  }
}

const adapters = registerAdapters(runtime, process.env, {
  slack: (opts) => new SlackAdapter(opts),
  telegram: (opts) => new TelegramAdapter(opts),
  discord: (opts) => new DiscordAdapter(opts),
  feishu: (opts) => new FeishuAdapter(opts),
  whatsapp: (opts) => new WhatsappAdapter(opts),
  googlechat: (opts) => new GoogleChatAdapter(opts),
  msteams: (opts) => new MSTeamsAdapter(opts),
  line: (opts) => new LineAdapter(opts),
  matrix: (opts) => new MatrixAdapter(opts),
  mattermost: (opts) => new MattermostAdapter(opts),
  signal: (opts) => new SignalAdapter(opts),
  wecom: (opts) => new WeComAdapter(opts),
  dingtalk: (opts) => new DingTalkAdapter(opts),
})
for (const warn of adapters.warns) {
  console.warn(`[ChannelRuntime] ${warn}`)
}

if (adapters.names.length === 0) {
  console.error(`No chat channel configured. ${ADAPTER_HINT}`)
  process.exit(1)
}
console.log(`[ChannelRuntime] Registered chat channels: ${adapters.names.join(", ")}`)

const receipt = await runtime.start()
console.log(`Channel runtime is running: ${receipt.channels.join(", ")}`)

// Auto-inject test prompt if TEST_PROMPT env var is set
if (process.env.TEST_PROMPT) {
  const channel = process.env.SLACK_CHANNEL_ID!
  console.log(`[Test] Injecting prompt into channel ${channel}`)
  runtime
    .injectPrompt("slack", channel, process.env.TEST_PROMPT)
    .catch((err) => console.error("[Test] injectPrompt failed:", err))
}

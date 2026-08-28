import { ChannelRuntime } from "./core"
import { registerAdapters, ADAPTER_HINT } from "./registry"
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
import { applyDashscopeRuntime } from "./dashscope"
import { createConfiguredSTT } from "./stt/setup"
import { VisionPipeline } from "./vision"

export { ADAPTER_HINT }

/**
 * The one composition root of a Channel runtime.
 *
 * There used to be two: this package's own entry assembled environment,
 * providers, adapters and readiness, and OpenCorvus assembled the same thing
 * again by reaching across the workspace into this package's private `src`
 * with relative imports. Two roots meant the supported adapter set, the STT
 * and Vision wiring and the "is anything configured" answer could disagree
 * between an in-process runtime and a spawned one, and the package boundary
 * existed only on paper. Both owners call this instead, and the only thing
 * that varies between them is the environment they hand it.
 */
export type ChannelBootstrapInput = {
  /** The environment this runtime is configured from. */
  env: Record<string, string | undefined>
  /** Emitted for each human-readable step; a host that wants silence omits it. */
  onDiagnostic?: (message: string) => void
}

export type ChannelBootstrap = {
  runtime: ChannelRuntime
  /** Adapter names this environment actually configured. */
  adapterNames: string[]
  /** Configuration problems that did not prevent the runtime from starting. */
  warnings: string[]
  /** The DashScope runtime this environment resolved, if any. */
  dashscope: { key?: string; baseURL?: string }
}

export async function bootstrapChannelRuntime(input: ChannelBootstrapInput): Promise<ChannelBootstrap> {
  const env = input.env
  const say = input.onDiagnostic ?? (() => {})

  const dashscope = await applyDashscopeRuntime()
  const serverUrl = env.OPENCORVUS_CHANNEL_SERVER_URL?.trim()
  if (serverUrl) say(`Attach existing OpenCorvus server: ${serverUrl}`)

  const runtime = new ChannelRuntime({
    baseUrl: serverUrl,
    directory: env.OPENCORVUS_PROJECT_DIR?.trim(),
    channelProtocol: env.OPENCORVUS_CHANNEL_PROTOCOL === "1",
    sharedMode: env.OPENCORVUS_SHARED_SESSION_MODE === "1",
    sharedFile: env.OPENCORVUS_SHARED_SESSION_FILE,
  })

  const sttPipeline = await createConfiguredSTT(env)
  if (sttPipeline) {
    runtime.setSTT(sttPipeline)
    say(`STT provider: ${env.STT_PROVIDER}`)
  } else {
    say("STT disabled (STT_PROVIDER not set)")
  }

  if (dashscope.key) {
    const visionModel = env.OPENCORVUS_VISION_MODEL
    if (visionModel) {
      runtime.setVision(
        new VisionPipeline({
          apiKey: dashscope.key,
          baseURL: dashscope.baseURL,
          model: visionModel,
        }),
      )
      say(`Vision pipeline enabled (model: ${visionModel}, baseURL: ${dashscope.baseURL})`)
    } else {
      say("Vision pipeline disabled (OPENCORVUS_VISION_MODEL not set)")
    }
  }

  const adapters = registerAdapters(runtime, env, {
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
  for (const warning of adapters.warns) say(warning)

  return {
    runtime,
    adapterNames: adapters.names,
    warnings: adapters.warns,
    dashscope: { key: dashscope.key, baseURL: dashscope.baseURL },
  }
}

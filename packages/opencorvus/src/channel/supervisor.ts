import { Instance } from "@/project/instance"
import { Installation } from "@/installation"
import { Log } from "@/util/log"
import { requireServerUrl } from "@/server/runtime-url"
import { ChannelCatalog, channelEnv } from "./catalog"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"

const log = Log.create({ service: "channel.supervisor" })

type RuntimeStatus = "disabled" | "unavailable" | "starting" | "running" | "stopped" | "error"

type InProcessRuntime = { stop(): Promise<void> }

type State = {
  runtime?: InProcessRuntime
  cleanupPending: Set<InProcessRuntime>
  lifecycleTail: Promise<void>
  status: RuntimeStatus
  detail: string
  signature: string
  channels: string[]
  logs: string[]
}

export namespace ChannelSupervisor {
  export const RuntimeStartError = NamedError.create(
    "ChannelRuntimeStartError",
    z.object({
      message: z.string(),
      detail: z.string(),
      channels: z.array(z.string()),
    }),
  )

  const state = Instance.state<State>(
    () => ({
      cleanupPending: new Set(),
      lifecycleTail: Promise.resolve(),
      status: "disabled",
      detail: "No managed channel runtime active.",
      signature: "",
      channels: [],
      logs: [],
    }),
    async (current) => {
      await withLifecycleOwner(current, () => stop(current))
    },
    "channel-supervisor",
  )

  export async function sync(config?: Record<string, unknown>) {
    const current = await state()
    return withLifecycleOwner(current, async () => {
      const next = desired(config)
      if (next.status === "disabled" || next.status === "unavailable") {
        await stop(current)
        current.status = next.status
        current.detail = next.detail
        current.signature = ""
        current.channels = []
        return snapshot(current)
      }
      if (current.signature === next.signature && current.runtime && current.status === "running") {
        return snapshot(current)
      }
      await syncRuntime(current, next)
      return snapshot(current)
    })
  }

  export async function restart(config?: Record<string, unknown>) {
    const current = await state()
    return withLifecycleOwner(current, async () => {
      const next = desired(config)
      await syncRuntime(current, next, true)
      return snapshot(current)
    })
  }

  export async function status() {
    return snapshot(await state())
  }

  export async function channelStatus(id: string) {
    const current = await state()
    if (!current.channels.includes(id)) {
      return {
        runtime_status: current.status === "unavailable" ? "unavailable" : "disabled",
        runtime_detail: current.detail,
      }
    }
    return {
      runtime_status: current.status,
      runtime_detail: current.detail,
    }
  }

  export async function handles(id: string) {
    return (await state()).channels.includes(id)
  }
}

function withLifecycleOwner<T>(current: State, operation: () => Promise<T>): Promise<T> {
  const ownedOperation = async () => {
    await settlePendingCleanup(current)
    return operation()
  }
  const result = current.lifecycleTail.then(ownedOperation, ownedOperation)
  current.lifecycleTail = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

async function settlePendingCleanup(current: State) {
  const pending = [...current.cleanupPending]
  if (pending.length === 0) return
  const results = await Promise.allSettled(
    pending.map(async (runtime) => {
      await runtime.stop()
      current.cleanupPending.delete(runtime)
    }),
  )
  const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
  if (failures.length > 0) {
    throw new AggregateError(failures, `Channel runtime cleanup retry failed for ${failures.length} owner(s)`)
  }
}

function desired(config?: Record<string, unknown>) {
  if (!Installation.isLocal()) {
    return {
      status: "unavailable" as const,
      detail: "Managed channel runtime is only available in local development installs.",
      env: undefined,
      channelProtocol: false,
      signature: "",
      channels: [] as string[],
    }
  }
  const channel = (config?.channel ?? {}) as Record<string, any>
  const env: Record<string, string> = {}
  const channels: string[] = []

  for (const item of ChannelCatalog) {
    if (item.implementation.kind === "planned") continue
    const next = channelEnv(item.id, channel[item.id], {})
    if (!next) continue
    Object.assign(env, next)
    channels.push(item.id)
  }

  if (channels.length === 0) {
    return {
      status: "disabled" as const,
      detail: "No managed channel runtime configured.",
      env: undefined,
      channelProtocol: false,
      signature: "",
      channels,
    }
  }

  env.OPENCORVUS_CHANNEL_SERVER_URL = requireServerUrl().toString().replace(/\/+$/, "")
  env.OPENCORVUS_PROJECT_DIR = Instance.directory
  env.OPENCORVUS_CONFIG_CONTENT = JSON.stringify(config ?? {})

  return {
    status: "starting" as const,
    detail: `Launching managed runtime for ${channels.join(", ")}.`,
    env,
    channelProtocol: true,
    signature: JSON.stringify({ env, channels, channelProtocol: true }),
    channels,
  }
}

async function syncRuntime(current: State, next: ReturnType<typeof desired>, force = false) {
  await stop(current)
  if (!next.env) {
    current.status = next.status
    current.detail = next.detail
    current.signature = ""
    current.channels = []
    return
  }
  current.status = "starting"
  current.detail = force ? `Restarting managed runtime for ${next.channels.join(", ")}.` : next.detail
  current.signature = next.signature
  current.channels = next.channels

  try {
    current.runtime = await startInProcess(next.env, current, next.channelProtocol)
    current.status = "running"
    current.detail = `Managed runtime active for ${next.channels.join(", ")}.`
  } catch (error) {
    const detail = `Channel runtime failed: ${String(error)}`
    current.status = "error"
    current.detail = detail
    log.error("channel runtime failed", { error: String(error) })
    throw new ChannelSupervisor.RuntimeStartError(
      {
        message: detail,
        detail,
        channels: [...next.channels],
      },
      { cause: error },
    )
  }
}

async function stop(current: State) {
  const runtime = current.runtime
  if (!runtime) return
  await runtime.stop()
  if (current.runtime === runtime) current.runtime = undefined
}

async function startInProcess(
  env: Record<string, string>,
  current: State,
  channelProtocol: boolean,
): Promise<InProcessRuntime> {
  // Dynamic import to avoid loading channel-runtime when not needed
  const { ChannelRuntime } = await import("../../../channel-runtime/src/core")
  const { registerAdapters, ADAPTER_HINT } = await import("../../../channel-runtime/src/registry")
  const { SlackAdapter } = await import("../../../channel-runtime/src/adapters/slack")
  const { TelegramAdapter } = await import("../../../channel-runtime/src/adapters/telegram")
  const { DiscordAdapter } = await import("../../../channel-runtime/src/adapters/discord")
  const { FeishuAdapter } = await import("../../../channel-runtime/src/adapters/feishu")
  const { WhatsappAdapter } = await import("../../../channel-runtime/src/adapters/whatsapp")
  const { GoogleChatAdapter } = await import("../../../channel-runtime/src/adapters/googlechat")
  const { MSTeamsAdapter } = await import("../../../channel-runtime/src/adapters/msteams")
  const { LineAdapter } = await import("../../../channel-runtime/src/adapters/line")
  const { MatrixAdapter } = await import("../../../channel-runtime/src/adapters/matrix")
  const { MattermostAdapter } = await import("../../../channel-runtime/src/adapters/mattermost")
  const { SignalAdapter } = await import("../../../channel-runtime/src/adapters/signal")
  const { WeComAdapter } = await import("../../../channel-runtime/src/adapters/wecom")
  const { DingTalkAdapter } = await import("../../../channel-runtime/src/adapters/dingtalk")
  const { applyDashscopeRuntime } = await import("../../../channel-runtime/src/dashscope")
  const { createConfiguredSTT } = await import("../../../channel-runtime/src/stt/setup")
  const { VisionPipeline } = await import("../../../channel-runtime/src/vision")

  const dashscope = await applyDashscopeRuntime()
  const serverUrl = env.OPENCORVUS_CHANNEL_SERVER_URL

  const runtime = new ChannelRuntime({
    baseUrl: serverUrl,
    directory: env.OPENCORVUS_PROJECT_DIR,
    channelProtocol,
    sharedMode: process.env.OPENCORVUS_SHARED_SESSION_MODE === "1",
    sharedFile: process.env.OPENCORVUS_SHARED_SESSION_FILE,
  })

  const sttPipeline = await createConfiguredSTT(env)
  if (sttPipeline) {
    runtime.setSTT(sttPipeline)
  }

  // Vision pipeline (optional)
  if (dashscope.key && process.env.OPENCORVUS_VISION_MODEL) {
    try {
      runtime.setVision(
        new VisionPipeline({
          apiKey: dashscope.key,
          baseURL: dashscope.baseURL,
          model: process.env.OPENCORVUS_VISION_MODEL,
        }),
      )
    } catch {
      /* Vision optional */
    }
  }

  // Register adapters
  const adapters = registerAdapters(runtime, env, {
    slack: (opts: any) => new SlackAdapter(opts),
    telegram: (opts: any) => new TelegramAdapter(opts),
    discord: (opts: any) => new DiscordAdapter(opts),
    feishu: (opts: any) => new FeishuAdapter(opts),
    whatsapp: (opts: any) => new WhatsappAdapter(opts),
    googlechat: (opts: any) => new GoogleChatAdapter(opts),
    msteams: (opts: any) => new MSTeamsAdapter(opts),
    line: (opts: any) => new LineAdapter(opts),
    matrix: (opts: any) => new MatrixAdapter(opts),
    mattermost: (opts: any) => new MattermostAdapter(opts),
    signal: (opts: any) => new SignalAdapter(opts),
    wecom: (opts: any) => new WeComAdapter(opts),
    dingtalk: (opts: any) => new DingTalkAdapter(opts),
  })
  for (const warn of adapters.warns) {
    log.warn("channel adapter skip", { message: warn })
  }
  if (adapters.names.length === 0) {
    throw new Error(`No chat channel configured. ${ADAPTER_HINT}`)
  }
  log.info("channel runtime starting", { channels: adapters.names })
  for (const name of adapters.names) {
    appendLog(current, `Registered: ${name}`)
  }

  try {
    await runtime.start()
  } catch (startupError) {
    try {
      await runtime.stop()
    } catch (cleanupError) {
      current.cleanupPending.add(runtime)
      throw new AggregateError(
        [startupError, cleanupError],
        `Channel runtime startup and rollback failed for ${adapters.names.join(", ")}`,
      )
    }
    throw startupError
  }
  log.info("channel runtime started", { channels: adapters.names })
  appendLog(current, `Channel runtime active: ${adapters.names.join(", ")}`)

  return { stop: () => runtime.stop() }
}

function appendLog(current: State, text: string) {
  current.logs.push(text)
  if (current.logs.length > 20) current.logs.shift()
}

function snapshot(current: State) {
  return {
    status: current.status,
    detail: current.detail,
    channels: [...current.channels],
    logs: [...current.logs],
    running: !!current.runtime && current.status === "running",
  }
}

import { Instance } from "@/project/instance"
import { Installation } from "@/installation"
import { Log } from "@/util/log"
import { requireServerUrl } from "@/server/runtime-url"
import { ChannelCatalog, channelEnv } from "./catalog"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"

const log = Log.create({ service: "channel.supervisor" })

type RuntimeStatus = "disabled" | "unavailable" | "starting" | "running" | "stopped" | "error"

type InProcessRuntime = { channels: readonly string[]; stop(): Promise<void> }

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
  current.channels = []

  try {
    current.runtime = await startInProcess(next.env, current, next.channelProtocol)
    current.channels = [...current.runtime.channels]
    current.status = "running"
    current.detail = `Managed runtime active for ${current.channels.join(", ")}.`
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
  // The Channel runtime's own composition root, consumed through the declared
  // package boundary. OpenCorvus used to reach across the workspace into this
  // package's private `src` with relative imports and assemble providers,
  // adapters and readiness a second time, so an in-process runtime and a
  // spawned one could disagree about what "configured" means.
  const { bootstrapChannelRuntime, ADAPTER_HINT } = await import("@opencorvus-ai/channel-runtime")

  const { runtime, adapterNames } = await bootstrapChannelRuntime({
    env: { ...env, OPENCORVUS_CHANNEL_PROTOCOL: channelProtocol ? "1" : env.OPENCORVUS_CHANNEL_PROTOCOL },
    onDiagnostic: (message) => log.info("channel runtime", { message }),
  })

  if (adapterNames.length === 0) {
    throw new Error(`No chat channel configured. ${ADAPTER_HINT}`)
  }
  log.info("channel runtime starting", { channels: adapterNames })
  for (const name of adapterNames) {
    appendLog(current, `Registered: ${name}`)
  }

  const owner: { channels: readonly string[]; stop(): Promise<void> } = { channels: [], stop: () => runtime.stop() }
  let receipt: Awaited<ReturnType<typeof runtime.start>>
  try {
    receipt = await runtime.start()
  } catch (startupError) {
    try {
      await runtime.stop()
    } catch (cleanupError) {
      current.cleanupPending.add(owner)
      throw new AggregateError(
        [startupError, cleanupError],
        `Channel runtime startup and rollback failed for ${adapterNames.join(", ")}`,
      )
    }
    throw startupError
  }
  owner.channels = [...receipt.channels]
  log.info("channel runtime started", { channels: receipt.channels, failedChannels: receipt.failedChannels })
  appendLog(current, `Channel runtime active: ${receipt.channels.join(", ")}`)

  return owner
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

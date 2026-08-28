import { EngineConfig } from "@/engine/config"

export class SchedulerExecutionInactivityError extends Error {
  override readonly name = "SchedulerExecutionInactivityError"

  constructor(
    readonly occurrence: string,
    readonly phase: string,
    readonly inactivityTimeoutMilliseconds: number,
  ) {
    super(
      `${occurrence} made no durable execution progress in phase ${phase} for ` + `${inactivityTimeoutMilliseconds}ms`,
    )
  }
}

export interface SchedulerExecutionInactivityFence {
  signal: AbortSignal
  touch(nextPhase: string): void
  runDelegated<T>(nextPhase: string, run: () => Promise<T>): Promise<T>
  [Symbol.dispose](): void
}

export async function createSchedulerExecutionInactivityFence(input: {
  occurrence: string
  signals: readonly AbortSignal[]
  initialPhase: string
  configurationOwner: "global" | "project"
}): Promise<SchedulerExecutionInactivityFence> {
  const configured = (await (input.configurationOwner === "global" ? EngineConfig.getGlobal() : EngineConfig.get()))
    .activity.execution_progress_idle_ms
  if (!Number.isInteger(configured) || configured <= 0) {
    throw new Error(`Invalid scheduler execution inactivity timeout ${configured}`)
  }
  const controller = new AbortController()
  let phase = input.initialPhase
  let timer: ReturnType<typeof setTimeout> | undefined
  let delegatedOwners = 0
  const arm = () => {
    if (timer) clearTimeout(timer)
    timer = undefined
    if (delegatedOwners > 0 || controller.signal.aborted) return
    timer = setTimeout(() => {
      controller.abort(new SchedulerExecutionInactivityError(input.occurrence, phase, configured))
    }, configured)
  }
  arm()
  return {
    signal: AbortSignal.any([...input.signals, controller.signal]),
    touch(nextPhase: string) {
      if (controller.signal.aborted) return
      phase = nextPhase
      arm()
    },
    async runDelegated<T>(nextPhase: string, run: () => Promise<T>): Promise<T> {
      if (controller.signal.aborted) controller.signal.throwIfAborted()
      phase = nextPhase
      delegatedOwners += 1
      arm()
      try {
        return await run()
      } finally {
        delegatedOwners -= 1
        arm()
      }
    },
    [Symbol.dispose]() {
      if (timer) clearTimeout(timer)
      timer = undefined
    },
  }
}

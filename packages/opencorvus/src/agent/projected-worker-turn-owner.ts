import { ExecutionCancellationError, createExecutionCancellationOrigin } from "@/session/prompt/cancellation"

type TurnOwnershipEntry = {
  tail: Promise<void>
}

const entries = new Map<string, TurnOwnershipEntry>()

/**
 * True while this process owns or is waiting to own a complete projected
 * worker Turn. This covers the durable-descriptor-to-prompt and
 * prompt-to-terminal-publication boundaries where no prompt controller may
 * exist yet, but process-recovery must not claim the Turn as interrupted.
 */
export function hasProjectedWorkerTurnOwnership(sessionID: string): boolean {
  return entries.has(sessionID.trim())
}

function waitForPriorTurn(prior: Promise<void>, sessionID: string, signal?: AbortSignal): Promise<void> {
  if (!signal) return prior
  if (signal.aborted) {
    return Promise.reject(
      signal.reason instanceof Error
        ? signal.reason
        : new ExecutionCancellationError({
            source: "session_prompt",
            sessionID,
            message: `Projected worker Session ${sessionID} Turn was cancelled before Turn ownership`,
            origin: createExecutionCancellationOrigin({
              actor: "runtime",
              source: "runtime.prompt_owner",
              surface: "agent",
              requestID: sessionID,
              reason: `Projected worker Session ${sessionID} Turn was cancelled before Turn ownership`,
              targetSessionID: sessionID,
            }),
          }),
    )
  }
  return new Promise<void>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new Error(`Projected worker Session ${sessionID} Turn was cancelled`))
    signal.addEventListener("abort", abort, { once: true })
    void prior.then(
      () => {
        signal.removeEventListener("abort", abort)
        resolve()
      },
      (error) => {
        signal.removeEventListener("abort", abort)
        reject(error)
      },
    )
  })
}

/**
 * Serialize complete projected-worker Turns by their physical Session.
 *
 * Durable lineage is deliberately validated by the caller only after the
 * previous owner settles. The owner chain preserves one physical writer, while the
 * descriptor/message/runtime stores remain the durable authorities.
 */
export async function runProjectedWorkerTurnExclusive<T>(input: {
  sessionID: string
  signal?: AbortSignal
  run: () => Promise<T>
}): Promise<T> {
  const sessionID = input.sessionID.trim()
  if (!sessionID) throw new Error("Projected worker Turn ownership requires a Session ID")

  const prior = entries.get(sessionID)?.tail ?? Promise.resolve()
  let release!: () => void
  const owned = new Promise<void>((resolve) => {
    release = resolve
  })
  const tail = prior.catch(() => undefined).then(() => owned)
  const entry = { tail }
  entries.set(sessionID, entry)
  void tail.finally(() => {
    if (entries.get(sessionID) === entry) entries.delete(sessionID)
  })

  try {
    await waitForPriorTurn(
      prior.catch(() => undefined),
      sessionID,
      input.signal,
    )
    return await input.run()
  } finally {
    release()
  }
}

export async function waitForProjectedWorkerTurnOwnersForTest(): Promise<void> {
  while (entries.size > 0) await Promise.all([...entries.values()].map((entry) => entry.tail))
}

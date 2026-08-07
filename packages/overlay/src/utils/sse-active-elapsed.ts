export interface SseActiveElapsedState {
  /** Elapsed ms (milliseconds) from task start to the latest selected-task SSE activity timestamp. */
  elapsedMs: number
  key: string
  startedAt?: number
  observedAt?: number
}

export interface SseActiveElapsedInput {
  activityAt: number
  active: boolean
  key: string
  startedAt: number
}

export function advanceSseActiveElapsed(
  state: SseActiveElapsedState,
  input: SseActiveElapsedInput,
): SseActiveElapsedState {
  if (!input.key) return { key: "", elapsedMs: 0 }
  if (!Number.isFinite(input.activityAt) || input.activityAt <= 0) {
    throw new Error(`SSE active elapsed activity timestamp must be positive, got ${input.activityAt}`)
  }
  if (!input.active) {
    if (state.key === input.key) return state
    return { key: input.key, elapsedMs: 0 }
  }
  if (!Number.isFinite(input.startedAt) || input.startedAt <= 0) {
    throw new Error(`SSE active elapsed start timestamp must be positive, got ${input.startedAt}`)
  }

  const previousObserved = state.key === input.key ? state.observedAt : undefined
  const observedAt =
    previousObserved === undefined ? input.activityAt : Math.max(previousObserved, input.activityAt)
  return {
    key: input.key,
    elapsedMs: Math.max(0, observedAt - input.startedAt),
    startedAt: input.startedAt,
    observedAt,
  }
}

export function pauseSseActiveElapsed(state: SseActiveElapsedState, key: string): SseActiveElapsedState {
  if (!key) return { key: "", elapsedMs: 0 }
  if (state.key !== key) return { key, elapsedMs: 0 }
  return state
}

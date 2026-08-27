let selectedLiveCursor = 0
let selectedLiveEpoch: number | undefined

function nonnegativeInteger(value: unknown): number | undefined {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined
}

export function resetSelectedLiveCursor(): void {
  selectedLiveCursor = 0
  selectedLiveEpoch = undefined
}

export function selectedLiveReplayQuery(options: { include?: boolean } = {}): Record<string, string> {
  if (options.include === false) return {}
  return {
    after_live: String(selectedLiveCursor),
    ...(selectedLiveEpoch !== undefined ? { after_live_epoch: String(selectedLiveEpoch) } : {}),
  }
}

export function selectedLiveCursorSnapshot(): { liveSequence: number; liveEpoch?: number } {
  return {
    liveSequence: selectedLiveCursor,
    ...(selectedLiveEpoch !== undefined ? { liveEpoch: selectedLiveEpoch } : {}),
  }
}

export function markSelectedLiveEventConsumed(event: any): void {
  const liveSequence = nonnegativeInteger(event?.live_sequence)
  if (liveSequence === undefined || liveSequence === 0) return
  if (liveSequence > selectedLiveCursor) selectedLiveCursor = liveSequence
  const liveEpoch = nonnegativeInteger(event?.live_epoch)
  if (liveEpoch !== undefined && liveEpoch > 0) selectedLiveEpoch = liveEpoch
}

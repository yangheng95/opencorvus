export type MissionPartRow = {
  id: string
  t: string | null
  tool: string | null
  st: string | null
  title: string | null
  text: string | null
  time_updated: number | null
}

export const MISSION_E2E_INACTIVITY_TIMEOUT_MS = 6 * 60 * 1000
export const MISSION_E2E_CANCEL_SETTLE_TIMEOUT_MS = 30 * 1000

export type MissionPartActivity = Map<string, string>

function partActivitySignature(p: MissionPartRow): string {
  return JSON.stringify([p.t || "", p.tool || "", p.st || "", p.title || "", p.text || "", p.time_updated || 0])
}

export function observeMissionParts(opts: {
  rows: MissionPartRow[]
  seen: MissionPartActivity
  prompt: string
  emit: (message: string) => void
  stamp: (message: string) => string
}): number {
  let activity = 0
  for (const p of opts.rows) {
    const signature = partActivitySignature(p)
    if (opts.seen.get(p.id) === signature) continue
    opts.seen.set(p.id, signature)
    activity++
    if (p.t === "tool") {
      opts.emit(opts.stamp(`  TOOL ${p.tool} [${p.st || "-"}] ${(p.title || "").slice(0, 100)}`))
    } else if (p.t === "text" && p.text && p.text !== opts.prompt) {
      opts.emit(opts.stamp(`  TEXT ${String(p.text).replace(/\s+/g, " ").slice(0, 220)}`))
    }
  }
  return activity
}

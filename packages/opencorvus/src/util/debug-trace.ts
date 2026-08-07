import { SessionObservability } from "./session-observability"

const syncEnabled = process.env.OPENCORVUS_FS_SYNC_TRACE === "1"
const busEnabled = process.env.OPENCORVUS_BUS_DISPATCH_TRACE === "1"

const syncCount = new Map<string, number>()

function line(tag: string, data: Record<string, unknown>) {
  const body = Object.entries({
    ...data,
    ...SessionObservability.traceTags(),
  })
    .filter((entry) => entry[1] !== undefined)
    .map((entry) => `${entry[0]}=${JSON.stringify(entry[1])}`)
    .join(" ")
  if (!body) {
    process.stderr.write(`[${tag}]` + "\n")
    return
  }
  process.stderr.write(`[${tag}] ${body}` + "\n")
}

export function traceSync(name: string, data: Record<string, unknown> = {}) {
  if (!syncEnabled) return
  const count = (syncCount.get(name) ?? 0) + 1
  syncCount.set(name, count)
  if (count > 10 && count % 1000 !== 0) return
  line("fs-sync-trace", {
    name,
    count,
    ...data,
  })
}

export function traceBus(data: Record<string, unknown>) {
  if (!busEnabled) return
  line("bus-dispatch-trace", data)
}

export function isBusTraceEnabled() {
  return busEnabled
}

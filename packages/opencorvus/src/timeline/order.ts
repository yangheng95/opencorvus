export type TimelineOrderDomain =
  | "task"
  | "control"
  | "message"
  | "part"
  | "protocol"
  | "session"
  | "board_goal"
  | "interaction"

const DOMAIN_RANK: Record<TimelineOrderDomain, number> = {
  task: 10,
  control: 20,
  message: 30,
  part: 31,
  protocol: 40,
  session: 50,
  board_goal: 60,
  interaction: 70,
}

function positiveInteger(value: unknown, label: string): number {
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`timeline order ${label} must be a positive integer`)
  }
  return number
}

function nonnegativeInteger(value: unknown, label: string): number {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`timeline order ${label} must be a nonnegative integer`)
  }
  return number
}

function entityID(value: unknown): string {
  const id = String(value || "").trim()
  if (!id) throw new Error("timeline order entity id is required")
  if (id.includes(":")) {
    throw new Error(`timeline order entity id must not contain colon: ${id}`)
  }
  return id
}

function pad(value: number): string {
  return String(value).padStart(16, "0")
}

export function timelineOrderKey(input: {
  domain: TimelineOrderDomain
  time: number
  id: string
  sequence?: number
}): string {
  const rank = DOMAIN_RANK[input.domain]
  if (rank === undefined) throw new Error(`timeline order domain is unknown: ${input.domain}`)
  const time = positiveInteger(input.time, "time")
  const sequence = input.sequence == null ? 0 : nonnegativeInteger(input.sequence, "sequence")
  return `v1:${pad(time)}:${pad(rank)}:${pad(sequence)}:${input.domain}:${entityID(input.id)}`
}

export function timelineMessageOrderKey(message: { info?: { id?: unknown; time?: { created?: unknown } } }): string {
  const info = message?.info
  return timelineOrderKey({
    domain: "message",
    time: positiveInteger(info?.time?.created, "message time.created"),
    id: entityID(info?.id),
  })
}

export function timelinePartOrderKey(part: { id?: unknown; timeCreated?: unknown }): string {
  return timelineOrderKey({
    domain: "part",
    time: positiveInteger(part?.timeCreated, "part time_created"),
    id: entityID(part?.id),
  })
}

export function timelineInteractionResponseOrderKey(input: { id: unknown; timeResolved: unknown }): string {
  return timelineOrderKey({
    domain: "interaction",
    time: positiveInteger(input.timeResolved, "interaction time_resolved"),
    id: `${entityID(input.id)}_response`,
  })
}

export function compareTimelineOrderKeys(left: string, right: string): number {
  const a = String(left || "").trim()
  const b = String(right || "").trim()
  if (!a) throw new Error("timeline order key is required")
  if (!b) throw new Error("timeline order key is required")
  if (!a.startsWith("v1:")) throw new Error(`timeline order key has unsupported version: ${a}`)
  if (!b.startsWith("v1:")) throw new Error(`timeline order key has unsupported version: ${b}`)
  return compareCanonicalStrings(a, b)
}

export function timelineOrderKeyDomain(value: unknown, label = "timeline order key"): TimelineOrderDomain {
  const key = String(value || "").trim()
  if (!key) throw new Error(`${label} is required`)
  if (!key.startsWith("v1:")) throw new Error(`${label} has unsupported version: ${key}`)
  const domain = key.split(":", 6)[4] || ""
  if (!(domain in DOMAIN_RANK)) throw new Error(`${label} has unknown domain: ${key}`)
  return domain as TimelineOrderDomain
}

export function requireTimelineOrderKeyDomain(
  value: unknown,
  label: string,
  expectedDomain: TimelineOrderDomain,
): string {
  const key = String(value || "").trim()
  const actualDomain = timelineOrderKeyDomain(key, label)
  if (actualDomain !== expectedDomain) {
    throw new Error(`${label} expected ${expectedDomain} orderKey, got ${actualDomain}: ${key}`)
  }
  return key
}

export function compareTimelineOrderedItems(left: { orderKey?: unknown }, right: { orderKey?: unknown }): number {
  const leftKey = typeof left?.orderKey === "string" ? left.orderKey : ""
  const rightKey = typeof right?.orderKey === "string" ? right.orderKey : ""
  return compareTimelineOrderKeys(leftKey, rightKey)
}
import { compareCanonicalStrings } from "@/util/canonical-digest"

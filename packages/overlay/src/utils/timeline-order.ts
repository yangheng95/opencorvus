export function requireTimelineOrderKey(value: unknown, label: string): string {
  const key = typeof value === "string" ? value.trim() : ""
  if (!key) throw new Error(`${label} missing orderKey`)
  if (!key.startsWith("v1:")) throw new Error(`${label} has unsupported orderKey: ${key}`)
  return key
}

export function timelineOrderKeyDomain(value: unknown, label: string): string {
  const key = requireTimelineOrderKey(value, label)
  const domain = key.split(":", 6)[4] || ""
  if (!domain) throw new Error(`${label} missing orderKey domain: ${key}`)
  return domain
}

export function timelineOrderKeyTime(value: unknown, label: string): number {
  const key = requireTimelineOrderKey(value, label)
  const raw = key.split(":", 3)[1] || ""
  const time = Number(raw)
  if (!Number.isFinite(time) || time <= 0) throw new Error(`${label} missing positive orderKey time: ${key}`)
  return time
}

export function requireTimelineOrderKeyDomain(value: unknown, label: string, expectedDomain: string): string {
  const key = requireTimelineOrderKey(value, label)
  const domain = timelineOrderKeyDomain(key, label)
  if (domain !== expectedDomain) {
    throw new Error(`${label} expected ${expectedDomain} orderKey, got ${domain}: ${key}`)
  }
  return key
}

export function compareTimelineOrderKeys(left: unknown, right: unknown, label = "timeline item"): number {
  return requireTimelineOrderKey(left, `${label} left`).localeCompare(requireTimelineOrderKey(right, `${label} right`))
}

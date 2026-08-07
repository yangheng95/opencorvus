import fs from "node:fs/promises"
import path from "node:path"

export type SoakConfig = {
  schemaVersion: 1
  warmupMs: number
  snapshotCadenceMs: number
  idleSettleMs: number
  controlDurationMs: number
  shortSoakDurationMs: number
  overnightDurationMs: number
  controlRuns: number
  browserCycles: number
  lspQueries: number
}

export type ProcessRow = {
  pid: number
  ppid: number
  pgid: number
  rssBytes: number
  command: string
}

export function parseProcessTable(raw: string): ProcessRow[] {
  const rows: ProcessRow[] = []
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/)
    if (!match) continue
    rows.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      pgid: Number(match[3]),
      rssBytes: Number(match[4]) * 1024,
      command: match[5]!,
    })
  }
  return rows
}

export function processTree(rows: readonly ProcessRow[], rootPids: readonly number[]): ProcessRow[] {
  const selected = new Set(rootPids)
  let changed = true
  while (changed) {
    changed = false
    for (const row of rows) {
      if (selected.has(row.pid) || !selected.has(row.ppid)) continue
      selected.add(row.pid)
      changed = true
    }
  }
  return rows.filter((row) => selected.has(row.pid)).sort((a, b) => a.pid - b.pid)
}

export function footprintsAboveControlCeiling(
  samples: readonly number[],
  maxPhysicalFootprintBytes: number,
): number[] {
  return samples.filter((sample) => sample > maxPhysicalFootprintBytes)
}

export function classifyProcess(command: string): "chromium" | "browser-node" | "lsp" | "serve" | "other" {
  const normalized = command.toLowerCase()
  if (normalized.includes("chromium") || normalized.includes("google chrome")) return "chromium"
  if (
    normalized.includes("browser-mcp") ||
    normalized.includes("mcp/browser") ||
    normalized.includes("mcp browser")
  )
    return "browser-node"
  if (
    normalized.includes("typescript-language-server") ||
    normalized.includes("/tsserver.js") ||
    normalized.includes("/typingsinstaller.js") ||
    normalized.includes("vscode-eslint-language-server") ||
    normalized.includes("eslint-language-server") ||
    normalized.includes("/eslintserver.js")
  )
    return "lsp"
  if (/\/opencorvus\s+serve\b/.test(normalized) || /^opencorvus\s+serve\b/.test(normalized)) return "serve"
  return "other"
}

export async function directoryBytes(root: string): Promise<number> {
  let total = 0
  const pending = [root]
  while (pending.length > 0) {
    const current = pending.pop()!
    let entries: Awaited<ReturnType<typeof fs.readdir>>
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const absolute = path.join(current, entry.name)
      if (entry.isDirectory()) {
        pending.push(absolute)
        continue
      }
      if (!entry.isFile()) continue
      try {
        total += (await fs.stat(absolute)).size
      } catch {}
    }
  }
  return total
}

export async function fileBytes(file: string): Promise<number> {
  try {
    return (await fs.stat(file)).size
  } catch {
    return 0
  }
}

export function validateConfig(value: unknown): SoakConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Runtime memory soak config must be an object")
  }
  const input = value as Record<string, unknown>
  if (input.schemaVersion !== 1) throw new Error("Runtime memory soak config schemaVersion must be 1")
  const fields = [
    "warmupMs",
    "snapshotCadenceMs",
    "idleSettleMs",
    "controlDurationMs",
    "shortSoakDurationMs",
    "overnightDurationMs",
    "controlRuns",
    "browserCycles",
    "lspQueries",
  ] as const
  for (const field of fields) {
    if (!Number.isInteger(input[field]) || (input[field] as number) <= 0) {
      throw new Error(`Runtime memory soak config ${field} must be a positive integer`)
    }
  }
  return input as SoakConfig
}

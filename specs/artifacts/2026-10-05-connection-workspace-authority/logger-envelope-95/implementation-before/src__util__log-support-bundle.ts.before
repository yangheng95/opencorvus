import fs from "node:fs/promises"
import path from "node:path"
import { BlobWriter, TextReader, Uint8ArrayReader, ZipWriter } from "@zip.js/zip.js"
import { Installation } from "@/installation"
import { Log } from "./log"

type LevelCounts = Record<string, number>

type FormattedLog = {
  text: string
  lineCount: number
  parsedLineCount: number
  unparsedLineCount: number
  levelCounts: LevelCounts
  services: string[]
  firstTimestamp: string | null
  lastTimestamp: string | null
}

export type LogSupportBundleManifest = {
  schema: "opencorvus.log-support-bundle.v1"
  exportedAt: string
  application: {
    version: string
    channel: string
  }
  runtime: {
    platform: NodeJS.Platform
    architecture: string
    bun: string
  }
  source: {
    directory: string
    current: string
    retention: string
  }
  totals: {
    fileCount: number
    byteCount: number
    lineCount: number
    parsedLineCount: number
    unparsedLineCount: number
    levelCounts: LevelCounts
  }
  files: Array<{
    name: string
    current: boolean
    size: number
    modified: string
    lineCount: number
    parsedLineCount: number
    unparsedLineCount: number
    levelCounts: LevelCounts
    services: string[]
    firstTimestamp: string | null
    lastTimestamp: string | null
    rawPath: string
    formattedPath: string
  }>
}

export type LogSupportBundle = {
  bytes: Uint8Array
  filename: string
  manifest: LogSupportBundleManifest
}

const RAW_ROOT = "logs/raw"
const FORMATTED_ROOT = "logs/formatted"

function archivePath(root: string, name: string): string {
  return `${root}/${name}`.replace(/\\/g, "/")
}

function increment(counts: LevelCounts, value: string): void {
  counts[value] = (counts[value] ?? 0) + 1
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function timestampField(record: Record<string, unknown>): string | undefined {
  return stringField(record, "time") ?? stringField(record, "timestamp") ?? stringField(record, "ts")
}

function sortedDetails(record: Record<string, unknown>): Record<string, unknown> {
  const details: Record<string, unknown> = {}
  for (const key of Object.keys(record).sort()) {
    if (key === "time" || key === "timestamp" || key === "ts") continue
    if (key === "level" || key === "service" || key === "message") continue
    details[key] = record[key]
  }
  return details
}

function formatLog(raw: string): FormattedLog {
  const lines = raw.split(/\r?\n/)
  if (lines.at(-1) === "") lines.pop()
  const formatted: string[] = []
  const levelCounts: LevelCounts = {}
  const services = new Set<string>()
  const timestamps: string[] = []
  let parsedLineCount = 0
  let unparsedLineCount = 0

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    try {
      const value = JSON.parse(line) as unknown
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("record is not an object")
      const record = value as Record<string, unknown>
      const timestamp = timestampField(record) ?? "timestamp-unavailable"
      const level = (stringField(record, "level") ?? "unknown").toUpperCase()
      const service = stringField(record, "service") ?? "unknown-service"
      const message = stringField(record, "message") ?? "(no message)"
      const details = sortedDetails(record)

      parsedLineCount++
      increment(levelCounts, level)
      services.add(service)
      if (timestamp !== "timestamp-unavailable") timestamps.push(timestamp)
      formatted.push(`[${timestamp}] ${level.padEnd(5)} [${service}] ${message}`)
      if (Object.keys(details).length > 0) {
        formatted.push(
          ...JSON.stringify(details, null, 2)
            .split("\n")
            .map((detailLine) => `  ${detailLine}`),
        )
      }
    } catch {
      unparsedLineCount++
      formatted.push(`[unparsed line ${index + 1}] ${line}`)
    }
    formatted.push("")
  }

  return {
    text: formatted.join("\n"),
    lineCount: lines.length,
    parsedLineCount,
    unparsedLineCount,
    levelCounts,
    services: [...services].sort(),
    firstTimestamp: timestamps[0] ?? null,
    lastTimestamp: timestamps.at(-1) ?? null,
  }
}

function mergeCounts(target: LevelCounts, source: LevelCounts): void {
  for (const [level, count] of Object.entries(source)) {
    target[level] = (target[level] ?? 0) + count
  }
}

function filenameForExport(exportedAt: string): string {
  return `opencorvus-log-support-${exportedAt.replace(/\.\d{3}Z$/, "Z").replace(/[-:]/g, "")}.zip`
}

function readme(manifest: LogSupportBundleManifest): string {
  return [
    "OpenCorvus Log Support Bundle",
    "==============================",
    "",
    `Exported: ${manifest.exportedAt}`,
    `OpenCorvus: ${manifest.application.version} (${manifest.application.channel})`,
    `Runtime: Bun ${manifest.runtime.bun}, ${manifest.runtime.platform}/${manifest.runtime.architecture}`,
    `Files: ${manifest.totals.fileCount}`,
    `Lines: ${manifest.totals.lineCount} parsed=${manifest.totals.parsedLineCount} unparsed=${manifest.totals.unparsedLineCount}`,
    "",
    "Contents",
    "--------",
    "- manifest.json: structured bundle metadata and per-file diagnostics.",
    "- logs/raw/: byte-exact retained Pino JSON log files.",
    "- logs/formatted/: deterministic human-readable renderings of the same files.",
    "",
    "Unparsed records are preserved and marked with their original line number.",
    "Raw and formatted logs can contain local paths, project content, prompts, and error details.",
    "Review the bundle before sharing it outside your organization.",
    "",
  ].join("\n")
}

export async function buildLogSupportBundle(): Promise<LogSupportBundle> {
  await Log.flush()
  const files = await Log.files()
  const exportedAt = new Date().toISOString()
  const totals: LogSupportBundleManifest["totals"] = {
    fileCount: files.length,
    byteCount: 0,
    lineCount: 0,
    parsedLineCount: 0,
    unparsedLineCount: 0,
    levelCounts: {},
  }
  const snapshots = await Promise.all(
    files.map(async (file) => {
      const bytes = new Uint8Array(await fs.readFile(file.path))
      const formatted = formatLog(new TextDecoder().decode(bytes))
      totals.byteCount += bytes.byteLength
      totals.lineCount += formatted.lineCount
      totals.parsedLineCount += formatted.parsedLineCount
      totals.unparsedLineCount += formatted.unparsedLineCount
      mergeCounts(totals.levelCounts, formatted.levelCounts)
      return { file, bytes, formatted }
    }),
  )
  const manifest: LogSupportBundleManifest = {
    schema: "opencorvus.log-support-bundle.v1",
    exportedAt,
    application: {
      version: Installation.VERSION,
      channel: Installation.CHANNEL,
    },
    runtime: {
      platform: process.platform,
      architecture: process.arch,
      bun: process.versions.bun ?? "unavailable",
    },
    source: {
      directory: Log.directory(),
      current: Log.file(),
      retention: "current log plus the 10 most recently modified production logs; dev.log is retained separately",
    },
    totals,
    files: snapshots.map(({ file, bytes, formatted }) => ({
      name: file.name,
      current: file.current,
      size: bytes.byteLength,
      modified: file.modified,
      lineCount: formatted.lineCount,
      parsedLineCount: formatted.parsedLineCount,
      unparsedLineCount: formatted.unparsedLineCount,
      levelCounts: formatted.levelCounts,
      services: formatted.services,
      firstTimestamp: formatted.firstTimestamp,
      lastTimestamp: formatted.lastTimestamp,
      rawPath: archivePath(RAW_ROOT, file.name),
      formattedPath: archivePath(FORMATTED_ROOT, file.name),
    })),
  }

  const zip = new ZipWriter(new BlobWriter("application/zip"))
  await zip.add("README.txt", new TextReader(readme(manifest)))
  await zip.add("manifest.json", new TextReader(`${JSON.stringify(manifest, null, 2)}\n`))
  for (const snapshot of snapshots) {
    await zip.add(archivePath(RAW_ROOT, snapshot.file.name), new Uint8ArrayReader(snapshot.bytes))
    await zip.add(archivePath(FORMATTED_ROOT, snapshot.file.name), new TextReader(snapshot.formatted.text))
  }
  const blob = await zip.close()
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    filename: filenameForExport(exportedAt),
    manifest,
  }
}

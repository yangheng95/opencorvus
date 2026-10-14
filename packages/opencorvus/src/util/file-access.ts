import fs from "node:fs/promises"
import path from "node:path"
import { Filesystem } from "./filesystem"
import { readFileEntry, type FileEntry } from "./file-entry"

export type FileAccessEntry = {
  position: string
  entry?: FileEntry
  text?: string
  possible?: boolean
}

export type FileAccessLookup = (parent: string, name: string) => Promise<FileAccessEntry[]>

export function filePosition(input: string) {
  return Filesystem.normalizeWindowsPath(input)
}

export function filePositionKey(input: string) {
  const value = path.normalize(filePosition(input))
  return process.platform === "win32" ? value.toLowerCase() : value
}

export function isShortFileName(input: string) {
  if (Array.from(input).some((char) => char.charCodeAt(0) >= 0x80 || char === " ")) return false
  const parts = input.split(".")
  return (
    parts.length <= 2 &&
    parts[0]!.length >= 1 &&
    parts[0]!.length <= 8 &&
    (parts.length === 1 || (parts[1]!.length >= 1 && parts[1]!.length <= 3))
  )
}

export async function lookupFileAccess(parent: string, name: string): Promise<FileAccessEntry[]> {
  const position = path.join(parent, name)
  try {
    const entry = await readFileEntry(position)
    return [
      {
        position: filePosition(entry.stat.isDirectory() && !entry.link ? await fs.realpath(position) : entry.address),
        entry,
        ...(entry.link ? { text: await fs.readlink(position) } : {}),
      },
    ]
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR"))
      return [{ position }]
    throw error
  }
}

export type FileAccessState = FileAccessEntry & { namespace: string; hops: number }

/** Resolve access namespaces against actual entries or an explicit finite tree view.
 * Every possible result must be checked by the caller; none is a preferred result. */
export async function walkFileAccess(
  raw: string,
  options: { lookup?: FileAccessLookup; observe?: (entry: FileEntry) => void } = {},
): Promise<FileAccessState[]> {
  // Native pathname contracts, not a configurable application retry policy.
  const maximum = { win32: 63, linux: 40, darwin: 32 }[process.platform as "win32" | "linux" | "darwin"]
  if (!maximum)
    throw Object.assign(new Error(`Unsupported file access platform: ${process.platform}`), { code: "ENOTSUP" })
  const lookup = options.lookup ?? lookupFileAccess
  const active = new Set<string>()
  const recursive = (operand: string, possible: boolean) =>
    Object.assign(new Error(`Recursive file access state: ${operand}`), { code: "ELOOP", path: operand, possible })
  async function resolve(operand: string, hops: number, possible: boolean): Promise<FileAccessState[]> {
    operand = process.platform === "win32" ? path.resolve(operand) : operand
    const key = operand
    if (active.has(key)) throw recursive(operand, possible)
    active.add(key)
    try {
      const root = path.parse(operand).root
      let states: FileAccessState[] = [
        { namespace: root, position: root, hops, possible, entry: (await lookupFileAccess(root, "."))[0]!.entry },
      ]
      const components = operand.slice(root.length).split(process.platform === "win32" ? /[\\/]/ : /\//)
      for (const name of components) {
        if (!name || name === ".") continue
        const next: FileAccessState[] = []
        for (const state of states) {
          if (name === "..") {
            const position = path.dirname(state.position)
            if (!state.entry || !state.entry.stat.isDirectory()) {
              next.push({ ...state, namespace: position, position, entry: undefined })
              continue
            }
            const parent = path.dirname(position)
            const parents =
              parent === position
                ? await lookupFileAccess(position, ".")
                : await lookup(parent, path.basename(position))
            next.push(
              ...parents.map((item) => ({
                ...item,
                namespace: item.position,
                hops: state.hops,
                possible: Boolean(state.possible || item.possible),
              })),
            )
            continue
          }
          if (!state.entry || !state.entry.stat.isDirectory()) {
            next.push({
              namespace: path.join(state.namespace, name),
              position: path.join(state.position, name),
              hops: state.hops,
              possible: state.possible,
            })
            continue
          }
          for (const item of await lookup(state.position, name)) {
            const namespace = path.join(state.namespace, name),
              uncertain = Boolean(state.possible || item.possible)
            if (!item.entry) {
              next.push({ ...item, namespace, hops: state.hops, possible: uncertain })
              continue
            }
            options.observe?.(item.entry)
            if (!item.entry.link) {
              next.push({ ...item, namespace, hops: state.hops, possible: uncertain })
              continue
            }
            if (state.hops >= maximum) throw recursive(namespace, uncertain)
            const text = item.text!
            const expanded =
              process.platform === "win32"
                ? path.resolve(state.namespace, text)
                : path.isAbsolute(text)
                  ? text
                  : `${state.namespace}${path.sep}${text}`
            const resolved = await resolve(expanded, state.hops + 1, uncertain)
            next.push(
              ...resolved.map((result) => ({
                ...result,
                namespace: item.entry!.link === "junction" ? namespace : result.namespace,
              })),
            )
          }
        }
        states = next
      }
      return states
    } finally {
      active.delete(key)
    }
  }
  return resolve(filePosition(raw), 0, false)
}

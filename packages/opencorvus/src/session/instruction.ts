import path from "path"
import os from "os"
import { readdir } from "fs/promises"
import { Global } from "../global"
import { Filesystem } from "../util/filesystem"
import { EffectiveConfig } from "../config/effective"
import { Instance } from "../project/instance"
import { createInstanceState } from "../project/instance-state"
import { Flag } from "@/flag/flag"
import { Log } from "../util/log"
import { Glob } from "../util/glob"
import type { Message } from "./message"
import { ConfigMarkdown } from "@/config/markdown"

const log = Log.create({ service: "instruction" })

const FILES = ["AGENTS.md", "AGENT.md", "CLAUDE.md"]

function isEnoent(error: unknown) {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "ENOENT"
}

async function findNamedFiles(dir: string, filename: string): Promise<string[]> {
  const exact = path.join(dir, filename)
  if (await Filesystem.exists(exact)) return [Filesystem.normalizePath(exact)]
  const lower = filename.toLowerCase()
  const entries = await readdir(dir, { withFileTypes: true }).catch((error) => {
    if (isEnoent(error)) return []
    throw error
  })
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase() === lower)
    .map((entry) => Filesystem.normalizePath(path.join(dir, entry.name)))
    .sort((a, b) => a.localeCompare(b))
}

async function findInstructionFilesInDir(dir: string, files = FILES): Promise<string[]> {
  const result: string[] = []
  for (const file of files) {
    result.push(...(await findNamedFiles(dir, file)))
  }
  return result
}

async function findUpInstructionFiles(target: string, start: string, stop?: string) {
  let current = start
  const result: string[] = []
  while (true) {
    result.push(...(await findNamedFiles(current, target)))
    if (stop === current) break
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return result
}

async function firstGlobalInstructionFile(): Promise<string | undefined> {
  const roots: Array<{ dir: string; files?: string[] }> = []
  if (Flag.OPENCORVUS_CONFIG_DIR) roots.push({ dir: Flag.OPENCORVUS_CONFIG_DIR })
  roots.push({ dir: Global.Path.config })
  if (!Flag.OPENCORVUS_DISABLE_CLAUDE_CODE_PROMPT) {
    roots.push({ dir: path.join(os.homedir(), ".claude"), files: ["CLAUDE.md"] })
  }
  for (const root of roots) {
    const matches = await findInstructionFilesInDir(root.dir, root.files)
    if (matches.length > 0) return matches[0]
  }
}

async function resolveRelative(instruction: string): Promise<string[]> {
  if (!Flag.OPENCORVUS_DISABLE_PROJECT_CONFIG) {
    return Filesystem.globUp(instruction, Instance.directory, Instance.worktree)
  }
  if (!Flag.OPENCORVUS_CONFIG_DIR) {
    log.warn(
      `Skipping relative instruction "${instruction}" - no OPENCORVUS_CONFIG_DIR set while project config is disabled`,
    )
    return []
  }
  return Filesystem.globUp(instruction, Flag.OPENCORVUS_CONFIG_DIR, Flag.OPENCORVUS_CONFIG_DIR).catch(() => [])
}

export namespace InstructionPrompt {
  const state = createInstanceState(() => {
    return {
      claims: new Map<string, Set<string>>(),
    }
  }, undefined, "session-instruction")

  function isClaimed(messageID: string, filepath: string) {
    const claimed = state().claims.get(messageID)
    if (!claimed) return false
    return claimed.has(filepath)
  }

  function claim(messageID: string, filepath: string) {
    const current = state()
    let claimed = current.claims.get(messageID)
    if (!claimed) {
      claimed = new Set()
      current.claims.set(messageID, claimed)
    }
    claimed.add(filepath)
  }

  export function clear(messageID: string) {
    state().claims.delete(messageID)
  }

  export async function systemPaths() {
    const config = await EffectiveConfig.effective()
    const paths = new Set<string>()

    const globalFile = await firstGlobalInstructionFile()
    if (globalFile) paths.add(path.resolve(globalFile))

    if (!Flag.OPENCORVUS_DISABLE_PROJECT_CONFIG) {
      for (const file of FILES) {
        const matches = await findUpInstructionFiles(file, Instance.directory, Instance.worktree)
        matches.forEach((p) => {
          paths.add(path.resolve(p))
        })
      }
    }

    if (config.instructions) {
      for (let instruction of config.instructions) {
        if (instruction.startsWith("https://") || instruction.startsWith("http://")) continue
        if (instruction.startsWith("~/")) {
          instruction = path.join(os.homedir(), instruction.slice(2))
        }
        const matches = path.isAbsolute(instruction)
          ? await Glob.scan(path.basename(instruction), {
              cwd: path.dirname(instruction),
              absolute: true,
              include: "file",
            })
          : await resolveRelative(instruction)
        matches.forEach((p) => {
          paths.add(path.resolve(p))
        })
      }
    }

    return paths
  }

  async function resolveReference(filepath: string, reference: string): Promise<string | undefined> {
    const target = reference.startsWith("~/")
      ? path.join(os.homedir(), reference.slice(2))
      : path.isAbsolute(reference)
        ? reference
        : path.resolve(path.dirname(filepath), reference)
    if (await Filesystem.exists(target)) return path.resolve(Filesystem.normalizePath(target))
    const matches = await findNamedFiles(path.dirname(target), path.basename(target))
    return matches[0] ? path.resolve(matches[0]) : undefined
  }

  function visitedKey(filepath: string) {
    const resolved = path.resolve(filepath)
    return process.platform === "win32" ? resolved.toLowerCase() : resolved
  }

  async function renderInstructionFile(filepath: string, visited = new Set<string>()): Promise<string> {
    const key = visitedKey(filepath)
    if (visited.has(key)) return ""
    visited.add(key)

    const content = await Filesystem.readText(filepath).catch((error) => {
      throw new Error(
        `Failed to read instruction file ${filepath}: ${error instanceof Error ? error.message : String(error)}`,
        {
          cause: error,
        },
      )
    })
    if (!content) return ""

    const includes: string[] = []
    const seenRefs = new Set<string>()
    for (const match of ConfigMarkdown.files(content)) {
      const ref = match[1]
      if (ref.startsWith("https://") || ref.startsWith("http://")) continue
      const resolved = await resolveReference(filepath, ref)
      if (!resolved) continue
      const refKey = visitedKey(resolved)
      if (seenRefs.has(refKey)) continue
      seenRefs.add(refKey)
      const rendered = await renderInstructionFile(resolved, visited)
      if (rendered) includes.push(rendered)
    }

    return ["Instructions from: " + filepath, content, ...includes].filter(Boolean).join("\n")
  }

  export async function system() {
    const config = await EffectiveConfig.effective()
    const paths = await systemPaths()

    const visited = new Set<string>()
    const files: string[] = []
    for (const p of paths) {
      const rendered = await renderInstructionFile(p, visited)
      if (rendered) files.push(rendered)
    }

    const urls: string[] = []
    if (config.instructions) {
      for (const instruction of config.instructions) {
        if (instruction.startsWith("https://") || instruction.startsWith("http://")) {
          urls.push(instruction)
        }
      }
    }
    const fetches = urls.map((url) =>
      fetch(url, { signal: AbortSignal.timeout(5000) })
        .then((res) => {
          if (!res.ok) throw new Error(`Instruction URL ${url} returned HTTP ${res.status}`)
          return res.text()
        })
        .catch((error) => {
          throw new Error(
            `Failed to load instruction URL ${url}: ${error instanceof Error ? error.message : String(error)}`,
            {
              cause: error,
            },
          )
        })
        .then((x) => (x ? "Instructions from: " + url + "\n" + x : "")),
    )

    return Promise.all([...files, ...fetches]).then((result) => result.filter(Boolean))
  }

  export function loaded(messages: Message.WithParts[]) {
    const paths = new Set<string>()
    for (const msg of messages) {
      for (const part of msg.parts) {
        if (part.type === "tool" && part.tool === "read" && part.state.status === "completed") {
          if (part.state.time.compacted) continue
          const loaded = part.state.metadata?.loaded
          if (!loaded || !Array.isArray(loaded)) continue
          for (const p of loaded) {
            if (typeof p === "string") paths.add(p)
          }
        }
      }
    }
    return paths
  }

  export async function find(dir: string) {
    for (const file of FILES) {
      const matches = await findNamedFiles(dir, file)
      if (matches[0]) return path.resolve(matches[0])
    }
  }

  export async function resolve(messages: Message.WithParts[], filepath: string, messageID: string) {
    const system = await systemPaths()
    const already = loaded(messages)
    const results: { filepath: string; content: string }[] = []

    const target = path.resolve(filepath)
    let current = path.dirname(target)
    const root = path.resolve(Instance.directory)

    while (current.startsWith(root) && current !== root) {
      const found = await find(current)

      if (found && found !== target && !system.has(found) && !already.has(found) && !isClaimed(messageID, found)) {
        claim(messageID, found)
        const content = await renderInstructionFile(found)
        if (content) {
          results.push({ filepath: found, content })
        }
      }
      current = path.dirname(current)
    }

    return results
  }
}

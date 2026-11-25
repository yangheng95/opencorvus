import { fn } from "@/util/fn"
import { isUtf8 } from "node:buffer"
import z from "zod"
import { Log } from "@/util/log"
import { Session } from "."

import { Message } from "./message"
import { Identifier } from "@/id/id"
import { Snapshot } from "@/snapshot"
import { FileDiff, SavedSnapshotFileDiff } from "@/snapshot/types"

import { Bus } from "@/bus"
import { Filesystem } from "@/util/filesystem"
import { withSharedJsonFactLock } from "@/util/process-lock"
import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"

export namespace SessionSummary {
  const log = Log.create({ service: "session.summary" })
  const legacyDiff = FileDiff.omit({ comparisonKind: true }).loose().array()
  const storedDiff = z.strictObject({
    version: z.literal(2),
    changes: SavedSnapshotFileDiff.loose().array(),
  })
  const emptyDiff: z.infer<typeof storedDiff> = { version: 2, changes: [] }
  const diffLocks = new Map<string, Promise<unknown>>()
  const gitPathEscapes: Record<string, string> = {
    a: "\x07", b: "\b", t: "\t", n: "\n", v: "\v", f: "\f", r: "\r", '"': '"', "\\": "\\",
  }

  function diffPath(sessionID: string) {
    return ProjectRuntimePaths.sessionDiffPath(Instance.directory, Instance.project.id, sessionID)
  }

  async function readStoredDiff(target: string): Promise<unknown> {
    try {
      return await Filesystem.readJson<unknown>(target)
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return emptyDiff
      throw error
    }
  }

  function withDiffLock<T>(target: string, run: () => Promise<T>): Promise<T> {
    return withSharedJsonFactLock({
      locks: diffLocks,
      filepath: target,
      empty: JSON.stringify(emptyDiff),
      run,
    })
  }

  function writeStoredDiff(target: string, changes: SavedSnapshotFileDiff[]): Promise<void> {
    const record = storedDiff.parse({ version: 2, changes })
    return Filesystem.writeAtomic(target, JSON.stringify(record, null, 2))
  }

  export async function readDiff(sessionID: string): Promise<SavedSnapshotFileDiff[]> {
    const target = diffPath(sessionID)
    const stored = await readStoredDiff(target)
    if (!Array.isArray(stored)) return storedDiff.parse(stored).changes

    return withDiffLock(target, async () => {
      const current = await readStoredDiff(target)
      if (!Array.isArray(current)) return storedDiff.parse(current).changes
      const changes = legacyDiff.parse(current).map((item) => ({
        ...item,
        file: unquoteGitPath(item.file),
        comparisonKind: "unknown" as const,
      }))
      await writeStoredDiff(target, changes)
      return changes
    })
  }

  export async function writeDiff(sessionID: string, diff: SavedSnapshotFileDiff[]): Promise<void> {
    const target = diffPath(sessionID)
    await withDiffLock(target, () => writeStoredDiff(target, diff))
  }

  function storageErrorMessage(error: unknown): string {
    const value = error as NodeJS.ErrnoException
    const message = error instanceof Error ? error.message : String(error)
    return value?.code ? `${value.code}: ${message}` : message
  }

  export async function publishDiff(input: {
    sessionID: string
    diff: SavedSnapshotFileDiff[]
  }): Promise<{ stored: true } | { stored: false; error: string }> {
    try {
      await writeDiff(input.sessionID, input.diff)
    } catch (error) {
      const message = storageErrorMessage(error)
      log.error("session diff storage failed; completed turn remains authoritative", {
        sessionID: input.sessionID,
        error: message,
      })
      return { stored: false, error: message }
    }
    await Bus.publish(Session.Event.Diff, {
      sessionID: input.sessionID,
      diff: input.diff,
    })
    return { stored: true }
  }

  function unquoteGitPath(input: string) {
    if (input.length < 2 || !input.startsWith('"') || !input.endsWith('"')) return input
    // Git can quote a control character while emitting adjacent Unicode as literal UTF-8.
    const parts = input.slice(1, -1).split(/\\([0-3][0-7]{2}|[abtnvfr"\\])/u)
    const bytes: Buffer[] = []
    for (const [index, part] of parts.entries()) {
      if (index % 2 === 0) {
        if (/[\\"]/u.test(part)) return input
        bytes.push(Buffer.from(part))
      } else {
        bytes.push(part.length === 3 ? Buffer.from([parseInt(part, 8)]) : Buffer.from(gitPathEscapes[part]!))
      }
    }
    const decoded = Buffer.concat(bytes)
    return isUtf8(decoded) && !decoded.includes(0) ? decoded.toString() : input
  }

  export const summarize = fn(
    z.object({
      sessionID: z.string(),
      messageID: z.string(),
    }),
    async (input) => {
      const all = await Session.messages({ sessionID: input.sessionID })
      await summarizeSession({ sessionID: input.sessionID, messages: all })
    },
  )

  async function summarizeSession(input: { sessionID: string; messages: Message.WithParts[] }) {
    const diffs = await computeDiff({ messages: input.messages }).catch((err) => {
      log.warn("computeDiff failed; refusing to persist session summary from invalid snapshot state", {
        sessionID: input.sessionID,
        error: err,
      })
      return undefined
    })
    if (!diffs) return
    await Session.setSummary({
      sessionID: input.sessionID,
      summary: {
        additions: diffs.reduce((sum, x) => sum + x.additions, 0),
        deletions: diffs.reduce((sum, x) => sum + x.deletions, 0),
        files: diffs.length,
      },
    }).catch((err) => {
      // Don't take down the diff/event publish below — this is best-effort
      // metadata. But surface the cause so a stuck overlay summary header can
      // be traced to a write failure instead of disappearing silently.
      log.warn("setSummary failed; overlay header may be stale", {
        sessionID: input.sessionID,
        error: err,
      })
    })
    await publishDiff({ sessionID: input.sessionID, diff: diffs })
  }

  export const diff = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message").optional(),
    }),
    (input) => readDiff(input.sessionID),
  )

  export async function computeDiff(input: { messages: Message.WithParts[] }) {
    let from: string | undefined
    let to: string | undefined

    // scan assistant messages to find earliest from and latest to
    // snapshot
    for (const item of input.messages) {
      if (!from) {
        for (const part of item.parts) {
          if (part.type === "step-start" && part.snapshot) {
            from = part.snapshot
            break
          }
        }
      }

      for (const part of item.parts) {
        if (part.type === "step-finish" && part.snapshot) {
          to = part.snapshot
        }
      }
    }

    if (from && to) return Snapshot.diffFull(from, to)
    return []
  }
}

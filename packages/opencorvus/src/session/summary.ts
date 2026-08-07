import { fn } from "@/util/fn"
import z from "zod"
import { Log } from "@/util/log"
import { Session } from "."

import { Message } from "./message"
import { Identifier } from "@/id/id"
import { Snapshot } from "@/snapshot"

import { Bus } from "@/bus"
import { Filesystem } from "@/util/filesystem"
import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"

export namespace SessionSummary {
  const log = Log.create({ service: "session.summary" })

  export async function readDiff(sessionID: string): Promise<Snapshot.FileDiff[]> {
    const target = ProjectRuntimePaths.sessionDiffPath(Instance.directory, Instance.project.id, sessionID)
    try {
      return await Filesystem.readJson<Snapshot.FileDiff[]>(target)
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return []
      throw error
    }
  }

  export async function writeDiff(sessionID: string, diff: Snapshot.FileDiff[]): Promise<void> {
    const target = ProjectRuntimePaths.sessionDiffPath(Instance.directory, Instance.project.id, sessionID)
    await Filesystem.writeAtomic(target, JSON.stringify(diff, null, 2))
  }

  function storageErrorMessage(error: unknown): string {
    const value = error as NodeJS.ErrnoException
    const message = error instanceof Error ? error.message : String(error)
    return value?.code ? `${value.code}: ${message}` : message
  }

  export async function publishDiff(input: {
    sessionID: string
    diff: Snapshot.FileDiff[]
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
    Bus.publish(Session.Event.Diff, {
      sessionID: input.sessionID,
      diff: input.diff,
    })
    return { stored: true }
  }

  function unquoteGitPath(input: string) {
    if (!input.startsWith('"')) return input
    if (!input.endsWith('"')) return input
    const body = input.slice(1, -1)
    const bytes: number[] = []

    for (let i = 0; i < body.length; i++) {
      const char = body[i]!
      if (char !== "\\") {
        bytes.push(char.charCodeAt(0))
        continue
      }

      const next = body[i + 1]
      if (!next) {
        bytes.push("\\".charCodeAt(0))
        continue
      }

      if (next >= "0" && next <= "7") {
        const chunk = body.slice(i + 1, i + 4)
        const match = chunk.match(/^[0-7]{1,3}/)
        if (!match) {
          bytes.push(next.charCodeAt(0))
          i++
          continue
        }
        bytes.push(parseInt(match[0], 8))
        i += match[0].length
        continue
      }

      const escaped =
        next === "n"
          ? "\n"
          : next === "r"
            ? "\r"
            : next === "t"
              ? "\t"
              : next === "b"
                ? "\b"
                : next === "f"
                  ? "\f"
                  : next === "v"
                    ? "\v"
                    : next === "\\" || next === '"'
                      ? next
                      : undefined

      bytes.push((escaped ?? next).charCodeAt(0))
      i++
    }

    return Buffer.from(bytes).toString()
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
    async (input) => {
      const diffs = await readDiff(input.sessionID)
      const next = diffs.map((item) => {
        const file = unquoteGitPath(item.file)
        if (file === item.file) return item
        return {
          ...item,
          file,
        }
      })
      const changed = next.some((item, i) => item.file !== diffs[i]?.file)
      if (changed)
        writeDiff(input.sessionID, next).catch((err) => {
          log.warn("session_diff storage write failed", { sessionID: input.sessionID, error: String(err) })
        })
      return next
    },
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

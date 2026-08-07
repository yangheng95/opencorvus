import z from "zod"
import path from "node:path"
import fs from "node:fs/promises"
import { Tool } from "./tool"
import { MissionID } from "@/mission/schema"
import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Session } from "@/session"

/**
 * Mission state tool — the Mission agent's durable, write-confined memory.
 * See mission split contract.
 *
 * Why this tool instead of giving Mission generic write/edit: Mission may
 * READ and analyse the project (read/glob/search_code/list/lsp), but its
 * only WRITE surface to the workspace is these four files. It must NOT
 * acquire edit/write/apply_patch. Mission does not own bash; runtime command
 * repair belongs to the Orchestrator scheduler and must not become an executor
 * lane (rule 11 — the orchestrator-core contract records how a coordination
 * agent with executor tools bypassed worker dispatch and tried to do work
 * itself). mission_state pins
 * the agent to a fixed directory tree and file-name vocabulary so it cannot
 * overwrite arbitrary repo files even by mistake; all real changes go through
 * dispatched engine_tasks.
 *
 * Directory layout (relative to the project directory at run time):
 *   .opencorvus/.r/m/<mission-key2>/<mission-key6>/
 *     frontier.md   — outstanding work + the mission contract
 *     tasks.md      — engine_task IDs the mission has dispatched + status
 *     handoff.md    — brief for the next wake of this same mission
 *     notes.md      — free-form scratchpad
 *
 * The four file names are an alphabet, not a schema — the LLM owns the
 * markdown contents, but the host owns where it lives. `.gitignore`
 * keeps the runtime tree out of the working copy.
 */

// Hard-coded file vocabulary. New file names are a deliberate schema
// change; do not add ad-hoc names from the LLM side.
const MISSION_FILES = ["frontier.md", "tasks.md", "handoff.md", "notes.md"] as const
type MissionFile = (typeof MISSION_FILES)[number]

// 256 KB cap on a single file write. Mission state is markdown notes,
// not artifact storage; anything past this size belongs in a real
// engine_artifact row.
const MAX_CONTENT_BYTES = 256 * 1024

function runtimeBase() {
  // Instance.directory is the project's active working directory; the
  // mission session is always tied to a single project / cwd, so we
  // resolve relative to it. If a mission ever needs to switch cwd
  // (multi-worktree mission), that decision is explicit at the wake
  // boundary, not silently here.
  return path.resolve(ProjectRuntimePaths.projectRuntimeRoot(Instance.directory), "m")
}

function missionDir(missionID: string) {
  const parsedMissionID = MissionID.parse(missionID)
  const base = runtimeBase()
  const resolved = path.resolve(ProjectRuntimePaths.missionRoot(Instance.directory, parsedMissionID))
  // Defense in depth: even though MissionID rejects ../ and slashes, verify
  // the resolved path stays under the base. Catches future schema regressions
  // and platform path quirks.
  if (!resolved.startsWith(base + path.sep)) {
    throw new Error(`missionID path traversal blocked: ${parsedMissionID}`)
  }
  return resolved
}

function missionFilePath(missionID: string, file: MissionFile) {
  return path.join(missionDir(missionID), file)
}

/**
 * The missionID is server-owned, not an agent parameter. It lives in the
 * mission session's `metadata.mission.id` (written at wake) and is the SINGLE
 * source for which mission directory this tool touches — mirroring how
 * `panel.create_task` derives Mission → Squad provenance from the same field
 * (rule 8: no dual source). Taking it from the LLM instead let the agent
 * fabricate ids ("smoke-test", "mission_001") and write its durable memory to
 * a directory no later wake could find, silently breaking cross-wake recall.
 */
async function resolveMissionID(sessionID: string): Promise<string> {
  const session = await Session.get(sessionID)
  const missionMeta = (session.metadata as Record<string, unknown> | undefined)?.mission as { id?: unknown } | undefined
  const missionID = typeof missionMeta?.id === "string" ? missionMeta.id : undefined
  if (!missionID) {
    throw new Error(
      `mission_state requires a mission session (metadata.mission.id). ` +
        `Session ${sessionID} is not a mission session.`,
    )
  }
  return missionID
}

async function atomicWrite(target: string, content: string) {
  await fs.mkdir(path.dirname(target), { recursive: true })
  // temp + rename: avoids torn writes if the process crashes or another
  // wake reads mid-write. process.pid + Date.now() suffix is enough —
  // a single master session is the only writer per missionID (the route
  // and wake path enforce single-loop-per-mission), and even racing
  // writers would each get a distinct temp path.
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`
  try {
    await fs.writeFile(tmp, content, "utf8")
    await fs.rename(tmp, target)
  } catch (err) {
    // Best-effort cleanup if rename failed; ignore unlink errors so the
    // original write error surfaces unmasked.
    await fs.unlink(tmp).catch(() => {})
    throw err
  }
}

async function readIfExists(target: string): Promise<string | undefined> {
  try {
    return await fs.readFile(target, "utf8")
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined
    throw err
  }
}

async function statIfExists(target: string) {
  try {
    return await fs.stat(target)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined
    throw err
  }
}

const ReadAction = z.object({
  action: z.literal("read"),
  file: z.enum(MISSION_FILES).describe("Mission state file to read."),
})

const WriteAction = z.object({
  action: z.literal("write"),
  file: z.enum(MISSION_FILES).describe("Mission state file to replace."),
  content: z.string().describe("Complete markdown content to write into the mission state file."),
})

const ListAction = z.object({
  action: z.literal("list"),
})

const MissionStateAction = z.discriminatedUnion("action", [ReadAction, WriteAction, ListAction])

export const MissionStateTool = Tool.define("mission_state", {
  description: [
    "Read, write, or list the state files for the CURRENT mission.",
    "The mission is resolved automatically from your session — you do NOT pass a missionID.",
    "All I/O is confined to `.opencorvus/.r/m/<this-mission-key>/` with a fixed",
    "file-name vocabulary: frontier.md, tasks.md, handoff.md, notes.md.",
    "Use this to carry mission progress across wake cycles — do NOT use read/write/glob.",
    "",
    "Actions:",
    "  read   { file } → returns the file content as a string (empty when not yet created).",
    "  write  { file, content } → atomically replaces the file (≤256 KB).",
    "  list   {} → returns metadata for each of the four files that currently exist.",
  ].join("\n"),
  parameters: MissionStateAction,
  async execute(params, ctx) {
    const missionID = await resolveMissionID(ctx.sessionID)
    switch (params.action) {
      case "read": {
        const target = missionFilePath(missionID, params.file)
        const content = (await readIfExists(target)) ?? ""
        return {
          title: `mission_state read ${missionID}/${params.file}`,
          output: content,
          metadata: { missionID, file: params.file, exists: content.length > 0 } as Record<string, unknown>,
        }
      }
      case "write": {
        const bytes = Buffer.byteLength(params.content, "utf8")
        if (bytes > MAX_CONTENT_BYTES) {
          throw new Error(
            `mission_state.write content size ${bytes} bytes exceeds limit ${MAX_CONTENT_BYTES} bytes. ` +
              `Trim the file or move bulk data to an engine_artifact.`,
          )
        }
        const target = missionFilePath(missionID, params.file)
        await atomicWrite(target, params.content)
        return {
          title: `mission_state write ${missionID}/${params.file}`,
          output: `Wrote ${bytes} bytes to ${params.file}.`,
          metadata: { missionID, file: params.file, exists: true, bytes } as Record<string, unknown>,
        }
      }
      case "list": {
        const dir = missionDir(missionID)
        const entries = await Promise.all(
          MISSION_FILES.map(async (file) => {
            const stat = await statIfExists(path.join(dir, file))
            return stat ? { file, size: stat.size, mtime: stat.mtimeMs } : null
          }),
        )
        const present = entries.filter((entry): entry is { file: MissionFile; size: number; mtime: number } => !!entry)
        return {
          title: `mission_state list ${missionID}`,
          output: JSON.stringify({ missionID, files: present }),
          metadata: { missionID, count: present.length } as Record<string, unknown>,
        }
      }
    }
  },
})

// Re-exported for tests and for callers that want to enumerate the
// supported file names without re-deriving them from the Zod enum.
export const MISSION_STATE_FILES = MISSION_FILES
export type MissionStateFile = MissionFile

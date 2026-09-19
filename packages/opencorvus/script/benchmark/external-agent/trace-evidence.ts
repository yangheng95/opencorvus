import fs from "node:fs/promises"
import { ProjectRuntimePaths } from "../../../src/project/runtime-paths"

export async function readCompleteTaskTraceEvents(input: {
  traceDir: string
  taskID: string
}): Promise<Array<Record<string, any>>> {
  const tracePath = ProjectRuntimePaths.taskAbsoluteFromRuntimeRoot(input.traceDir, input.taskID, "trace.jsonl")
  const handle = await fs.open(tracePath, "r")
  try {
    const before = await handle.stat()
    const bytes = await handle.readFile()
    const after = await handle.stat()
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || bytes.byteLength !== before.size) {
      throw new Error(`Task trace changed while sealing complete evidence for ${input.taskID}`)
    }
    const raw = bytes.toString("utf8")
    if (raw.length > 0 && !raw.endsWith("\n")) {
      throw new Error(`Task trace is not terminated by a complete JSONL record for ${input.taskID}`)
    }
    const lines = raw.length === 0 ? [] : raw.slice(0, -1).split("\n")
    if (lines.some((line) => line.length === 0 || line.endsWith("\r"))) {
      throw new Error(`Task trace does not use canonical non-empty LF-delimited JSONL for ${input.taskID}`)
    }
    const events = lines
      .map((line, index) => {
        let event: unknown
        try {
          event = JSON.parse(line)
        } catch (error) {
          throw new Error(`Task trace contains invalid JSON at line ${index + 1} for ${input.taskID}`, {
            cause: error,
          })
        }
        if (!event || typeof event !== "object" || Array.isArray(event)) {
          throw new Error(`Task trace line ${index + 1} is not an event object for ${input.taskID}`)
        }
        if ((event as Record<string, unknown>).taskID !== input.taskID) {
          throw new Error(`Task trace line ${index + 1} has the wrong Task identity for ${input.taskID}`)
        }
        return { event: event as Record<string, any>, index }
      })
    events.sort((left, right) => {
      const byTime = Number(left.event.ts ?? 0) - Number(right.event.ts ?? 0)
      return byTime || left.index - right.index
    })
    return events.map((item) => item.event)
  } finally {
    await handle.close()
  }
}

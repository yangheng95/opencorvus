import { buffer as readStreamBuffer } from "node:stream/consumers"
import { resolveProjectIndexRuntime } from "../runtime/project-index"
import { ProcessSupervisor } from "../shell/process-supervisor"
import { Filesystem } from "../util/filesystem"

export type ProjectIndex = { files: string[]; dirs: string[] }

export async function readProjectIndex(cwd: string): Promise<ProjectIndex> {
  await Filesystem.assertExistingDirectory(cwd)
  const process = await ProcessSupervisor.spawnHostCommand({
    executable: await resolveProjectIndexRuntime(),
    args: [],
    cwd,
    owner: "project-index",
  })
  const stderr = process.stderr ? readStreamBuffer(process.stderr) : Promise.resolve(Buffer.alloc(0))
  void stderr.catch(() => undefined)
  const result: ProjectIndex = { files: [], dirs: [] }
  let completed = false
  try {
    if (!process.stdout || !process.stderr) throw new Error("Project index output is unavailable")
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
    let pending = ""
    for await (const chunk of process.stdout as AsyncIterable<Uint8Array>) {
      pending += decoder.decode(chunk, { stream: true })
      const entries = pending.split("\0")
      pending = entries.pop() ?? ""
      for (const entry of entries) {
        if (entry.length > 1 && entry[0] === "f") result.files.push(entry.slice(1))
        else if (entry.length > 1 && entry[0] === "d") result.dirs.push(entry.slice(1) + "/")
        else throw new Error("Invalid project index entry")
      }
    }
    if (pending + decoder.decode()) throw new Error("Project index ended without an entry terminator")
    const [code, diagnostic] = await Promise.all([process.exited, stderr, process.outputSettled])
    if (code !== 0) {
      const detail = diagnostic.toString().trim()
      throw new Error(`Project index failed with code ${code}${detail ? `: ${detail}` : ""}`)
    }
    completed = true
    return result
  } finally {
    if (!completed) {
      await ProcessSupervisor.terminateAndWaitForExit(process, "project index")
      await Promise.allSettled([stderr, process.outputSettled])
    } else await process.dispose()
  }
}

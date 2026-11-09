import path from "node:path"
import { ProjectRuntimePaths } from "../project/runtime-paths"
import { readProjectIndex } from "./project-index"

export async function readProjectDirectoryTree(input: { cwd: string; limit?: number }): Promise<string> {
  const { dirs } = await readProjectIndex(input.cwd)
  const configDirectory = path.basename(ProjectRuntimePaths.projectConfigRoot(input.cwd))
  const children = new Map<string, string[]>()
  let total = 0
  for (const identity of dirs) {
    const relative = identity.slice(0, -1)
    if (relative.split(path.sep).includes(configDirectory)) continue
    const parent = path.dirname(relative)
    const siblings = children.get(parent)
    if (siblings) siblings.push(relative)
    else children.set(parent, [relative])
    total++
  }

  const ordered = (parent: string) => (children.get(parent) ?? []).sort((a, b) =>
    path.basename(a).localeCompare(path.basename(b)) || (a < b ? -1 : a > b ? 1 : 0),
  )
  const queue = [...ordered(".")]
  const lines: string[] = []
  const limit = input.limit ?? total
  for (let i = 0; i < queue.length && i < limit; i++) {
    const directory = queue[i]
    lines.push(directory.split(path.sep).join("/"))
    for (const child of ordered(directory)) queue.push(child)
  }
  if (lines.length < total) lines.push(`[${total - lines.length} truncated]`)
  return lines.join("\n")
}

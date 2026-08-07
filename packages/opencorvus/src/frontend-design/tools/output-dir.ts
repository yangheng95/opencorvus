import fs from "node:fs/promises"
import path from "node:path"

import { taskRootDirectory } from "@/engine/task-directory"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { requireTask } from "@/engine/store"
import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { TaskRuntimeMaterializer } from "@/project/task-runtime-materializer"

export interface TaskWebpageEvidenceOutputDirectory {
  kind: "task"
  absolutePath: string
  projectRelativePath: string
}

export interface ExternalWebpageEvidenceOutputDirectory {
  kind: "external"
  absolutePath: string
}

export function resolveWebpageEvidenceOutputDir(input: {
  sessionID: string
}): Promise<TaskWebpageEvidenceOutputDirectory>
export function resolveWebpageEvidenceOutputDir(input: {
  override: string
}): Promise<ExternalWebpageEvidenceOutputDirectory>
export function resolveWebpageEvidenceOutputDir(input: {
  override?: string
  sessionID?: string
}): Promise<TaskWebpageEvidenceOutputDirectory | ExternalWebpageEvidenceOutputDirectory>
export async function resolveWebpageEvidenceOutputDir(input: {
  override?: string
  sessionID?: string
}): Promise<TaskWebpageEvidenceOutputDirectory | ExternalWebpageEvidenceOutputDirectory> {
  if (input.sessionID && input.override) {
    throw new Error("resolveWebpageEvidenceOutputDir: task sessions do not accept output directory overrides")
  }

  if (input.sessionID) {
    const taskID = taskIDForSession(input.sessionID)
    if (!taskID) {
      throw new Error(`resolveWebpageEvidenceOutputDir: session ${input.sessionID} has no owning task`)
    }
    const taskDirectory = taskRootDirectory(requireTask(taskID))
    const paths = ProjectRuntimePaths.webpageEvidencePaths(taskDirectory, taskID)
    const absolutePath = await TaskRuntimeMaterializer.webpageEvidenceDir(taskDirectory, taskID)
    return {
      kind: "task",
      absolutePath,
      projectRelativePath: paths.relative,
    }
  }

  if (!input.override) {
    throw new Error("resolveWebpageEvidenceOutputDir: sessionID or explicit external override is required")
  }
  const absolutePath = path.isAbsolute(input.override)
    ? path.resolve(input.override)
    : path.resolve(Instance.directory, input.override)
  await fs.mkdir(absolutePath, { recursive: true })
  return { kind: "external", absolutePath }
}

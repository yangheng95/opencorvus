import type { Tool } from "./tool"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { createPluginToolFilesHost } from "./plugin-tool-files-host"
import { Instance } from "@/project/instance"

export function taskFiles(ctx: Pick<Tool.Context, "sessionID">) {
  return createPluginToolFilesHost((operation) => operation(), {
    taskID: taskProcessIdentity(ctx, "File tool").taskID,
  })
}

export function taskProcessIdentity(
  ctx: Pick<Tool.Context, "sessionID">,
  label: string,
  cwd?: string,
): Readonly<{ taskID: string; cwd: string }> {
  const taskID = taskIDForSession(ctx.sessionID)
  if (!taskID) throw new Error(`${label} Session ${ctx.sessionID} does not belong to a Task`)
  return Object.freeze({ taskID, cwd: cwd ?? Instance.directory })
}

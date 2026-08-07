import * as nativeFiles from "node:fs/promises"
import type { ToolFiles } from "@opencorvus-ai/plugin"
import { Tool } from "./tool"
import { createPluginToolFilesHost } from "./plugin-tool-files-host"
import { Instance } from "@/project/instance"

const nativeToolFiles = Object.freeze({
  access: nativeFiles.access,
  copyFile: nativeFiles.copyFile,
  cp: nativeFiles.cp,
  lstat: nativeFiles.lstat,
  mkdir: nativeFiles.mkdir,
  mkdtemp: nativeFiles.mkdtemp,
  readFile: nativeFiles.readFile,
  readdir: nativeFiles.readdir,
  realpath: nativeFiles.realpath,
  rename: nativeFiles.rename,
  rm: nativeFiles.rm,
  stat: nativeFiles.stat,
  writeFile: nativeFiles.writeFile,
}) as ToolFiles

export function executionFiles(ctx: Pick<Tool.Context, "executionAuthority">): ToolFiles {
  const authority = Tool.requireExecutionAuthority(ctx)
  return authority.kind === "task"
    ? createPluginToolFilesHost((operation) => operation(), { taskID: authority.taskID })
    : nativeToolFiles
}

export function executionProcessAuthority(
  ctx: Pick<Tool.Context, "executionAuthority">,
  cwd = Instance.directory,
): Readonly<{ kind: "host"; cwd: string }> | Readonly<{ kind: "task"; taskID: string; cwd: string }> {
  const authority = Tool.requireExecutionAuthority(ctx)
  return authority.kind === "task"
    ? Object.freeze({ kind: "task", taskID: authority.taskID, cwd })
    : Object.freeze({ kind: "host", cwd })
}

export function taskExecutionProcessIdentity(
  ctx: Pick<Tool.Context, "executionAuthority">,
  label: string,
  cwd = Instance.directory,
): Readonly<{ taskID: string; cwd: string }> {
  const authority = Tool.requireExecutionAuthority(ctx)
  if (authority.kind !== "task") {
    throw new Error(`${label} requires explicit Task execution authority`)
  }
  return Object.freeze({ taskID: authority.taskID, cwd })
}

export function taskExecutionID(ctx: Pick<Tool.Context, "executionAuthority">, label: string): string {
  const authority = Tool.requireExecutionAuthority(ctx)
  if (authority.kind !== "task") throw new Error(`${label} requires explicit Task execution authority`)
  return authority.taskID
}

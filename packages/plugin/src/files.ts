import { AsyncLocalStorage } from "node:async_hooks"

export type ToolFiles = Readonly<
  Pick<
    typeof import("node:fs/promises"),
    | "access"
    | "copyFile"
    | "cp"
    | "lstat"
    | "mkdir"
    | "mkdtemp"
    | "readFile"
    | "readdir"
    | "realpath"
    | "rename"
    | "rm"
    | "stat"
    | "writeFile"
  >
>

const invocationFiles = new AsyncLocalStorage<ToolFiles>()

function currentFiles(): ToolFiles {
  const files = invocationFiles.getStore()
  if (!files) throw new Error("Package tool filesystem capability requires an active tool invocation")
  return files
}

export function withToolFiles<T>(files: ToolFiles, callback: () => Promise<T>): Promise<T> {
  return invocationFiles.run(files, callback)
}

export const packageToolFiles: ToolFiles = Object.freeze({
  access: ((...args: Parameters<ToolFiles["access"]>) => currentFiles().access(...args)) as ToolFiles["access"],
  copyFile: ((...args: Parameters<ToolFiles["copyFile"]>) => currentFiles().copyFile(...args)) as ToolFiles["copyFile"],
  cp: ((...args: Parameters<ToolFiles["cp"]>) => currentFiles().cp(...args)) as ToolFiles["cp"],
  lstat: ((...args: Parameters<ToolFiles["lstat"]>) => currentFiles().lstat(...args)) as ToolFiles["lstat"],
  mkdir: ((...args: Parameters<ToolFiles["mkdir"]>) => currentFiles().mkdir(...args)) as ToolFiles["mkdir"],
  mkdtemp: ((...args: Parameters<ToolFiles["mkdtemp"]>) => currentFiles().mkdtemp(...args)) as ToolFiles["mkdtemp"],
  readFile: ((...args: Parameters<ToolFiles["readFile"]>) => currentFiles().readFile(...args)) as ToolFiles["readFile"],
  readdir: ((...args: Parameters<ToolFiles["readdir"]>) => currentFiles().readdir(...args)) as ToolFiles["readdir"],
  realpath: ((...args: Parameters<ToolFiles["realpath"]>) => currentFiles().realpath(...args)) as ToolFiles["realpath"],
  rename: ((...args: Parameters<ToolFiles["rename"]>) => currentFiles().rename(...args)) as ToolFiles["rename"],
  rm: ((...args: Parameters<ToolFiles["rm"]>) => currentFiles().rm(...args)) as ToolFiles["rm"],
  stat: ((...args: Parameters<ToolFiles["stat"]>) => currentFiles().stat(...args)) as ToolFiles["stat"],
  writeFile: ((...args: Parameters<ToolFiles["writeFile"]>) => currentFiles().writeFile(...args)) as ToolFiles["writeFile"],
})

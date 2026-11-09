import { spawnSync } from "node:child_process"
import { statSync } from "node:fs"
import path from "node:path"
import { projectIndexSourceDirectory, sourceProjectIndexExecutable } from "../src/runtime/project-index"

export function prepareProjectIndex(): string {
  const source = projectIndexSourceDirectory()
  const result = spawnSync("cargo", [
    "build", "--locked", "--release",
    "--manifest-path", path.join(source, "Cargo.toml"),
    "--target-dir", path.join(source, "target"),
  ], { cwd: source, stdio: "inherit", windowsHide: true })
  if (result.error) throw new Error("Building the project index requires a Rust toolchain (cargo).", { cause: result.error })
  if (result.status !== 0) throw new Error(`Building the project index failed (${result.signal ?? result.status}).`)
  const executable = sourceProjectIndexExecutable()
  if (!statSync(executable, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Project index executable is unavailable at ${executable}.`)
  }
  return executable
}

if (import.meta.main) prepareProjectIndex()

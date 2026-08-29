import path from "node:path"
import { initializeOpenCorvusRuntimeDirectories } from "../packages/util/src/runtime-directories"
import { resolveOpenCorvusRuntimePaths } from "../packages/util/src/runtime-paths"

export const PACKAGE_RUNTIME_RELATIVE_PATH = path.join(".scratch", "package-runtime")

export interface PublicRuntimePackageBuildCommand {
  label: string
  cwd: string
  argv: string[]
}

export function publicRuntimePackageBuildCommands(repoRoot: string): PublicRuntimePackageBuildCommand[] {
  return [
    {
      label: "Util build",
      cwd: path.join(repoRoot, "packages", "util"),
      argv: ["bun", "run", "build"],
    },
    {
      label: "SDK build",
      cwd: repoRoot,
      argv: ["bun", "packages/sdk/js/script/build.ts"],
    },
    {
      label: "Plugin build",
      cwd: path.join(repoRoot, "packages", "plugin"),
      argv: ["bun", "run", "build"],
    },
  ]
}

export async function preparePackageBuildEnvironment(
  repoRoot: string,
  baseEnv: NodeJS.ProcessEnv,
): Promise<NodeJS.ProcessEnv> {
  const root =
    baseEnv.OPENCORVUS_HOME === undefined
      ? path.join(path.resolve(repoRoot), PACKAGE_RUNTIME_RELATIVE_PATH)
      : baseEnv.OPENCORVUS_HOME
  const paths = resolveOpenCorvusRuntimePaths({
    env: baseEnv,
    platform: process.platform,
    home: path.resolve(repoRoot),
    root,
  })
  await initializeOpenCorvusRuntimeDirectories(paths)
  return {
    ...baseEnv,
    OPENCORVUS_HOME: paths.root,
    TEMP: paths.temporary,
    TMP: paths.temporary,
    TMPDIR: paths.temporary,
  }
}

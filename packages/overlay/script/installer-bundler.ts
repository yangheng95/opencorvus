import { $ } from "bun"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { runTimedStage } from "../../../script/timed-stage"

const repo = fileURLToPath(new URL("../../../", import.meta.url))

/** Shared installer producer; verbose output preserves native subprocess errors. */
export async function installerBundler(bundles: readonly string[]): Promise<string[]> {
  if (!bundles.includes("rpm")) return ["bun", "run", "tauri", "--verbose"]
  const executable = (await runTimedStage("Prepare corrected RPM bundler", () =>
    $`python3 ${path.join(repo, "script/prepare-rpm-bundler.py")}`.cwd(repo).text(),
  )).trim()
  if (!path.isAbsolute(executable)) throw new Error("RPM preparation did not return an absolute executable path")
  return [executable, "--verbose"]
}

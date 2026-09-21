import { $ } from "bun"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { runTimedStage } from "../../../script/timed-stage"

const repo = fileURLToPath(new URL("../../../", import.meta.url))

/** One RPM producer shared by local and hosted installer packaging. */
export async function installerBundler(bundles: readonly string[]): Promise<string[]> {
  if (!bundles.includes("rpm")) return ["bun", "run", "tauri"]
  const executable = (await runTimedStage("Prepare corrected RPM bundler", () =>
    $`python3 ${path.join(repo, "script/prepare-rpm-bundler.py")}`.cwd(repo).text(),
  )).trim()
  if (!path.isAbsolute(executable)) throw new Error("RPM preparation did not return an absolute executable path")
  return [executable]
}

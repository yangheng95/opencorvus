import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const initService = readFileSync(new URL("../src/services/init.ts", import.meta.url), "utf8")

describe("Overlay project startup Git ordering", () => {
  test("awaits configured Git initialization before every project-scoped startup load", () => {
    const directoryRestore = initService.indexOf("const directory = await ensureWorkspaceDirectory()")
    const apiBinding = initService.indexOf("syncApiConfig()", directoryRestore)
    const emptyDirectoryReturn = initService.indexOf("return false", apiBinding)
    const gitInitialization = initService.indexOf(
      "if (settingsStore.initGit) await initializeActiveDirectoryGit()",
      emptyDirectoryReturn,
    )
    const configPatch = initService.indexOf('await apiJsonWithTimeout("config"', gitInitialization)
    const parallelProjectLoads = initService.indexOf("await Promise.all([", configPatch)

    expect(directoryRestore).toBeGreaterThan(-1)
    expect(apiBinding).toBeGreaterThan(directoryRestore)
    expect(emptyDirectoryReturn).toBeGreaterThan(apiBinding)
    expect(gitInitialization).toBeGreaterThan(emptyDirectoryReturn)
    expect(configPatch).toBeGreaterThan(gitInitialization)
    expect(parallelProjectLoads).toBeGreaterThan(configPatch)
    expect(initService.slice(parallelProjectLoads, initService.indexOf("])\n", parallelProjectLoads))).not.toContain(
      "initializeActiveDirectoryGit",
    )
  })
})

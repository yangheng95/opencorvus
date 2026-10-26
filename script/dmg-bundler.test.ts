import { expect, test } from "bun:test"
import path from "node:path"
import { dmgCommand, requireCreateDmgVersion, type DmgConfiguration } from "../packages/overlay/script/dmg-bundler"

const configuration = (await Bun.file(
  new URL("../packages/overlay/src-tauri/tauri.conf.json", import.meta.url),
).json()) as DmgConfiguration
const root = path.resolve("dmg-test-root")
const input = {
  configuration,
  overlayDirectory: path.join(root, "overlay"),
  source: path.join(root, "staged-app"),
  outputDirectory: path.join(root, "images"),
}

test("accepts the current upstream disk-image producer version", () => {
  expect(requireCreateDmgVersion("1.3.0\n")).toBe("1.3.0")
})

test("maps the old vendor version to the explicit packaging error", () => {
  expect(() => requireCreateDmgVersion("1.2.1")).toThrow('DMG packaging requires create-dmg 1.3.0; observed "1.2.1"')
})

test("reports a parent-directory product identity as the filename error contract", () => {
  expect(() =>
    dmgCommand({ ...input, configuration: { ...configuration, productName: ".." }, arch: "x64", ci: true }),
  ).toThrow("DMG product name must be a single filename")
})

test.each(["x64", "arm64"] as const)("projects the %s installer identity and declared disk-image layout", (arch) => {
  const image = path.join(
    input.outputDirectory,
    `OpenCorvus_${configuration.version}_${arch === "x64" ? "x64" : "aarch64"}.dmg`,
  )
  expect(dmgCommand({ ...input, arch, ci: true })).toEqual({
    executable: "create-dmg",
    image,
    app: "OpenCorvus.app",
    args: [
      "--volname",
      "OpenCorvus",
      "--icon",
      "OpenCorvus.app",
      "180",
      "170",
      "--app-drop-link",
      "480",
      "170",
      "--window-size",
      "660",
      "400",
      "--hide-extension",
      "OpenCorvus.app",
      "--volicon",
      path.join(input.overlayDirectory, "icons", "icon.icns"),
      "--skip-jenkins",
      image,
      input.source,
    ],
  })
})

test("installs the native disk-image producer with the macOS build prerequisites", async () => {
  const action = Bun.YAML.parse(
    await Bun.file(new URL("../.github/actions/setup-overlay-runtime/action.yml", import.meta.url)).text(),
  ) as {
    runs: { steps: Array<{ name?: string; if?: string; shell?: string; run?: string }> }
  }
  expect(action.runs.steps.find((step) => step.name === "Install macOS overlay runtime dependencies")).toEqual({
    name: "Install macOS overlay runtime dependencies",
    if: "runner.os == 'macOS'",
    shell: "bash",
    run: "brew install ripgrep create-dmg",
  })
})

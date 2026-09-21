import { expect, test } from "bun:test"
import path from "node:path"
import { installerBundler } from "../packages/overlay/script/installer-bundler"

test("the ordinary installer command executes the installed Tauri CLI", async () => {
  const command = await installerBundler(process.platform === "win32" ? ["msi", "nsis"] : ["deb"])
  expect(command).toEqual(["bun", "run", "tauri"])
  const cwd = path.resolve(import.meta.dir, "../packages/overlay")
  const installed = await Bun.file(path.join(cwd, "node_modules/@tauri-apps/cli/package.json")).json()
  const child = Bun.spawn([...command, "--version"], { cwd, stdout: "pipe", stderr: "pipe" })
  expect(await new Response(child.stdout).text()).toBe(`tauri-cli ${installed.version}\n`)
  expect(await child.exited).toBe(0)
})

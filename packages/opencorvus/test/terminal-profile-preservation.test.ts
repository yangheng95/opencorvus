import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "../src/config/config"
import { Instance } from "../src/project/instance"
import { TerminalProfile } from "../src/system-terminal/profile"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function writeProjectTerminal(directory: string, defaultProfileID: string) {
  const command = path.join(directory, "operator-shell", "pwsh.exe")
  await fs.mkdir(path.dirname(command), { recursive: true })
  await fs.writeFile(command, "operator-owned terminal command identity")
  const profile = {
    label: "PowerShell",
    command,
    args: ["-NoLogo"],
    env: { TERM: "xterm-256color", COLORTERM: "truecolor" },
    icon: "powershell" as const,
  }
  const terminal = { default_profile_id: defaultProfileID, profiles: { pwsh: profile } }
  const configPath = path.join(directory, ".opencorvus", "opencorvus.jsonc")
  const text = "// Operator-owned terminal configuration\r\n" + JSON.stringify({ terminal }, null, 2) + "\r\n"
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  await fs.writeFile(configPath, text)
  return { command, profile, terminal, configPath, text }
}

test("project-open terminal initialization preserves an operator command with a system-like profile identity", async () => {
  await using project = await memoryProject()
  const original = await writeProjectTerminal(project.path, "pwsh")
  for (let reopen = 0; reopen < 2; reopen++) {
    await Instance.disposeAll()
    const result = await Instance.provide({
      directory: project.path,
      init: () => TerminalProfile.ensureProjectDefaultProfile(),
      fn: async () => ({ terminal: (await Config.get()).terminal, resolved: await TerminalProfile.resolve("pwsh") }),
    })
    expect(result.terminal).toEqual(original.terminal)
    expect(result.resolved).toEqual({ id: "pwsh", ...original.profile })
    expect(await fs.readFile(original.configPath, "utf8")).toBe(original.text)
  }
})

test("an unconfigured project receives a durable default that resolves through the real registry", async () => {
  await using project = await memoryProject()
  const result = await Instance.provide({
    directory: project.path,
    init: () => TerminalProfile.ensureProjectDefaultProfile(),
    fn: async () => {
      const terminal = (await Config.get()).terminal!
      const listed = await TerminalProfile.list()
      const resolved = await TerminalProfile.resolve(listed.defaultProfileID)
      return { terminal, listed, resolved }
    },
  })
  expect(result.terminal.default_profile_id).toBe(result.listed.defaultProfileID)
  expect(result.listed.profiles.map((profile) => profile.id)).toContain(result.resolved.id)
  expect(result.resolved.command.length).toBeGreaterThan(0)
  expect(result.terminal.profiles![result.resolved.id]!.command).toBe(result.resolved.command)
})

test("an explicit unknown default retains its configuration and returns the precise registry error", async () => {
  await using project = await memoryProject()
  const original = await writeProjectTerminal(project.path, "operator-default")
  const error = await Instance.provide({
    directory: project.path,
    init: () => TerminalProfile.ensureProjectDefaultProfile(),
    fn: () => TerminalProfile.list().catch((cause) => cause),
  })
  expect(error).toBeInstanceOf(TerminalProfile.ConfigError)
  expect(error.data).toEqual({ message: "Terminal default_profile_id references unknown profile: operator-default" })
  expect(await fs.readFile(original.configPath, "utf8")).toBe(original.text)
})

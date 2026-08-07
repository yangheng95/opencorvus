import { beforeEach, expect, mock, test } from "bun:test"

const calls: string[] = []
let directory = ""
let confirmedLocale = "en-US"
let setLocaleImplementation = async (value: string) => {
  calls.push(`ui:${value}`)
}
let syncImplementation = async (value: string, options: { directory?: string }) => {
  calls.push(`project:${value}:${options.directory}`)
}
let saveImplementation = async () => {
  calls.push("save")
}

mock.module("../src/store/settings", () => ({
  setSettingsStore: (key: string, value: string) => calls.push(`store:${key}:${value}`),
  confirmedPersistedSettingsSnapshot: () => ({ locale: confirmedLocale }),
  saveSettings: () => saveImplementation(),
}))

mock.module("../src/utils/i18n", () => ({
  setLocale: (value: string) => setLocaleImplementation(value),
}))

mock.module("../src/services/config", () => ({
  syncAgentPromptLocale: (value: string, options: { directory?: string }) => syncImplementation(value, options),
}))

mock.module("../src/services/project-directory", () => ({
  activeProjectDirectory: () => directory,
}))

const { applyLocalePreference } = await import("../src/services/locale-preference")

beforeEach(() => {
  calls.length = 0
  directory = ""
  confirmedLocale = "en-US"
  setLocaleImplementation = async (value) => {
    calls.push(`ui:${value}`)
  }
  syncImplementation = async (value, options) => {
    calls.push(`project:${value}:${options.directory}`)
  }
  saveImplementation = async () => {
    calls.push("save")
  }
})

test("global locale selection persists UI language without a project config request", async () => {
  await applyLocalePreference("zh-CN")
  expect(calls).toEqual(["store:locale:zh-CN", "ui:zh-CN", "save"])
})

test("project locale selection also synchronizes the active project prompt locale", async () => {
  directory = "D:/repo/project"
  await applyLocalePreference("en-US")
  expect(calls).toEqual([
    "store:locale:en-US",
    "ui:en-US",
    "project:en-US:D:/repo/project",
    "save",
  ])
})

test("a delayed project A locale operation never targets project B after navigation", async () => {
  directory = "D:/repo/project-a"
  let releaseLocale!: () => void
  setLocaleImplementation = async (value) => {
    calls.push(`ui:start:${value}`)
    await new Promise<void>((resolve) => {
      releaseLocale = resolve
    })
    calls.push(`ui:end:${value}`)
  }

  const selection = applyLocalePreference("zh-CN")
  await Promise.resolve()
  directory = "D:/repo/project-b"
  releaseLocale()

  expect(await selection).toBe(true)
  expect(calls.filter((call) => call.startsWith("project:"))).toEqual([])
  expect(calls).not.toContain("project:zh-CN:D:/repo/project-b")
})

test("a newer locale owns the final document, project prompt, and durable save", async () => {
  directory = "D:/repo/project"
  let releaseFirst!: () => void
  setLocaleImplementation = async (value) => {
    calls.push(`ui:start:${value}`)
    if (value === "zh-CN") {
      await new Promise<void>((resolve) => {
        releaseFirst = resolve
      })
    }
    calls.push(`ui:end:${value}`)
  }

  const oldSelection = applyLocalePreference("zh-CN")
  await Promise.resolve()
  const latestSelection = applyLocalePreference("en-US")
  releaseFirst()

  expect(await oldSelection).toBe(false)
  expect(await latestSelection).toBe(true)
  expect(calls.filter((call) => call === "save")).toEqual(["save"])
  expect(calls.filter((call) => call.startsWith("project:"))).toEqual(["project:en-US:D:/repo/project"])
  expect(calls.slice(-3)).toEqual(["ui:end:en-US", "project:en-US:D:/repo/project", "save"])
})

test("a current persistence failure restores durable store, document locale, and project prompt", async () => {
  directory = "D:/repo/project"
  confirmedLocale = "en-US"
  saveImplementation = async () => {
    calls.push("save:failed")
    throw new Error("settings fixture rejected")
  }

  await expect(applyLocalePreference("zh-CN")).rejects.toThrow("settings fixture rejected")
  expect(calls).toEqual([
    "store:locale:zh-CN",
    "ui:zh-CN",
    "project:zh-CN:D:/repo/project",
    "save:failed",
    "store:locale:en-US",
    "ui:en-US",
    "project:en-US:D:/repo/project",
  ])
})

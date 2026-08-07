import { beforeEach, expect, mock, test } from "bun:test"

const calls: string[] = []
let confirmedTheme = "light"
let saveImplementation: (input: {
  overrides?: { theme?: string }
  onFailure?: (failure: { error: unknown; confirmed: { theme: string } }) => void
}) => Promise<void>

mock.module("../src/store/settings", () => ({
  setSettingsStore: (key: string, value: string) => calls.push(`store:${key}:${value}`),
  saveSettings: (input: Parameters<typeof saveImplementation>[0]) => saveImplementation(input),
}))

mock.module("../src/services/theme", () => ({
  applyTheme: (value: string) => calls.push(`dom:${value}`),
}))

const { applyThemePreference } = await import("../src/services/theme-preference")

beforeEach(() => {
  calls.length = 0
  confirmedTheme = "light"
  saveImplementation = async (input) => {
    calls.push(`save:${input.overrides?.theme}`)
  }
})

test("theme persistence uses an immutable override", async () => {
  expect(await applyThemePreference("dark")).toBe(true)
  expect(calls).toEqual(["store:theme:dark", "dom:dark", "save:dark"])
})

test("a current failure restores the confirmed theme in both store and document", async () => {
  saveImplementation = async (input) => {
    const error = new Error("theme save rejected")
    input.onFailure?.({ error, confirmed: { theme: confirmedTheme } })
    throw error
  }

  await expect(applyThemePreference("dark")).rejects.toThrow("theme save rejected")
  expect(calls).toEqual(["store:theme:dark", "dom:dark", "store:theme:light", "dom:light"])
})

test("a stale theme failure cannot roll back the newer selection", async () => {
  const pending: Array<{
    input: Parameters<typeof saveImplementation>[0]
    resolve: () => void
    reject: (error: Error) => void
  }> = []
  saveImplementation = (input) =>
    new Promise<void>((resolve, reject) => {
      pending.push({ input, resolve, reject })
    })

  const oldSelection = applyThemePreference("dark")
  const latestSelection = applyThemePreference("vscode-dark")
  const oldError = new Error("old theme failed")
  pending[0]!.input.onFailure?.({ error: oldError, confirmed: { theme: confirmedTheme } })
  pending[0]!.reject(oldError)
  pending[1]!.resolve()

  expect(await oldSelection).toBe(false)
  expect(await latestSelection).toBe(true)
  expect(calls).toEqual([
    "store:theme:dark",
    "dom:dark",
    "store:theme:vscode-dark",
    "dom:vscode-dark",
  ])
})

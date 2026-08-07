import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { createRoot } from "solid-js"
import { useAsyncAction } from "../src/solid/async-action"

const COMPONENTS_ROOT = join(import.meta.dir, "..", "src", "components")

function callsitesByFile(): Map<string, number> {
  const callsites = new Map<string, number>()
  function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (name.endsWith(".tsx")) {
        const text = readFileSync(full, "utf8")
        const matches = text.matchAll(/\buseAsyncAction\s*\(/g)
        const count = Array.from(matches).length
        if (count > 0) callsites.set(name, count)
      }
    }
  }
  walk(COMPONENTS_ROOT)
  return callsites
}

describe("useAsyncAction — behaviour", () => {
  test("pending defaults to false", () => {
    createRoot((dispose) => {
      const action = useAsyncAction(async () => undefined)
      expect(action.pending()).toBe(false)
      dispose()
    })
  })

  test("run flips pending during a resolving action", async () => {
    let resolveAction: (() => void) | undefined

    await createRoot(async (dispose) => {
      const action = useAsyncAction(
        () =>
          new Promise<void>((resolve) => {
            resolveAction = resolve
          }),
      )

      const promise = action.run()
      expect(action.pending()).toBe(true)
      resolveAction?.()
      await promise
      expect(action.pending()).toBe(false)
      dispose()
    })
  })

  test("run resets pending after rejection", async () => {
    await createRoot(async (dispose) => {
      const action = useAsyncAction(async () => {
        throw new Error("boom")
      })

      await expect(action.run()).rejects.toThrow("boom")
      expect(action.pending()).toBe(false)
      dispose()
    })
  })
})

describe("useAsyncAction — adoption", () => {
  test("the settings save and log actions use the shared async action wrapper", () => {
    expect(callsitesByFile()).toEqual(
      new Map([
        ["LogViewer.tsx", 2],
        ["ChannelsPanel.tsx", 1],
      ]),
    )
  })
})

import { isOverlayPersistedSettings } from "@opencorvus-ai/transport-protocol"
import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"

import { browserSettingsFixture } from "./browser/browser-settings-fixture"

test("shared browser settings fixture satisfies the strict persisted-settings protocol", () => {
  const settings = browserSettingsFixture()

  expect(isOverlayPersistedSettings(settings)).toBeTrue()
  expect(settings).not.toHaveProperty("executor")
})

test("settings injection stays in the top-level document", () => {
  const source = readFileSync(new URL("./browser/browser-settings-fixture.ts", import.meta.url), "utf8")

  expect(source).toContain("if (window !== window.top) return")
  expect(source.indexOf("if (window !== window.top) return")).toBeLessThan(source.indexOf("localStorage.setItem"))
})

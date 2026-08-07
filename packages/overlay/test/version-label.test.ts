import { expect, test } from "bun:test"
import { formatVersionLabel } from "../src/utils/version-format"

test("formats canonical prerelease SemVer as the compact product label", () => {
  expect(formatVersionLabel("0.0.4-beta")).toBe("v0.0.4beta")
  expect(formatVersionLabel("0.0.4-beta.2")).toBe("v0.0.4beta.2")
  expect(formatVersionLabel("0.0.4")).toBe("v0.0.4")
})

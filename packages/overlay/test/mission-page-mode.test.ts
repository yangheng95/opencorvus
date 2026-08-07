import { expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = join(import.meta.dir, "..")

function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

test("Mission page-mode store is retired", () => {
  expect(existsSync(join(ROOT, "src/store/page-mode.ts"))).toBe(false)
  for (const source of [
    read("src/main.tsx"),
    read("src/services/diagnostics.ts"),
  ]) {
    expect(source).not.toContain("pageMode")
    expect(source).not.toContain("setPageMode")
    expect(source).not.toContain("isMissionPage")
    expect(source).not.toContain("data-page-mode")
  }
  expect(existsSync(join(ROOT, "src/styles/surfaces/mission.css"))).toBe(false)
  expect(existsSync(join(ROOT, "src/components/Mission.tsx"))).toBe(false)
})

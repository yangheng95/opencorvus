import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"

const skillPath = path.join(
  import.meta.dir,
  "../../script/benchmark/external-agent/automationbench-api.SKILL.md",
)

test("AutomationBench Skill defines a bounded source-to-destination evidence loop", async () => {
  const skill = await fs.readFile(skillPath, "utf8")

  expect(skill).toContain("authoritative source, destination or action, and exact values")
  expect(skill).toContain("one focused search query that names the required services and actions together")
  expect(skill).toContain("put independent read-only client commands in one `bash` call")
  expect(skill).toContain("compare those exact fields with the final destination")
  expect(skill).toContain("closes only the route, resource, or capability whose absence it explicitly proves")
  expect(skill).toContain("Mark each required fact found or still missing")
  expect(skill).toContain("Independent work whose own prerequisites are complete may continue")
  expect(skill).toContain("search once by the information shape and business terms")
  expect(skill).toContain("Preserve the exact method, URL, and parameter shape")
  expect(skill).toContain("Never repeat a successful irreversible create")
})

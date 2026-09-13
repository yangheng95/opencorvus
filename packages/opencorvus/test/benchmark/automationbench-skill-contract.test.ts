import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { automationBenchHarnessRequest } from "../../script/benchmark/external-agent/contract"

const skillPath = path.join(import.meta.dir, "../../script/benchmark/external-agent/automationbench-api.SKILL.md")

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
  expect(skill).toContain("Recent operational instructions, approvals, links, exclusions, and warnings")
  expect(skill).toContain("concrete entity, event, account, or record names from the Task")
  expect(skill).toContain("make one concrete-entity query before declaring the source absent")
  expect(skill).toContain("Destination identity and final state start with the destination service")
})

test("AutomationBench Mission request preserves public reconciliation and explicit Skill activation", () => {
  const request = automationBenchHarnessRequest([
    {
      role: "system",
      content:
        "Operate safely. You have a budget of ~50 tool-using turns — favor parallel tool calls and avoid duplicate searches.",
    },
    { role: "user", content: "Perform the business operation." },
  ])

  expect(request).toContain('@skill("automationbench-api")')
  expect(request).toContain("require the real `skill` Tool call before the first client call")
  expect(request).toContain("new evidence-backed acceptance gap derived from the original request")
  expect(request).toContain("unsupported extra requirements and already exhausted discovery")
  expect(request.match(/^SYSTEM:/gm)).toHaveLength(1)
  expect(request.match(/^USER:/gm)).toHaveLength(1)
})

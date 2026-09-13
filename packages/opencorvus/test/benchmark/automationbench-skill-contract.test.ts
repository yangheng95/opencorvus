import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { automationBenchHarnessRequest } from "../../script/benchmark/external-agent/contract"

const skillPath = path.join(import.meta.dir, "../../script/benchmark/external-agent/automationbench-api.SKILL.md")

test("AutomationBench Skill defines a bounded source-to-destination evidence loop", async () => {
  const skill = await fs.readFile(skillPath, "utf8")

  expect(skill).toContain("authoritative source, destination or action, and exact values")
  expect(skill).toContain("one focused search query that names the required services and actions together")
  expect(skill).toContain("Use the structured `batch` command for independent discovery and reads")
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
  expect(skill).toContain("Do not run `ls`, `glob`, project `read`, or capability discovery")
  expect(skill).toContain("fetch only those matching candidates")
  expect(skill).toContain("an applicable shared policy")
  expect(skill).toContain("Make each source query answer one material evidence obligation")
  expect(skill).toContain("An empty over-constrained query")
  expect(skill).toContain("complete this bounded query ladder before switching products or source families")
  expect(skill).toContain("one source-owned anchor from the original request or an already fetched record")
  expect(skill).toContain("contract-required namespace, tenant, repository, mode, projection, and pagination controls")
  expect(skill).toContain("reduce it once to a smaller discriminative fragment of the same source entity")
  expect(skill).toContain("When an exact identity filter is sufficient")
  expect(skill).toContain("honor contract-declared mode, field projection, sorting, and pagination semantics")
  expect(skill).toContain("make one minimal exact-filter read")
  expect(skill).toContain("A current authoritative operational record that gives concrete do/don't rules")
  expect(skill).toContain("map the original obligation to the source record, the concrete rule")
  expect(skill).toContain("process, approval, and historical rules require their own corresponding execution evidence")
  expect(skill).toContain("a record references a required dependency")
  expect(skill).toContain("one concrete-entity query plus one constraint-or-policy query bounds the attempted search")
  expect(skill).toContain("does not prove that the source is absent or waive a material fact")
  expect(skill).toContain("prefer one structured batch")
  expect(skill).toContain("returns one ordered `results` array")
  expect(skill).toContain("describe only delivery through the local Unix bridge")
  expect(skill).toContain("may contain a typed business/API error even when transport is HTTP 200")
  expect(skill).toContain("marks the current operation `transport_outcome_unknown`")
  expect(skill).toContain("Never batch POST, PATCH, PUT, DELETE")
  expect(skill).toContain("do not concatenate multiple client commands with shell newlines")
  expect(skill).toContain("Discover the mutation contract and any same-record final readback contract together")
  expect(skill).toContain("After a mutation, prefer the pre-discovered contract and never repeat broad discovery")
  expect(skill).toContain("the exact same-record read contract was genuinely absent")
  expect(skill).toContain("the complete mutation receipt and continue verification from its returned record")
  expect(skill).toContain("Independently judging raw receipt fields is verification of operation evidence")
  expect(skill).toContain("or definite later mutation, operation-outcome, or rollback evidence")
  expect(skill).toContain("authoritative evidence of that operation's returned result at response time")
  expect(skill).toContain("only when the discovered API contract defines the successful response as a synchronous commit")
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
  expect(request).toContain("A projected worker that calls the benchmark client must load this Skill")
  expect(request).toContain("Mission and a child Task Orchestrator")
  expect(request).toContain("materially depends on client-contract content absent from visible evidence")
  expect(request).toContain("load the exact named Skill directly without capability discovery")
  expect(request).toContain("new evidence-backed acceptance gap derived from the original request")
  expect(request).toContain("must not add a report, proof channel, independent storage field, or evidence duty")
  expect(request).toContain("independent verification does not require a second API projection for every fact")
  expect(request).toContain("process, approval, historical, referenced-policy, incomplete-coverage")
  expect(request).toContain("already exhausted discovery are truthful limitations rather than reasons to repeat work")
  expect(request.match(/^SYSTEM:/gm)).toHaveLength(1)
  expect(request.match(/^USER:/gm)).toHaveLength(1)
})

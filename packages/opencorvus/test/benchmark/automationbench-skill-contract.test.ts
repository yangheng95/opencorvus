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
  expect(skill).toContain("smallest source entity or event term that still distinguishes the requested subject")
  expect(skill).toContain("Do not run `ls`, `glob`, project `read`, or capability discovery")
  expect(skill).toContain("fetch only those matching candidates")
  expect(skill).toContain("an applicable shared policy")
  expect(skill).toContain("Make each source query answer one material evidence obligation")
  expect(skill).toContain("An empty over-constrained query")
  expect(skill).toContain("complete this ordered query ladder before switching products or source families")
  expect(skill).toContain("Candidate generation is recall-first")
  expect(skill).toContain("exactly one minimal discriminative source-owned entity")
  expect(skill).toContain("cannot justify a source-family switch")
  expect(skill).toContain("makes every earlier result with no applicable match for that unresolved fact provisional")
  expect(skill).toContain("Only after the minimal anchor and every admitted eligible anchor")
  expect(skill).toContain("completed contract-valid candidate inspection with no applicable match")
  expect(skill).toContain("candidates excluded by explicit identity, content, recency, or applicability evidence")
  expect(skill).toContain("does not reopen a route or service already closed by typed unavailability")
  expect(skill).toContain("do not add the destination organization, channel, audience")
  expect(skill).toContain("independently established as source-owned or contract-required scope")
  expect(skill).toContain("only when the request or an observed record identifies a formal policy/document dependency")
  expect(skill).toContain("cannot replace a missing minimal-anchor read")
  expect(skill).toContain("contract-required namespace, tenant, repository, mode, projection, and pagination controls")
  expect(skill).toContain("A compound or full-phrase empty query does not consume the endpoint attempt")
  expect(skill).toContain("Resolve anchor-producing identity or detail facts before dependent rule")
  expect(skill).toContain("admit it only when that authority identifies it as the requested entity's ID")
  expect(skill).toContain("ignore incidental people, events, accounts, and records")
  expect(skill).toContain("Try each fact, endpoint, and eligible anchor combination at most once")
  expect(skill).toContain("This finite evidence worklist is bounded by material facts")
  expect(skill).toContain("When an exact identity filter is sufficient")
  expect(skill).toContain("honor contract-declared mode, field projection, sorting, and pagination semantics")
  expect(skill).toContain("make one minimal exact-filter read")
  expect(skill).toContain("A current authoritative operational record that gives concrete do/don't rules")
  expect(skill).toContain("Treat those abstract words as coverage labels, not separate facts")
  expect(skill).toContain("retaining a duplicate missing-guidelines or missing-policy checklist item")
  expect(skill).toContain("A first client call-shape, argument-validation, or contract `TypeError` proves only")
  expect(skill).toContain("If the corrected contract-valid call returns the same external/interface failure")
  expect(skill).toContain("map the original obligation to the source record, the concrete rule")
  expect(skill).toContain("process, approval, and historical rules require their own corresponding execution evidence")
  expect(skill).toContain("a record references a required dependency")
  expect(skill).toContain("record the exact minimal-anchor and later eligible-anchor reads")
  expect(skill).toContain("their typed outcome or candidate count")
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
  expect(skill).toContain(
    "only when the discovered API contract defines the successful response as a synchronous commit",
  )
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
  expect(request).toContain("For panel_create_task.request it copies the contiguous child-Task authority block")
  expect(request).toContain("The Host validates byte provenance")
  expect(request).toContain("materially depends on client-contract content absent from visible evidence")
  expect(request).toContain("load the exact named Skill directly without capability discovery")
  expect(request).toContain("new evidence-backed acceptance gap derived from the original request")
  expect(request).toContain(
    "without a heading, delegation note, paraphrase, source prerequisite, destination representation field",
  )
  expect(request).toContain("independent verification does not require a second API projection for every fact")
  expect(request).toContain("process, approval, historical, referenced-policy, incomplete-coverage")
  expect(request).toContain("already exhausted discovery are truthful limitations rather than reasons to repeat work")
  expect(request.match(/^SYSTEM:/gm)).toHaveLength(1)
  expect(request.match(/^USER:/gm)).toHaveLength(1)
  const childRequest = request.slice(request.lastIndexOf("This is an AutomationBench API-mode evaluation"))
  expect(childRequest).toBe(
    [
      "This is an AutomationBench API-mode evaluation. The simulated business end state is the only scored deliverable.",
      'The visible directive `@skill("automationbench-api")` is mandatory for every child worker that uses the benchmark client: require the real `skill` Tool call before the first client call, then use only the project-local client for benchmark operations. Capability discovery or reading the Skill file does not load it.',
      "SYSTEM:\nOperate safely. ",
      "USER:\nPerform the business operation.",
      "END OF AUTOMATIONBENCH CHILD TASK AUTHORITY.",
    ].join("\n\n"),
  )
})
